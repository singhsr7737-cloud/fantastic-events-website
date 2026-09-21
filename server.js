const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const Razorpay=require('razorpay');
const root=__dirname;
const port=process.env.PORT||3000;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.mov':'video/quicktime','.ico':'image/x-icon'};
const prices={'Individual Pass':499,'Couple Pass':999,'VIP Pass':1999};
const razorpay=()=>new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET});
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function readBody(req){return new Promise((resolve,reject)=>{let body='';req.on('data',c=>{body+=c;if(body.length>100000)req.destroy();});req.on('end',()=>{try{resolve(JSON.parse(body||'{}'));}catch(e){reject(e);}});req.on('error',reject);});}
async function api(req,res){
 if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET)return json(res,500,{error:'Payment gateway is not configured yet.'});
 if(req.method==='POST'&&req.url==='/api/create-order'){
  try{const d=await readBody(req);const price=prices[d.ticket];const name=String(d.name||'').trim();const phone=String(d.phone||'').trim();const email=String(d.email||'').trim();if(!name||name.length>80||!/^[0-9]{10}$/.test(phone)||!email||email.length>120||!price)return json(res,400,{error:'Please enter valid booking details.'});const quantity=d.ticket==='VIP Pass'?1:Math.min(10,Math.max(1,Number(d.quantity)||1));const order=await razorpay().orders.create({amount:price*quantity*100,currency:'INR',receipt:'FAN'+Date.now().toString().slice(-10),notes:{event:'GARBA RAAS-RANG-18',ticket:d.ticket,quantity:String(quantity),phone}});return json(res,200,{keyId:process.env.RAZORPAY_KEY_ID,orderId:order.id,amount:order.amount});}
  catch(e){const detail=e&&e.error&&e.error.description?e.error.description:(e&&e.message?e.message:'Unknown Razorpay error');console.error('Razorpay order error:',detail);return json(res,500,{error:'Unable to create payment order.',detail});}
 }
 if(req.method==='POST'&&req.url==='/api/verify-payment'){
  try{const d=await readBody(req);if(!d.razorpay_order_id||!d.razorpay_payment_id||!d.razorpay_signature)return json(res,400,{error:'Incomplete payment response.'});const expected=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update(d.razorpay_order_id+'|'+d.razorpay_payment_id).digest('hex');if(expected!==d.razorpay_signature)return json(res,400,{error:'Payment verification failed.'});return json(res,200,{success:true,bookingId:'FAN'+Date.now().toString().slice(-8)});}
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
server.listen(port,'0.0.0.0',()=>console.log('FANTASTIC website listening on port '+port));