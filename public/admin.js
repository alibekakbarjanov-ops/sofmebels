/* ==========================================================
   SOF SHOP — admin.js  TO'LIQ
   ✅ Excel: Katalog | Sub-katalog | Nomi | Kodi | Qolgani | Bori | Narxi
   ✅ Qolmagan bo'limi to'liq ishlaydi
   ✅ Kataloglar boshqaruvi
   ✅ Realtime Socket.io
   ✅ GPS xarita
========================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyBscHNUMxO99kiqJFcDT-aIA9m3r_o2Pyg",
  authDomain: "sofmebel-e44bb.firebaseapp.com",
  projectId: "sofmebel-e44bb",
  storageBucket: "sofmebel-e44bb.firebasestorage.app",
  messagingSenderId: "876873009974",
  appId: "1:876873009974:web:1246fcc90f5297259f8197",
  measurementId: "G-PWWPTS1256"
};
initializeApp(firebaseConfig, "admin-app");

const BASE = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "http://localhost:4000"
  : location.origin;
const API = BASE + "/api";

/* ── Utils ── */
const $       = id => document.getElementById(id);
const esc     = s  => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const fmt     = n  => (Number(n)||0).toLocaleString("uz-UZ") + " so'm";
const nowMs   = ()  => Date.now();
const safeNum = x  => Number(x||0)||0;

function toast(msg, dur=2800){
  const t=$("toastEl"); t.textContent=msg; t.classList.remove("hidden");
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.add("hidden"),dur);
}
function showMsg(el,txt,type="error"){
  if(!el) return; el.textContent=txt; el.className="amsg "+type; el.classList.remove("hidden");
  clearTimeout(showMsg._t); showMsg._t=setTimeout(()=>el.classList.add("hidden"),4500);
}
function fileToBase64(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res(r.result);
    r.onerror=()=>rej(new Error("Fayl o'qilmadi"));
    r.readAsDataURL(file);
  });
}
function calcDistance(lat1,lon1,lat2,lon2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

/* ── API ── */
let _token = null;
async function apiFetch(method, path, body){
  const opts={method,headers:{"Content-Type":"application/json"}};
  if(_token) opts.headers["Authorization"]="Bearer "+_token;
  if(body)   opts.body=JSON.stringify(body);
  const res=await fetch(API+path,opts);
  const data=await res.json();
  if(!res.ok) throw new Error(data.error||"Server xatosi");
  return data;
}
const apiGet  = p     => apiFetch("GET",    p);
const apiPost = (p,b) => apiFetch("POST",   p,b);
const apiPut  = (p,b) => apiFetch("PUT",    p,b);
const apiDel  = (p,b) => apiFetch("DELETE", p,b);

/* ── Katalog (localStorage) ── */
const DEFAULT_CATALOGS = {
  "🛏️ Mebellar":{"🛏️ Yotoqxona":[],"🛋️ Mexmonxona":[],"🛋️ Yumshoq":[],"🍽️ Stol-stul":[],"🍴 Oshxona":[],"👶 Bolalar":[],"💼 Ofis":[],"🚪 Shkaflar":[]},
  "🎨 Aksesuarlar":{"🪞 Oynalar":[],"🖼️ Kartinalar":[]},
  "📺 Maishiy texnika":{"❄️ Muzlatkich":[],"🧼 Kir yuvish":[],"🔥 Gaz plita":[],"🌀 Konditsioner":[],"🔌 Boshqa":[]},
  "🏃 Sport":{"🏃 Yugurish":[],"🚴 Velo":[],"💆 Massaj":[]},
  "📱 Telefonlar":{"📱 Samsung":[],"📱 Redmi":[],"📱 Honor":[]}
};
function loadCatalogs(){ try{ const s=localStorage.getItem("sofshop_catalogs"); return s?JSON.parse(s):{...DEFAULT_CATALOGS}; }catch{ return {...DEFAULT_CATALOGS}; } }
function saveCatalogs(c){ try{ localStorage.setItem("sofshop_catalogs",JSON.stringify(c)); }catch{} }
let CATALOGS = loadCatalogs();

/* ── State ── */
let currentUser=null, selectedImgs=[], editProdId=null;
let assignOid=null, assignDrvId=null, gpsWatchId=null;
let adminMap=null, driverMap=null, driverMarkers={}, driverMarker=null;
let allOrders=[], allProducts=[], adsSelected=new Set(), pollTimer=null;
let allDriversCache=[], adminSocket=null;
let allUsersCache=[], userLocMarkers={}, usersMap=null;
let nearestDriverLayer=null, userFilter="all", selectedAdminCat=null;
const onlineUsers=new Set(JSON.parse(sessionStorage.getItem("sof_online")||"[]"));
const activeUsers=new Set(JSON.parse(sessionStorage.getItem("sof_active")||"[]"));

/* ════════════════════════════════════════
   SOCKET.IO
════════════════════════════════════════ */
function initAdminSocket(role,uid){
  if(adminSocket){ adminSocket.disconnect(); adminSocket=null; }
  if(typeof io==="undefined") return;
  const socket=io(BASE,{auth:{role,uid},reconnection:true,reconnectionDelay:1500,transports:["websocket","polling"]});
  adminSocket=socket;
  socket.on("connect",()=>{ socket.emit("join",{role,uid}); setSocketStatus(true); });
  socket.on("disconnect",()=>setSocketStatus(false));
  socket.on("connect_error",()=>setSocketStatus(false));
  if(role==="admin") bindAdminSocketEvents(socket);
  if(role==="driver") bindDriverSocketEvents(socket);
}
function setSocketStatus(on){
  document.querySelectorAll(".socket-dot").forEach(d=>{ d.classList.toggle("on",on); d.title=on?"Realtime: Ulangan ✅":"Realtime: Uzilgan ⚠"; });
}
function bindAdminSocketEvents(socket){
  socket.on("new_order",order=>{ allOrders.unshift(order); renderNewOrders(); showOrderNotification(order); });
  socket.on("order_updated",data=>{ const idx=allOrders.findIndex(o=>o.orderId===data.orderId); if(idx!==-1){ if(data.status==="on_way") allOrders[idx].status.onWay=true; if(data.status==="delivered") allOrders[idx].status.delivered=true; if(data.driverName) allOrders[idx].driverName=data.driverName; } renderNewOrders();renderDelivery();renderArchive(); });
  socket.on("user_location",({uid,lat,lng})=>{ const u=allUsersCache.find(x=>x.uid===uid); if(u){u.lat=lat;u.lng=lng;} if(userLocMarkers[uid]) userLocMarkers[uid].setLatLng([lat,lng]); });
  socket.on("driver_location",({uid,lat,lng})=>{ const d=allDriversCache.find(x=>x.uid===uid); if(d){d.lat=lat;d.lng=lng;} if(driverMarkers[uid]) driverMarkers[uid].setLatLng([lat,lng]); if(userLocMarkers["drv_"+uid]) userLocMarkers["drv_"+uid].setLatLng([lat,lng]); });
}
function bindDriverSocketEvents(socket){
  socket.on("order_assigned",()=>{ toast("📦 Yangi buyurtma tayinlandi!"); if(navigator.vibrate) navigator.vibrate([100,50,100,50,100]); fetchDriverOrders(); });
  socket.on("order_delivered",()=>fetchDriverOrders());
}
function showOrderNotification(order){
  const u=order.user||{},name=((u.firstName||"")+" "+(u.lastName||"")).trim();
  toast(`🔔 Yangi buyurtma! ${name||"Mijoz"} — ${(order.total||0).toLocaleString()} so'm`);
  if(Notification.permission==="granted") new Notification("🔔 SOF SHOP — Yangi buyurtma!",{body:`${name||"Mijoz"} · ${(order.total||0).toLocaleString()} so'm`,icon:"/favicon.ico"});
  else if(Notification.permission!=="denied") Notification.requestPermission();
}

/* ════════════════════════════════════════
   AUTH
════════════════════════════════════════ */
$("atLogin").addEventListener("click",()=>switchTab("login"));
$("atReg").addEventListener("click",  ()=>switchTab("reg"));
function switchTab(tab){
  $("atLogin").classList.toggle("active",tab==="login"); $("atReg").classList.toggle("active",tab==="reg");
  $("loginForm").classList.toggle("hidden",tab!=="login"); $("regForm").classList.toggle("hidden",tab!=="reg");
  $("authMsg").classList.add("hidden");
}
document.querySelectorAll(".role-opt").forEach(opt=>{
  opt.addEventListener("click",()=>{ document.querySelectorAll(".role-opt").forEach(o=>o.classList.remove("active")); opt.classList.add("active"); $("rRole").value=opt.dataset.role; });
});

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const phone=$("lPhone").value.trim(), pass=$("lPass").value;
  if(!phone||!pass){ showMsg($("authMsg"),"Telefon va parolni kiriting"); return; }
  try{ const data=await apiPost("/auth/login-admin",{phone,password:pass}); loginSuccess(data.user,data.token); }
  catch(err){ showMsg($("authMsg"),err.message); }
});

