const PDFDocument=require('pdfkit');
const QRCode=require('qrcode');

function json(res,status,data){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}
function baseUrl(){
  return String(process.env.PUBLIC_BASE_URL||'https://www.fantasticevents.in').replace(/\/$/,'');
}
function normalizePhone(value){
  const d=String(value||'').replace(/\D/g,'');
  return d.length>=10?d.slice(-10):d;
}
async function graph(payload){
  const token=process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId=process.env.WHATSAPP_PHONE_NUMBER_ID||'1238458526026805';
  const version=process.env.WHATSAPP_GRAPH_VERSION||'v23.0';
  if(!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not configured');
  const response=await fetch('https://graph.facebook.com/'+version+'/'+phoneId+'/messages',{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||'WhatsApp API request failed');
  return data;
}
async function sendText(to,body){
  return graph({messaging_product:'whatsapp',to,type:'text',text:{preview_url:false,body}});
}
async function ticketPdfBuffer(booking){
  const verify=baseUrl()+'/api/verify-ticket?id='+encodeURIComponent(booking.booking_id);
  const data=await QRCode.toDataURL(verify,{margin:1,width:180});
  const qr=Buffer.from(data.split(',')[1],'base64');
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:42});
    const chunks=[];
    doc.on('data',c=>chunks.push(c));
    doc.on('end',()=>resolve(Buffer.concat(chunks)));
    doc.on('error',reject);
    doc.fillColor('#7a3db8').fontSize(12).text('FANTASTIC',{align:'right'});
    doc.moveDown(1).fillColor('#171018').fontSize(28).text('GARBA RAAS-RANG-18',{align:'center'});
    doc.moveDown(.3).fontSize(16).text('ENTRY PASS',{align:'center'});
    doc.moveDown(1).fontSize(11).text('19 OCTOBER 2026 | KESARGARH HAWELI, CHOMU | 5:00 PM - 11:00 PM',{align:'center'});
    doc.moveDown(1.2).fontSize(12).text('PASS TYPE');doc.fontSize(18).text(booking.pass_type);
    doc.moveDown(.4).fontSize(12).text('QUANTITY');doc.fontSize(18).text(String(booking.quantity));
    doc.moveDown(.4).fontSize(12).text('HOLDER');doc.fontSize(18).text(booking.holder_name);
    doc.moveDown(.4).fontSize(12).text('BOOKING ID');doc.fontSize(18).text(booking.booking_id);
    doc.moveDown(1).image(qr,{fit:[140,140],align:'center'});
    doc.moveDown(.4).fontSize(9).fillColor('#555').text('Scan the QR code to verify this ticket.',{align:'center'});
    doc.moveDown(1).fillColor('#171018').fontSize(10).text('LIVE GARBA & DANDIYA | DJ & LIVE MUSIC | FOOD COURTS',{align:'center'});
    doc.end();
  });
}
async function sendTicket(to,booking){
  const url=baseUrl()+'/api/ticket-pdf?id='+encodeURIComponent(booking.booking_id);
  await sendText(to,'Your FANTASTIC Garba Raas-Rang-18 booking is confirmed.\n\nBooking ID: '+booking.booking_id+'\nPass: '+booking.pass_type+'\nQuantity: '+booking.quantity+'\n\nYour ticket PDF is attached below.');
  return graph({messaging_product:'whatsapp',to,type:'document',document:{link:url,filename:booking.booking_id+'.pdf',caption:'GARBA RAAS-RANG-18 Entry Pass'}});
}
async function handleIncoming(body,pool){
  if(!pool) return;
  const value=body?.entry?.[0]?.changes?.[0]?.value;
  const message=value?.messages?.[0];
  if(!message?.from||message.type!=='text') return;
  const from=normalizePhone(message.from);
  const text=String(message.text?.body||'').trim();
  const match=text.match(/\bFAN\d{6,12}\b/i);
  let result;
  if(match){
    result=await pool.query('SELECT booking_id,holder_name,phone,pass_type,quantity FROM garba_bookings WHERE booking_id=$1 AND RIGHT(phone,10)=$2 LIMIT 1',[match[0].toUpperCase(),from]);
  }else if(/^(ticket|pass|my ticket|send ticket)$/i.test(text)){
    result=await pool.query('SELECT booking_id,holder_name,phone,pass_type,quantity FROM garba_bookings WHERE RIGHT(phone,10)=$1 ORDER BY created_at DESC LIMIT 1',[from]);
  }else{
    await sendText(message.from,'Hi! Reply TICKET or send your Booking ID to receive your FANTASTIC Garba ticket.');
    return;
  }
  if(!result.rowCount){
    await sendText(message.from,'No matching booking found for this WhatsApp number. Please send the Booking ID used at checkout or contact +91 9929692498.');
    return;
  }
  await sendTicket(message.from,result.rows[0]);
}
async function webhook(req,res,pool){
  if(req.method==='GET'){
    const u=new URL(req.url,'http://localhost');
    if(u.searchParams.get('hub.mode')==='subscribe'&&u.searchParams.get('hub.verify_token')===process.env.WHATSAPP_VERIFY_TOKEN){
      res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});
      return res.end(u.searchParams.get('hub.challenge')||'');
    }
    return res.writeHead(403),res.end('Forbidden');
  }
  if(req.method==='POST'){
    let body={};
    try{let raw='';for await(const chunk of req)raw+=chunk;body=JSON.parse(raw||'{}');}catch(e){}
    handleIncoming(body,pool).catch(e=>console.error('WhatsApp ticket error:',e.message));
    return json(res,200,{received:true});
  }
  return res.writeHead(405),res.end('Method Not Allowed');
}
async function pdf(req,res,pool){
  try{
    if(!pool)return res.writeHead(503),res.end('Booking database is not configured.');
    const u=new URL(req.url,'http://localhost');const id=u.searchParams.get('id');
    if(!id)return res.writeHead(400),res.end('Ticket ID required.');
    const result=await pool.query('SELECT booking_id,holder_name,pass_type,quantity FROM garba_bookings WHERE booking_id=$1 LIMIT 1',[id]);
    if(!result.rowCount)return res.writeHead(404),res.end('Ticket not found.');
    const buffer=await ticketPdfBuffer(result.rows[0]);
    res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':buffer.length,'Cache-Control':'no-store'});
    res.end(buffer);
  }catch(e){console.error('Ticket PDF error:',e.message);res.writeHead(500);res.end('Unable to generate ticket.');}
}
module.exports={webhook,pdf,ticketPdfBuffer};