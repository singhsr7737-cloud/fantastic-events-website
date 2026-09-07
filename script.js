const menu = document.querySelector('.menu');
const nav = document.querySelector('.nav nav');
if (menu) {
  menu.addEventListener('click', () => {
    nav.classList.toggle('mobile-open');
    nav.style.display = nav.classList.contains('mobile-open') ? 'flex' : '';
    nav.style.position = 'absolute'; nav.style.top = '70px'; nav.style.left = '0'; nav.style.right = '0';
    nav.style.padding = '24px'; nav.style.background = 'rgba(8,7,10,.97)'; nav.style.flexDirection = 'column';
  });
}

const gallery = document.getElementById('gallery');
const videoGrid = document.getElementById('videoGrid');
const counts = {weddings:12, decor:12, production:12, corporate:12, celebrations:12};
const labels = {weddings:'Weddings', decor:'Décor & Styling', production:'Stage & Production', corporate:'Corporate Events', celebrations:'Celebrations'};

function buildGallery(filter='all') {
  gallery.innerHTML = '';
  const cats = filter === 'all' ? Object.keys(counts) : [filter];
  let n = 0;
  cats.forEach(cat => {
    for (let i=1;i<=counts[cat];i++) {
      const figure = document.createElement('figure');
      if (n % 9 === 0) figure.classList.add('wide');
      const img = document.createElement('img');
      img.loading = n < 9 ? 'eager' : 'lazy';
      img.src = `assets/media/${cat}/${String(i).padStart(2,'0')}.jpg`;
      img.alt = `${labels[cat]} by FANTASTIC`;
      const cap = document.createElement('figcaption'); cap.textContent = labels[cat];
      figure.append(img,cap); gallery.appendChild(figure); n++;
    }
  });
}

function buildVideos() {
  for (let i=1;i<=6;i++) {
    const card=document.createElement('article'); card.className='video-card';
    const video=document.createElement('video'); video.controls=true; video.preload='metadata'; video.playsInline=true;
    video.src=`assets/media/videos/showreel-${String(i).padStart(2,'0')}.mp4`;
    const p=document.createElement('p'); p.textContent=`FANTASTIC — Event Showreel ${String(i).padStart(2,'0')}`;
    card.append(video,p); videoGrid.appendChild(card);
  }
}

buildGallery(); buildVideos();
document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.filter').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); buildGallery(btn.dataset.filter);
}));
document.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>console.log('Media could not be loaded:',img.src)));


// GARBA 2026 ticket booking preview
const ticketOptions = document.querySelectorAll('.ticket-option');
const selectedTicketEl = document.getElementById('selectedTicket');
const ticketQtyEl = document.getElementById('ticketQty');
const ticketTotalEl = document.getElementById('ticketTotal');
const formTicketName = document.getElementById('formTicketName');
const formTicketTotal = document.getElementById('formTicketTotal');
const bookingModal = document.getElementById('bookingModal');
let selectedTicket = {name:'Early Bird Pass', price:499};
let ticketQty = 1;

function updateTicketUI(){
  selectedTicketEl.textContent=selectedTicket.name;
  ticketQtyEl.textContent=ticketQty;
  const total=selectedTicket.price*ticketQty;
  ticketTotalEl.textContent='₹'+total.toLocaleString('en-IN');
  formTicketName.textContent=selectedTicket.name+' × '+ticketQty;
  formTicketTotal.textContent='₹'+total.toLocaleString('en-IN');
}

ticketOptions.forEach(btn=>btn.addEventListener('click',()=>{
  ticketOptions.forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  selectedTicket={name:btn.dataset.name,price:Number(btn.dataset.price)}; ticketQty=1; updateTicketUI();
}));
document.getElementById('minusTicket').addEventListener('click',()=>{ticketQty=Math.max(1,ticketQty-1);updateTicketUI()});
document.getElementById('plusTicket').addEventListener('click',()=>{ticketQty=Math.min(10,ticketQty+1);updateTicketUI()});
function openBooking(){bookingModal.classList.add('open');bookingModal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');updateTicketUI()}
function closeBooking(){bookingModal.classList.remove('open');bookingModal.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open')}
document.getElementById('openBooking').addEventListener('click',openBooking);
document.getElementById('closeBooking').addEventListener('click',closeBooking);
document.getElementById('closeBookingX').addEventListener('click',closeBooking);
document.getElementById('bookingForm').addEventListener('submit',e=>{
  e.preventDefault();
  const id='FAN'+Date.now().toString().slice(-8);
  document.getElementById('bookingId').textContent=id;
  document.getElementById('bookingForm').hidden=true;
  document.getElementById('demoPayment').hidden=false;
  const qr=document.getElementById('qrCode'); qr.innerHTML='';
  const data=encodeURIComponent(JSON.stringify({bookingId:id,event:'FANTASTIC Garba 2026',ticket:selectedTicket.name,quantity:ticketQty,total:selectedTicket.price*ticketQty}));
  const img=document.createElement('img'); img.alt='Booking QR code'; img.width=190; img.height=190; img.src='https://api.qrserver.com/v1/create-qr-code/?size=190x190&data='+data; qr.appendChild(img);
});