$("regForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const firstName=$("rFirst").value.trim(), lastName=$("rLast").value.trim();
  const phone=$("rPhone").value.trim(), pass=$("rPass").value, role=$("rRole").value;
  if(!firstName||!lastName||!phone||!pass){ showMsg($("authMsg"),"Barcha maydonlarni to'ldiring"); return; }
  if(pass.length<6){ showMsg($("authMsg"),"Parol kamida 6 ta belgi"); return; }
  try{ const data=await apiPost("/auth/register-admin",{firstName,lastName,phone,password:pass,role}); loginSuccess(data.user,data.token); }
  catch(err){ showMsg($("authMsg"),err.message); }
});

function loginSuccess(user,token){
  currentUser=user; _token=token;
  localStorage.setItem("sofAdminUser",JSON.stringify(user));
  localStorage.setItem("sofAdminToken",token);
  initAdminSocket(user.role,user.uid);
  startApp();
}

window.addEventListener("DOMContentLoaded",async()=>{
  try{ const res=await fetch(API+"/health"); if(!res.ok) throw new Error(); }
  catch{ showMsg($("authMsg"),"⚠ Backend ulanmadi! node server.js ishga tushirilganmi?","error"); }
  const saved=localStorage.getItem("sofAdminUser"), tok=localStorage.getItem("sofAdminToken");
  if(saved&&tok){
    try{ currentUser=JSON.parse(saved); _token=tok; initAdminSocket(currentUser.role,currentUser.uid); startApp(); }
    catch{ doLogout(); }
  }
});

$("adminLogout").addEventListener("click", doLogout);
$("driverLogout").addEventListener("click",doLogout);

function doLogout(){
  if(gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId);
  clearInterval(pollTimer);
  if(adminSocket){ adminSocket.disconnect(); adminSocket=null; }
  localStorage.removeItem("sofAdminUser"); localStorage.removeItem("sofAdminToken");
  currentUser=null; _token=null; location.reload();
}

function startApp(){
  $("authPage").classList.add("hidden");
  if(currentUser.role==="driver"){
    $("driverPage").classList.remove("hidden");
    initDriverPage();
  } else {
    $("adminPage").classList.remove("hidden");
    initAdminPage();
    if(Notification.permission==="default") Notification.requestPermission();
  }
}

/* ════════════════════════════════════════
   ADMIN PAGE
════════════════════════════════════════ */
function initAdminPage(){
  $("sbName").textContent=(currentUser.firstName+" "+currentUser.lastName).trim();
  $("sbAv").textContent=(currentUser.firstName?.[0]||"A").toUpperCase();

  document.querySelectorAll(".snav").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".snav").forEach(b=>b.classList.remove("active")); btn.classList.add("active");
      const titles={products:"Mahsulotlar",catalogs:"Kataloglar",orders:"Buyurtmalar",ads:"Reklamalar",outofstock:"Qolmagan mahsulotlar",users:"Foydalanuvchilar",drivers:"Shoferlar"};
      $("dashTitle").textContent=titles[btn.dataset.sec]||"";
      loadSection(btn.dataset.sec);
      closeSidebar();
    });
  });

  $("burger").addEventListener("click",()=>{ $("sidebar").classList.toggle("open"); $("sbOverlay").classList.toggle("show"); });
  $("sbOverlay").addEventListener("click",closeSidebar);

  /* Excel tugma — bir marta bog'laymiz */
  const excelBtn=$("exportExcelBtn");
  if(excelBtn){ excelBtn.onclick=exportToExcel; }

  pollTimer=setInterval(()=>{ if(!$("sec-orders").classList.contains("hidden")) fetchAndRenderOrders(); },10000);

  loadSection("products");
}

function closeSidebar(){
  $("sidebar").classList.remove("open");
  $("sbOverlay").classList.remove("show");
}

function loadSection(name){
  document.querySelectorAll(".dsec").forEach(s=>s.classList.add("hidden"));
  $("sec-"+name)?.classList.remove("hidden");
  ({
    products:  loadProductsSection,
    catalogs:  loadCatalogsSection,
    orders:    loadOrdersSection,
    ads:       loadAdsSection,
    outofstock:loadOutOfStockSection,
    users:     loadUsersSection,
    drivers:   loadDriversSection,
  })[name]?.();
}

/* ════════════════════════════════════════
   EXCEL EXPORT
   Ustunlar: 1-Katalog 2-Sub-katalog 3-Nomi
             4-Kodi 5-Qolgani 6-Bori 7-Narxi
════════════════════════════════════════ */
function exportToExcel(){
  /* Mahsulotlar yo'q bo'lsa serverdan yuklab olamiz */
  if(!allProducts.length){
    toast("⏳ Yuklanmoqda...");
    apiGet("/products")
      .then(list=>{ allProducts=list; doExport(list); })
      .catch(()=>toast("❌ Mahsulotlar yuklanmadi"));
    return;
  }
  /* Qidiruv filtri */
  const q=($("prodSearch")?.value||"").toLowerCase();
  const list = q
    ? allProducts.filter(p=>(p.name||"").toLowerCase().includes(q)||(p.code||"").toLowerCase().includes(q))
    : allProducts;
  doExport(list);
}

function doExport(list){
  if(!list.length){ toast("Mahsulot yo'q"); return; }

  /* ─── SheetJS XLSX ─── */
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  script.onload = () => _doExportXlsx(list);
  script.onerror = () => {
    // SheetJS yuklanmasa, CSV fallback
    _doExportCsv(list);
  };
  /* Agar allaqachon yuklangan bo'lsa */
  if(typeof XLSX !== "undefined"){ _doExportXlsx(list); return; }
  document.head.appendChild(script);
}

function _doExportXlsx(list){
  /* ─── USTUNLAR TARTIBI ─── */
  const headers = [
    "Katalog", "Sub-katalog", "Nomi", "Kodi",
    "Qolgani", "Bori",
    "Narxi (so'm)", "3 oy (so'm)", "6 oy (so'm)", "12 oy (so'm)"
  ];

  const jsonData = list.map(p => ({
    "Katalog":       p.category    || "",
    "Sub-katalog":   p.subcategory || "",
    "Nomi":          p.name        || "",
    "Kodi":          p.code        || "",
    "Qolgani":       safeNum(p.stock),
    "Bori":          safeNum(p.soldCount),
    "Narxi (so'm)":  safeNum(p.price),
    "3 oy (so'm)":   safeNum(p.price3m),
    "6 oy (so'm)":   safeNum(p.price6m),
    "12 oy (so'm)":  safeNum(p.price12m),
  }));

  const ws = XLSX.utils.json_to_sheet(jsonData, { header: headers });

  /* ─── Ustun kengliklarini avtomatik hisoblash ─── */
  const allRows = [headers, ...list.map(p => [
    p.category||"", p.subcategory||"", p.name||"", p.code||"",
    safeNum(p.stock), safeNum(p.soldCount),
    safeNum(p.price), safeNum(p.price3m), safeNum(p.price6m), safeNum(p.price12m)
  ])];
  ws["!cols"] = headers.map((_, ci) => ({
    wch: Math.max(...allRows.map(r => String(r[ci] ?? "").length), 10) + 2
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mahsulotlar");
  XLSX.writeFile(wb, "sofshop_mahsulotlar.xlsx", { bookType: "xlsx", type: "binary" });
  toast("✅ Excel yuklab olindi — " + list.length + " ta mahsulot");
}

function _doExportCsv(list){
  /* Zaxira: SheetJS yuklanmasa CSV */
  const rows = [
    ["Katalog","Sub-katalog","Nomi","Kodi","Qolgani","Bori","Narxi (so'm)","3 oy (so'm)","6 oy (so'm)","12 oy (so'm)"]
  ];
  list.forEach(p => rows.push([
    p.category||"", p.subcategory||"", p.name||"", p.code||"",
    safeNum(p.stock), safeNum(p.soldCount),
    safeNum(p.price), safeNum(p.price3m), safeNum(p.price6m), safeNum(p.price12m)
  ]));
  const csv = rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join("\t")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download="sofshop_mahsulotlar.csv";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  toast("✅ CSV yuklab olindi — "+list.length+" ta mahsulot");
}

/* ════════════════════════════════════════
   PRODUCTS
════════════════════════════════════════ */
function loadProductsSection(){
  document.querySelectorAll("[data-ptab]").forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll("[data-ptab]").forEach(b=>b.classList.remove("active")); btn.classList.add("active");
      document.querySelectorAll(".ptab").forEach(p=>p.classList.add("hidden")); $("ptab-"+btn.dataset.ptab).classList.remove("hidden");
      if(btn.dataset.ptab==="list") fetchAndRenderProdList();
    };
  });
  /* Search — bir marta bog'laymiz */
  const search=$("prodSearch");
  if(search && !search._bound){ search._bound=true; search.addEventListener("input",()=>renderProdList(allProducts)); }
  initProdForm();
  fetchProducts();
}

