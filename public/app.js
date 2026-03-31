/* ==========================================================
   SOF SHOP — app.js
   ✅ Firebase Auth
   ✅ PostgreSQL backend
   ✅ Socket.io realtime
   ✅ GPS tracking
   ✅ Katalog (localStorage)
   ✅ Stock / sold_count / out-of-stock
   ✅ Installment tabs
   ✅ Reviews
   ✅ Profile tabs
========================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBscHNUMxO99kiqJFcDT-aIA9m3r_o2Pyg",
  authDomain: "sofmebel-e44bb.firebaseapp.com",
  projectId: "sofmebel-e44bb",
  storageBucket: "sofmebel-e44bb.firebasestorage.app",
  messagingSenderId: "876873009974",
  appId: "1:876873009974:web:1246fcc90f5297259f8197",
  measurementId: "G-PWWPTS1256"
};

const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);

const BASE = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "http://localhost:4000"
  : location.origin;
const API        = BASE + "/api";
const SOCKET_URL = BASE;

const ADMIN_CODE  = "/789456123159";
const DRIVER_CODE = "/shofer15948";

/* ── Katalog (localStorage) ── */
const DEFAULT_CATALOGS = {
  "🛏️ Mebellar": {"🛏️ Yotoqxona":[],"🛋️ Mexmonxona":[],"🛋️ Yumshoq":[],"🍽️ Stol-stul":[],"🍴 Oshxona":[],"👶 Bolalar":[],"💼 Ofis":[],"🚪 Shkaflar":[]},
  "🎨 Aksesuarlar": {"🪞 Oynalar":[],"🖼️ Kartinalar":[]},
  "📺 Maishiy texnika": {"❄️ Muzlatkich":[],"🧼 Kir yuvish":[],"🔥 Gaz plita":[],"🌀 Konditsioner":[],"🔌 Boshqa":[]},
  "🏃 Sport": {"🏃 Yugurish":[],"🚴 Velo":[],"💆 Massaj":[]},
  "📱 Telefonlar": {"📱 Samsung":[],"📱 Redmi":[],"📱 Honor":[]}
};
function loadCatalogs(){ try{ const s=localStorage.getItem("sofshop_catalogs"); return s?JSON.parse(s):{...DEFAULT_CATALOGS}; }catch{ return {...DEFAULT_CATALOGS}; } }
function saveCatalogs(c){ try{ localStorage.setItem("sofshop_catalogs",JSON.stringify(c)); }catch{} }
let CATALOGS = loadCatalogs();

/* ── Regions ── */
const REGIONS = {
  "Toshkent shahri":["Uchtepa","Chilonzor","Yunusobod","Mirzo Ulug'bek","Sergeli","Yakkasaroy","Shayxontohur","Olmazor","Mirobod","Yashnobod","Bektemir"],
  "Toshkent viloyati":["Bekobod","Bo'ka","Bo'stonliq","Chinoz","Ohangaron","Oqqo'rg'on","O'rta Chirchiq","Parkent","Piskent","Qibray","Quyi Chirchiq","Toshkent tumani","Yangiyo'l","Yuqori Chirchiq","Zangiota"],
  "Samarqand viloyati":["Samarqand","Urgut","Toyloq","Jomboy","Paxtachi","Ishtixon","Kattaqo'rg'on"],
  "Andijon viloyati":["Andijon","Asaka","Baliqchi","Marhamat","Shahrixon","Xo'jaobod","Qo'rg'ontepa"],
  "Farg'ona viloyati":["Farg'ona","Quva","Rishton","Qo'shtepa","Oltiariq","Toshloq","Beshariq"],
  "Namangan viloyati":["Namangan","Chortoq","Chust","Pop","To'raqo'rg'on","Uchqo'rg'on"],
  "Buxoro viloyati":["Buxoro","G'ijduvon","Jondor","Kogon","Olot","Romitan"],
  "Xorazm viloyati":["Urganch","Hazorasp","Qo'shko'pir","Shovot","Gurlan"],
  "Qashqadaryo viloyati":["Qarshi","Shahrisabz","Yakkabog'","G'uzor","Koson"],
  "Surxondaryo viloyati":["Termiz","Denov","Sherobod","Sho'rchi","Boysun"],
  "Sirdaryo viloyati":["Guliston","Boyovut","Sardoba","Sayxunobod","Xovos"],
  "Jizzax viloyati":["Jizzax","Zomin","Forish","Paxtakor","Do'stlik"],
  "Navoiy viloyati":["Karmana","Qiziltepa","Xatirchi","Nurota","Uchquduq"],
  "Qoraqalpog'iston":["Nukus","Qo'ng'irot","Beruniy","To'rtko'l","Xo'jayli"]
};

/* ── API ── */
async function apiFetch(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res  = await fetch(API + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Server xatosi");
    return data;
  } catch (err) {
    if (err.message === "Failed to fetch") throw new Error("Server bilan ulanib bo'lmadi");
    throw err;
  }
}
const apiGet  = p      => apiFetch("GET",    p);
const apiPost = (p, b) => apiFetch("POST",   p, b);
const apiPut  = (p, b) => apiFetch("PUT",    p, b);
const apiDel  = (p, b) => apiFetch("DELETE", p, b);

/* ── Helpers ── */
const $       = id => document.getElementById(id);
const show    = el => el && el.classList.remove("hidden");
const hide    = el => el && el.classList.add("hidden");
const nowMs   = () => Date.now();
const safeNum = x  => Number(x || 0) || 0;
const fmt     = n  => (Number(n) || 0).toLocaleString("uz-UZ") + " so'm";
function esc(s){ return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }
function toast(msg){ const t=$("toast"); if(!t) return; t.textContent=msg; show(t); clearTimeout(toast._t); toast._t=setTimeout(()=>hide(t),2200); }
function setMsg(el,msg){ if(!el) return; el.textContent=msg; show(el); clearTimeout(setMsg._t); setMsg._t=setTimeout(()=>hide(el),4200); }

/* ── State ── */
const state = {
  user:null, profile:null,
  products:[], productsMap:{},
  favorites:{}, cart:{},
  adsProducts:[], adIndex:0, adTimer:null,
  view:"home", homeFilter:"all", search:"",
  catalogLevel:"root", cat:null, sub:null,
  adminTab:"add", orderMode:"active",
  openProductId:null, openProductImgIdx:0,
  userOrders:[], allOrders:[],
  socket:null,
};

/* ── Polling ── */
const polls={};
function startPoll(key,fn,ms=10000){ stopPoll(key); fn(); polls[key]=setInterval(fn,ms); }
function stopPoll(key){ if(polls[key]){ clearInterval(polls[key]); delete polls[key]; } }
function stopAllPolls(){ Object.keys(polls).forEach(stopPoll); }

/* ── Socket.io ── */
function initSocket(user){
  if(state.socket){ state.socket.disconnect(); state.socket=null; }
  if(typeof io==="undefined") return;
  const socket=io(SOCKET_URL,{transports:["websocket","polling"],reconnection:true,reconnectionDelay:1000});
  state.socket=socket;
  socket.on("connect",()=>{ socket.emit("join",{role:"customer",uid:user.uid}); updateSocketIndicator(true); });
  socket.on("disconnect",()=>updateSocketIndicator(false));
  socket.on("connect_error",()=>updateSocketIndicator(false));
  socket.on("my_order_updated",data=>{
    const idx=state.userOrders.findIndex(o=>o.orderId===data.orderId);
    if(idx!==-1){
      if(data.status==="on_way")    state.userOrders[idx].status.onWay=true;
      if(data.status==="delivered") state.userOrders[idx].status.delivered=true;
    }
    renderOrders();
    if(data.status==="on_way")    { toast("🚗 Buyurtmangiz yo'lga chiqdi!"); vibrate(); }
    if(data.status==="delivered") { toast("✅ Buyurtmangiz yetib keldi!"); vibrate(); }
  });
  socket.on("order_created",data=>{ state.userOrders.unshift(data); renderOrders(); });
}
function disconnectSocket(){ if(state.socket){ state.socket.disconnect(); state.socket=null; } updateSocketIndicator(false); }
function updateSocketIndicator(connected){ const dot=$("socketDot"); if(dot) dot.classList.toggle("connected",connected); }
function vibrate(){ if(navigator.vibrate) navigator.vibrate([80,40,80]); }

