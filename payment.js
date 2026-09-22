const bookingModal=document.getElementById('booking');
const openBooking=document.getElementById('openBooking');
const closeBooking=document.getElementById('closeBooking');
const ticketOptions=document.querySelectorAll('.ticket-option');
const selectedTicketEl=document.getElementById('selectedTicket');
const ticketQtyEl=document.getElementById('ticketQty');
const ticketTotalEl=document.getElementById('ticketTotal');
const bookingForm=document.getElementById('bookingForm');
const statusEl=document.getElementById('bookingStatus');
let selectedTicket={name:'Single Female Pass',price:299};
let ticketQty=1;
function updateTicketUI(){const total=selectedTicket.price*ticketQty;selectedTicketEl.textContent=selectedTicket.name;ticketQtyEl.textContent=ticketQty;ticketTotalEl.textContent='₹'+total.toLocaleString('en-IN');}
function closeTicketModal(){bookingModal.classList.remove('open');bookingModal.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');}
openBooking.addEventListener('click',e=>{e.preventDefault();bookingModal.classList.add('open');bookingModal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');statusEl.hidden=true;updateTicketUI();});
closeBooking.addEventListener('click',closeTicketModal);
document.querySelector('[data-close-booking]').addEventListener('click',closeTicketModal);
ticketOptions.forEach(btn=>btn.addEventListener('click',()=>{ticketOptions.forEach(b=>b.classList.remove('active'));btn.classList.add('active');selectedTicket={name:btn.dataset.name,price:Number(btn.dataset.price)};ticketQty=1;updateTicketUI();}));
document.getElementById('minusTicket').addEventListener('click',()=>{ticketQty=Math.max(1,ticketQty-1);updateTicketUI();});
document.getElementById('plusTicket').addEventListener('click',()=>{ticketQty=Math.min(10,ticketQty+1);updateTicketUI();});
bookingForm.addEventListener('submit',async e=>{e.preventDefault();statusEl.hidden=false;statusEl.textContent='Creating secure payment…';const name=document.getElementById('customerName').value.trim();const phone=document.getElementById('customerPhone').value.trim();const email=document.getElementById('customerEmail').value.trim();try{const response=await fetch('/api/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,email,ticket:selectedTicket.name,quantity:ticketQty})});const data=await response.json();if(!response.ok)throw new Error(data.detail ? data.error+' '+data.detail : (data.error||'Unable to start payment.'));const options={key:data.keyId,amount:data.amount,currency:'INR',name:'FANTASTIC Events',description:'GARBA RAAS-RANG-18 - '+selectedTicket.name,order_id:data.orderId,prefill:{name,email,contact:'+91'+phone},theme:{color:'#b86cff'},handler:async function(payment){statusEl.textContent='Verifying payment…';const verify=await fetch('/api/verify-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({razorpay_order_id:payment.razorpay_order_id,razorpay_payment_id:payment.razorpay_payment_id,razorpay_signature:payment.razorpay_signature,name,phone,email,ticket:selectedTicket.name,quantity:ticketQty})});const result=await verify.json();if(!verify.ok||!result.success)throw new Error(result.error||'Payment verification failed.');statusEl.textContent='Payment successful! Booking ID: '+result.bookingId;showDigitalTicket({bookingId:result.bookingId,name,ticket:selectedTicket.name,quantity:ticketQty});bookingForm.reset();},modal:{ondismiss:function(){statusEl.textContent='Payment window closed. You can try again.';}}};const checkout=new Razorpay(options);checkout.on('payment.failed',function(){statusEl.textContent='Payment failed or was cancelled. Please try again.';});checkout.open();}catch(err){statusEl.textContent=err.message;}});
function showDigitalTicket(data){
  document.getElementById('passType').textContent=data.ticket;
  document.getElementById('passQty').textContent=data.quantity;
  document.getElementById('passHolder').textContent=data.name;
  document.getElementById('passId').textContent=data.bookingId;
  const qr=document.getElementById('ticketQr'); qr.innerHTML='';
  if(window.QRCode)new QRCode(qr,{text:'FANTASTIC|GARBA RAAS-RANG-18|'+data.bookingId+'|'+data.ticket+'|'+data.quantity,width:120,height:120,colorDark:'#171018',colorLight:'#ffffff'});
  const modal=document.getElementById('ticketPass');modal.classList.add('open');modal.setAttribute('aria-hidden','false');
}
function closeDigitalTicket(){const m=document.getElementById('ticketPass');m.classList.remove('open');m.setAttribute('aria-hidden','true');}
document.getElementById('closeTicket').addEventListener('click',closeDigitalTicket);
document.getElementById('doneTicket').addEventListener('click',closeDigitalTicket);
document.querySelector('[data-close-ticket]').addEventListener('click',closeDigitalTicket);
document.getElementById('printTicket').addEventListener('click',()=>window.print());

document.getElementById('emailTicket').addEventListener('click',()=>{const email=document.getElementById('customerEmail').value.trim();const id=document.getElementById('passId').textContent;const subject='GARBA रास-रंग 18 Booking Confirmation - '+id;const body='Booking ID: '+id+'\nHolder: '+document.getElementById('passHolder').textContent+'\nPass: '+document.getElementById('passType').textContent+'\nQuantity: '+document.getElementById('passQty').textContent+'\nDate: 19 October 2026\nVenue: Kesargarh Haweli, Chomu\nTime: 5:00 PM - 11:00 PM\n\nPlease keep your digital pass for entry.';window.location.href='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);});
function openWhatsAppTicket(){
 const id=document.getElementById('passId').textContent.trim();
 const holder=document.getElementById('passHolder').textContent.trim();
 const type=document.getElementById('passType').textContent.trim();
 const qty=document.getElementById('passQty').textContent.trim();
 const phoneInput=document.getElementById('customerPhone');
 const customerPhone=(phoneInput&&phoneInput.value||'').replace(/\D/g,'');
 const target=customerPhone.length===10?'91'+customerPhone:'919929692498';
 const message='Hello FANTASTIC Events, my GARBA Raas-Rang 18 booking is confirmed.\n\nBooking ID: '+id+'\nHolder: '+holder+'\nPass: '+type+'\nQuantity: '+qty+'\nDate: 19 October 2026\nVenue: Kesargarh Haweli, Chomu\nTime: 5:00 PM - 11:00 PM';
 window.open('https://wa.me/'+target+'?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
}
document.getElementById('whatsappTicket').addEventListener('click',openWhatsAppTicket);