async function fetchProducts(){
  try{ allProducts=await apiGet("/products"); }
  catch(err){ toast("❌ "+err.message); }
}

function initProdForm(){
  if($("productForm")._inited) return;
  $("productForm")._inited=true;

  refreshProdFormCatalogs();
  $("pType").onchange=()=>{ const t=$("pType").value; $("discFi").classList.toggle("hidden",t==="new"); $("newFi").classList.toggle("hidden",t!=="new"); };

  const drop=$("imgDrop"), input=$("imgFile");
  drop.addEventListener("click",()=>input.click());
  drop.addEventListener("dragover",e=>{e.preventDefault();drop.classList.add("drag-over");});
  drop.addEventListener("dragleave",()=>drop.classList.remove("drag-over"));
  drop.addEventListener("drop",e=>{e.preventDefault();drop.classList.remove("drag-over");addImages([...e.dataTransfer.files]);});
  input.addEventListener("change",()=>{addImages([...input.files]);input.value="";});

  $("productForm").addEventListener("submit",saveProduct);
  $("cancelEdit").addEventListener("click",resetProdForm);
}

function refreshProdFormCatalogs(){
  if(!$("pCat")) return;
  $("pCat").innerHTML=Object.keys(CATALOGS).map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
  const fillSub=()=>{ $("pSub").innerHTML=Object.keys(CATALOGS[$("pCat").value]||{}).map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join(""); };
  $("pCat").onchange=fillSub; fillSub();
}

function addImages(files){
  files.forEach(f=>{
    if(!f.type.startsWith("image/")){ toast("Faqat rasm (jpg,png,webp)"); return; }
    if(selectedImgs.length>=10){ toast("Maksimal 10 ta rasm"); return; }
    selectedImgs.push(f);
  });
  renderImgPreview();
}
function renderImgPreview(){
  const grid=$("imgPreview"); grid.innerHTML="";
  selectedImgs.forEach((f,i)=>{ const t=document.createElement("div"); t.className="img-tile"; t.innerHTML=`<img src="${URL.createObjectURL(f)}"/><button class="img-tile-x" data-i="${i}" type="button">✕</button>`; grid.appendChild(t); });
  $("imgDropInner").innerHTML=selectedImgs.length===0
    ? `<div class="idi-icon">🖼</div><div class="idi-text">Rasmlarni tashlang yoki <b>tanlang</b></div><div class="idi-sub">JPG · PNG · WEBP</div>`
    : `<div class="idi-icon">➕</div><div class="idi-text"><b>Yana qo'shish</b> (${selectedImgs.length}/10)</div>`;
}
$("imgPreview").addEventListener("click",e=>{
  const btn=e.target.closest("[data-i]"); if(!btn) return;
  selectedImgs.splice(Number(btn.dataset.i),1); renderImgPreview();
});

async function saveProduct(e){
  e.preventDefault();
  const msg=$("prodMsg"); $("saveProdBtn").disabled=true; $("saveProdBtn").textContent="⏳...";
  try{
    let images=[];
    if(selectedImgs.length>0) images=await Promise.all(selectedImgs.map(fileToBase64));
    else if(editProdId) images=allProducts.find(p=>p.id===editProdId)?.images||[];
    const type=$("pType").value, discount=safeNum($("pDiscount").value), newDays=safeNum($("pNewDays").value)||7;
    if(type==="discount"&&discount<=0) throw new Error("Chegirma % kiriting (1..90)");
    const payload={
      name:$("pName").value.trim(), code:$("pCode").value.trim(),
      price:safeNum($("pPrice").value), price3m:safeNum($("p3m").value),
      price6m:safeNum($("p6m").value), price12m:safeNum($("p12m").value),
      stock:safeNum($("pStock").value),
      discountPercent:type==="discount"?discount:0,
      newUntil:type==="new"?(nowMs()+newDays*86400000):0,
      category:$("pCat").value, subcategory:$("pSub").value,
      colors:$("pColors").value.trim(), desc:$("pDesc").value.trim(), images,
    };
    if(!payload.name) throw new Error("Nomi kiritilmagan");
    if(!payload.code) throw new Error("Kodi kiritilmagan");
    if(editProdId){ await apiPut("/products/"+editProdId,payload); toast("✅ Yangilandi"); }
    else          { await apiPost("/products",payload);            toast("✅ Saqlandi"); }
    allProducts=await apiGet("/products"); resetProdForm();
    showMsg(msg,"Saqlandi!","success");
    document.querySelectorAll("[data-ptab]").forEach(b=>b.classList.toggle("active",b.dataset.ptab==="list"));
    document.querySelectorAll(".ptab").forEach(p=>p.classList.add("hidden")); $("ptab-list").classList.remove("hidden");
    renderProdList(allProducts);
  }catch(err){ showMsg(msg,err.message); }
  finally{ $("saveProdBtn").disabled=false; $("saveProdBtn").textContent=editProdId?"💾 Yangilash":"💾 Saqlash"; }
}

function resetProdForm(){
  editProdId=null; $("editId").value=""; $("productForm").reset(); $("pType").value="normal";
  $("discFi").classList.remove("hidden"); $("newFi").classList.add("hidden");
  selectedImgs=[]; renderImgPreview(); $("cancelEdit").classList.add("hidden");
  $("prodFormTitle").textContent="Yangi mahsulot kiritish"; $("saveProdBtn").textContent="💾 Saqlash";
}

async function fetchAndRenderProdList(){
  try{ allProducts=await apiGet("/products"); renderProdList(allProducts); }
  catch(err){ $("prodList").innerHTML=`<div class="empty-box">❌ ${err.message}</div>`; }
}

function renderProdList(products){
  const q=($("prodSearch")?.value||"").toLowerCase();
  const list=q?products.filter(p=>(p.name||"").toLowerCase().includes(q)||(p.code||"").toLowerCase().includes(q)):products;
  const c=$("prodList");
  if(!list.length){ c.innerHTML=`<div class="empty-box">Mahsulot topilmadi</div>`; return; }
  c.innerHTML=list.map(p=>{
    const img=p.images?.[0]||"", stock=safeNum(p.stock);
    return `
      <div class="prod-row">
        <div class="prod-thumb">${img?`<img src="${img}" alt=""/>`:""}</div>
        <div class="prod-info">
          <div class="prod-name">${esc(p.name||"—")}</div>
          <div class="prod-meta">${esc(p.code)} · ${fmt(p.price)}</div>
          <div class="prod-meta" style="color:${stock<=0?"#e11d2e":"#16a34a"};font-weight:700">
            ${stock<=0?"🔴 Tugagan":"✅ Stok: "+stock+" dona"}
            ${safeNum(p.soldCount)>0?" · "+safeNum(p.soldCount)+" sotildi":""}
          </div>
        </div>
        <div class="prod-acts">
          <button class="act-btn edit" data-action="edit" data-pid="${esc(p.id)}">✏ Tahrirlash</button>
          <button class="act-btn del"  data-action="del"  data-pid="${esc(p.id)}">🗑</button>
        </div>
      </div>`;
  }).join("");
  c.querySelectorAll("[data-action]").forEach(btn=>{
    btn.onclick=()=>btn.dataset.action==="edit"?startEdit(btn.dataset.pid):deleteProd(btn.dataset.pid);
  });
}