/* ── Router ── */
function go(view){
  state.view=view;
  ["home","catalog","cart","fav","profile","product","admin","driver"].forEach(v=>hide($(`view-${v}`)));
  show($(`view-${view}`));
  document.querySelectorAll(".navBtn").forEach(b=>b.classList.toggle("active",b.dataset.go===view));
  document.querySelectorAll(".sd-btn").forEach(b=>b.classList.toggle("active",b.dataset.go===view));
  if(view==="home")    { renderAds(); renderHome(); }
  if(view==="catalog") { state.catalogLevel="root"; state.cat=null; state.sub=null; renderCatalog(); }
  if(view==="cart")    renderCart();
  if(view==="fav")     renderFav();
  if(view==="profile") { renderProfile(); renderOrders(); }
  if(view==="product"&&state.openProductId) renderProduct(state.openProductId);
  if(view==="admin")   { setAdminTab(state.adminTab); fetchAllOrders(); }
  if(view==="driver")  { fetchAllOrders(); renderDriverOrders(); }
  updateCartBadge();
}

/* ── Regions UI ── */
function initRegionsUI(){
  const reg=$("regRegion"), dis=$("regDistrict"); if(!reg||!dis) return;
  reg.innerHTML=Object.keys(REGIONS).map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join("");
  const fill=()=>{ dis.innerHTML=(REGIONS[reg.value]||[]).map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join(""); };
  reg.addEventListener("change",fill); fill();
}

/* ── Auth UI ── */
let _justRegistered=false;
function initAuthUI(){
  $("tabLogin")?.addEventListener("click",()=>{ $("tabLogin").classList.add("active"); $("tabReg").classList.remove("active"); show($("loginForm")); hide($("regForm")); hide($("authMsg")); });
  $("tabReg")?.addEventListener("click",()=>{ $("tabReg").classList.add("active"); $("tabLogin").classList.remove("active"); hide($("loginForm")); show($("regForm")); hide($("authMsg")); });
  $("loginForm")?.addEventListener("submit",async e=>{
    e.preventDefault(); hide($("authMsg"));
    const btn=$("loginForm").querySelector("button[type=submit]");
    if(btn){ btn.disabled=true; btn.textContent="⏳..."; }
    try{ await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPass").value); }
    catch(err){ setMsg($("authMsg"),err?.message||"Login xato"); }
    finally{ if(btn){ btn.disabled=false; btn.textContent="Kirish"; } }
  });
  $("regForm")?.addEventListener("submit",async e=>{
    e.preventDefault(); hide($("authMsg"));
    const firstName=$("regFirst")?.value.trim()||"", lastName=$("regLast")?.value.trim()||"";
    const phone=$("regPhone")?.value.trim()||"", email=$("regEmail")?.value.trim()||"";
    const pass=$("regPass")?.value||"", lang=$("regLang")?.value||"uz";
    const region=$("regRegion")?.value||"", district=$("regDistrict")?.value||"";
    if(!firstName||!lastName){ setMsg($("authMsg"),"Ism va familiya kiritilmagan"); return; }
    if(!email){ setMsg($("authMsg"),"Email kiritilmagan"); return; }
    if(pass.length<6){ setMsg($("authMsg"),"Parol kamida 6 ta belgi"); return; }
    const btn=$("regForm").querySelector("button[type=submit]");
    if(btn){ btn.disabled=true; btn.textContent="⏳..."; }
    _justRegistered=true;
    try{
      const cred=await createUserWithEmailAndPassword(auth,email,pass);
      await syncUser(cred.user,{email,firstName,lastName,phone,lang,region,district});
      _justRegistered=false; toast("Ro'yxatdan o'tildi ✅");
      hide($("auth")); show($("app")); state.user=cred.user;
      await Promise.all([fetchProducts(),fetchFavorites(),fetchCart(),fetchAds()]);
      await fetchUserOrders();
      startPoll("products",fetchProducts,30000); startPoll("favorites",fetchFavorites,30000);
      startPoll("cart",fetchCart,20000); startPoll("ads",fetchAds,60000);
      startPoll("userOrders",fetchUserOrders,20000);
      initSocket(cred.user); startAutoGPS(); go("home");
    }catch(err){
      _justRegistered=false;
      if(btn){ btn.disabled=false; btn.textContent="Ro'yxatdan o'tish"; }
      setMsg($("authMsg"),err?.message||"Xato");
    }
  });
  $("logout")?.addEventListener("click",()=>signOut(auth));
}

/* ── Profile ── */
function genCustomerId(){ return String(Math.floor(1000000+Math.random()*9000000)); }
async function syncUser(user,regData=null){
  try{ const ex=await apiGet("/users/"+user.uid); if(ex?.uid){ state.profile=ex; return ex; } }catch{}
  if(!regData) throw new Error("Profil topilmadi. Qaytadan ro'yxatdan o'ting.");
  const profile={uid:user.uid,customerId:genCustomerId(),email:regData.email||user.email||"",firstName:regData.firstName||"",lastName:regData.lastName||"",phone:regData.phone||"",lang:regData.lang||"uz",region:regData.region||"",district:regData.district||""};
  await apiPost("/users/sync",profile); state.profile=profile; return profile;
}
function renderProfile(){
  const p=state.profile; if(!p) return;
  const initial=(p.firstName||"?")[0].toUpperCase();
  const sdAv=$("sdAv"); if(sdAv) sdAv.textContent=initial;
  const sdNm=$("sdName"); if(sdNm) sdNm.textContent=`${p.firstName||""} ${p.lastName||""}`.trim()||"—";
  if(state.view!=="profile") return;
  $("profileAvatar").textContent=initial;
  $("profileName").textContent=`${p.firstName||""} ${p.lastName||""}`.trim()||"—";
  $("profilePhone").textContent=p.phone||"—";
  $("profileRegion").textContent=`${p.region||""} ${p.district?"/ "+p.district:""}`.trim()||"—";
}
function initProfileTabs(){
  document.querySelectorAll(".ptab").forEach(b=>{
    b.onclick=()=>{
      document.querySelectorAll(".ptab").forEach(x=>x.classList.remove("active")); b.classList.add("active");
      const tab=b.dataset.ptab;
      $("ptab-orders").classList.toggle("hidden",tab!=="orders");
      $("ptab-reviews").classList.toggle("hidden",tab!=="reviews");
      if(tab==="reviews") renderReviewableOrders();
    };
  });
}

/* ── Search ── */
function initSearch(){
  $("search")?.addEventListener("input",e=>{
    const v=(e.target.value||"").trim();
    if(v===ADMIN_CODE){ e.target.value=""; state.search=""; toast("ADMIN ✅"); go("admin"); return; }
    if(v===DRIVER_CODE){ e.target.value=""; state.search=""; toast("SHOFER ✅"); go("driver"); return; }
    state.search=v; renderAds(); renderHome();
  });
}

/* ── Products ── */
function isNew(p){ return safeNum(p.newUntil)>nowMs(); }
function finalPrice(p){ const d=safeNum(p.discountPercent); return d>0?Math.round(safeNum(p.price)*(100-d)/100):safeNum(p.price); }

async function fetchProducts(){
  try{
    const arr=await apiGet("/products");
    arr.sort((a,b)=>safeNum(b.createdAt)-safeNum(a.createdAt));
    state.products=arr; state.productsMap=Object.fromEntries(arr.map(p=>[p.id,p]));
    renderHome(); renderCatalog(); renderAds();
    if(state.view==="product"&&state.openProductId) renderProduct(state.openProductId);
    if(state.view==="admin"&&state.adminTab==="list") renderAdminList();
    if(state.view==="admin"&&state.adminTab==="ads")  renderAdsPicker();
    updateCartBadge();
  }catch(err){ console.error("Products:",err.message); }
}
function matchesHome(p){
  const q=(state.search||"").toLowerCase();
  if(q&&!(p.name||"").toLowerCase().includes(q)&&!(p.code||"").toLowerCase().includes(q)) return false;
  if(state.homeFilter==="discount") return safeNum(p.discountPercent)>0;
  if(state.homeFilter==="new")      return isNew(p);
  return true;
}
function productCard(p){
  const img=p.images?.[0]||"", fav=!!state.favorites?.[p.id];
  const disc=safeNum(p.discountPercent);
  const badge=disc>0?`${disc}%`:(isNew(p)?"NEW":(p.code||""));
  const outOfStock=safeNum(p.stock)<=0;
  const soldBadge=safeNum(p.soldCount)>0?`<div class="sold-badge">🛍 ${safeNum(p.soldCount)} ta sotildi</div>`:"";
  return `
    <div class="cardP${outOfStock?" card-out-stock":""}" data-open="${esc(p.id)}">
      ${outOfStock?`<div class="out-stock-overlay">🔴 Tugagan</div>`:`<button class="cartBtn" data-cart="${esc(p.id)}" type="button">🛒</button>`}
      <button class="favBtn ${fav?"active":""}" data-fav="${esc(p.id)}" type="button">${fav?"❤️":"🤍"}</button>
      <div class="pImg">${img?`<img src="${img}" loading="lazy">`:""}</div>
      <div class="pBody">
        <div class="pName">${esc(p.name||"—")}</div>
        ${soldBadge}
        <div class="pMeta">
          <div class="price">${fmt(finalPrice(p))}</div>
          <div class="${(disc>0||isNew(p))?"badge red":"badge"}">${esc(badge)}</div>
        </div>
      </div>
    </div>`;
}
function bindProductGrid(c){
  if(!c) return;
  c.querySelectorAll("[data-open]").forEach(el=>{ el.onclick=()=>openProduct(el.dataset.open); });
  c.querySelectorAll("[data-fav]").forEach(el=>{ el.onclick=e=>{ e.stopPropagation(); toggleFav(el.dataset.fav); }; });
  c.querySelectorAll("[data-cart]").forEach(el=>{ el.onclick=e=>{ e.stopPropagation(); addToCart(el.dataset.cart,1); }; });
}
function renderHome(){
  if(state.view!=="home") return;
  const list=state.products.filter(matchesHome);
  $("homeGrid").innerHTML=list.map(productCard).join(""); bindProductGrid($("homeGrid"));
  if(!list.length) show($("homeEmpty")); else hide($("homeEmpty"));
}

/* ── Product Detail ── */
function openProduct(id){ state.openProductId=id; state.openProductImgIdx=0; go("product"); window.scrollTo({top:0,behavior:"smooth"}); const mainEl=document.querySelector(".main"); if(mainEl) mainEl.scrollTo({top:0,behavior:"smooth"}); }
function renderProduct(id){
  const p=state.productsMap[id]; if(!p||!$("productBox")) return;
  const imgs=(p.images||[]).slice(0,10), colors=(p.colors||"").split(",").map(s=>s.trim()).filter(Boolean);
  const fav=!!state.favorites?.[id], disc=safeNum(p.discountPercent), outOfStock=safeNum(p.stock)<=0;
  const installTabs=[];
  installTabs.push({key:"naqd",label:"Naqd",price:finalPrice(p)});
  if(safeNum(p.price3m)>0) installTabs.push({key:"3m",label:"3 oy",price:safeNum(p.price3m),months:3});
  if(safeNum(p.price6m)>0) installTabs.push({key:"6m",label:"6 oy",price:safeNum(p.price6m),months:6});
  if(safeNum(p.price12m)>0) installTabs.push({key:"12m",label:"12 oy",price:safeNum(p.price12m),months:12});
  $("productBox").innerHTML=`
    <div class="product-detail-grid">
      <div class="product-gallery-wrap">
        <div class="product-gallery-main" id="mainImg">
          ${imgs.length?`<img src="${imgs[0]}" id="mainImgEl">`:`<div style="display:grid;place-items:center;height:100%;color:var(--muted)">Rasm yo'q</div>`}
        </div>
        ${imgs.length>1?`<div class="product-thumbs" id="thumbs">${imgs.map((u,i)=>`<div class="thumb-item${i===0?" active":""}" data-thi="${i}"><img src="${u}" loading="lazy"></div>`).join("")}</div>`:""}
      </div>
      <div class="product-info">
        <div class="row between">
          <div>
            <div class="h2">${esc(p.name||"—")}</div>
            <div class="muted" style="margin-top:4px">Kod: <b>${esc(p.code||"—")}</b></div>
          </div>
          <button class="pill${fav?" danger":""}" id="pfav" type="button">${fav?"❤️":"🤍"}</button>
        </div>
        ${outOfStock?`<div class="out-stock-banner">🔴 Ushbu mahsulot tugagan. Tez orada bo'ladi!</div>`:""}
        ${safeNum(p.soldCount)>0?`<div class="muted" style="font-size:13px">🛍 ${safeNum(p.soldCount)} ta sotildi</div>`:""}
        <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:6px">
          <div class="price" style="font-size:20px">${fmt(finalPrice(p))}</div>
          ${disc>0?`<div class="badge red">${disc}% CHEGIRMA</div>`:""}
          ${isNew(p)?`<div class="badge red">YANGI</div>`:""}
        </div>
        ${colors.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${colors.map(c=>`<span class="badge">${esc(c)}</span>`).join("")}</div>`:""}
        ${installTabs.length>1?`
        <div>
          <div class="install-tabs" id="installTabs">${installTabs.map((t,i)=>`<button class="itab${i===0?" active":""}" data-itab="${t.key}" type="button">${t.label}</button>`).join("")}</div>
          <div class="install-info" id="installInfo">${fmt(installTabs[0].price)}</div>
        </div>`:""}
        <div>
          <div style="font-weight:800;margin-bottom:6px">Tavsif</div>
          <div class="muted" style="line-height:1.6">${esc(p.desc||"—")}</div>
        </div>
        ${outOfStock
          ?`<div class="muted" style="font-size:14px;font-weight:700">⏳ Tez orada bo'ladi</div>`
          :`<div class="row" style="flex-wrap:wrap">
              <button class="btn primary" id="buyNow" type="button">🛒 Buyurtma</button>
              <button class="pill" id="addCartBtn" type="button">Savatga</button>
            </div>`}
      </div>
    </div>`;
  const thumbs=$("productBox").querySelectorAll(".thumb-item");
  thumbs.forEach(th=>{ th.onclick=()=>{ const i=Number(th.dataset.thi); thumbs.forEach((x,xi)=>x.classList.toggle("active",xi===i)); const mainEl=$("mainImgEl"); if(mainEl) mainEl.src=imgs[i]; }; });
  $("productBox").querySelectorAll(".itab").forEach(bt=>{
    bt.onclick=()=>{
      $("productBox").querySelectorAll(".itab").forEach(x=>x.classList.remove("active")); bt.classList.add("active");
      const found=installTabs.find(t=>t.key===bt.dataset.itab), info=$("installInfo");
      if(found&&info) info.innerHTML=found.months?`<b>${fmt(found.price)}</b> × ${found.months} oy = <b>${fmt(found.price*found.months)}</b> jami`:`<b>${fmt(found.price)}</b>`;
    };
  });
  $("pfav").onclick=()=>toggleFav(id);
  $("addCartBtn")?.addEventListener("click",()=>addToCart(id,1));
  $("buyNow")?.addEventListener("click",()=>{ addToCart(id,1); go("cart"); });
  const same=state.products.filter(x=>x.id!==id&&x.category===p.category&&x.subcategory===p.subcategory).slice(0,10);
  $("sameGrid").innerHTML=same.map(productCard).join(""); bindProductGrid($("sameGrid"));
  loadProductReviews(id);
}
async function loadProductReviews(productId){
  const box=$("reviewsBox"); if(!box) return;
  try{
    const arr=await apiGet("/reviews/"+productId);
    if(!arr.length){ box.innerHTML=`<div class="empty">Hali sharh yo'q</div>`; return; }
    box.innerHTML=arr.map(r=>`
      <div class="review-card">
        <div class="review-header"><div class="review-user">${esc(r.userName||"Foydalanuvchi")}</div><div class="review-date">${new Date(r.createdAt).toLocaleDateString()}</div></div>
        ${r.pros?`<div class="review-pros">✅ ${esc(r.pros)}</div>`:""}
        ${r.cons?`<div class="review-cons">⚠️ ${esc(r.cons)}</div>`:""}
        ${r.comment?`<div class="review-comment">${esc(r.comment)}</div>`:""}
      </div>`).join("");
  }catch{ box.innerHTML=`<div class="empty">...</div>`; }
}

