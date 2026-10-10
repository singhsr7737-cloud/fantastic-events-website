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
    // Simple cream background, thin purple-and-gold frame
    doc.rect(0,0,W,H).fill('#fffaf0');
    doc.rect(0,0,W,10).fill('#40106f');
    doc.rect(0,10,W,3).fill('#e8ad22');
    doc.rect(0,H-13,W,10).fill('#40106f');
    doc.rect(0,H-16,W,3).fill('#e8ad22');

    // Company logo at the very top
    try {
      doc.image(path.join(__dirname,'logo.png'),365,20,{fit:[170,56],align:'center',valign:'center'});
    } catch(e) {
      doc.fillColor('#40106f').font('Helvetica-Bold').fontSize(23).text('FANTASTIK',300,31,{width:300,align:'center'});
      doc.fillColor('#40106f').font('Helvetica').fontSize(9).text('Events \'N\' Wedding Planner',300,57,{width:300,align:'center'});
    }

    // Preserve the original event logo artwork without redrawing its text
    try {
      doc.image(path.join(__dirname,'file_00000000b1708211b93191b401dbc8cc.png'),270,82,{fit:[360,148],align:'center',valign:'center'});
    } catch(e) {
      doc.fillColor('#40106f').font('Helvetica-Bold').fontSize(25).text('GARBA रास-रंग 18',220,120,{width:460,align:'center'});
    }

    // Simple pass heading and time (date/venue are already on the supplied event logo)
    doc.roundedRect(28,238,844,44,12).fill('#40106f');
    doc.fillColor('#f9d96b').font('Helvetica-Bold').fontSize(18).text('OFFICIAL ENTRY PASS',48,250);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text('5 PM ONWARDS',570,250,{width:278,align:'right'});

    // Customer-specific pass details
    doc.roundedRect(28,298,520,204,14).lineWidth(1.5).strokeColor('#e8ad22').stroke();
    doc.fillColor('#7a6687').font('Helvetica-Bold').fontSize(10).text('PASS HOLDER',48,316);
    doc.fillColor('#24152e').font('Helvetica-Bold').fontSize(22).text(String(booking.holder_name||'Guest'),48,333,{width:465});
    doc.moveTo(48,369).lineTo(525,369).lineWidth(1).strokeColor('#e8d9b7').stroke();
    doc.fillColor('#7a6687').font('Helvetica-Bold').fontSize(10).text('PASS TYPE',48,384);
    doc.fillColor('#24152e').font('Helvetica-Bold').fontSize(17).text(String(booking.pass_type||'Entry Pass'),48,401,{width:300});
    doc.fillColor('#7a6687').font('Helvetica-Bold').fontSize(10).text('QUANTITY',365,384);
    doc.fillColor('#24152e').font('Helvetica-Bold').fontSize(17).text(String(booking.quantity),365,401);
    doc.moveTo(48,433).lineTo(525,433).lineWidth(1).strokeColor('#e8d9b7').stroke();
    doc.fillColor('#7a6687').font('Helvetica-Bold').fontSize(10).text('UNIQUE BOOKING ID',48,447);
    doc.fillColor('#d94732').font('Helvetica-Bold').fontSize(17).text(String(booking.booking_id),48,464,{width:465});
    doc.fillColor('#5c4b63').font('Helvetica').fontSize(9).text('Keep this pass ready and show it at the entry gate.',48,485,{width:465});

    // QR is unique to this booking and points to the live verification endpoint
    doc.roundedRect(570,298,302,204,14).fill('#40106f');
    doc.fillColor('#f9d96b').font('Helvetica-Bold').fontSize(17).text('SCAN TO VERIFY',590,311,{width:262,align:'center'});
    doc.roundedRect(655,338,132,132,8).fill('#ffffff');
    doc.image(qr,663,346,{fit:[116,116]});
    doc.fillColor('#ffffff').font('Helvetica').fontSize(9).text('Unique QR · One-time entry check',590,478,{width:262,align:'center'});

    // Contact numbers at the bottom
    doc.fillColor('#40106f').font('Helvetica-Bold').fontSize(12).text('FOR QUERIES:  9929692498  |  9509566606',0,530,{width:W,align:'center'});
    doc.fillColor('#786b7d').font('Helvetica').fontSize(9).text('Valid only for the pass type and quantity shown. Entry is subject to QR verification.',0,551,{width:W,align:'center'});
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