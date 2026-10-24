import { db } from "./firebase.js";
import { ref, get, push, set, update } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const $ = id => document.getElementById(id);
let profile={name:"فريق الصيانة",role:"admin"}, machines=[], jobs=[], scanner=null, scannerTarget=null;
const roles={admin:"مدير النظام",supervisor:"مشرف",technician:"فني صيانة",viewer:"مشاهدة فقط"};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateToday=()=>new Date().toLocaleDateString("en-CA");
const fmtDate=s=>s?new Date(s+"T00:00:00").toLocaleDateString("ar-EG"):"—";
function message(id,text,ok=false){$(id).textContent=text;$(id).style.color=ok?"#159768":"#d54a4a";}
function canEdit(){return true}
function isAdmin(){return false}
function showPage(name){
 document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
 $("page-"+name)?.classList.remove("hidden");
 document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===name));
 const titles={dashboard:["نظرة عامة","لوحة التحكم"],machines:["قاعدة البيانات","الماكينات"],maintenance:["سجل العمليات","سجل الصيانة"],parts:["المخزون المسجل","قطع الغيار"],users:["إدارة الوصول","المستخدمون والصلاحيات"]};
 $("pageEyebrow").textContent=titles[name]?.[0]||"";$("pageTitle").textContent=titles[name]?.[1]||"";
}
async function loadAll(){
 try {
  const [ms,js]=await Promise.all([get(ref(db,"machines")),get(ref(db,"maintenance"))]);
  machines=ms.exists()?Object.entries(ms.val()).map(([id,data])=>({id,...data})):[];
  jobs=js.exists()?Object.entries(js.val()).map(([id,data])=>({id,...data})):[];
  jobs.sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0));
  renderAll(); message("globalMessage","تم الاتصال بقاعدة البيانات وتحميل البيانات.",true);
 } catch(e) { message("globalMessage",friendlyError(e)); }
}
function renderAll(){
 $("statMachines").textContent=machines.length;$("statJobs").textContent=jobs.length;$("statParts").textContent=jobs.reduce((n,j)=>n+(j.parts||[]).length,0);$("statDown").textContent=machines.filter(m=>m.status!=="تعمل").length;
 $("machineSerialList").innerHTML=machines.map(m=>`<option value="${esc(m.serial)}">${esc(m.type||"")}</option>`).join("");
 renderMachines();renderJobs();renderRecent();renderParts();
}
function statusPill(s){let cl=s==="تعمل"?"":s==="متوقفة"?"red":"amber";return `<span class="pill ${cl}">${esc(s||"—")}</span>`}
function renderMachines(){
 const q=($("machineSearch").value||"").toLowerCase();
 const rows=machines.filter(m=>[m.serial,m.type,m.brand,m.model,m.section].some(v=>String(v||"").toLowerCase().includes(q)));
 $("machinesTable").innerHTML=rows.length?`<table><thead><tr><th>السيريال</th><th>النوع / الماركة</th><th>الموديل</th><th>القسم</th><th>الحالة</th><th>السجل</th></tr></thead><tbody>${rows.map(m=>`<tr><td class="serial">${esc(m.serial)}</td><td>${esc(m.type)}<br><small class="muted">${esc(m.brand||"")}</small></td><td>${esc(m.model||"—")}</td><td>${esc(m.section||"—")}</td><td>${statusPill(m.status)}</td><td><button class="action-btn" data-history="${esc(m.serial)}">عرض الصيانة</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">لا توجد ماكينات مطابقة. أضف أول ماكينة للبدء.</div>`;
 $("machinesTable").querySelectorAll("[data-history]").forEach(b=>b.onclick=()=>{$("jobSearch").value=b.dataset.history;showPage("maintenance");renderJobs()});
}
function jobRow(j){const m=machines.find(x=>x.serial===j.serial);return `<tr><td>${fmtDate(j.date)}</td><td class="serial">${esc(j.serial)}</td><td>${esc(m?.type||"—")}</td><td>${esc(j.fault)}</td><td>${esc(j.technician)}</td><td>${(j.parts||[]).map(p=>esc(p.name)+" × "+esc(p.qty)).join("<br>")||"—"}</td><td>${statusPill(j.status)}</td></tr>`}
function renderJobs(){
 const q=($("jobSearch").value||"").toLowerCase();
 const rows=jobs.filter(j=>[j.serial,j.technician,j.fault,j.action,...(j.parts||[]).map(p=>p.name)].some(v=>String(v||"").toLowerCase().includes(q)));
 $("jobsTable").innerHTML=rows.length?`<table><thead><tr><th>التاريخ</th><th>السيريال</th><th>النوع</th><th>العطل</th><th>الفني</th><th>قطع الغيار</th><th>الحالة</th></tr></thead><tbody>${rows.map(jobRow).join("")}</tbody></table>`:`<div class="empty">لا توجد عمليات صيانة مسجلة حتى الآن.</div>`;
}
function renderRecent(){const rows=jobs.slice(0,6);$("recentJobs").innerHTML=rows.length?`<table><thead><tr><th>التاريخ</th><th>السيريال</th><th>العطل</th><th>الفني</th><th>الحالة</th></tr></thead><tbody>${rows.map(j=>`<tr><td>${fmtDate(j.date)}</td><td class="serial">${esc(j.serial)}</td><td>${esc(j.fault)}</td><td>${esc(j.technician)}</td><td>${statusPill(j.status)}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">ستظهر هنا أحدث عمليات الصيانة.</div>`}
function renderParts(){const list=[];jobs.forEach(j=>(j.parts||[]).forEach(p=>list.push({...p,serial:j.serial,date:j.date,technician:j.technician})));$("partsTable").innerHTML=list.length?`<table><thead><tr><th>اسم القطعة</th><th>الكمية</th><th>سيريال الماكينة</th><th>تاريخ التغيير</th><th>الفني</th><th>ملاحظات</th></tr></thead><tbody>${list.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.qty)}</td><td class="serial">${esc(p.serial)}</td><td>${fmtDate(p.date)}</td><td>${esc(p.technician)}</td><td>${esc(p.note||"—")}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">قطع الغيار ستظهر تلقائيًا بعد تسجيلها في الصيانة.</div>`}
function friendlyError(e){console.error(e);if(e.code==="PERMISSION_DENIED"||e.code==="permission-denied")return"Firebase رفض العملية. افتح Realtime Database → Rules وتأكد من نشر القواعد المرفقة.";if(e.code==="NETWORK_ERROR")return"تعذر الاتصال بالإنترنت. تحقق من الاتصال ثم أعد المحاولة.";return e.message||"حدث خطأ غير متوقع."}
$("appView").classList.remove("hidden");
$("userName").textContent="فريق الصيانة"; $("userRole").textContent="دخول مباشر بدون حساب"; $("avatar").textContent="ص";
$("todayDate").textContent=new Date().toLocaleDateString("ar-EG",{weekday:"short",year:"numeric",month:"short",day:"numeric"});
loadAll();
document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>showPage(n.dataset.page));
document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>showPage(b.dataset.goto));
$("quickAdd").onclick=()=>canEdit()?openDialog("jobDialog") : message("globalMessage","صلاحيات حسابك تسمح بالمشاهدة فقط.");
function openDialog(id){$(id).showModal()}
$("addMachineBtn").onclick=()=>{ $("machineForm").reset();openDialog("machineDialog")};
$("addJobBtn").onclick=()=>{$("jobForm").reset();$("jDate").value=dateToday();$("jTechnician").value="";openDialog("jobDialog")};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
async function saveMachine(e){
 if(e) e.preventDefault();
 const form=$("machineForm"), btn=form.querySelector('button[type="submit"]');
 const data={serial:$("mSerial").value.trim(),type:$("mType").value.trim(),brand:$("mBrand").value.trim(),model:$("mModel").value.trim(),section:$("mSection").value.trim(),status:$("mStatus").value,notes:$("mNotes").value.trim(),createdBy:"بدون تسجيل دخول",createdAt:Date.now()};
 if(!data.serial || !data.type){ message("globalMessage","اكتب السيريال نمبر ونوع الماكينة أولًا."); if(!data.serial) $("mSerial").focus(); else $("mType").focus(); return; }
 if(machines.some(m=>String(m.serial||"").toLowerCase()===data.serial.toLowerCase())){message("globalMessage","هذا السيريال مسجل بالفعل.");return;}
 btn.disabled=true; const oldText=btn.textContent; btn.textContent="جارٍ الحفظ..."; message("globalMessage","جارٍ حفظ الماكينة في قاعدة البيانات...",true);
 try {
   const machineRef=push(ref(db,"machines"));
   await set(machineRef,data);
   const verify=await get(ref(db,"machines/"+machineRef.key));
   if(!verify.exists()) throw new Error("تم إرسال الطلب لكن لم يظهر السجل عند التحقق. راجع قواعد Realtime Database.");
   $("machineDialog").close();
   await loadAll();
   message("globalMessage","تم حفظ الماكينة بنجاح في Firebase.",true);
 } catch(err) {
   message("globalMessage","تعذر حفظ الماكينة: "+friendlyError(err));
   console.error("saveMachine failed",err);
 } finally { btn.disabled=false; btn.textContent=oldText; }
}
$("machineForm").addEventListener("submit",saveMachine);
// بعض متصفحات الهاتف لا توضح سبب منع الإرسال بسبب الحقول المطلوبة؛ أظهر تنبيهًا واضحًا عند الضغط.
$("machineForm").querySelector('button[type="submit"]').addEventListener("click",()=>{
 const form=$("machineForm");
 if(!$("mSerial").value.trim() || !$("mType").value.trim()) message("globalMessage","لازم تكتب السيريال نمبر ونوع الماكينة قبل الحفظ.");
});
$("jobForm").onsubmit=async e=>{e.preventDefault();const serial=$("jSerial").value.trim();if(!machines.some(m=>m.serial.toLowerCase()===serial.toLowerCase()))return message("globalMessage","السيريال غير موجود. أضف الماكينة أولًا.");const parts=$("jParts").value.split("\n").map(s=>s.trim()).filter(Boolean).map(line=>{const a=line.split("|").map(x=>x.trim());return{name:a[0]||"قطعة غير مسماة",qty:Number(a[1])||1,note:a.slice(2).join(" | ")}});const data={serial,date:$("jDate").value,technician:$("jTechnician").value.trim(),kind:$("jKind").value,fault:$("jFault").value.trim(),action:$("jAction").value.trim(),status:$("jStatus").value,downtime:Number($("jDowntime").value)||0,parts,notes:$("jNotes").value.trim(),createdBy:"بدون تسجيل دخول",createdAt:Date.now()};try{const jobRef=push(ref(db,"maintenance"));await set(jobRef,data);const m=machines.find(x=>x.serial.toLowerCase()===serial.toLowerCase());await update(ref(db,"machines/"+m.id),{status:data.status,lastMaintenanceDate:data.date});$("jobDialog").close();await loadAll();message("globalMessage","تم حفظ عملية الصيانة وقطع الغيار وربطها بالماكينة.",true)}catch(err){message("globalMessage",friendlyError(err))}};
$("machineSearch").oninput=renderMachines;$("jobSearch").oninput=renderJobs;
async function startScanner(target){scannerTarget=target;openDialog("scannerDialog");$("scannerRegion").innerHTML="";message("scannerMessage","جارٍ تجهيز قارئ الكاميرا...",true);try{if(!window.isSecureContext)throw new Error("قارئ الكاميرا يحتاج HTTPS أو localhost.");if(!("BarcodeDetector" in window))throw new Error("المتصفح لا يدعم قارئ الباركود المدمج. استخدم إدخال السيريال يدويًا أو جرّب متصفحًا حديثًا.");const detector=new BarcodeDetector({formats:["qr_code","code_128","code_39","ean_13","ean_8","upc_a","upc_e","itf","codabar"]});const video=document.createElement("video");video.setAttribute("playsinline","");video.autoplay=true;$("scannerRegion").appendChild(video);const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});video.srcObject=stream;scanner={stream,video,detector,active:true};message("scannerMessage","وجّه الكاميرا نحو الباركود أو QR.",true);const tick=async()=>{if(!scanner?.active)return;try{if(video.readyState>=2){const codes=await detector.detect(video);if(codes.length&&codes[0].rawValue){$(scannerTarget).value=codes[0].rawValue;stopScanner();$("scannerDialog").close();message("globalMessage","تمت قراءة الكود. راجع السيريال قبل الحفظ.",true);return}}}catch(e){}requestAnimationFrame(tick)};video.onloadeddata=()=>requestAnimationFrame(tick)}catch(e){message("scannerMessage",e.message+" يمكنك إدخال السيريال يدويًا.");}}
function stopScanner(){if(scanner){scanner.active=false;scanner.stream.getTracks().forEach(t=>t.stop());scanner=null}}
$("scanSerialBtn").onclick=()=>startScanner("mSerial");$("scanMachineBtn").onclick=()=>startScanner("machineSearch");$("scanJobBtn").onclick=()=>startScanner("jSerial");$("stopScannerBtn").onclick=stopScanner;$("scannerDialog").addEventListener("close",stopScanner);

window.addEventListener("error", e => { try { message("globalMessage", "حدث خطأ في تشغيل الصفحة: " + (e.message || "خطأ JavaScript")); } catch(_) {} });
window.addEventListener("unhandledrejection", e => { try { message("globalMessage", "فشلت عملية: " + (e.reason?.message || String(e.reason || "خطأ غير معروف"))); } catch(_) {} });