/* ── Catalog ── */
function initCatalogBack(){ $("catBack")?.addEventListener("click",()=>{ if(state.catalogLevel==="products") state.catalogLevel="sub"; else if(state.catalogLevel==="sub"){ state.catalogLevel="root"; state.cat=null; state.sub=null; } renderCatalog(); }); }
function renderCatalog(){
  if(state.view!=="catalog"||!$("catalogList")) return;
  const list=$("catalogList"), back=$("catBack");
  if(state.catalogLevel==="root"){
    hide(back);
    list.innerHTML=Object.keys(CATALOGS).map(cat=>`<div class="item" data-cat="${esc(cat)}"><div class="left"><div class="thumb"></div><div><div class="t1">${esc(cat)}</div><div class="t2">${Object.keys(CATALOGS[cat]||{}).length} bo'lim</div></div></div><div class="pill">→</div></div>`).join("");
    list.querySelectorAll("[data-cat]").forEach(el=>{ el.onclick=()=>{ state.cat=el.dataset.cat; state.catalogLevel="sub"; renderCatalog(); }; }); return;
  }
  if(state.catalogLevel==="sub"){
    show(back);
    list.innerHTML=Object.keys(CATALOGS[state.cat]||{}).map(sub=>`<div class="item" data-sub="${esc(sub)}"><div class="left"><div class="thumb"></div><div><div class="t1">${esc(sub)}</div><div class="t2">${esc(state.cat)}</div></div></div><div class="pill">→</div></div>`).join("");
    list.querySelectorAll("[data-sub]").forEach(el=>{ el.onclick=()=>{ state.sub=el.dataset.sub; state.catalogLevel="products"; renderCatalog(); }; }); return;
  }
  show(back);
  const prods=state.products.filter(p=>p.category===state.cat&&p.subcategory===state.sub);
  list.innerHTML=`<div class="h2" style="margin-bottom:10px">${esc(state.cat)} → ${esc(state.sub)}</div><div class="grid">${prods.map(productCard).join("")}</div>${!prods.length?`<div class="empty">Mahsulot yo'q</div>`:""}`;
  bindProductGrid(list);
}

