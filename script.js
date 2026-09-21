const menu=document.querySelector('.menu');
const nav=document.querySelector('.nav nav');
if(menu){menu.addEventListener('click',()=>{nav.classList.toggle('mobile-open');nav.style.display=nav.classList.contains('mobile-open')?'flex':'';nav.style.position='absolute';nav.style.top='70px';nav.style.left='0';nav.style.right='0';nav.style.padding='24px';nav.style.background='rgba(8,7,10,.97)';nav.style.flexDirection='column';});}

const gallery=document.getElementById('gallery');
const videoGrid=document.getElementById('videoGrid');
const counts={weddings:12,decor:12,production:12,corporate:12,celebrations:12};
const labels={weddings:'Weddings',decor:'Décor & Styling',production:'Stage & Production',corporate:'Corporate Events',celebrations:'Celebrations'};

function buildGallery(filter='all'){
 gallery.innerHTML='';
 const cats=filter==='all'?Object.keys(counts):[filter];
 let n=0;
 cats.forEach(cat=>{for(let i=1;i<=counts[cat];i++){const figure=document.createElement('figure');if(n%9===0)figure.classList.add('wide');const img=document.createElement('img');img.loading=n<9?'eager':'lazy';img.src=`${cat}/${String(i).padStart(2,'0')}.jpg`;img.alt=`${labels[cat]} by FANTASTIC`;const cap=document.createElement('figcaption');cap.textContent=labels[cat];figure.append(img,cap);gallery.appendChild(figure);n++;}});
}
function buildVideos(){for(let i=1;i<=6;i++){const card=document.createElement('article');card.className='video-card';const video=document.createElement('video');video.controls=true;video.preload='metadata';video.playsInline=true;video.src=`videos/showreel-${String(i).padStart(2,'0')}.mp4`;const p=document.createElement('p');p.textContent=`FANTASTIC — Event Showreel ${String(i).padStart(2,'0')}`;card.append(video,p);videoGrid.appendChild(card);}}

if(gallery)buildGallery();
if(videoGrid)buildVideos();
document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(b=>b.classList.remove('active'));btn.classList.add('active');buildGallery(btn.dataset.filter);}));
document.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>console.log('Media could not be loaded:',img.src)));