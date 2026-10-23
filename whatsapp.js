const PDFDocument=require('pdfkit');
const QRCode=require('qrcode');
const path=require('path');

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
  const data=await QRCode.toDataURL(verify,{margin:1,width:320,errorCorrectionLevel:'H'});
  const qr=Buffer.from(data.split(',')[1],'base64');
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:[900,600],margin:0,compress:true});
    const chunks=[];
    doc.on('data',c=>chunks.push(c));
    doc.on('end',()=>resolve(Buffer.concat(chunks)));
    doc.on('error',reject);
    const W=900,H=600;
    const posterPath=path.join(__dirname,'WhatsApp Image 2026-10-21 at 9.15.57 PM (1).jpeg');
    try { doc.image(posterPath,0,0,{width:W,height:H}); } catch(e) { doc.rect(0,0,W,H).fill('#160c25'); }

    // Clean, intentional ticket layout: preserve the poster as the full-bleed background,
    // while giving all variable details and the QR code their own readable panels.
    doc.rect(14,14,W-28,H-28).lineWidth(4).strokeColor('#f4c84a').stroke();
    doc.roundedRect(34,34,832,62,14).fill('#35105c');
    doc.fillColor('#f9d96b').font('Helvetica-Bold').fontSize(25).text('FANTASTIC  |  ENTRY PASS',56,52,{width:490});
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text('6:00 PM ONWARDS',570,57,{width:270,align:'right'});

    // Holder details panel on the left: opaque enough for contrast, not a full-page wash.
    doc.roundedRect(36,116,520,332,18).fillOpacity(0.90).fill('#25103f').fillOpacity(1);
    doc.roundedRect(36,116,520,332,18).lineWidth(2).strokeColor('#f1c64b').stroke();
    doc.fillColor('#f9d96b').font('Helvetica-Bold').fontSize(12).text('PASS HOLDER',62,142);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(27).text(String(booking.holder_name||'Guest'),62,164,{width:465,height:66, ellipsis:true});
    doc.moveTo(62,226).lineTo(526,226).lineWidth(1).strokeColor('#745b8d').stroke();
    doc.fillColor('#d9c9ef').font('Helvetica-Bold').fontSize(12).text('PASS TYPE',62,246);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text(String(booking.pass_type||'Entry Pass'),62,267,{width:455,height:42,ellipsis:true});
    doc.fillColor('#d9c9ef').font('Helvetica-Bold').fontSize(12).text('QUANTITY',62,322);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text(String(booking.quantity),62,343);
    doc.moveTo(62,380).lineTo(526,380).lineWidth(1).strokeColor('#745b8d').stroke();
    doc.fillColor('#f9d96b').font('Helvetica-Bold').fontSize(11).text('BOOKING / PASS ID',62,397);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(String(booking.booking_id),62,416,{width:455,height:24,ellipsis:true});

    // QR is isolated on the right and never overlaps holder information.
    doc.roundedRect(592,116,272,332,18).fillOpacity(0.96).fill('#35105c').fillOpacity(1);
    doc.roundedRect(592,116,272,332,18).lineWidth(2).strokeColor('#f1c64b').stroke();
    doc.fillColor('#f9d96b').font('Helvetica-Bold').fontSize(17).text('SCAN TO VERIFY',610,139,{width:236,align:'center'});
    doc.roundedRect(638,174,180,180,10).fill('#ffffff');
    doc.image(qr,648,184,{fit:[160,160]});
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('UNIQUE ENTRY QR',610,370,{width:236,align:'center'});
    doc.fillColor('#e7d9f3').font('Helvetica').fontSize(10).text('Keep this pass ready at the entry gate.',610,390,{width:236,align:'center'});
    doc.fillColor('#35105c').font('Helvetica-Bold').fontSize(12).text('GARBA RAAS-RANG 18',0,478,{width:W,align:'center'});
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text('26 OCTOBER 2026  |  KESARGARH HAWELI, CHOMU',0,498,{width:W,align:'center'});
    doc.fillColor('#ffffff').font('Helvetica').fontSize(10).text('Valid only for the pass type and quantity shown. Entry is subject to QR verification.',0,520,{width:W,align:'center'});
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
  const match=text.match(/\bFAN[A-Z0-9]{8,20}\b/i);
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