/* ── Favorites ── */
async function fetchFavorites(){ if(!state.user) return; try{ const arr=await apiGet("/favorites/"+state.user.uid); state.favorites=Object.fromEntries(arr.map(p=>[p.id,true])); renderHome(); renderFav(); }catch{} }
async function toggleFav(pid){
  if(!state.user) return;
  if(state.favorites?.[pid]){ await apiDel("/favorites",{uid:state.user.uid,productId:pid}); delete state.favorites[pid]; toast("Sevimlidan o'chirildi"); }
  else{ await apiPost("/favorites",{uid:state.user.uid,productId:pid}); state.favorites[pid]=true; toast("Sevimlilarga qo'shildi"); }
  renderHome(); renderFav(); if(state.view==="product") renderProduct(state.openProductId);
}
function renderFav(){
  if(state.view!=="fav"||!$("favGrid")) return;
  const list=Object.keys(state.favorites).map(id=>state.productsMap[id]).filter(Boolean);
  $("favGrid").innerHTML=list.map(p=>`<div class="cardP" data-open="${esc(p.id)}"><button class="favBtn active" data-fav="${esc(p.id)}" type="button">❤️</button><div class="pImg">${p.images?.[0]?`<img src="${p.images[0]}" loading="lazy">`:""}</div><div class="pBody"><div class="pName">${esc(p.name||"—")}</div><div class="pMeta"><div class="price">${fmt(finalPrice(p))}</div><div class="badge">${esc(p.code||"")}</div></div></div></div>`).join("");
  if(!list.length) show($("favEmpty")); else hide($("favEmpty"));
  bindProductGrid($("favGrid"));
}

/* ── Cart ── */
async function fetchCart(){ if(!state.user) return; try{ const arr=await apiGet("/cart/"+state.user.uid); state.cart={}; arr.forEach(item=>{ state.cart[item.id]={qty:item.qty,color:item.color}; }); renderCart(); updateCartBadge(); }catch{} }
function cartItems(){ return Object.entries(state.cart||{}).map(([pid,it])=>{ const p=state.productsMap[pid]; if(!p) return null; const qty=safeNum(it.qty)||1,unit=finalPrice(p); return{pid,p,qty,unit,sum:unit*qty}; }).filter(Boolean); }
function cartTotal(){ return cartItems().reduce((a,b)=>a+b.sum,0); }
function updateCartBadge(){
  const count=Object.keys(state.cart||{}).length;
  const badge=$("cartBadge"); if(badge){ badge.textContent=count; if(count>0) show(badge); else hide(badge); }
  const sdBadge=$("sdCartCount"); if(sdBadge){ sdBadge.textContent=count; if(count>0) sdBadge.classList.remove("hidden"); else sdBadge.classList.add("hidden"); }
}
async function addToCart(pid,addQty){ if(!state.user) return; const newQty=Math.max(1,(state.cart[pid]?.qty||0)+addQty); await apiPost("/cart",{uid:state.user.uid,productId:pid,qty:newQty}); state.cart[pid]={qty:newQty}; renderCart(); updateCartBadge(); toast("Savatga qo'shildi 🛒"); }
async function setQty(pid,qty){ if(!state.user) return; if(qty<=0){ await apiDel("/cart",{uid:state.user.uid,productId:pid}); delete state.cart[pid]; }else{ await apiPost("/cart",{uid:state.user.uid,productId:pid,qty}); state.cart[pid]={qty}; } renderCart(); updateCartBadge(); }
function initCartButtons(){ $("cartClear")?.addEventListener("click",async()=>{ if(!state.user) return; await apiDel("/cart",{uid:state.user.uid}); state.cart={}; renderCart(); updateCartBadge(); toast("Savat tozalandi"); }); }
function renderCart(){
  if(state.view!=="cart"||!$("cartList")) return;
  const list=cartItems();
  $("cartList").innerHTML=list.map(x=>{ const img=x.p.images?.[0]||""; return `<div class="item"><div class="left"><div class="thumb">${img?`<img src="${img}">`:""}</div><div><div class="t1">${esc(x.p.name||"—")}</div><div class="t2">Kod: ${esc(x.p.code||"—")} • ${fmt(x.unit)}</div></div></div><div class="row"><div class="qty"><button class="qb" data-dec="${esc(x.pid)}" type="button">−</button><b>${x.qty}</b><button class="qb" data-inc="${esc(x.pid)}" type="button">+</button></div><button class="del" data-del="${esc(x.pid)}" type="button">🗑</button></div></div>`; }).join("");
  $("cartTotal").textContent=fmt(cartTotal());
  $("cartPreview").innerHTML=list.length?list.map(x=>`• ${esc(x.p.name)} (${x.qty}x) = ${fmt(x.sum)}`).join("<br>"):"Savat bo'sh";
  $("cartList").querySelectorAll("[data-inc]").forEach(b=>{ b.onclick=()=>setQty(b.dataset.inc,(state.cart[b.dataset.inc]?.qty||1)+1); });
  $("cartList").querySelectorAll("[data-dec]").forEach(b=>{ b.onclick=()=>setQty(b.dataset.dec,(state.cart[b.dataset.dec]?.qty||1)-1); });
  $("cartList").querySelectorAll("[data-del]").forEach(b=>{ b.onclick=()=>setQty(b.dataset.del,0); });
}

/* ── Receipt + Orders ── */
function receiptHtml(order){
  const u=order.user||{}, items=order.items||[];
  return `<div style="display:flex;justify-content:space-between;gap:10px"><div><div><b>SOF SHOP CHEK</b></div>${order.orderId?`<div class="muted">OrderID: <b>${esc(order.orderId)}</b></div>`:""}<div class="muted">${new Date().toLocaleString()}</div></div><div><b>ID:</b> ${esc(order.customerId||"—")}</div></div><hr style="border:none;height:1px;background:var(--line);margin:10px 0"><div class="muted"><b>Mijoz</b></div><div style="display:flex;justify-content:space-between"><span>F.I.Sh</span><b>${esc((u.firstName||"")+" "+(u.lastName||""))}</b></div><div style="display:flex;justify-content:space-between"><span>Tel</span><span>${esc(u.phone||"—")}</span></div><div style="display:flex;justify-content:space-between"><span>Lokatsiya</span><span>${esc((u.region||"")+", "+(u.district||""))}</span></div><hr style="border:none;height:1px;background:var(--line);margin:10px 0"><div class="muted"><b>Mahsulotlar</b></div>${items.map(it=>`<div style="margin-top:8px"><div style="display:flex;justify-content:space-between"><b>${esc(it.name||"")}</b><b>${fmt(safeNum(it.price)*safeNum(it.qty))}</b></div><div class="muted" style="font-size:12px">Kod: ${esc(it.code||"—")} • ${safeNum(it.qty)||1} dona • ${fmt(it.price||0)}</div></div>`).join("")}<hr style="border:none;height:1px;background:var(--line);margin:10px 0"><div style="display:flex;justify-content:space-between"><b>Jami</b><b>${fmt(order.total||0)}</b></div>`;
}
function initReceiptModal(){
  $("receiptClose")?.addEventListener("click",()=>hide($("receiptModal")));
  $("receiptModal")?.addEventListener("click",e=>{ if(e.target===$("receiptModal")) hide($("receiptModal")); });
  $("agree")?.addEventListener("change",()=>{ const ok=$("agree").checked&&cartItems().length>0; $("sendOrder").disabled=!ok; $("sendOrder").classList.toggle("disabled",!ok); });
  $("openReceipt")?.addEventListener("click",()=>{
    if(!state.profile){ toast("Profil topilmadi"); return; }
    const items=cartItems(); if(!items.length){ toast("Savat bo'sh"); return; }
    $("receiptBox").innerHTML=receiptHtml({orderId:null,customerId:state.profile.customerId,user:{firstName:state.profile.firstName,lastName:state.profile.lastName,phone:state.profile.phone,region:state.profile.region,district:state.profile.district},items:items.map(x=>({productId:x.pid,name:x.p.name||"",code:x.p.code||"",price:x.unit,qty:x.qty})),total:cartTotal()});
    $("agree").checked=false; $("sendOrder").disabled=true; $("sendOrder").classList.add("disabled"); show($("receiptModal"));
  });
  $("sendOrder")?.addEventListener("click",async()=>{
    if(!$("agree").checked) return;
    const items=cartItems(); if(!items.length) return;
    $("sendOrder").disabled=true; $("sendOrder").classList.add("disabled");
    await createOrder(items); hide($("receiptModal")); $("agree").checked=false; toast("Buyurtma yuborildi ✅");
  });
}
async function createOrder(items){
  if(!state.user||!state.profile) return;
  try{
    await apiPost("/orders",{userUid:state.user.uid,customerId:state.profile.customerId,total:cartTotal(),items:items.map(x=>({productId:x.pid,name:x.p.name||"",code:x.p.code||"",price:x.unit,qty:x.qty})),userData:{firstName:state.profile.firstName,lastName:state.profile.lastName,phone:state.profile.phone,region:state.profile.region,district:state.profile.district,lat:state.profile.lat||null,lng:state.profile.lng||null}});
    await apiDel("/cart",{uid:state.user.uid}); state.cart={}; renderCart(); updateCartBadge(); fetchUserOrders();
  }catch(err){ toast("❌ "+err.message); $("sendOrder").disabled=false; $("sendOrder").classList.remove("disabled"); }
}

