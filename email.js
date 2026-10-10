const whatsapp=require('./whatsapp');
function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
async function sendTicketEmail(booking){
 const apiKey=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;
 if(!apiKey||!from)throw new Error('Email service is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL in Railway Variables.');
 const pdf=await whatsapp.ticketPdfBuffer(booking);
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({
  from,to:[booking.email],subject:'Your FANTASTIC GARBA रास-रंग 18 ticket - '+booking.booking_id,
  html:'<div style="font-family:Arial,sans-serif;line-height:1.6;color:#21152a"><h2>Your Garba ticket is ready!</h2><p>Thank you for booking with FANTASTIC Events.</p><p><b>Booking ID:</b> '+escapeHtml(booking.booking_id)+'<br><b>Name:</b> '+escapeHtml(booking.holder_name)+'<br><b>Pass:</b> '+escapeHtml(booking.pass_type)+'<br><b>Quantity:</b> '+Number(booking.quantity)+'</p><p>Your ticket PDF is attached to this email. Keep it safe and bring it to the event.</p><p><b>GARBA रास-रंग 18</b><br>19 October 2026 · Kesar Garh Haveli, Kacholiya Road, Chomu · 5 PM ONWARDS</p><p>If you lose your ticket, recover it at <a href="https://www.fantasticevents.in/recover-ticket.html">Recover My Ticket</a>.</p></div>',
  text:'Your FANTASTIC GARBA रास-रंग 18 ticket is attached. Booking ID: '+booking.booking_id+'. Name: '+booking.holder_name+'. Pass: '+booking.pass_type+'. Quantity: '+booking.quantity+'. Recover ticket: https://www.fantasticevents.in/recover-ticket.html',
  attachments:[{filename:booking.booking_id+'.pdf',content:pdf.toString('base64')}]
 })});
 const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.message||data?.error||'Email provider rejected the ticket email.');return true;
}
module.exports={sendTicketEmail};