async function startEdit(id){
  editProdId=id; const p=allProducts.find(x=>x.id===id); if(!p) return;
  $("editId").value=id; $("pName").value=p.name||""; $("pCode").value=p.code||"";
  $("pPrice").value=p.price||0; $("p3m").value=p.price3m||0; $("p6m").value=p.price6m||0;
  $("p12m").value=p.price12m||0; $("pStock").value=safeNum(p.stock);
  $("pColors").value=p.colors||""; $("pDesc").value=p.desc||p.description||"";
  const disc=safeNum(p.discountPercent), isNewP=safeNum(p.newUntil)>nowMs();
  $("pType").value=disc>0?"discount":isNewP?"new":"normal"; $("pDiscount").value=disc;
  $("discFi").classList.toggle("hidden",$("pType").value==="new"); $("newFi").classList.toggle("hidden",$("pType").value!=="new");
  refreshProdFormCatalogs(); $("pCat").value=p.category||$("pCat").value; $("pCat").dispatchEvent(new Event("change")); $("pSub").value=p.subcategory||"";
  const prev=$("imgPreview");
  prev.innerHTML=(p.images||[]).map((url,i)=>`<div class="img-tile"><img src="${esc(url)}"/><button class="img-tile-x" data-existing="${i}" type="button">✕</button></div>`).join("");
  prev.querySelectorAll("[data-existing]").forEach(btn=>{
    btn.onclick=async()=>{
      const prod=allProducts.find(x=>x.id===editProdId); if(!prod) return;
      const imgs=[...(prod.images||[])]; imgs.splice(Number(btn.dataset.existing),1);
      await apiPut("/products/"+editProdId,{...prod,images:imgs});
      allProducts=await apiGet("/products"); startEdit(editProdId); toast("Rasm o'chirildi");
    };
  });
  $("imgDropInner").innerHTML=`<div class="idi-icon">➕</div><div class="idi-text"><b>Yangi rasm qo'shish</b></div>`;
  $("cancelEdit").classList.remove("hidden");
  $("prodFormTitle").textContent="✏ Tahrirlash: "+(p.name||"");
  $("saveProdBtn").textContent="💾 Yangilash";
  document.querySelectorAll("[data-ptab]").forEach(b=>b.classList.toggle("active",b.dataset.ptab==="add"));
  document.querySelectorAll(".ptab").forEach(pt=>pt.classList.add("hidden")); $("ptab-add").classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
}

async function deleteProd(id){
  if(!confirm("Mahsulotni o'chirasizmi?")) return;
  try{ await apiDel("/products/"+id); allProducts=await apiGet("/products"); renderProdList(allProducts); toast("🗑 O'chirildi"); }
  catch(err){ toast("❌ "+err.message); }
}

/* ════════════════════════════════════════
   QOLMAGAN BO'LIMI (OUT OF STOCK)
════════════════════════════════════════ */
async function loadOutOfStockSection(){
  const c=$("outOfStockList");
  if(!c){ console.error("outOfStockList element topilmadi!"); return; }

  c.innerHTML=`<div class="empty-box" style="color:#64748b">⏳ Yuklanmoqda...</div>`;

  try{
    const list = await apiGet("/products/out-of-stock");

    if(!list.length){
      c.innerHTML=`
        <div class="empty-box" style="color:#16a34a;font-weight:800;font-size:15px;padding:24px">
          ✅ Barcha mahsulotlar omborda mavjud!
        </div>`;
      return;
    }

    let html = `<div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">`;
    list.forEach(p=>{
      const img = p.images?.[0]||"";
      const sold = safeNum(p.soldCount);
      html += `
        <div class="oos-row" data-id="${esc(p.id)}">
          <div class="oos-info">
            <div class="oos-thumb">
              ${img?`<img src="${esc(img)}" loading="lazy" alt=""/>` : `<div style="display:grid;place-items:center;height:100%;color:#cbd5e1;font-size:20px">📦</div>`}
            </div>
            <div style="min-width:0;flex:1">
              <div class="oos-name">${esc(p.name||"—")}</div>
              <div class="oos-meta">Kod: <b>${esc(p.code||"—")}</b> &nbsp;·&nbsp; ${fmt(p.price)}</div>
              <div class="oos-meta" style="margin-top:3px">
                <span style="color:#e11d2e;font-weight:700;background:rgba(225,29,46,.08);padding:2px 8px;border-radius:6px">🔴 Stok: 0</span>
                ${sold>0?`&nbsp; <span style="color:#64748b">🛍 ${sold} ta sotilgan</span>`:""}
              </div>
            </div>
          </div>
          <div class="oos-actions">
            <input
              type="number"
              min="1"
              value="10"
              id="rs_${esc(p.id)}"
              class="oos-qty-input"
              placeholder="Dona"
            />
            <button
              class="abtn primary sm"
              data-restock="${esc(p.id)}"
              type="button"
            >✅ Qo'shish</button>
          </div>
        </div>`;
    });
    html += `</div>`;
    c.innerHTML = html;

    /* Tugma hodisalari */
    c.querySelectorAll("[data-restock]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id  = btn.dataset.restock;
        const inp = document.getElementById("rs_"+id);
        const qty = safeNum(inp?.value);
        if(qty<1){ toast("⚠️ Miqdor kamida 1 bo'lsin"); return; }

        const origText = btn.textContent;
        btn.disabled=true; btn.textContent="⏳...";

        try{
          await apiPut("/products/"+id+"/restock", { qty });
          toast(`✅ +${qty} dona qo'shildi!`);
          /* Animatsiya bilan olib tashlash */
          const row = c.querySelector(`.oos-row[data-id="${id}"]`);
          if(row){
            row.style.transition="all .35s ease";
            row.style.opacity="0";
            row.style.transform="translateX(40px)";
            setTimeout(()=>loadOutOfStockSection(), 380);
          } else {
            loadOutOfStockSection();
          }
        }catch(err){
          toast("❌ "+err.message);
          btn.disabled=false; btn.textContent=origText;
        }
      });
    });

  }catch(err){
    c.innerHTML=`<div class="empty-box" style="color:#e11d2e">❌ Xato: ${esc(err.message)}</div>`;
    console.error("loadOutOfStockSection error:", err);
  }
}

/* ════════════════════════════════════════
   KATALOGLAR BO'LIMI
════════════════════════════════════════ */
function loadCatalogsSection(){
  renderAdminCatList();
  renderAdminSubCatList();

  const addCatBtn=$("addCatBtn");
  if(addCatBtn && !addCatBtn._bound){
    addCatBtn._bound=true;
    addCatBtn.onclick=()=>{
      const name=$("newCatInput").value.trim();
      if(!name){ toast("Nom kiriting"); return; }
      if(CATALOGS[name]){ toast("Bu katalog allaqachon bor"); return; }
      CATALOGS[name]={}; saveCatalogs(CATALOGS); $("newCatInput").value="";
      renderAdminCatList(); refreshProdFormCatalogs(); toast("Qo'shildi ✅");
    };
  }

  const addSubBtn=$("addSubCatBtn");
  if(addSubBtn && !addSubBtn._bound){
    addSubBtn._bound=true;
    addSubBtn.onclick=()=>{
      if(!selectedAdminCat){ toast("Avval katalog tanlang"); return; }
      const name=$("newSubCatInput").value.trim();
      if(!name){ toast("Nom kiriting"); return; }
      if(CATALOGS[selectedAdminCat][name]){ toast("Bu sub-katalog allaqachon bor"); return; }
      CATALOGS[selectedAdminCat][name]=[]; saveCatalogs(CATALOGS); $("newSubCatInput").value="";
      renderAdminSubCatList(); refreshProdFormCatalogs(); toast("Qo'shildi ✅");
    };
  }
}

function renderAdminCatList(){
  const c=$("adminCatList"); if(!c) return;
  c.innerHTML=Object.keys(CATALOGS).map(cat=>`
    <div class="cat-item${cat===selectedAdminCat?" selected":""}" data-catname="${esc(cat)}">
      <span class="cat-item-name">${esc(cat)}</span>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="cat-count">${Object.keys(CATALOGS[cat]||{}).length} bo'lim</span>
        <button class="cat-del-btn" data-delcat="${esc(cat)}" type="button">🗑</button>
      </div>
    </div>`).join("")||`<div class="empty-box">Katalog yo'q</div>`;
  c.querySelectorAll("[data-catname]").forEach(el=>{
    el.onclick=e=>{ if(e.target.closest("[data-delcat]")) return; selectedAdminCat=el.dataset.catname; renderAdminCatList(); renderAdminSubCatList(); };
  });
  c.querySelectorAll("[data-delcat]").forEach(el=>{
    el.onclick=()=>{
      if(!confirm(`"${el.dataset.delcat}" katalogini o'chirasizmi?`)) return;
      delete CATALOGS[el.dataset.delcat]; saveCatalogs(CATALOGS);
      if(selectedAdminCat===el.dataset.delcat) selectedAdminCat=null;
      renderAdminCatList(); renderAdminSubCatList(); refreshProdFormCatalogs(); toast("O'chirildi ✅");
    };
  });
}