/* ── Orders ── */
async function fetchUserOrders(){ if(!state.user) return; try{ state.userOrders=await apiGet("/my-orders/"+state.user.uid); renderOrders(); }catch{} }
function initOrdersButtons(){
  $("btnActiveOrders")?.addEventListener("click",()=>{ state.orderMode="active"; $("btnActiveOrders").classList.add("active"); $("btnHistoryOrders").classList.remove("active"); renderOrders(); });
  $("btnHistoryOrders")?.addEventListener("click",()=>{ state.orderMode="history"; $("btnHistoryOrders").classList.add("active"); $("btnActiveOrders").classList.remove("active"); renderOrders(); });
}
function renderOrders(){
  if(state.view!=="profile"||!$("ordersList")) return;
  const arr=[...state.userOrders].sort((a,b)=>safeNum(b.createdAt)-safeNum(a.createdAt));
  const list=state.orderMode==="history"?arr.filter(o=>o.status?.delivered):arr.filter(o=>!o.status?.delivered);
  $("ordersList").innerHTML=list.map(o=>{ const s=o.status||{}; const st=s.delivered?"✅ Yetib keldi":(s.onWay?"🚚 Yo'lda":"⏳ Buyurtma berildi"); return `<div class="item"><div><div class="t1">Buyurtma • <b>${esc(o.orderId)}</b></div><div class="t2">${st} • Jami: <b>${fmt(o.total||0)}</b></div></div><button class="pill" data-oview="${esc(o.orderId)}" type="button">👁</button></div>`; }).join("");
  $("ordersList").querySelectorAll("[data-oview]").forEach(b=>{ b.onclick=()=>{ const o=state.userOrders.find(x=>x.orderId===b.dataset.oview); if(o) openOrderView(o); }; });
  if(!list.length) show($("ordersEmpty")); else hide($("ordersEmpty"));
}

/* ── Reviews ── */
function renderReviewableOrders(){
  const box=$("reviewableList"); if(!box) return;
  const delivered=state.userOrders.filter(o=>o.status?.delivered);
  if(!delivered.length){ box.innerHTML=""; $("reviewsEmpty").style.display="block"; return; }
  $("reviewsEmpty").style.display="none";
  const items=[];
  delivered.forEach(o=>{ (o.items||[]).forEach(it=>{ items.push({orderId:o.orderId,productId:it.productId,productName:it.name||it.code||"—"}); }); });
  box.innerHTML=items.map(it=>`<div class="item"><div class="t1">${esc(it.productName)}</div><button class="pill" data-review-pid="${esc(it.productId)}" data-review-oid="${esc(it.orderId)}" data-review-name="${esc(it.productName)}" type="button">✍️ Sharh</button></div>`).join("");
  box.querySelectorAll("[data-review-pid]").forEach(b=>{ b.onclick=()=>openReviewModal(b.dataset.reviewPid,b.dataset.reviewOid,b.dataset.reviewName); });
}
function openReviewModal(productId,orderId,productName){ $("reviewProductId").value=productId; $("reviewOrderId").value=orderId; $("reviewProductName").textContent=productName; $("reviewPros").value=""; $("reviewCons").value=""; $("reviewComment").value=""; hide($("reviewMsg")); show($("reviewModal")); }
function initReviewModal(){
  $("reviewClose")?.addEventListener("click",()=>hide($("reviewModal")));
  $("reviewModal")?.addEventListener("click",e=>{ if(e.target===$("reviewModal")) hide($("reviewModal")); });
  $("submitReview")?.addEventListener("click",async()=>{
    if(!state.user||!state.profile) return;
    const productId=$("reviewProductId").value, orderId=$("reviewOrderId").value;
    const pros=$("reviewPros").value.trim(), cons=$("reviewCons").value.trim(), comment=$("reviewComment").value.trim();
    if(!pros&&!cons&&!comment){ setMsg($("reviewMsg"),"Kamida bitta maydon to'ldirilsin"); return; }
    try{
      await apiPost("/reviews",{productId,userUid:state.user.uid,userName:`${state.profile.firstName||""} ${state.profile.lastName||""}`.trim()||"Foydalanuvchi",orderId,pros,cons,comment});
      hide($("reviewModal")); toast("Sharh saqlandi ✅");
    }catch(err){ setMsg($("reviewMsg"),err?.message||"Xato"); }
  });
}

/* ── Order View Modal ── */
function initOrderViewModal(){ $("orderViewClose")?.addEventListener("click",()=>hide($("orderViewModal"))); $("orderViewModal")?.addEventListener("click",e=>{ if(e.target===$("orderViewModal")) hide($("orderViewModal")); }); }
function openOrderView(order){ $("orderViewBox").innerHTML=receiptHtml(order); show($("orderViewModal")); }

/* ── Ads ── */
async function fetchAds(){ try{ state.adsProducts=await apiGet("/ads"); renderAds(); }catch{} }
function renderAds(){
  if(state.view!=="home"||!$("ads")) return;
  if(state.search||!state.adsProducts.length){ hide($("ads")); clearInterval(state.adTimer); state.adTimer=null; return; }
  show($("ads"));
  const ads=state.adsProducts;
  $("ads").innerHTML=`${ads.map((p,i)=>`<div class="adSlide ${i===0?"active":""}" data-adopen="${esc(p.id)}"><div class="adInner"><div class="adPic">${p.images?.[0]?`<img src="${p.images[0]}">`:""}</div><div class="adInfo"><div class="adTitle">${esc(p.name||"—")}</div><div class="adSub">Kod: ${esc(p.code||"—")} • ${fmt(finalPrice(p))}</div></div></div></div>`).join("")}<div class="adDots">${ads.map((_,i)=>`<div class="dot ${i===0?"active":""}" data-idx="${i}"></div>`).join("")}</div>`;
  const slides=Array.from($("ads").querySelectorAll(".adSlide")), dots=Array.from($("ads").querySelectorAll(".dot"));
  const setIdx=i=>{ slides.forEach((s,idx)=>s.classList.toggle("active",idx===i)); dots.forEach((d,idx)=>d.classList.toggle("active",idx===i)); state.adIndex=i; };
  slides.forEach(s=>s.onclick=()=>openProduct(s.dataset.adopen));
  dots.forEach(d=>d.onclick=()=>setIdx(Number(d.dataset.idx)));
  clearInterval(state.adTimer);
  state.adTimer=setInterval(()=>setIdx((state.adIndex+1)%slides.length),5000);
}

/* ── Admin ── */
function setAdminTab(tab){
  state.adminTab=tab;
  document.querySelectorAll(".tab2").forEach(b=>b.classList.toggle("active",b.dataset.atab===tab));
  ["add","list","catalogs","orders","ads","outofstock","archive"].forEach(x=>hide($(`admin-${x}`)));
  show($(`admin-${tab}`));
  if(tab==="list")       renderAdminList();
  if(tab==="catalogs")   renderAdminCatalogs();
  if(tab==="orders")     renderAdminOrders();
  if(tab==="ads")        renderAdsPicker();
  if(tab==="outofstock") renderOutOfStock();
  if(tab==="archive")    renderAdminArchive();
}
function initAdminTabs(){ document.querySelectorAll(".tab2").forEach(b=>{ b.onclick=()=>setAdminTab(b.dataset.atab); }); $("adminBack")?.addEventListener("click",()=>go("home")); }

