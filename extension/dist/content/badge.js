"use strict";(()=>{var i="offo-deal-check-badge",d="offo_dismissed_listings";function l(){try{let t=sessionStorage.getItem(d);return t?new Set(JSON.parse(t)):new Set}catch{return new Set}}function f(t){let n=l();n.add(t);try{sessionStorage.setItem(d,JSON.stringify([...n]))}catch{}}function a(){document.getElementById(i)?.remove()}function g(t,n){if(document.getElementById(i)||l().has(n))return;let e=document.createElement("div");e.id=i,e.className="offo-badge",e.setAttribute("role","complementary"),e.setAttribute("aria-label","OFFO Deal Checker");let o=[t.year,t.make,t.model].filter(Boolean).join(" ");e.innerHTML=`
    <div class="offo-badge-inner">
      <div class="offo-badge-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 12l2 2 4-4"/>
          <circle cx="12" cy="12" r="10"/>
        </svg>
      </div>
      <div class="offo-badge-text">
        <span class="offo-badge-title">Check this deal</span>
        <span class="offo-badge-subtitle">${o||"EV listing"}</span>
      </div>
      <button class="offo-badge-close" aria-label="Dismiss" title="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `,e.querySelector(".offo-badge-inner").addEventListener("click",s=>{s.target.closest(".offo-badge-close")||chrome.runtime.sendMessage({type:"open_receipt",url:window.location.href})}),e.querySelector(".offo-badge-close").addEventListener("click",s=>{s.stopPropagation(),f(n),e.classList.add("offo-badge-exit"),setTimeout(()=>a(),300)}),document.body.appendChild(e),requestAnimationFrame(()=>{e.classList.add("offo-badge-enter")})}console.log("[OFFO] Badge script loaded, listening for events");window.addEventListener("offo-detection",t=>{let{isEV:n,vehicle:e,url:o}=t.detail;console.log("[OFFO] Badge received event:",{isEV:n,vehicle:e,url:o}),n&&e?chrome.storage.local.get(["enabled"],r=>{r.enabled!==!1?g(e,o):a()}):a()});window.dispatchEvent(new CustomEvent("offo-request-detection"));})();
