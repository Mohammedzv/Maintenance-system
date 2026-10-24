import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, query, orderBy, limit, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = id => document.getElementById(id);
let currentUser=null, profile=null, machines=[], jobs=[], userProfiles=[], scanner=null, scannerTarget=null;
const roles={admin:"مدير النظام",supervisor:"مشرف",technician:"فني صيانة",viewer:"مشاهدة فقط"};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateToday=()=>new Date().toLocaleDateString("en-CA");
const fmtDate=s=>s?new Date(s+"T00:00:00").toLocaleDateString("ar-EG"):"—";
function message(id,text,ok=false){$(id).textContent=text;$(id).style.color=ok?"#159768":"#d54a4a";}
function canEdit(){return ["admin","supervisor","technician"].includes(profile?.role)}
function isAdmin(){return profile?.role==="admin"}
function enforceUI(){
 $("userName").textContent=profile?.name||currentUser?.email||"مستخدم";
 $("userRole").textContent=roles[profile?.role]||"دور غير محدد";
 $("avatar").textContent=($("userName").textContent.trim()[0]||"م");
 document.querySelectorAll(".admin-only").forEach(x=>x.classList.toggle("hidden",!isAdmin()));
 document.querySelectorAll(".can-edit").forEach(x=>x.classList.toggle("hidden",!canEdit()));
}
function showPage(name){
 document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
 $("page-"+name)?.classList.remove("hidden");
 document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===name));
 const titles={dashboard:["نظرة عامة","لوحة التحكم"],machines:["قاعدة البيانات","الماكينات"],maintenance:["سجل العمليات","سجل الصيانة"],parts:["المخزون المسجل","قطع الغيار"],users:["إدارة الوصول","المستخدمون والصلاحيات"]};
 $("pageEyebrow").textContent=titles[name]?.[0]||"";$("pageTitle").textContent=titles[name]?.[1]||"";
}
async function loadAll(){
 const [ms,js,us]=await Promise.all([getDocs(collection(db,"machines")),getDocs(query(collection(db,"maintenance"),orderBy("createdAt","desc"))),isAdmin()?getDocs(collection(db,"users")):Promise.resolve(null)]);
 machines=ms.docs.map(d=>({id:d.id,...d.data()})); jobs=js.docs.map(d=>({id:d.id,...d.data()})); userProfiles=us?us.docs.map(d=>({id:d.id,...d.data()})):[];
 renderAll();
}
function renderAll(){
 $("statMachines").textContent=machines.length;$("statJobs").textContent=jobs.length;$("statParts").textContent=jobs.reduce((n,j)=>n+(j.parts||[]).length,0);$("statDown").textContent=machines.filter(m=>m.status!=="تعمل").length;
 $("machineSerialList").innerHTML=machines.map(m=>`<option value="${esc(m.serial)}">${esc(m.type||"")}</option>`).join("");
 renderMachines();renderJobs();renderRecent();renderParts();if(isAdmin())renderUsers();
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
function renderUsers(){$("usersTable").innerHTML=userProfiles.length?`<table><thead><tr><th>البريد الإلكتروني</th><th>الاسم</th><th>الدور الحالي</th><th>تغيير الدور</th></tr></thead><tbody>${userProfiles.map(u=>`<tr><td>${esc(u.email||u.id)}</td><td>${esc(u.name||"—")}</td><td>${esc(roles[u.role]||u.role||"غير محدد")}</td><td><select data-role-user="${esc(u.id)}">${Object.entries(roles).map(([v,n])=>`<option value="${v}" ${u.role===v?"selected":""}>${n}</option>`).join("")}</select> <button class="action-btn" data-save-role="${esc(u.id)}">حفظ</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">لا يوجد مستخدمون مضافون بعد.</div>`;
 $("usersTable").querySelectorAll("[data-save-role]").forEach(b=>b.onclick=async()=>{const id=b.dataset.saveRole,role=$("usersTable").querySelector(`[data-role-user="${CSS.escape(id)}"]`).value;try{await setDoc(doc(db,"users",id),{...userProfiles.find(u=>u.id===id),role},{merge:true});message("globalMessage","تم تحديث الدور. قد تحتاج إعادة تحميل الجلسة لتطبيقه بالكامل.",true);await loadAll()}catch(e){message("globalMessage",friendlyError(e))}});
}
function friendlyError(e){console.error(e);if(e.code==="permission-denied")return"تم رفض العملية بسبب الصلاحيات. راجع إعدادات Firestore Rules ودور المستخدم.";if(e.code==="auth/invalid-credential")return"البريد الإلكتروني أو كلمة المرور غير صحيحة.";return e.message||"حدث خطأ غير متوقع."}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();message("loginMessage","جارٍ تسجيل الدخول...",true);try{await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPassword").value)}catch(err){message("loginMessage",friendlyError(err))}});
onAuthStateChanged(auth,async user=>{currentUser=user;if(!user){$("loginView").classList.remove("hidden");$("appView").classList.add("hidden");return}try{const snap=await getDoc(doc(db,"users",user.uid));if(!snap.exists()){await signOut(auth);message("loginMessage","الحساب موجود لكن لم يتم تعيين دور له. اطلب من المدير إضافته في مجموعة users.");return}profile=snap.data();if(!roles[profile.role]){await signOut(auth);message("loginMessage","هذا الحساب ليس له دور صالح.");return}$("loginView").classList.add("hidden");$("appView").classList.remove("hidden");$("todayDate").textContent=new Date().toLocaleDateString("ar-EG",{weekday:"short",year:"numeric",month:"short",day:"numeric"});enforceUI();await loadAll()}catch(e){message("loginMessage",friendlyError(e));await signOut(auth)}});
$("logoutBtn").onclick=()=>signOut(auth);
document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>showPage(n.dataset.page));
document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>showPage(b.dataset.goto));
$("quickAdd").onclick=()=>canEdit()?openDialog("jobDialog") : message("globalMessage","صلاحيات حسابك تسمح بالمشاهدة فقط.");
function openDialog(id){$(id).showModal()}
$("addMachineBtn").onclick=()=>{if(!canEdit())return; $("machineForm").reset();openDialog("machineDialog")};
$("addJobBtn").onclick=()=>{if(!canEdit())return;$("jobForm").reset();$("jDate").value=dateToday();$("jTechnician").value=profile?.name||"";openDialog("jobDialog")};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$("machineForm").onsubmit=async e=>{e.preventDefault();if(!canEdit())return;const data={serial:$("mSerial").value.trim(),type:$("mType").value.trim(),brand:$("mBrand").value.trim(),model:$("mModel").value.trim(),section:$("mSection").value.trim(),status:$("mStatus").value,notes:$("mNotes").value.trim(),createdBy:currentUser.uid,createdAt:serverTimestamp()};if(!data.serial)return;if(machines.some(m=>m.serial.toLowerCase()===data.serial.toLowerCase()))return message("globalMessage","هذا السيريال مسجل بالفعل.");try{await addDoc(collection(db,"machines"),data);$("machineDialog").close();await loadAll();message("globalMessage","تم تسجيل الماكينة بنجاح.",true)}catch(err){message("globalMessage",friendlyError(err))}};
$("jobForm").onsubmit=async e=>{e.preventDefault();if(!canEdit())return;const serial=$("jSerial").value.trim();if(!machines.some(m=>m.serial.toLowerCase()===serial.toLowerCase()))return message("globalMessage","السيريال غير موجود. أضف الماكينة أولًا.");const parts=$("jParts").value.split("\n").map(s=>s.trim()).filter(Boolean).map(line=>{const a=line.split("|").map(x=>x.trim());return{name:a[0]||"قطعة غير مسماة",qty:Number(a[1])||1,note:a.slice(2).join(" | ")}});const data={serial,date:$("jDate").value,technician:$("jTechnician").value.trim(),kind:$("jKind").value,fault:$("jFault").value.trim(),action:$("jAction").value.trim(),status:$("jStatus").value,downtime:Number($("jDowntime").value)||0,parts,notes:$("jNotes").value.trim(),createdBy:currentUser.uid,createdAt:serverTimestamp()};try{await addDoc(collection(db,"maintenance"),data);const m=machines.find(x=>x.serial.toLowerCase()===serial.toLowerCase());await updateDoc(doc(db,"machines",m.id),{status:data.status,lastMaintenanceDate:data.date});$("jobDialog").close();await loadAll();message("globalMessage","تم حفظ عملية الصيانة وقطع الغيار وربطها بالماكينة.",true)}catch(err){message("globalMessage",friendlyError(err))}};
$("userForm").onsubmit=async e=>{e.preventDefault();if(!isAdmin())return;const email=$("newUserEmail").value.trim().toLowerCase();try{const found=userProfiles.find(u=>(u.email||"").toLowerCase()===email);if(!found)return message("globalMessage","أنشئ الحساب أولًا من Firebase Authentication ثم سجّل بريده هنا. الحسابات لا تُنشأ من صفحة الموقع.");await setDoc(doc(db,"users",found.id),{email,name:$("newUserName").value.trim(),role:$("newUserRole").value},{merge:true});$("userForm").reset();await loadAll();message("globalMessage","تم تحديث بيانات المستخدم.",true)}catch(err){message("globalMessage",friendlyError(err))}};
$("machineSearch").oninput=renderMachines;$("jobSearch").oninput=renderJobs;
async function startScanner(target){scannerTarget=target;openDialog("scannerDialog");$("scannerRegion").innerHTML="";message("scannerMessage","جارٍ تجهيز قارئ الكاميرا...",true);try{if(!window.isSecureContext)throw new Error("قارئ الكاميرا يحتاج HTTPS أو localhost.");if(!("BarcodeDetector" in window))throw new Error("المتصفح لا يدعم قارئ الباركود المدمج. استخدم إدخال السيريال يدويًا أو جرّب متصفحًا حديثًا.");const detector=new BarcodeDetector({formats:["qr_code","code_128","code_39","ean_13","ean_8","upc_a","upc_e","itf","codabar"]});const video=document.createElement("video");video.setAttribute("playsinline","");video.autoplay=true;$("scannerRegion").appendChild(video);const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});video.srcObject=stream;scanner={stream,video,detector,active:true};message("scannerMessage","وجّه الكاميرا نحو الباركود أو QR.",true);const tick=async()=>{if(!scanner?.active)return;try{if(video.readyState>=2){const codes=await detector.detect(video);if(codes.length&&codes[0].rawValue){$(scannerTarget).value=codes[0].rawValue;stopScanner();$("scannerDialog").close();message("globalMessage","تمت قراءة الكود. راجع السيريال قبل الحفظ.",true);return}}}catch(e){}requestAnimationFrame(tick)};video.onloadeddata=()=>requestAnimationFrame(tick)}catch(e){message("scannerMessage",e.message+" يمكنك إدخال السيريال يدويًا.");}}
function stopScanner(){if(scanner){scanner.active=false;scanner.stream.getTracks().forEach(t=>t.stop());scanner=null}}
$("scanSerialBtn").onclick=()=>startScanner("mSerial");$("scanMachineBtn").onclick=()=>startScanner("machineSearch");$("scanJobBtn").onclick=()=>startScanner("jSerial");$("stopScannerBtn").onclick=stopScanner;$("scannerDialog").addEventListener("close",stopScanner);