function initAdminProductForm(){
  if(!$("productForm")) return;
  refreshCatalogDropdowns();
  const fillSub=()=>{ $("pSub").innerHTML=Object.keys(CATALOGS[$("pCat").value]||{}).map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join(""); };
  $("pCat").onchange=fillSub; fillSub();
  $("pType").onchange=()=>{ if($("pType").value==="new") show($("newBox")); else hide($("newBox")); };
  $("imgInputs").innerHTML=""; addImgInput("");
  $("addImg")?.addEventListener("click",()=>addImgInput(""));
  $("cancelEdit")?.addEventListener("click",resetAdminForm);
  $("adminSearch")?.addEventListener("input",renderAdminList);
  $("exportExcel")?.addEventListener("click",exportToExcel);
  $("productForm").addEventListener("submit",async e=>{
    e.preventDefault(); hide($("adminMsg"));
    try{
      const editId=($("editId").value||"").trim(), payload=buildProductPayload();
      const dup=state.products.find(x=>(x.code||"").toLowerCase()===payload.code.toLowerCase()&&x.id!==editId);
      if(dup) throw new Error("Kod unikal bo'lsin!");
      if(editId){ await apiPut("/products/"+editId,payload); toast("Yangilandi ✅"); }
      else       { await apiPost("/products",payload);        toast("Saqlandi ✅");   }
      await fetchProducts(); resetAdminForm(); setAdminTab("list");
    }catch(err){ setMsg($("adminMsg"),err?.message||"Xatolik"); }
  });
}
function refreshCatalogDropdowns(){ if(!$("pCat")) return; $("pCat").innerHTML=Object.keys(CATALOGS).map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join(""); $("pSub").innerHTML=Object.keys(CATALOGS[$("pCat").value]||{}).map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join(""); }
function addImgInput(val){ const box=$("imgInputs"); if(!box) return; if(box.querySelectorAll("input[data-img]").length>=10){toast("Max 10 rasm");return;} const w=document.createElement("div"); w.innerHTML=`<input data-img="1" placeholder="https://..." value="${esc(val||"")}">`;box.appendChild(w);w.querySelector("input").oninput=renderImgPreview;renderImgPreview(); }
function readImages(){ return Array.from($("imgInputs")?.querySelectorAll("input[data-img]")||[]).map(i=>i.value.trim()).filter(Boolean).slice(0,10); }
function renderImgPreview(){ const pv=$("imgPreview"); if(!pv) return; pv.innerHTML=readImages().map((u,idx)=>`<div class="imgTile"><img src="${u}"><button class="imgX" data-x="${idx}" type="button">✕</button></div>`).join(""); pv.querySelectorAll("[data-x]").forEach(btn=>{ btn.onclick=()=>{ const inputs=Array.from($("imgInputs").querySelectorAll("input[data-img]")).filter(i=>i.value.trim()); if(inputs[Number(btn.dataset.x)]) inputs[Number(btn.dataset.x)].value=""; cleanupImgInputs();renderImgPreview(); }; }); }
function cleanupImgInputs(){ const box=$("imgInputs"); if(!box) return; const filled=Array.from(box.querySelectorAll("input[data-img]")).map(i=>i.value.trim()).filter(Boolean); box.innerHTML=""; if(!filled.length) addImgInput(""); else filled.forEach(v=>addImgInput(v)); }
function buildProductPayload(){
  const type=$("pType").value, disc=safeNum($("pDiscount").value), newDays=safeNum($("pNewDays").value)||1;
  if(type==="discount"&&disc<=0) throw new Error("Chegirma % kiriting (1..90).");
  if(type==="new"&&newDays<1)    throw new Error("Yangi kun kamida 1.");
  return { name:$("pName").value.trim(), code:$("pCode").value.trim(), price:safeNum($("pPrice").value), stock:safeNum($("pStock").value), price3m:safeNum($("pPrice3m").value), price6m:safeNum($("pPrice6m").value), price12m:safeNum($("pPrice12m").value), discountPercent:type==="discount"?disc:0, newUntil:type==="new"?(nowMs()+newDays*86400000):0, category:$("pCat").value, subcategory:$("pSub").value, colors:$("pColors").value.trim(), desc:$("pDesc").value.trim(), images:readImages() };
}
function resetAdminForm(){ $("editId").value=""; $("adminHint").textContent="Yangi mahsulot"; hide($("cancelEdit")); $("productForm").reset(); $("pType").value="normal"; hide($("newBox")); $("imgInputs").innerHTML=""; addImgInput(""); renderImgPreview(); }
function renderAdminList(){
  if(state.view!=="admin"||state.adminTab!=="list"||!$("adminProducts")) return;
  const q=($("adminSearch").value||"").trim().toLowerCase();
  const list=state.products.filter(p=>!q||(p.name||"").toLowerCase().includes(q)||(p.code||"").toLowerCase().includes(q));
  $("adminProducts").innerHTML=list.map(p=>{ const img=p.images?.[0]||"",disc=safeNum(p.discountPercent),stock=safeNum(p.stock); return `<div class="item"><div class="left"><div class="thumb">${img?`<img src="${img}">`:""}</div><div><div class="t1">${esc(p.name||"—")}</div><div class="t2">Kod: <b>${esc(p.code||"—")}</b> • ${fmt(finalPrice(p))}</div><div class="t2" style="color:${stock<=0?"var(--red)":"var(--green)"}">Stok: ${stock} dona ${safeNum(p.soldCount)>0?"• "+safeNum(p.soldCount)+" sotildi":""}</div></div></div><div class="row"><button class="pill" data-edit="${esc(p.id)}" type="button">✏️</button><button class="pill danger" data-del="${esc(p.id)}" type="button">🗑</button></div></div>`; }).join("")||`<div class="empty">Mahsulot yo'q</div>`;
  $("adminProducts").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>startEdit(b.dataset.edit));
  $("adminProducts").querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.del));
}
function startEdit(id){ const p=state.productsMap[id]; if(!p) return; $("editId").value=id; $("adminHint").textContent="Tahrirlash: "+(p.name||""); show($("cancelEdit")); $("pName").value=p.name||""; $("pCode").value=p.code||""; $("pPrice").value=safeNum(p.price); $("pStock").value=safeNum(p.stock); $("pPrice3m").value=safeNum(p.price3m); $("pPrice6m").value=safeNum(p.price6m); $("pPrice12m").value=safeNum(p.price12m); const type=safeNum(p.discountPercent)>0?"discount":(isNew(p)?"new":"normal"); $("pType").value=type; $("pDiscount").value=safeNum(p.discountPercent); if(type==="new"){show($("newBox"));$("pNewDays").value=Math.max(1,Math.ceil(Math.max(0,safeNum(p.newUntil)-nowMs())/86400000));}else{hide($("newBox"));$("pNewDays").value=1;} $("pCat").value=p.category||$("pCat").value; $("pCat").dispatchEvent(new Event("change")); $("pSub").value=p.subcategory||""; $("pColors").value=p.colors||""; $("pDesc").value=p.desc||""; $("imgInputs").innerHTML=""; (p.images?.length?p.images:[""]).slice(0,10).forEach(u=>addImgInput(u)); cleanupImgInputs(); renderImgPreview(); setAdminTab("add"); }
async function deleteProduct(id){ if(!confirm("O'chirasizmi?")) return; try{ await apiDel("/products/"+id); await fetchProducts(); toast("O'chirildi ✅"); }catch(err){ toast("❌ "+err.message); } }

/* Excel */
function exportToExcel(){
  const q=($("adminSearch")?.value||"").trim().toLowerCase();
  const list=state.products.filter(p=>!q||(p.name||"").toLowerCase().includes(q)||(p.code||"").toLowerCase().includes(q));
  if(!list.length){ toast("Mahsulot yo'q"); return; }
  const rows=[["Katalog","Sub-katalog","Nomi","Kodi","Qolgani","Bori","Narxi (so'm)"]];
  list.forEach(p=>rows.push([p.category||"",p.subcategory||"",p.name||"",p.code||"",safeNum(p.stock),safeNum(p.soldCount),safeNum(p.price)]));
  const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(",")).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download="sofshop_mahsulotlar.csv"; a.click(); URL.revokeObjectURL(url); toast("Excel yuklab olindi ✅");
}

