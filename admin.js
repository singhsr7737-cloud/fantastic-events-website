const loginCard=document.getElementById('loginCard'),dashboard=document.getElementById('dashboard'),loginForm=document.getElementById('loginForm'),loginMsg=document.getElementById('loginMsg'),dashMsg=document.getElementById('dashMsg'),rows=document.getElementById('rows');let bookings=[];let adminPassword=sessionStorage.getItem('fantasticAdminPassword')||'';function money(n){return '₹'+Number(n||0).toLocaleString('en-IN')}function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}async function load(){dashMsg.textContent='';const r=await fetch('/api/admin/bookings',{headers:{'x-admin-password':adminPassword}});const d=await r.json();if(!r.ok){sessionStorage.removeItem('fantasticAdminPassword');adminPassword='';dashboard.hidden=true;loginCard.hidden=false;loginMsg.textContent=d.error||'Login failed.';return}bookings=d.bookings||[];document.getElementById('total').textContent=bookings.length;document.getElementById('tickets').textContent=bookings.reduce((s,b)=>s+Number(b.quantity||0),0);document.getElementById('revenue').textContent=money(bookings.reduce((s,b)=>s+Number(b.amount||0),0));document.getElementById('used').textContent=bookings.filter(b=>b.used_at).length;rows.innerHTML=bookings.map(b=>'<tr><td><b>'+esc(b.booking_id)+'</b></td><td>'+esc(b.holder_name)+'</td><td>'+esc(b.phone)+'</td><td>'+esc(b.pass_type)+'</td><td>'+esc(b.quantity)+'</td><td>'+money(b.amount)+'</td><td class="'+(b.used_at?'status-used':'status-valid')+'">'+(b.used_at?'USED':'VALID')+'</td><td>'+new Date(b.created_at).toLocaleString('en-IN')+'</td></tr>').join('')}loginForm.addEventListener('submit',async e=>{e.preventDefault();adminPassword=document.getElementById('password').value;const r=await fetch('/api/admin/bookings',{headers:{'x-admin-password':adminPassword}});const d=await r.json();if(!r.ok){loginMsg.textContent=d.error||'Login failed.';return}sessionStorage.setItem('fantasticAdminPassword',adminPassword);loginCard.hidden=true;dashboard.hidden=false;document.getElementById('logout').hidden=false;bookings=d.bookings||[];await load()});document.getElementById('refresh').addEventListener('click',load);document.getElementById('logout').addEventListener('click',()=>{sessionStorage.removeItem('fantasticAdminPassword');location.reload()});document.getElementById('export').addEventListener('click',()=>{const head=['Booking ID','Holder','Phone','Email','Pass Type','Quantity','Amount','Status','Created At'];const lines=[head,...bookings.map(b=>[b.booking_id,b.holder_name,b.phone,b.email,b.pass_type,b.quantity,b.amount,b.used_at?'USED':'VALID',b.created_at])].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(','));const blob=new Blob([lines.join('\\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='fantastic-garba-bookings.csv';a.click();URL.revokeObjectURL(a.href)});if(adminPassword){loginCard.hidden=true;dashboard.hidden=false;document.getElementById('logout').hidden=false;load()}

const connectWhatsApp=document.getElementById('connectWhatsApp');
const whatsappMsg=document.getElementById('whatsappMsg');
function showWhatsAppMessage(message,ok=false){if(whatsappMsg){whatsappMsg.textContent=message;whatsappMsg.style.color=ok?'#176b3a':'#a33';}}
window.addEventListener('message',async function(event){
  if(event.origin!=='https://www.facebook.com') return;
  let data;
  try{data=typeof event.data==='string'?JSON.parse(event.data):event.data;}catch(e){return;}
  if(data?.type!=='WA_EMBEDDED_SIGNUP') return;
  if(data?.event==='CANCEL'||data?.event==='ERROR'){showWhatsAppMessage('WhatsApp setup was cancelled or returned an error.');return;}
  if(data?.event==='FINISH'||data?.event==='FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'){
    showWhatsAppMessage('Coexistence completed. Finalizing the connection...',true);
    try{
      const r=await fetch('/api/whatsapp/embedded-signup',{method:'POST',headers:{'Content-Type':'application/json','x-admin-password':adminPassword},body:JSON.stringify({code:window.__waSignupCode||'',session:data.data||{},event:data.event,version:data.version})});
      const result=await r.json();
      if(!r.ok) throw new Error(result.error||'Unable to finalize WhatsApp connection.');
      showWhatsAppMessage('WhatsApp Business + Cloud API onboarding completed. '+(result.phoneNumberId?'Phone ID: '+result.phoneNumberId:'The phone ID will be discovered next.'),true);
    }catch(e){showWhatsAppMessage(e.message||'Connection finalization failed.');}
  }
});
if(connectWhatsApp){
  connectWhatsApp.addEventListener('click',function(){
    showWhatsAppMessage('Opening Meta WhatsApp Embedded Signup...');
    if(!window.FB){showWhatsAppMessage('Meta Login is still loading. Please wait a few seconds and try again.');return;}
    FB.login(function(response){
      if(response?.authResponse?.code){
        window.__waSignupCode=response.authResponse.code;
        showWhatsAppMessage('Meta onboarding completed. Waiting for the final connection message...');
      }else{
        showWhatsAppMessage('Meta login was cancelled or did not return an authorization code.');
      }
    },{
      config_id:'2584698858699466',
      response_type:'code',
      override_default_response_type:true,
      extras:{setup:{},featureType:'whatsapp_business_app_onboarding',sessionInfoVersion:'3'}
    });
  });
}

/* Multi-device entry gate scanner */
let gateScanner=null,gateBusy=false;
const scanResult=document.getElementById('scanResult');
function showScanResult(message,kind){if(!scanResult)return;scanResult.textContent=message;scanResult.className='scan-result '+(kind||'');}
function extractBookingId(value){
  const raw=String(value||'').trim();
  try{const u=new URL(raw);const id=u.searchParams.get('id');if(id)return id.trim().toUpperCase();}catch(e){}
  const m=raw.match(/\bFAN[A-Z0-9]{8,20}\b/i);
  return m?m[0].toUpperCase():'';
}
async function checkInBooking(raw){
  if(gateBusy)return;
  const id=extractBookingId(raw);
  if(!id){showScanResult('INVALID QR / BOOKING ID. Please scan the ticket QR or enter its ID.','invalid');return;}
  if(!adminPassword){showScanResult('Please log in to the admin panel first.','invalid');return;}
  gateBusy=true;showScanResult('Checking ticket…','pending');
  try{
    const r=await fetch('/api/use-ticket',{method:'POST',headers:{'Content-Type':'application/json','x-admin-password':adminPassword},body:JSON.stringify({bookingId:id})});
    const d=await r.json();
    if(r.ok&&d.success){const b=d.booking||{};showScanResult('✓ VALID — ENTRY CHECKED IN\n'+(b.holder_name||'')+' · '+(b.pass_type||'')+' · Qty '+(b.quantity||'')+'\nBooking ID: '+(b.booking_id||id),'valid');await load();}
    else if(d.status==='USED'){const b=d.booking||{};showScanResult('⛔ ALREADY USED — DO NOT ALLOW ENTRY\n'+(b.holder_name||'')+' · '+(b.pass_type||'')+'\nBooking ID: '+(b.booking_id||id),'used');}
    else showScanResult('✕ INVALID TICKET — '+(d.error||'Booking not found.'),'invalid');
  }catch(e){showScanResult('Unable to verify ticket. Check internet and try again.','invalid');}
  finally{gateBusy=false;}
}
const checkBookingButton=document.getElementById('checkBooking');
if(checkBookingButton)checkBookingButton.addEventListener('click',()=>{const input=document.getElementById('scanBookingId');checkInBooking(input.value);});
const scanInput=document.getElementById('scanBookingId');
if(scanInput)scanInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();checkInBooking(scanInput.value);}});
const startScannerButton=document.getElementById('startScanner'),stopScannerButton=document.getElementById('stopScanner');
async function stopGateScanner(){if(gateScanner){try{await gateScanner.stop();}catch(e){}try{await gateScanner.clear();}catch(e){}gateScanner=null;}if(startScannerButton)startScannerButton.hidden=false;if(stopScannerButton)stopScannerButton.hidden=true;}
if(startScannerButton)startScannerButton.addEventListener('click',async()=>{
 if(!adminPassword){showScanResult('Please log in to the admin panel first.','invalid');return;}
 if(!window.Html5Qrcode){showScanResult('QR scanner library did not load. Use Booking ID field or refresh.','invalid');return;}
 try{
  gateScanner=new Html5Qrcode('qr-reader');
  await gateScanner.start({facingMode:'environment'},{fps:10,qrbox:{width:230,height:230}},async decoded=>{
   const id=extractBookingId(decoded);if(id){await stopGateScanner();await checkInBooking(id);}
  },()=>{});
  startScannerButton.hidden=true;stopScannerButton.hidden=false;showScanResult('Camera active. Point it at the ticket QR code.','pending');
 }catch(e){gateScanner=null;showScanResult('Camera could not start. Allow camera access and use HTTPS, or enter the Booking ID manually.','invalid');}
});
if(stopScannerButton)stopScannerButton.addEventListener('click',stopGateScanner);
