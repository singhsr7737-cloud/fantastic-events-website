const bookingModal=document.getElementById('booking');
const openBooking=document.getElementById('openBooking');
const closeBooking=document.getElementById('closeBooking');
const ticketOptions=document.querySelectorAll('.ticket-option');
const selectedTicketEl=document.getElementById('selectedTicket');
const ticketQtyEl=document.getElementById('ticketQty');
const ticketTotalEl=document.getElementById('ticketTotal');
const bookingForm=document.getElementById('bookingForm');
const statusEl=document.getElementById('bookingStatus');
let selectedTicket={name:'Individual Pass',price:499};
let ticketQty=1;
function updateTicketUI(){const total=selectedTicket.price*ticketQty;selectedTicketEl.textContent=selectedTicket.name;ticketQtyEl.textContent=ticketQty;ticketTotalEl.textContent='₹'+total.toLocaleString('en-IN');}
function closeTicketModal(){bookingModal.classList.remove('open');bookingModal.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');}
openBooking.addEventListener('click',e=>{e.preventDefault();bookingModal.classList.add('open');bookingModal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');statusEl.hidden=true;updateTicketUI();});
closeBooking.addEventListener('click',closeTicketModal);
document.querySelector('[data-close-booking]').addEventListener('click',closeTicketModal);
ticketOptions.forEach(btn=>btn.addEventListener('click',()=>{ticketOptions.forEach(b=>b.classList.remove('active'));btn.classList.add('active');selectedTicket={name:btn.dataset.name,price:Number(btn.dataset.price)};ticketQty=1;updateTicketUI();}));
document.getElementById('minusTicket').addEventListener('click',()=>{ticketQty=Math.max(1,ticketQty-1);updateTicketUI();});
document.getElementById('plusTicket').addEventListener('click',()=>{if(selectedTicket.name!=='VIP Pass')ticketQty=Math.min(10,ticketQty+1);updateTicketUI();});
bookingForm.addEventListener('submit',async e=>{e.preventDefault();statusEl.hidden=false;statusEl.textContent='Creating secure payment…';const name=document.getElementById('customerName').value.trim();const phone=document.getElementById('customerPhone').value.trim();const email=document.getElementById('customerEmail').value.trim();try{const response=await fetch('/api/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,email,ticket:selectedTicket.name,quantity:ticketQty})});const data=await response.json();if(!response.ok)throw new Error(data.detail ? data.error+' '+data.detail : (data.error||'Unable to start payment.'));const options={key:data.keyId,amount:data.amount,currency:'INR',name:'FANTASTIC Events',description:'GARBA RAAS-RANG-18 - '+selectedTicket.name,order_id:data.orderId,prefill:{name,email,contact:'+91'+phone},theme:{color:'#b86cff'},handler:async function(payment){statusEl.textContent='Verifying payment…';const verify=await fetch('/api/verify-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({razorpay_order_id:payment.razorpay_order_id,razorpay_payment_id:payment.razorpay_payment_id,razorpay_signature:payment.razorpay_signature,name,phone,email,ticket:selectedTicket.name,quantity:ticketQty})});const result=await verify.json();if(!verify.ok||!result.success)throw new Error(result.error||'Payment verification failed.');statusEl.textContent='Payment successful! Booking ID: '+result.bookingId;bookingForm.reset();},modal:{ondismiss:function(){statusEl.textContent='Payment window closed. You can try again.';}}};const checkout=new Razorpay(options);checkout.on('payment.failed',function(){statusEl.textContent='Payment failed or was cancelled. Please try again.';});checkout.open();}catch(err){statusEl.textContent=err.message;}});