function renderAdminSubCatList(){
  const c=$("adminSubCatList"), lbl=$("selectedCatLabel"); if(!c) return;
  if(!selectedAdminCat||!CATALOGS[selectedAdminCat]){
    if(lbl) lbl.textContent="—";
    c.innerHTML=`<div class="empty-box">Chap tomondan katalog tanlang</div>`; return;
  }
  if(lbl) lbl.textContent=selectedAdminCat;
  c.innerHTML=Object.keys(CATALOGS[selectedAdminCat]||{}).map(sub=>`
    <div class="cat-item">
      <span class="cat-item-name">${esc(sub)}</span>
      <button class="cat-del-btn" data-delsub="${esc(sub)}" type="button">🗑</button>
    </div>`).join("")||`<div class="empty-box">Sub-katalog yo'q</div>`;
  c.querySelectorAll("[data-delsub]").forEach(el=>{
    el.onclick=()=>{
      if(!confirm(`"${el.dataset.delsub}" sub-katalogini o'chirasizmi?`)) return;
      delete CATALOGS[selectedAdminCat][el.dataset.delsub]; saveCatalogs(CATALOGS);
      renderAdminSubCatList(); refreshProdFormCatalogs(); toast("O'chirildi ✅");
    };
  });
}

/* ════════════════════════════════════════
   ORDERS
════════════════════════════════════════ */
function loadOrdersSection(){
  document.querySelectorAll("[data-otab]").forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll("[data-otab]").forEach(b=>b.classList.remove("active")); btn.classList.add("active");
      document.querySelectorAll(".otab").forEach(o=>o.classList.add("hidden")); $("otab-"+btn.dataset.otab).classList.remove("hidden");
    };
  });
  $("delivFilterDrv").onchange=renderDelivery; $("archFilterDrv").onchange=renderArchive;
  populateDriverFilters(); fetchAndRenderOrders();
}
async function fetchAndRenderOrders(){
  try{ allOrders=await apiGet("/orders"); renderNewOrders();renderDelivery();renderArchive(); }
  catch(err){ toast("❌ "+err.message); }
}
async function populateDriverFilters(){
  try{
    const drivers=await apiGet("/admin-users?role=driver");
    const opts=drivers.map(d=>`<option value="${esc(d.uid)}">${esc(d.firstName)} ${esc(d.lastName)}</option>`).join("");
    [$("delivFilterDrv"),$("archFilterDrv")].forEach(s=>{ s.innerHTML=`<option value="">Barcha shoferlar</option>`+opts; });
  }catch{}
}
function renderNewOrders(){ const list=allOrders.filter(o=>!o.status?.onWay&&!o.status?.delivered); $("newOrdersList").innerHTML=list.length?list.map(o=>orderCardHTML(o,"new")).join(""):`<div class="empty-box">Yangi buyurtma yo'q</div>`; bindOrderBtns($("newOrdersList")); }
function renderDelivery(){ const drv=$("delivFilterDrv")?.value||""; const list=allOrders.filter(o=>o.status?.onWay&&!o.status?.delivered&&(!drv||o.assignedDriver===drv)); $("deliveryList").innerHTML=list.length?list.map(o=>orderCardHTML(o,"delivery")).join(""):`<div class="empty-box">Yo'lda buyurtma yo'q</div>`; bindOrderBtns($("deliveryList")); }
function renderArchive(){ const drv=$("archFilterDrv")?.value||""; const list=allOrders.filter(o=>o.status?.delivered&&(!drv||o.assignedDriver===drv)); $("archiveList").innerHTML=list.length?list.map(o=>orderCardHTML(o,"done")).join(""):`<div class="empty-box">Arxiv bo'sh</div>`; bindOrderBtns($("archiveList")); }
function orderCardHTML(o,type){
  const u=o.user||{}, cls={new:"new",delivery:"delivery",done:"done"}, lbl={new:"🆕 Yangi",delivery:"🚗 Yo'lda",done:"✅ Yetkazildi"};
  const drv=o.driverName?`<br>🚗 Shofer: <b>${esc(o.driverName)}</b>`:"", short=(o.orderId||"").slice(-6).toUpperCase();
  return `<div class="o-card"><div class="o-head"><div class="o-id">Buyurtma #${esc(short)}</div><span class="o-badge ${cls[type]}">${lbl[type]}</span></div><div class="o-body">👤 ${esc((u.firstName||"")+" "+(u.lastName||""))} · 📞 ${esc(u.phone||"—")}<br>📍 ${esc((u.region||"")+", "+(u.district||""))}<br>💰 <b>${fmt(o.total||0)}</b>${drv}</div><div class="o-foot"><button class="abtn secondary sm" data-action="view" data-oid="${esc(o.orderId)}">📋 Chekni ko'rish</button>${type==="new"?`<button class="abtn primary sm" data-action="assign" data-oid="${esc(o.orderId)}">🚗 Yo'lga yuborish</button>`:""}</div></div>`;
}
function bindOrderBtns(container){ container.querySelectorAll("[data-action]").forEach(btn=>{ btn.onclick=()=>btn.dataset.action==="view"?openReceipt(btn.dataset.oid):openAssign(btn.dataset.oid); }); }
function openReceipt(oid){ const o=allOrders.find(x=>x.orderId===oid); if(!o) return; $("receiptBox").innerHTML=buildReceiptHTML(o); $("receiptModal").classList.remove("hidden"); }
$("receiptClose").addEventListener("click",()=>$("receiptModal").classList.add("hidden"));
function buildReceiptHTML(o){
  const u=o.user||{}, items=(o.items||[]).map(i=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f0"><span>${esc(i.name||"")} × ${safeNum(i.qty)}</span><b>${fmt((safeNum(i.finalPrice)||safeNum(i.price))*safeNum(i.qty))}</b></div>`).join("");
  return `<b style="font-size:16px">Buyurtma #${esc((o.orderId||"").slice(-6).toUpperCase())}</b><div style="color:#666;font-size:12px;margin-bottom:10px">${new Date(o.createdAt||0).toLocaleString("uz-UZ")}</div><b>Mijoz:</b> ${esc((u.firstName||"")+" "+(u.lastName||""))}<br><b>Tel:</b> ${esc(u.phone||"—")}<br><b>Manzil:</b> ${esc((u.region||"")+", "+(u.district||""))}<br><hr style="margin:10px 0;border:none;border-top:1px solid #eee"/>${items}<div style="display:flex;justify-content:space-between;margin-top:12px;font-size:16px"><b>Jami:</b><b style="color:#e11d2e">${fmt(o.total||0)}</b></div>`;
}
async function openAssign(oid){
  assignOid=oid; assignDrvId=null; $("assignMsg").classList.add("hidden");
  $("assignList").innerHTML=`<div class="empty-box">Yuklanmoqda...</div>`;
  $("assignModal").classList.remove("hidden");
  try{
    const drivers=await apiGet("/admin-users?role=driver");
    if(!drivers.length){ $("assignList").innerHTML=`<div class="empty-box">Shofer topilmadi</div>`; return; }
    $("assignList").innerHTML=drivers.map(d=>`<div class="assign-row" data-did="${esc(d.uid)}" data-dname="${esc(d.firstName+" "+d.lastName)}"><div class="assign-dot"></div><div><div class="assign-name">${esc(d.firstName)} ${esc(d.lastName)}</div><div class="assign-phone">${esc(d.phone)}</div></div></div>`).join("");
    $("assignList").querySelectorAll(".assign-row").forEach(row=>{ row.onclick=()=>{ $("assignList").querySelectorAll(".assign-row").forEach(r=>r.classList.remove("sel")); row.classList.add("sel"); assignDrvId=row.dataset.did; }; });
  }catch(err){ $("assignList").innerHTML=`<div class="empty-box">❌ ${err.message}</div>`; }
}
$("assignClose").addEventListener("click",()=>$("assignModal").classList.add("hidden"));
$("assignConfirm").addEventListener("click",async()=>{
  if(!assignDrvId){ showMsg($("assignMsg"),"Shofer tanlang"); return; }
  const row=$("assignList").querySelector(".assign-row.sel"), name=row?.dataset.dname||"";
  try{ await apiPut("/orders/"+assignOid+"/assign",{driverId:assignDrvId,driverName:name}); toast("✅ Shoferga yuborildi"); $("assignModal").classList.add("hidden"); await fetchAndRenderOrders(); }
  catch(err){ showMsg($("assignMsg"),err.message); }
});

/* ════════════════════════════════════════
   ADS
════════════════════════════════════════ */
async function loadAdsSection(){
  adsSelected.clear();
  try{
    const [products,ads]=await Promise.all([apiGet("/products"),apiGet("/ads")]);
    allProducts=products; ads.forEach(a=>adsSelected.add(a.id)); renderAdsList();
  }catch(err){ $("adsList").innerHTML=`<div class="empty-box">❌ ${err.message}</div>`; }

  const search=$("adsSearch");
  if(search && !search._bound){ search._bound=true; search.oninput=()=>{ const q=search.value.toLowerCase(); document.querySelectorAll(".ads-row").forEach(row=>{ row.style.display=row.querySelector(".ads-name").textContent.toLowerCase().includes(q)?"":"none"; }); }; }

  const saveBtn=$("saveAdsBtn");
  if(saveBtn && !saveBtn._bound){ saveBtn._bound=true; saveBtn.onclick=async()=>{ try{ const ids=[...$("adsList").querySelectorAll(".ads-row.sel")].map(r=>r.dataset.pid); await apiPost("/ads",{productIds:ids}); showMsg($("adsMsg"),"✅ Reklama saqlandi!","success"); toast("✅ Saqlandi"); }catch(err){ showMsg($("adsMsg"),err.message); } }; }
}

function renderAdsList(){
  const c=$("adsList");
  if(!allProducts.length){ c.innerHTML=`<div class="empty-box">Mahsulotlar yo'q</div>`; return; }
  c.innerHTML=allProducts.map(p=>{ const sel=adsSelected.has(p.id), img=p.images?.[0]||""; return `<div class="ads-row ${sel?"sel":""}" data-pid="${esc(p.id)}"><div class="ads-chk">${sel?"✓":""}</div><div class="ads-thumb">${img?`<img src="${img}" alt=""/>`:""}</div><div><div class="ads-name">${esc(p.name||"—")}</div><div class="ads-price">${fmt(p.price)}</div></div></div>`; }).join("");
  c.querySelectorAll(".ads-row").forEach(row=>{ row.onclick=()=>{ row.classList.toggle("sel"); row.querySelector(".ads-chk").textContent=row.classList.contains("sel")?"✓":""; }; });
}

/* ════════════════════════════════════════
   USERS
════════════════════════════════════════ */
async function loadUsersSection(){
  clearTimeout(loadUsersSection._mapTimer);
  try{ const users=await apiGet("/users"); allUsersCache=users; renderUsersStats(users); renderUsersList(users); }
  catch(err){ $("usersList").innerHTML=`<div class="empty-box">❌ ${err.message}</div>`; }
  initUsersMap();
  const search=$("usersSearch");
  if(search && !search._bound){ search._bound=true; search.oninput=()=>{ const q=search.value.toLowerCase(); renderUsersList(allUsersCache.filter(u=>(u.firstName+" "+u.lastName).toLowerCase().includes(q)||(u.phone||"").includes(q)||(u.email||"").toLowerCase().includes(q))); }; }
  document.querySelectorAll(".uf-btn").forEach(btn=>{ btn.onclick=()=>{ document.querySelectorAll(".uf-btn").forEach(b=>b.classList.remove("active")); btn.classList.add("active"); userFilter=btn.dataset.uf; applyUserFilter(); }; });
}
function renderUsersStats(users){ $("statTotal").textContent=users.length; $("statOnline").textContent=users.filter(u=>onlineUsers.has(u.uid)).length; $("statActive").textContent=users.filter(u=>activeUsers.has(u.uid)).length; $("statInactive").textContent=users.length-users.filter(u=>activeUsers.has(u.uid)).length; }
function applyUserFilter(){ let list=allUsersCache; if(userFilter==="online") list=list.filter(u=>onlineUsers.has(u.uid)); if(userFilter==="active") list=list.filter(u=>activeUsers.has(u.uid)); if(userFilter==="inactive") list=list.filter(u=>!activeUsers.has(u.uid)); renderUsersList(list); }
function renderUsersList(users){
  const c=$("usersList");
  if(!users.length){ c.innerHTML=`<div class="empty-box">Foydalanuvchi topilmadi</div>`; return; }
  c.innerHTML=users.map(u=>{ const isOnline=onlineUsers.has(u.uid),isActive=activeUsers.has(u.uid),statusCls=isOnline?"status-online":isActive?"status-active":"status-inactive",statusLbl=isOnline?"🟢 Online":isActive?"🔵 Kirgan":"⚪ Chiqqan",hasLoc=u.lat&&u.lng; return `<div class="u-row u-row-click" data-uid="${esc(u.uid)}" style="cursor:pointer"><div class="u-av">${(u.firstName?.[0]||"?").toUpperCase()}</div><div class="u-info"><div class="u-name">${esc((u.firstName||"")+" "+(u.lastName||""))}</div><div class="u-meta">${esc(u.phone||"—")} · ${esc(u.email||"—")}</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px"><span class="u-badge ${statusCls}">${statusLbl}</span>${hasLoc?`<button class="map-loc-btn" data-uid="${esc(u.uid)}" data-lat="${u.lat}" data-lng="${u.lng}">📍</button>`:""}</div></div>`; }).join("");
  c.querySelectorAll(".u-row-click").forEach(row=>{ row.onclick=e=>{ if(e.target.closest(".map-loc-btn")) return; const u=allUsersCache.find(x=>x.uid===row.dataset.uid); if(u) openUserModal(u); }; });
  c.querySelectorAll(".map-loc-btn").forEach(btn=>{ btn.onclick=e=>{ e.stopPropagation(); const lat=parseFloat(btn.dataset.lat),lng=parseFloat(btn.dataset.lng); if(usersMap){ usersMap.setView([lat,lng],15); userLocMarkers[btn.dataset.uid]?.openPopup(); $("usersMapWrap").scrollIntoView({behavior:"smooth"}); } }; });
}
function openUserModal(u){
  const isOnline=onlineUsers.has(u.uid),isActive=activeUsers.has(u.uid);
  $("umName").textContent=(u.firstName||"")+" "+(u.lastName||""); $("umEmail").textContent=u.email||"—"; $("umPhone").textContent=u.phone||"—"; $("umId").textContent=u.customerId||u.uid||"—"; $("umRegion").textContent=(u.region||"")+(u.district?", "+u.district:"")||"—"; $("umStatus").textContent=isOnline?"🟢 Online":isActive?"🔵 Kirgan":"⚪ Chiqib ketgan"; $("umAv").textContent=(u.firstName?.[0]||"?").toUpperCase();
  if(u.lat&&u.lng){ $("umMapLink").href=`https://www.google.com/maps?q=${u.lat},${u.lng}`; $("umMapLink").classList.remove("hidden"); $("umMapBtn").classList.remove("hidden"); $("umMapBtn").onclick=()=>{ $("userModal").classList.add("hidden"); if(usersMap){ usersMap.setView([u.lat,u.lng],15); userLocMarkers[u.uid]?.openPopup(); setTimeout(()=>showNearestDriver(u.lat,u.lng),300); $("usersMapWrap").scrollIntoView({behavior:"smooth"}); } }; }
  else{ $("umMapLink").classList.add("hidden"); $("umMapBtn").classList.add("hidden"); }
  $("userModal").classList.remove("hidden");
}
$("userModalClose").addEventListener("click",()=>$("userModal").classList.add("hidden"));
$("userModal").addEventListener("click",e=>{ if(e.target===$("userModal")) $("userModal").classList.add("hidden"); });

function initUsersMap(){
  if(usersMap){ usersMap.invalidateSize(); refreshUsersMapMarkers(); return; }
  usersMap=L.map("usersMap").setView([41.2995,69.2401],11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(usersMap);
  refreshUsersMapMarkers(); loadUsersSection._mapTimer=setInterval(refreshUsersMapMarkers,20000);
}
async function refreshUsersMapMarkers(){
  try{ const drivers=await apiGet("/admin-users?role=driver"); allDriversCache=drivers; drivers.forEach(d=>{ if(!d.lat||!d.lng) return; const icon=L.divIcon({className:"",html:`<div class="map-marker-driver" title="${d.firstName} ${d.lastName}">🚗</div>`,iconSize:[38,38],iconAnchor:[19,19]}); if(userLocMarkers["drv_"+d.uid]) userLocMarkers["drv_"+d.uid].setLatLng([d.lat,d.lng]); else userLocMarkers["drv_"+d.uid]=L.marker([d.lat,d.lng],{icon}).addTo(usersMap).bindPopup(`<b>🚗 Shofer</b><br>${d.firstName} ${d.lastName}<br>📞 ${d.phone}`); }); }catch{}
  allUsersCache.forEach(u=>{ if(!u.lat||!u.lng) return; const icon=L.divIcon({className:"",html:`<div class="map-marker-user">${(u.firstName?.[0]||"?").toUpperCase()}</div>`,iconSize:[32,32],iconAnchor:[16,16]}); if(userLocMarkers[u.uid]) userLocMarkers[u.uid].setLatLng([u.lat,u.lng]); else{ userLocMarkers[u.uid]=L.marker([u.lat,u.lng],{icon}).addTo(usersMap).bindPopup(`<b>${u.firstName||""} ${u.lastName||""}</b><br>📞 ${u.phone||"—"}<br>✉️ ${u.email||"—"}<br><a href="https://www.google.com/maps?q=${u.lat},${u.lng}" target="_blank" style="color:#e11d2e">🗺 Google Maps</a>`); userLocMarkers[u.uid].on("click",()=>showNearestDriver(u.lat,u.lng)); } });
}
function showNearestDriver(userLat,userLng){
  if(!usersMap) return; if(nearestDriverLayer){ usersMap.removeLayer(nearestDriverLayer); nearestDriverLayer=null; }
  const driversWithLoc=allDriversCache.filter(d=>d.lat&&d.lng); if(!driversWithLoc.length){ toast("📍 GPS faol shofer topilmadi"); return; }
  let nearest=null,minDist=Infinity; driversWithLoc.forEach(d=>{ const dist=calcDistance(userLat,userLng,d.lat,d.lng); if(dist<minDist){minDist=dist;nearest=d;} });
  if(!nearest) return; nearestDriverLayer=L.layerGroup().addTo(usersMap);
  L.polyline([[userLat,userLng],[nearest.lat,nearest.lng]],{color:"#e11d2e",weight:3,dashArray:"8,5",opacity:.85}).addTo(nearestDriverLayer);
  const midLat=(userLat+nearest.lat)/2,midLng=(userLng+nearest.lng)/2,distKm=minDist.toFixed(1);
  L.marker([midLat,midLng],{icon:L.divIcon({className:"",html:`<div class="map-dist-label">${distKm} km</div>`,iconSize:[80,28],iconAnchor:[40,14]})}).addTo(nearestDriverLayer);
  toast(`🚗 Eng yaqin shofer: ${nearest.firstName} ${nearest.lastName} — ${distKm} km`);
  usersMap.fitBounds([[userLat,userLng],[nearest.lat,nearest.lng]],{padding:[50,50]});
}

/* ════════════════════════════════════════
   DRIVERS
════════════════════════════════════════ */
async function loadDriversSection(){
  if(!adminMap){ adminMap=L.map("adminMap").setView([41.2995,69.2401],12); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(adminMap); }
  try{
    const drivers=await apiGet("/admin-users?role=driver"); allDriversCache=drivers; renderDriversList(drivers);
    drivers.forEach(d=>{ if(!d.lat||!d.lng) return; const icon=L.divIcon({className:"",html:`<div class="map-marker-driver">🚗</div>`,iconSize:[38,38],iconAnchor:[19,38]}); if(driverMarkers[d.uid]) driverMarkers[d.uid].setLatLng([d.lat,d.lng]); else driverMarkers[d.uid]=L.marker([d.lat,d.lng],{icon}).addTo(adminMap).bindPopup(`<b>🚗 ${d.firstName} ${d.lastName}</b><br>📞 ${d.phone}`); });
  }catch(err){ $("driversList").innerHTML=`<div class="empty-box">❌ ${err.message}</div>`; }
  clearTimeout(loadDriversSection._t); loadDriversSection._t=setTimeout(loadDriversSection,15000);
}
function renderDriversList(drivers){
  const c=$("driversList");
  if(!drivers.length){ c.innerHTML=`<div class="empty-box">Hali shofer yo'q</div>`; return; }
  c.innerHTML=drivers.map(d=>`<div class="u-row driver-row-click" data-uid="${esc(d.uid)}" data-lat="${d.lat||""}" data-lng="${d.lng||""}" style="cursor:pointer"><div class="u-av" style="background:linear-gradient(135deg,#0284c7,#38bdf8)">🚗</div><div class="u-info"><div class="u-name">${esc(d.firstName)} ${esc(d.lastName)}</div><div class="u-meta">${esc(d.phone)}</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px"><span class="u-badge driver">🚗 Shofer</span>${d.lat?`<span class="gps-badge">📍 GPS faol</span>`:`<span class="gps-badge off">GPS yo'q</span>`}</div></div>`).join("");
  c.querySelectorAll(".driver-row-click").forEach(row=>{ row.onclick=()=>{ const lat=parseFloat(row.dataset.lat),lng=parseFloat(row.dataset.lng); if(!lat||!lng){toast("⚠ GPS koordinatasi yo'q");return;} if(adminMap){adminMap.setView([lat,lng],16);if(driverMarkers[row.dataset.uid]) driverMarkers[row.dataset.uid].openPopup();$("adminMap").scrollIntoView({behavior:"smooth"});} }; });
}

/* ════════════════════════════════════════
   DRIVER PAGE
════════════════════════════════════════ */
let driverCurrentLat=null, driverCurrentLng=null, orderClientMarkers={};

function initDriverPage(){
  $("driverLabel").textContent=(currentUser.firstName+" "+currentUser.lastName).trim();
  const av=$("drvAvatar"); if(av) av.textContent=(currentUser.firstName?.[0]||"S").toUpperCase();
  driverMap=L.map("driverMap",{zoomControl:false}).setView([41.2995,69.2401],13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OSM"}).addTo(driverMap);
  L.control.zoom({position:"bottomright"}).addTo(driverMap);
  startAutoDriverGPS(); fetchDriverOrders(); setInterval(fetchDriverOrders,12000);
}

function startAutoDriverGPS(){
  if(!navigator.geolocation){ setDriverGPSStatus("error","GPS qo'llab-quvvatlanmaydi","Qurilmangizda GPS yo'q"); return; }
  setDriverGPSStatus("loading","Aniqlanmoqda...","GPS signal qidirilmoqda");
  const onSuccess=pos=>{
    const {latitude:lat,longitude:lng,accuracy}=pos.coords;
    driverCurrentLat=lat; driverCurrentLng=lng;
    const overlay=$("drvMapOverlay"); if(overlay) overlay.classList.add("hidden");
    setDriverGPSStatus("online","GPS Faol — Online",`Aniqlik: ~${Math.round(accuracy)} m`);
    const coords=$("drvCoords"); if(coords) coords.textContent=`${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const icon=L.divIcon({className:"",html:`<div class="drv-map-marker"><div class="drv-marker-pulse"></div><div class="drv-marker-icon">🚗</div></div>`,iconSize:[52,52],iconAnchor:[26,26]});
    if(!driverMarker){ driverMarker=L.marker([lat,lng],{icon}).addTo(driverMap).bindPopup(`<b>${currentUser.firstName} ${currentUser.lastName}</b>`).openPopup(); setTimeout(()=>fitMapToAll(),800); }
    else driverMarker.setLatLng([lat,lng]);
    updateOrderMapLines();
    fetch(API+"/admin-users/"+currentUser.uid+"/location",{method:"PUT",headers:{"Content-Type":"application/json","Authorization":"Bearer "+_token},body:JSON.stringify({lat,lng})}).catch(()=>{});
  };
  const onError=err=>{ if(err.code===1) setDriverGPSStatus("error","GPS ruxsat berilmadi","Brauzer sozlamalaridan ruxsat bering"); else if(err.code===2) setDriverGPSStatus("error","GPS signal yo'q","Ochiq joyga chiqing"); else{ setDriverGPSStatus("warn","GPS ulanmoqda...","Qayta urinilmoqda"); setTimeout(startAutoDriverGPS,5000); } };
  navigator.geolocation.getCurrentPosition(onSuccess,onError,{enableHighAccuracy:true,timeout:10000,maximumAge:0});
  if(gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId);
  gpsWatchId=navigator.geolocation.watchPosition(onSuccess,onError,{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
}

function setDriverGPSStatus(state,title,sub){
  const dot=$("gpsDot"),label=$("gpsLabel"),pill=$("drvGpsPill"),banner=$("drvStatusBanner"),icon=$("drvStatusIcon"),stitle=$("drvStatusTitle"),ssub=$("drvStatusSub");
  if(dot){dot.className="drv-gps-dot";if(state==="online") dot.classList.add("on");if(state==="error") dot.classList.add("err");if(state==="warn") dot.classList.add("warn");if(state==="loading") dot.classList.add("loading");}
  if(label) label.textContent=title;
  if(pill){pill.className="drv-gps-pill";if(state==="online") pill.classList.add("online");if(state==="error") pill.classList.add("error");if(state==="warn") pill.classList.add("warn");}
  if(banner){banner.className="drv-status-banner";if(state==="online") banner.classList.add("online");if(state==="error") banner.classList.add("error");if(state==="warn") banner.classList.add("warn");}
  if(icon) icon.textContent=state==="online"?"📍":state==="error"?"⚠️":state==="warn"?"🔄":"📡";
  if(stitle) stitle.textContent=title; if(ssub) ssub.textContent=sub;
}

function fitMapToAll(){ if(!driverMap) return; const bounds=[]; if(driverCurrentLat) bounds.push([driverCurrentLat,driverCurrentLng]); Object.values(orderClientMarkers).forEach(l=>{ if(l?.marker) bounds.push(l.marker.getLatLng()); }); if(bounds.length>1) driverMap.fitBounds(bounds,{padding:[60,60]}); else if(bounds.length===1) driverMap.setView(bounds[0],15); }

async function fetchDriverOrders(){
  const list=$("driverOrdersList"),empty=$("driverOrdersEmpty"),cnt=$("drvOrdersCount");
  try{
    const orders=await apiGet("/orders/driver/"+currentUser.uid);
    if(cnt) cnt.textContent=orders.length;
    if(!orders.length){ list.innerHTML=""; empty.classList.remove("hidden"); clearOrderMapLayers(); return; }
    empty.classList.add("hidden");
    list.innerHTML=orders.map(o=>{ const u=o.user||{},short=(o.orderId||"").slice(-6).toUpperCase(),hasLoc=u.lat&&u.lng; let distHtml=""; if(hasLoc&&driverCurrentLat&&driverCurrentLng){ const km=calcDistance(driverCurrentLat,driverCurrentLng,u.lat,u.lng); distHtml=`<div class="drv-oc-dist"><span class="drv-dist-badge">📏 ${km<1?Math.round(km*1000)+" m":km.toFixed(1)+" km"} uzoqlikda</span></div>`; } return `<div class="drv-order-card" data-oid="${esc(o.orderId)}"><div class="drv-oc-head"><div class="drv-oc-id">#${esc(short)}</div><div class="drv-oc-price">${fmt(o.total||0)}</div></div><div class="drv-oc-client"><div class="drv-oc-av">${(u.firstName?.[0]||"?").toUpperCase()}</div><div style="flex:1"><div class="drv-oc-name">${esc((u.firstName||"")+" "+(u.lastName||""))}</div><div class="drv-oc-phone">📞 ${esc(u.phone||"—")}</div></div></div><div class="drv-oc-addr">📍 ${esc((u.region||"")+", "+(u.district||""))}</div>${distHtml}${hasLoc?`<button class="drv-btn-map" data-map="${esc(o.orderId)}" data-lat="${u.lat}" data-lng="${u.lng}">🗺 Xaritada ko'rish</button>`:""}<div class="drv-oc-btns"><button class="drv-btn-sec" data-action="view" data-oid="${esc(o.orderId)}">📋 Chek</button><button class="drv-btn-pri" data-action="done" data-oid="${esc(o.orderId)}">✅ Yetkazib berdim</button></div></div>`; }).join("");
    orders.forEach(o=>showClientOnMap(o));
    list.querySelectorAll("[data-action]").forEach(btn=>{ btn.onclick=async()=>{ const oid=btn.dataset.oid; if(btn.dataset.action==="view"){ const o=orders.find(x=>x.orderId===oid); if(o){$("receiptBox").innerHTML=buildReceiptHTML(o);$("receiptModal").classList.remove("hidden");} } if(btn.dataset.action==="done"){ if(!confirm("Buyurtmani yetkazganingizni tasdiqlaysizmi?")) return; try{btn.textContent="⏳...";btn.disabled=true;await apiPut("/orders/"+oid+"/delivered",{});toast("✅ Yetkazildi!");removeOrderMapLayer(oid);fetchDriverOrders();}catch(err){toast("❌ "+err.message);btn.textContent="✅ Yetkazib berdim";btn.disabled=false;} } }; });
    list.querySelectorAll("[data-map]").forEach(btn=>{ btn.onclick=()=>{ const lat=parseFloat(btn.dataset.lat),lng=parseFloat(btn.dataset.lng),oid=btn.dataset.map; if(!driverMap) return; const bounds=[]; if(driverCurrentLat) bounds.push([driverCurrentLat,driverCurrentLng]); bounds.push([lat,lng]); if(bounds.length>1) driverMap.fitBounds(bounds,{padding:[60,60]}); else driverMap.setView([lat,lng],15); $("driverMap").scrollIntoView({behavior:"smooth",block:"start"}); orderClientMarkers[oid]?.marker?.openPopup(); }; });
  }catch(err){ list.innerHTML=`<div class="drv-empty"><div class="drv-empty-icon">❌</div><div>${err.message}</div></div>`; }
}

function showClientOnMap(order){
  if(!driverMap) return; const u=order.user||{}; if(!u.lat||!u.lng) return; const oid=order.orderId; removeOrderMapLayer(oid);
  const clientIcon=L.divIcon({className:"",html:`<div class="drv-client-marker"><div class="drv-client-pulse"></div><div class="drv-client-icon">${(u.firstName?.[0]||"?").toUpperCase()}</div></div>`,iconSize:[44,44],iconAnchor:[22,22]});
  const marker=L.marker([u.lat,u.lng],{icon:clientIcon}).addTo(driverMap).bindPopup(`<b>${esc((u.firstName||"")+" "+(u.lastName||""))}</b><br>📞 ${esc(u.phone||"—")}<br>📍 ${esc((u.region||"")+", "+(u.district||""))}`);
  let polyline=null, distLabel=null;
  if(driverCurrentLat&&driverCurrentLng){
    const km=calcDistance(driverCurrentLat,driverCurrentLng,u.lat,u.lng),distText=km<1?Math.round(km*1000)+" m":km.toFixed(1)+" km";
    polyline=L.polyline([[driverCurrentLat,driverCurrentLng],[u.lat,u.lng]],{color:"#3b82f6",weight:3,dashArray:"8 6",opacity:.85}).addTo(driverMap);
    const midLat=(driverCurrentLat+u.lat)/2,midLng=(driverCurrentLng+u.lng)/2;
    distLabel=L.marker([midLat,midLng],{icon:L.divIcon({className:"",html:`<div class="drv-dist-map-label">${distText}</div>`,iconSize:[80,28],iconAnchor:[40,14]})}).addTo(driverMap);
  }
  orderClientMarkers[oid]={marker,polyline,distLabel,userUid:order.userUid};
}
function updateOrderMapLines(){ if(!driverCurrentLat||!driverCurrentLng) return; Object.entries(orderClientMarkers).forEach(([oid,layers])=>{ if(!layers?.marker) return; const ll=layers.marker.getLatLng(); rebuildLine(oid,layers,ll.lat,ll.lng); }); }
function updateClientLineByUid(uid,lat,lng){ Object.entries(orderClientMarkers).forEach(([oid,layers])=>{ if(!layers||layers.userUid!==uid) return; layers.marker.setLatLng([lat,lng]); rebuildLine(oid,layers,lat,lng); }); }
function rebuildLine(oid,layers,clientLat,clientLng){
  const km=calcDistance(driverCurrentLat,driverCurrentLng,clientLat,clientLng),distText=km<1?Math.round(km*1000)+" m":km.toFixed(1)+" km";
  if(layers.polyline) layers.polyline.setLatLngs([[driverCurrentLat,driverCurrentLng],[clientLat,clientLng]]);
  else{ const p=L.polyline([[driverCurrentLat,driverCurrentLng],[clientLat,clientLng]],{color:"#3b82f6",weight:3,dashArray:"8 6",opacity:.85}).addTo(driverMap); orderClientMarkers[oid]={...layers,polyline:p}; }
  const midLat=(driverCurrentLat+clientLat)/2,midLng=(driverCurrentLng+clientLng)/2;
  if(layers.distLabel){ layers.distLabel.setLatLng([midLat,midLng]); const el=layers.distLabel.getElement(); if(el){const lbl=el.querySelector(".drv-dist-map-label");if(lbl) lbl.textContent=distText;} }
  const card=document.querySelector(`.drv-order-card[data-oid="${oid}"]`); if(card){const badge=card.querySelector(".drv-dist-badge");if(badge) badge.textContent=`📏 ${distText} uzoqlikda`;}
}
function removeOrderMapLayer(oid){ const layers=orderClientMarkers[oid]; if(!layers) return; if(layers.marker) driverMap?.removeLayer(layers.marker); if(layers.polyline) driverMap?.removeLayer(layers.polyline); if(layers.distLabel) driverMap?.removeLayer(layers.distLabel); delete orderClientMarkers[oid]; }
function clearOrderMapLayers(){ Object.keys(orderClientMarkers).forEach(removeOrderMapLayer); }