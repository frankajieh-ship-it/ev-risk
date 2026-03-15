"use strict";(()=>{var n=document.getElementById("enableToggle"),o=document.getElementById("routineCard"),i=document.getElementById("routineDetail"),l={home_l1:"Home L1 charger",home_l2:"Home L2 charger",work:"Workplace charging",public_only:"Public charging only"};chrome.storage.local.get(["enabled","offo_routine"],t=>{n.checked=t.enabled!==!1;let e=t.offo_routine;if(e){o.classList.remove("missing"),o.classList.add("synced");let a=l[e.charging_access??""]??e.charging_access??"Unknown",s=e.weekly_miles?`${e.weekly_miles} mi/wk`:null,c=[a,s].filter(Boolean).join(" \xB7 ");i.textContent=`Routine synced \xB7 ${c}`}else i.innerHTML=`
      No routine found.
      <a href="https://offolab.com/routine" target="_blank" class="routine-card-link">
        Complete setup at offolab.com \u2192
      </a>
    `});n.addEventListener("change",()=>{chrome.storage.local.set({enabled:n.checked})});})();