/* Katalog admin */
let selectedAdminCat=null;
function renderAdminCatalogs(){
  if(state.view!=="admin"||state.adminTab!=="catalogs") return;
  const catList=$("adminCatalogList"); if(!catList) return;
  catList.innerHTML=Object.keys(CATALOGS).map(cat=>`<div class="catalog-item${cat===selectedAdminCat?" selected":""}" data-admincat="${esc(cat)}"><div class="catalog-item-name">${esc(cat)}</div><div class="catalog-item-actions"><button class="cat-del-btn" data-delcat="${esc(cat)}" type="button">🗑</button></div></div>`).join("")||"<div class='empty'>Katalog yo'q</div>";
  catList.querySelectorAll("[data-admincat]").forEach(el=>{ el.onclick=e=>{ if(e.target.closest("[data-delcat]")) return; selectedAdminCat=el.dataset.admincat; renderAdminCatalogs(); renderAdminSubCats(); }; });
  catList.querySelectorAll("[data-delcat]").forEach(el=>{ el.onclick=()=>{ if(!confirm(`"${el.dataset.delcat}" o'chirasizmi?`)) return; delete CATALOGS[el.dataset.delcat]; saveCatalogs(CATALOGS); if(selectedAdminCat===el.dataset.delcat) selectedAdminCat=null; renderAdminCatalogs(); renderAdminSubCats(); refreshCatalogDropdowns(); toast("O'chirildi ✅"); }; });
  $("addCatBtn").onclick=()=>{ const name=$("newCatName").value.trim(); if(!name){ toast("Nom kiriting"); return; } if(CATALOGS[name]){ toast("Allaqachon bor"); return; } CATALOGS[name]={}; saveCatalogs(CATALOGS); $("newCatName").value=""; renderAdminCatalogs(); refreshCatalogDropdowns(); toast("Qo'shildi ✅"); };
  renderAdminSubCats();
}
function renderAdminSubCats(){
  const panel=$("adminSubCatList"), nameEl=$("selectedCatName"); if(!panel||!nameEl) return;
  if(!selectedAdminCat||!CATALOGS[selectedAdminCat]){ nameEl.textContent="—"; panel.innerHTML=""; return; }
  nameEl.textContent=selectedAdminCat;
  const subs=Object.keys(CATALOGS[selectedAdminCat]||{});
  panel.innerHTML=subs.map(sub=>`<div class="catalog-item"><div class="catalog-item-name">${esc(sub)}</div><button class="cat-del-btn" data-delsub="${esc(sub)}" type="button">🗑</button></div>`).join("")||"<div class='empty'>Sub-katalog yo'q</div>";
  panel.querySelectorAll("[data-delsub]").forEach(el=>{ el.onclick=()=>{ if(!confirm(`"${el.dataset.delsub}" o'chirasizmi?`)) return; delete CATALOGS[selectedAdminCat][el.dataset.delsub]; saveCatalogs(CATALOGS); renderAdminSubCats(); refreshCatalogDropdowns(); toast("O'chirildi ✅"); }; });
  $("addSubCatBtn").onclick=()=>{ const name=$("newSubCatName").value.trim(); if(!name){ toast("Nom kiriting"); return; } if(CATALOGS[selectedAdminCat][name]){ toast("Allaqachon bor"); return; } CATALOGS[selectedAdminCat][name]=[]; saveCatalogs(CATALOGS); $("newSubCatName").value=""; renderAdminSubCats(); refreshCatalogDropdowns(); toast("Qo'shildi ✅"); };
}

/* Ads */
function renderAdsPicker(){ if(state.view!=="admin"||state.adminTab!=="ads"||!$("adsPick")) return; const sel=new Set(state.adsProducts.map(p=>p.id)); $("adsPick").innerHTML=state.products.map(p=>{ const img=p.images?.[0]||""; return `<div class="item"><div class="left"><div class="thumb">${img?`<img src="${img}">`:""}</div><div><div class="t1">${esc(p.name||"—")}</div><div class="t2">${fmt(finalPrice(p))} • Kod: ${esc(p.code||"")}</div></div></div><input type="checkbox" data-ad="${esc(p.id)}" ${sel.has(p.id)?"checked":""}/></div>`; }).join("")||`<div class="empty">Mahsulot yo'q</div>`; }
function initAdsSave(){ $("saveAds")?.addEventListener("click",async()=>{ try{ const ids=Array.from($("adsPick").querySelectorAll("input[data-ad]:checked")).map(ch=>ch.dataset.ad); await apiPost("/ads",{productIds:ids}); await fetchAds(); setMsg($("adsMsg"),"Reklama saqlandi ✅"); }catch(err){ setMsg($("adsMsg"),err?.message||"Xatolik"); } }); }

/* Out of stock */
async function renderOutOfStock(){
  if(state.view!=="admin"||state.adminTab!=="outofstock"||!$("adminOutOfStock")) return;
  const c=$("adminOutOfStock");
  c.innerHTML=`<div class="empty">⏳ Yuklanmoqda...</div>`;
  try{
    const list=await apiGet("/products/out-of-stock");
    if(!list.length){ c.innerHTML=`<div class="empty" style="color:var(--green)">✅ Barcha mahsulotlar omborda mavjud!</div>`; return; }
    c.innerHTML=`<div style="display:flex;flex-direction:column;gap:12px">`+list.map(p=>`
      <div class="oos-row" data-id="${esc(p.id)}">
        <div class="oos-info">
          <div class="oos-thumb">${p.images?.[0]?`<img src="${esc(p.images[0])}" loading="lazy"/>`:""}</div>
          <div style="min-width:0;flex:1">
            <div class="oos-name">${esc(p.name||"—")}</div>
            <div class="oos-meta">Kod: <b>${esc(p.code||"—")}</b> · ${fmt(p.price)}</div>
            <div class="oos-meta"><span style="color:var(--red);font-weight:700">🔴 Stok: 0</span>${safeNum(p.soldCount)>0?` · 🛍 ${safeNum(p.soldCount)} ta sotilgan`:""}</div>
          </div>
        </div>
        <div class="oos-actions">
          <input type="number" min="1" value="10" class="oos-qty-input" id="rs_${esc(p.id)}" placeholder="Dona"/>
          <button class="btn primary" data-restock="${esc(p.id)}" type="button" style="padding:9px 14px;font-size:13px">✅ Qo'shish</button>
        </div>
      </div>`).join("")+`</div>`;
    c.querySelectorAll("[data-restock]").forEach(btn=>{
      btn.addEventListener("click",async()=>{
        const id=btn.dataset.restock, inp=document.getElementById("rs_"+id), qty=safeNum(inp?.value);
        if(qty<1){ toast("Miqdor kamida 1 bo'lsin"); return; }
        const origText=btn.textContent; btn.disabled=true; btn.textContent="⏳...";
        try{
          await apiPut("/products/"+id+"/restock",{qty}); toast(`✅ +${qty} dona qo'shildi!`);
          const row=c.querySelector(`.oos-row[data-id="${id}"]`);
          if(row){ row.style.transition="all .3s"; row.style.opacity="0"; setTimeout(()=>renderOutOfStock(),320); }
          else renderOutOfStock();
        }catch(err){ toast("❌ "+err.message); btn.disabled=false; btn.textContent=origText; }
      });
    });
  }catch(err){ c.innerHTML=`<div class="empty" style="color:var(--red)">❌ ${esc(err.message)}</div>`; }
}

