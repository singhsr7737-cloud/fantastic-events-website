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
  const data=await QRCode.toDataURL(verify,{margin:1,width:220});
  const qr=Buffer.from(data.split(',')[1],'base64');
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:0});
    const chunks=[];
    doc.on('data',c=>chunks.push(c));
    doc.on('end',()=>resolve(Buffer.concat(chunks)));
    doc.on('error',reject);

    const W=doc.page.width, H=doc.page.height;
    // Warm, colourful page background
    doc.rect(0,0,W,H).fill('#fff4e8');
    // Soft decorative corner shapes
    doc.circle(W-18,40,95).fill('#ffe0a8');
    doc.circle(8,H-20,105).fill('#f7c7e5');

    // Main pass card and shadow
    const x=35,y=58,w=W-70,h=H-116;
    doc.roundedRect(x+3,y+5,w,h,22).fill('#e4d7e8');
    doc.roundedRect(x,y,w,h,22).fill('#ffffff');

    // Colourful header band
    doc.roundedRect(x,y,w,230,22).fill('#55218a');
    doc.rect(x,y+205,w,25).fill('#55218a');
    doc.rect(x,y+212,w,18).fill('#f05b48');
    doc.circle(x+w-18,y+25,70).fill('#7d42b3');
    doc.circle(x+w-18,y+25,45).fill('#f6b83f');

    doc.fillColor('#ffe5a6').font('Helvetica-Bold').fontSize(12)
      .text('FANTASTIC EVENTS',x+28,y+25,{characterSpacing:1.2});
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(27)
      .text('GARBA',x+28,y+65);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22)
      .text('RAAS-RANG-18',x+28,y+99);
    doc.fillColor('#ffe5a6').font('Helvetica-Bold').fontSize(13)
      .text('OFFICIAL ENTRY PASS',x+28,y+143);
    doc.fillColor('#ffffff').font('Helvetica').fontSize(10)
      .text('LIVE GARBA  •  DANDIYA  •  MUSIC  •  FOOD',x+28,y+177,{width:w-56});

    // Event information strip
    doc.roundedRect(x+22,y+250,w-44,76,12).fill('#fff0cf');
    doc.fillColor('#55218a').font('Helvetica-Bold').fontSize(15)
      .text('19 OCTOBER 2026',x+36,y+264);
    doc.fillColor('#493b50').font('Helvetica').fontSize(11)
      .text('Kesargarh Haweli, Chomu',x+36,y+287);
    doc.fillColor('#493b50').font('Helvetica-Bold').fontSize(11)
      .text('5:00 PM – 11:00 PM',x+36,y+304);

    // Pass details
    const left=x+28, right=x+w-190;
    doc.fillColor('#8a7c91').font('Helvetica-Bold').fontSize(9).text('PASS TYPE',left,y+355);
    doc.fillColor('#2c2034').font('Helvetica-Bold').fontSize(17)
      .text(String(booking.pass_type||'Entry Pass'),left,y+372,{width:285});
    doc.fillColor('#8a7c91').font('Helvetica-Bold').fontSize(9).text('QUANTITY',left,y+420);
    doc.fillColor('#2c2034').font('Helvetica-Bold').fontSize(17)
      .text(String(booking.quantity),left,y+437);
    doc.fillColor('#8a7c91').font('Helvetica-Bold').fontSize(9).text('PASS HOLDER',left,y+480);
    doc.fillColor('#2c2034').font('Helvetica-Bold').fontSize(15)
      .text(String(booking.holder_name||'Guest'),left,y+497,{width:300});
    doc.fillColor('#8a7c91').font('Helvetica-Bold').fontSize(9).text('BOOKING ID',left,y+543);
    doc.fillColor('#f05b48').font('Helvetica-Bold').fontSize(16)
      .text(String(booking.booking_id),left,y+560);

    // QR verification panel
    const qx=x+w-164,qy=y+365;
    doc.roundedRect(qx-10,qy-10,132,160,12).fill('#f5edfa');
    doc.image(qr,qx,qy,{fit:[112,112]});
    doc.fillColor('#55218a').font('Helvetica-Bold').fontSize(9)
      .text('SCAN TO VERIFY',qx-2,qy+119,{width:116,align:'center'});

    // Footer
    doc.moveTo(x+24,y+h-65).lineTo(x+w-24,y+h-65).lineWidth(1).strokeColor('#eadfed').stroke();
    doc.fillColor('#55218a').font('Helvetica-Bold').fontSize(10)
      .text('KEEP THIS PASS READY AT THE ENTRY GATE',x+22,y+h-50,{width:w-44,align:'center'});
    doc.fillColor('#76677d').font('Helvetica').fontSize(8)
      .text('Please show this QR code to the event team for ticket verification.',x+22,y+h-31,{width:w-44,align:'center'});
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