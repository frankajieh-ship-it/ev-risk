"use strict";(()=>{var l="offo-verdict-panel",s={GREEN:{bg:"#dcfce7",border:"#86efac",text:"#166534",label:"Good Deal"},YELLOW:{bg:"#fef9c3",border:"#fde047",text:"#854d0e",label:"Proceed with Caution"},RED:{bg:"#fee2e2",border:"#fca5a5",text:"#991b1b",label:"High Risk"}},p={UNDERPRICED:"Below Market",FAIR:"Fair Price",OVERPRICED:"Overpriced",UNKNOWN:"Price Unknown"};function a(){document.getElementById(l)?.remove()}function d(e){let o=document.getElementById(l);if(o){o.remove();return}g(e)}function g(e){a();let o=s[e.verdict]??s.YELLOW,r=p[e.price_sanity?.label]??"Price Unknown",n=document.createElement("div");n.id=l,n.className="offo-panel";let c=e.risk_flags.map(i=>`<li class="offo-panel-flag">${t(i)}</li>`).join(""),f=e.must_answer_questions.map(i=>`<li class="offo-panel-question">${t(i)}</li>`).join("");n.innerHTML=`
    <div class="offo-panel-inner">
      <div class="offo-panel-header" style="background:${o.bg};border-bottom:2px solid ${o.border}">
        <div class="offo-panel-verdict-row">
          <span class="offo-panel-verdict-label" style="color:${o.text}">${o.label}</span>
          <button class="offo-panel-close" aria-label="Close panel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <p class="offo-panel-verdict-reason" style="color:${o.text}">${t(e.verdict_reason)}</p>
      </div>

      <div class="offo-panel-body">
        <section class="offo-panel-section">
          <h4 class="offo-panel-section-title">Risk Flags</h4>
          <ul class="offo-panel-list">${c}</ul>
        </section>

        <section class="offo-panel-section">
          <h4 class="offo-panel-section-title">Price Check</h4>
          <p class="offo-panel-price-label">${r}</p>
          ${e.price_sanity?.rationale_short?`<p class="offo-panel-price-rationale">${t(e.price_sanity.rationale_short)}</p>`:""}
        </section>

        <section class="offo-panel-section">
          <h4 class="offo-panel-section-title">Negotiation Opener</h4>
          <blockquote class="offo-panel-quote">${t(e.negotiation_opener)}</blockquote>
        </section>

        <section class="offo-panel-section">
          <h4 class="offo-panel-section-title">Must-Ask Questions</h4>
          <ul class="offo-panel-list">${f}</ul>
        </section>
      </div>

      <div class="offo-panel-footer">
        <a
          href="https://offolab.com/receipt/${encodeURIComponent(e.receipt_id)}"
          target="_blank"
          rel="noopener noreferrer"
          class="offo-panel-full-link"
        >
          Open Full Receipt
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;margin-left:4px">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>
    </div>
  `,n.querySelector(".offo-panel-close").addEventListener("click",a),document.body.appendChild(n),requestAnimationFrame(()=>n.classList.add("offo-panel-enter"))}function t(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}window.addEventListener("offo-show-panel",e=>{d(e.detail)});})();
