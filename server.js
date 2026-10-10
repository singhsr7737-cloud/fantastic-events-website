const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const Razorpay=require('razorpay');
const {Pool}=require('pg');
const whatsapp=require('./whatsapp');
const ticketEmail=require('./email');
const root=__dirname;
const port=process.env.PORT||3000;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.mov':'video/quicktime','.ico':'image/x-icon'};
const prices={'Single Female Pass':299,'Couple Pass':499,'Family Pass':799};
const razorpay=()=>new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET});
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}):null;
async function initDb(){if(!pool)return;await pool.query(`CREATE TABLE IF NOT EXISTS garba_bookings (booking_id TEXT PRIMARY KEY, payment_id TEXT UNIQUE NOT NULL, order_id TEXT NOT NULL, holder_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, pass_type TEXT NOT NULL, quantity INTEGER NOT NULL, amount INTEGER NOT NULL, used_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);}
async function logWhatsAppPhoneStatus(){
 try{
  const token=process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId=process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version=process.env.WHATSAPP_GRAPH_VERSION||'v23.0';
  if(!token||!phoneId)return;
  const r=await fetch('https://graph.facebook.com/'+version+'/'+phoneId+'?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,platform_type',{
   headers:{Authorization:'Bearer '+token}
  });
  const d=await r.json().catch(()=>({}));
  console.log('WhatsApp phone status:',JSON.stringify({
   httpStatus:r.status,
   id:d.id,
   display_phone_number:d.display_phone_number,
   verified_name:d.verified_name,
   code_verification_status:d.code_verification_status,
   quality_rating:d.quality_rating,
   platform_type:d.platform_type,
   error:d.error?.message||null
  }));
 }catch(e){console.error('WhatsApp phone status check error:',e.message);}
}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function readBody(req){return new Promise((resolve,reject)=>{let body='';req.on('data',c=>{body+=c;if(body.length>100000)req.destroy();});req.on('end',()=>{try{resolve(JSON.parse(body||'{}'));}catch(e){reject(e);}});req.on('error',reject);});}
async function handleWhatsAppEmbeddedSignup(req,res){
  try{
    const body=await readBody(req);
    const code=String(body.code||'').trim();
    if(!code)return json(res,400,{error:'Missing Embedded Signup authorization code.'});
    if(process.env.ADMIN_PASSWORD && req.headers['x-admin-password']!==process.env.ADMIN_PASSWORD)return json(res,401,{error:'Unauthorized'});
    const appId=process.env.META_APP_ID||'1074711985340491';
    const appSecret=process.env.META_APP_SECRET;
    if(!appSecret)return json(res,503,{error:'META_APP_SECRET is not configured on Railway. Add it to Variables, then retry.'});
    const version=process.env.WHATSAPP_GRAPH_VERSION||'v23.0';
    const tokenUrl='https://graph.facebook.com/'+version+'/oauth/access_token?client_id='+encodeURIComponent(appId)+'&client_secret='+encodeURIComponent(appSecret)+'&code='+encodeURIComponent(code);
    const tokenResponse=await fetch(tokenUrl);
    const tokenData=await tokenResponse.json().catch(()=>({}));
    if(!tokenResponse.ok||!tokenData.access_token)throw new Error(tokenData?.error?.message||'Meta authorization code exchange failed.');
    const session=body.session||{};
    const wabaId=session.waba_id||session.wabaId||null;
    const phoneNumberId=session.phone_number_id||session.phoneNumberId||null;
    console.log('WhatsApp Embedded Signup completed:',JSON.stringify({wabaId,phoneNumberId,event:body.event||null,version:body.version||null,tokenReceived:true}));
    return json(res,200,{success:true,wabaId,phoneNumberId,tokenReceived:true,message:'Meta authorization completed. If WHATSAPP_ACCESS_TOKEN is still the old token, replace it with the customer/system-user token from this onboarding before sending API messages.'});
  }catch(e){
    console.error('WhatsApp Embedded Signup error:',e.message);
    return json(res,500,{error:e.message||'Unable to finalize WhatsApp Embedded Signup.'});
  }
}
async function handleWhatsAppWebhook(req,res){
 return whatsapp.webhook(req,res,pool);
}

async function api(req,res){
 if(req.url&&req.url.startsWith('/api/whatsapp/webhook'))return handleWhatsAppWebhook(req,res);
 if(req.method==='POST'&&req.url==='/api/whatsapp/embedded-signup')return handleWhatsAppEmbeddedSignup(req,res);
 if(req.method==='GET'&&req.url.startsWith('/api/ticket-pdf'))return whatsapp.pdf(req,res,pool);
 if(req.method==='POST'&&req.url==='/api/recover-ticket'){try{const d=await readBody(req);const lookup=String(d.lookup||'').trim();if(!lookup||lookup.length>120)return json(res,400,{error:'Please enter your registered mobile number or email address.'});if(!pool)return json(res,503,{error:'Booking database is not configured.'});if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)return json(res,503,{error:'Email service is not configured yet. Please contact FANTASTIC Events.'});let r;if(lookup.includes('@')){const email=lookup.toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return json(res,400,{error:'Please enter a valid email address or mobile number.'});r=await pool.query('SELECT booking_id,holder_name,email,pass_type,quantity FROM garba_bookings WHERE LOWER(email)=LOWER($1) ORDER BY created_at DESC LIMIT 10',[email]);}else{const phone=lookup.replace(/\D/g,'');if(!/^\d{10,13}$/.test(phone))return json(res,400,{error:'Please enter a valid registered mobile number or email address.'});const last10=phone.slice(-10);r=await pool.query("SELECT booking_id,holder_name,email,pass_type,quantity FROM garba_bookings WHERE RIGHT(regexp_replace(phone, '\\D', '', 'g'), 10)=$1 ORDER BY created_at DESC LIMIT 10",[last10]);}for(const booking of r.rows){await ticketEmail.sendTicketEmail(booking);}return json(res,200,{success:true,message:'If matching bookings are found, ticket PDFs will be sent to the registered email address(es). Please check Inbox and Spam.'});}catch(e){console.error('Ticket recovery error:',e.message);return json(res,500,{error:'Unable to send the ticket right now. Please contact FANTASTIC Events.'});}}
 if(req.method==='GET'&&req.url==='/api/payment-status')return json(res,200,{configured:!!(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET),keyIdPresent:!!process.env.RAZORPAY_KEY_ID,keyPrefix:process.env.RAZORPAY_KEY_ID?String(process.env.RAZORPAY_KEY_ID).slice(0,8):null,secretPresent:!!process.env.RAZORPAY_KEY_SECRET});
 if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET)return json(res,500,{error:'Payment gateway is not configured yet.'});
 if(req.method==='POST'&&req.url==='/api/create-order'){
  try{const d=await readBody(req);const price=prices[d.ticket];const name=String(d.name||'').trim();const phone=String(d.phone||'').trim();const email=String(d.email||'').trim();if(!name||name.length>80||!/^[0-9]{10}$/.test(phone)||!email||email.length>120||!price)return json(res,400,{error:'Please enter valid booking details.'});const quantity=Math.min(10,Math.max(1,Number(d.quantity)||1));const order=await razorpay().orders.create({amount:price*quantity*100,currency:'INR',receipt:'FAN'+Date.now().toString().slice(-10),notes:{event:'GARBA RAAS-RANG-18',ticket:d.ticket,quantity:String(quantity),phone}});return json(res,200,{keyId:process.env.RAZORPAY_KEY_ID,orderId:order.id,amount:order.amount});}
  catch(e){const detail=e&&e.error&&e.error.description?e.error.description:(e&&e.message?e.message:'Unknown Razorpay error');console.error('Razorpay order error:',detail);return json(res,500,{error:'Unable to create payment order.',detail});}
 }
 if(req.method==='GET'&&req.url.startsWith('/api/admin/bookings')){try{const adminPassword=process.env.ADMIN_PASSWORD;if(!adminPassword)return json(res,503,{error:'Admin password is not configured.'});if(req.headers['x-admin-password']!==adminPassword)return json(res,401,{error:'Unauthorized'});if(!pool)return json(res,500,{error:'Booking database is not configured.'});const r=await pool.query('SELECT booking_id,holder_name,phone,email,pass_type,quantity,amount,used_at,created_at FROM garba_bookings ORDER BY created_at DESC');return json(res,200,{bookings:r.rows});}catch(e){console.error('Admin bookings error:',e.message);return json(res,500,{error:'Unable to load bookings.'});}}
 if(req.method==='GET'&&req.url.startsWith('/api/verify-ticket')){try{if(!pool)return json(res,500,{error:'Booking database is not configured.'});const u=new URL(req.url,'http://localhost');const id=u.searchParams.get('id');if(!id)return json(res,400,{error:'Ticket ID required.'});const r=await pool.query('SELECT booking_id,holder_name,pass_type,quantity,used_at FROM garba_bookings WHERE booking_id=$1',[id]);if(!r.rowCount)return json(res,404,{valid:false,error:'Ticket not found.'});const b=r.rows[0];return json(res,200,{valid:true,bookingId:b.booking_id,holderName:b.holder_name,passType:b.pass_type,quantity:b.quantity,used:!!b.used_at,usedAt:b.used_at});}catch(e){return json(res,500,{error:'Verification error.'});}
 }
 if(req.method==='POST'&&req.url==='/api/use-ticket'){try{if(!pool)return json(res,500,{error:'Booking database is not configured.'});const d=await readBody(req);const r=await pool.query('UPDATE garba_bookings SET used_at=NOW() WHERE booking_id=$1 AND used_at IS NULL RETURNING booking_id,holder_name,pass_type,quantity,used_at',[String(d.bookingId||'')]);if(!r.rowCount)return json(res,409,{success:false,error:'Ticket is invalid or has already been used.'});return json(res,200,{success:true,...r.rows[0]});}catch(e){return json(res,500,{error:'Ticket validation error.'});}
 }
 if(req.method==='POST'&&req.url==='/api/verify-payment'){
  try{const d=await readBody(req);if(!d.razorpay_order_id||!d.razorpay_payment_id||!d.razorpay_signature)return json(res,400,{error:'Incomplete payment response.'});const expected=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update(d.razorpay_order_id+'|'+d.razorpay_payment_id).digest('hex');if(expected!==d.razorpay_signature)return json(res,400,{error:'Payment verification failed.'});const bookingId='FAN'+Date.now().toString().slice(-8);const amount=(prices[d.ticket]||0)*Math.min(10,Math.max(1,Number(d.quantity)||1));if(!pool)return json(res,500,{error:'Booking database is not configured.'});const booking={booking_id:bookingId,holder_name:String(d.name||'').trim(),phone:String(d.phone||'').trim(),email:String(d.email||'').trim(),pass_type:String(d.ticket||''),quantity:Math.min(10,Math.max(1,Number(d.quantity)||1)),amount};await pool.query('INSERT INTO garba_bookings (booking_id,payment_id,order_id,holder_name,phone,email,pass_type,quantity,amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',[bookingId,d.razorpay_payment_id,d.razorpay_order_id,booking.holder_name,booking.phone,booking.email,booking.pass_type,booking.quantity,amount]);let emailSent=false;if(process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL){try{await ticketEmail.sendTicketEmail(booking);emailSent=true;}catch(emailError){console.error('Automatic ticket email failed:',emailError.message);}}return json(res,200,{success:true,bookingId,emailSent});}
  catch(e){console.error('Payment verification error:',e.message);return json(res,500,{error:'Verification error. Please contact FANTASTIC.'});}
 }
 return json(res,404,{error:'Not found'});
}
function safePath(urlPath){const clean=decodeURIComponent(urlPath.split('?')[0]);const resolved=path.resolve(root,'.'+(clean==='/'?'/index.html':clean));return resolved.startsWith(root+path.sep)||resolved===path.join(root,'index.html')?resolved:null;}
const server=http.createServer(async(req,res)=>{
 if(req.url&&req.url.startsWith('/api/'))return api(req,res);
 const requestPath=req.url||'/';
 if(requestPath==='/garba'||requestPath==='/garba/')return res.writeHead(302,{Location:'/#garba'}),res.end();
 const filePath=safePath(requestPath);if(!filePath)return res.writeHead(403),res.end('Forbidden');
 fs.stat(filePath,(err,stat)=>{if(err||!stat.isFile()){const index=path.join(root,'index.html');return fs.readFile(index,(x,d)=>{if(x){res.writeHead(500);return res.end('Server error');}res.writeHead(200,{'Content-Type':types['.html']});res.end(d);});}fs.readFile(filePath,(x,d)=>{if(x){res.writeHead(500);return res.end('Server error');}const ext=path.extname(filePath).toLowerCase();res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=86400'});res.end(d);});});
});
initDb().then(()=>server.listen(port,'0.0.0.0',async()=>{console.log('FANTASTIC website listening on port '+port);await logWhatsAppPhoneStatus();})).catch(e=>{console.error('Database initialization failed:',e.message);server.listen(port,'0.0.0.0',async()=>{console.log('FANTASTIC website listening on port '+port);await logWhatsAppPhoneStatus();});});