/* Admin/Driver orders */
async function fetchAllOrders(){ try{ state.allOrders=await apiGet("/orders"); if(state.view==="admin"){ renderAdminOrders(); renderAdminArchive(); } if(state.view==="driver") renderDriverOrders(); }catch{} }
async function adminTickOnWay(orderId){ const o=state.allOrders.find(x=>x.orderId===orderId); if(!o) return; await apiPut("/orders/"+orderId+"/assign",{driverId:o.assignedDriver||"manual",driverName:o.driverName||"—"}); await fetchAllOrders(); toast("Yo'lda ✅"); }
async function driverTickDelivered(orderId){ await apiPut("/orders/"+orderId+"/delivered",{}); await fetchAllOrders(); toast("Yetib keldi ✅"); }
function renderAdminOrders(){
  if(state.view!=="admin"||state.adminTab!=="orders"||!$("adminOrders")) return;
  const active=state.allOrders.filter(o=>!o.status?.delivered);
  $("adminOrders").innerHTML=active.map(o=>{ const u=o.user||{},onWay=!!o.status?.onWay; return `<div class="item" style="align-items:flex-start"><div style="flex:1"><div class="t1">Chek • <b>${esc(o.orderId)}</b></div><div class="t2">ID: <b>${esc(o.customerId||"—")}</b> • ${esc((u.firstName||"")+" "+(u.lastName||""))}</div><div class="t2">${esc((u.region||"")+", "+(u.district||""))} • ${esc(u.phone||"")}</div><div class="t2"><b>Jami:</b> ${fmt(o.total||0)} • ${onWay?"✅ Yo'lda":"⏳ Kutilmoqda"}</div></div><div class="row" style="flex-direction:column;gap:6px"><button class="pill" data-view="${esc(o.orderId)}" type="button">👁 Chek</button><button class="pill ${onWay?"danger":""}" data-tick="${esc(o.orderId)}" type="button">${onWay?"Yo'lda ✅":"Tick ✅"}</button></div></div>`; }).join("")||`<div class="empty">Buyurtma yo'q</div>`;
  $("adminOrders").querySelectorAll("[data-view]").forEach(b=>{ b.onclick=()=>{ const o=state.allOrders.find(x=>x.orderId===b.dataset.view); if(o) openOrderView(o); }; });
  $("adminOrders").querySelectorAll("[data-tick]").forEach(b=>{ b.onclick=()=>adminTickOnWay(b.dataset.tick); });
}
function renderAdminArchive(){
  if(state.view!=="admin"||state.adminTab!=="archive"||!$("adminArchive")) return;
  $("adminArchive").innerHTML=state.allOrders.filter(o=>o.status?.delivered).map(o=>`<div class="item"><div><div class="t1">Arxiv • <b>${esc(o.orderId)}</b></div><div class="t2">Jami: ${fmt(o.total||0)} • ✅ Yetib keldi</div></div><button class="pill" data-view="${esc(o.orderId)}" type="button">👁</button></div>`).join("")||`<div class="empty">Arxiv bo'sh</div>`;
  $("adminArchive").querySelectorAll("[data-view]").forEach(b=>{ b.onclick=()=>{ const o=state.allOrders.find(x=>x.orderId===b.dataset.view); if(o) openOrderView(o); }; });
}
function renderDriverOrders(){
  if(state.view!=="driver"||!$("driverOrders")) return;
  const list=state.allOrders.filter(o=>o.status?.onWay&&!o.status?.delivered);
  $("driverOrders").innerHTML=list.map(o=>{ const u=o.user||{}; return `<div class="item" style="align-items:flex-start"><div style="flex:1"><div class="t1">Yetkazish • <b>${esc(o.orderId)}</b></div><div class="t2">ID: <b>${esc(o.customerId||"—")}</b> • ${esc((u.firstName||"")+" "+(u.lastName||""))}</div><div class="t2">${esc((u.region||"")+", "+(u.district||""))} • ${esc(u.phone||"")}</div><div class="t2"><b>Jami:</b> ${fmt(o.total||0)}</div></div><div class="row" style="flex-direction:column;gap:6px"><button class="pill" data-view="${esc(o.orderId)}" type="button">👁 Chek</button><button class="pill danger" data-done="${esc(o.orderId)}" type="button">🚚✅ Keldi</button></div></div>`; }).join("")||`<div class="empty">Yo'lda buyurtma yo'q</div>`;
  $("driverOrders").querySelectorAll("[data-view]").forEach(b=>{ b.onclick=()=>{ const o=state.allOrders.find(x=>x.orderId===b.dataset.view); if(o) openOrderView(o); }; });
  $("driverOrders").querySelectorAll("[data-done]").forEach(b=>{ b.onclick=()=>driverTickDelivered(b.dataset.done); });
}

/* Nav + Filters */
function initNav(){
  document.querySelectorAll(".navBtn,.sd-btn").forEach(b=>{ if(b.dataset.go) b.onclick=()=>go(b.dataset.go); });
  $("prodBack")?.addEventListener("click",()=>go("home"));
  $("driverBack")?.addEventListener("click",()=>go("home"));
  $("sdLogout")?.addEventListener("click",()=>$("logout")?.click());
}
function initFilters(){ const s=()=>{ $("filterAll")?.classList.toggle("active",state.homeFilter==="all"); $("filterDiscount")?.classList.toggle("active",state.homeFilter==="discount"); $("filterNew")?.classList.toggle("active",state.homeFilter==="new"); }; $("filterAll")?.addEventListener("click",()=>{ state.homeFilter="all"; s(); renderHome(); }); $("filterDiscount")?.addEventListener("click",()=>{ state.homeFilter="discount"; s(); renderHome(); }); $("filterNew")?.addEventListener("click",()=>{ state.homeFilter="new"; s(); renderHome(); }); s(); }

/* GPS */
let _gpsWatchId=null;
function startAutoGPS(){ if(!navigator.geolocation) return; if(_gpsWatchId) return; const onSuccess=pos=>sendLocation(pos.coords.latitude,pos.coords.longitude); const onError=err=>{ if(err.code===1) updateGPSIndicator(false); }; const opts={enableHighAccuracy:false,timeout:10000,maximumAge:60000}; navigator.geolocation.getCurrentPosition(onSuccess,onError,opts); _gpsWatchId=navigator.geolocation.watchPosition(onSuccess,onError,{enableHighAccuracy:false,maximumAge:60000,timeout:20000}); }
function stopAutoGPS(){ if(_gpsWatchId){ navigator.geolocation.clearWatch(_gpsWatchId); _gpsWatchId=null; } updateGPSIndicator(false); }
async function sendLocation(lat,lng){ if(!state.user) return; fetch(API+"/users/"+state.user.uid+"/location",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({lat,lng})}).catch(()=>{}); if(state.profile){ state.profile.lat=lat; state.profile.lng=lng; } updateGPSIndicator(true,lat,lng); }
function updateGPSIndicator(active,lat,lng){ const dot=$("gpsIndicatorDot"),lbl=$("gpsIndicatorLbl"); if(!dot) return; if(active){ dot.classList.add("active");dot.classList.remove("error"); if(lbl) lbl.textContent=lat&&lng?`${lat.toFixed(3)},${lng.toFixed(3)}`:"📍 Faol"; }else{ dot.classList.remove("active");dot.classList.add("error"); if(lbl) lbl.textContent="GPS yo'q"; } }

/* Boot */
function start(){
  initRegionsUI(); initAuthUI(); initSearch(); initNav(); initFilters();
  initCatalogBack(); initCartButtons(); initReceiptModal(); initOrderViewModal();
  initOrdersButtons(); initAdminTabs(); initAdminProductForm(); initAdsSave();
  initProfileTabs(); initReviewModal();
  onAuthStateChanged(auth, async user=>{
    if(_justRegistered) return;
    state.user=user||null; stopAllPolls();
    if(user){
      hide($("auth")); show($("app"));
      try{ state.profile=await syncUser(user); renderProfile(); }
      catch(err){ await signOut(auth); show($("auth")); hide($("app")); setMsg($("authMsg"),err?.message||"Profil xato"); return; }
      await Promise.all([fetchProducts(),fetchFavorites(),fetchCart(),fetchAds()]);
      await fetchUserOrders();
      startPoll("products",fetchProducts,30000); startPoll("favorites",fetchFavorites,30000);
      startPoll("cart",fetchCart,20000); startPoll("ads",fetchAds,60000);
      startPoll("userOrders",fetchUserOrders,20000);
      initSocket(user); startAutoGPS(); go("home");
    }else{
      stopAutoGPS(); disconnectSocket(); state.profile=null; show($("auth")); hide($("app"));
    }
  });
}
document.addEventListener("DOMContentLoaded",start);

/* ── DevTools blocker ── */
(function(){
  // Klaviatura orqali blok (F12, Ctrl+Shift+I/J/C/U, Ctrl+U)
  document.addEventListener("keydown", function(e){
    if(
      e.key==="F12" ||
      (e.ctrlKey && e.shiftKey && ["I","J","C","i","j","c"].includes(e.key)) ||
      (e.ctrlKey && ["U","u"].includes(e.key)) ||
      (e.ctrlKey && e.shiftKey && e.key==="K")
    ){
      e.preventDefault(); e.stopPropagation(); return false;
    }
  }, true);

  // O'ng click (inspect) blok
  document.addEventListener("contextmenu", function(e){
    e.preventDefault(); return false;
  }, true);

  // DevTools ochiq bo'lsa sahifani yashirish
  let devOpen=false;
  const threshold=160;
  setInterval(function(){
    const wH=window.outerHeight - window.innerHeight;
    const wW=window.outerWidth  - window.innerWidth;
    if(wH>threshold || wW>threshold){
      if(!devOpen){ devOpen=true; document.body.style.display="none"; }
    } else {
      if(devOpen){ devOpen=false; document.body.style.display=""; }
    }
  }, 800);
})();