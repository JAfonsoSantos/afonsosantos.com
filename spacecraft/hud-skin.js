/* CorpHQ HUD skin — builds the left rail from the app's real nav, mirrors state.
   Pure overlay: never changes app logic; App.show() stays the source of truth. */
(function(){
  var ICON={dashboard:'squares-four',bases:'planet',planner:'flask',chain:'flow-arrow',profit:'trend-up',market:'currency-circle-dollar',database:'database',settings:'gear-six',admin:'shield-check',map:'map-trifold',calc:'calculator'};
  function labelFor(btn){ return (btn.textContent||'').replace(/[^\x20-\x7E]/g,'').replace(/\s+/g,' ').trim()||btn.dataset.tab; }
  function buildRail(){
    var nav=document.getElementById('nav'); if(!nav) return false;
    var btns=nav.querySelectorAll('button'); if(!btns.length) return false;
    document.body.classList.add('hud-skin');
    var rail=document.getElementById('hudRail');
    if(!rail){ rail=document.createElement('nav'); rail.id='hudRail';
      rail.innerHTML='<div class="hud-logo" title="CorpHQ"><i class="ph-fill ph-shooting-star"></i></div><div class="hud-navlist"></div><div class="hud-radar"><i class="ph-fill ph-broadcast"></i></div>';
      document.body.appendChild(rail);
      rail.querySelector('.hud-logo').onclick=function(){ if(window.showLanding)showLanding(); };
    }
    var list=rail.querySelector('.hud-navlist'); list.innerHTML='';
    btns.forEach(function(btn){
      var tab=btn.dataset.tab; if(!tab) return;
      var a=document.createElement('a'); a.className='hud-navitem'; a.dataset.tab=tab; a.href='javascript:void(0)';
      a.innerHTML='<i class="ph-fill ph-'+(ICON[tab]||'circle')+'"></i><span>'+labelFor(btn)+'</span>';
      a.addEventListener('click',function(e){ e.preventDefault(); if(window.App&&App.show)App.show(tab); btn.click&&btn.click(); syncActive(); });
      list.appendChild(a);
    });
    // Map lives outside #nav in the real app — add it to the rail, pointing at the real map page
    var mapLink=document.querySelector('header a[href="map/"]');
    var m=document.createElement('a'); m.className='hud-navitem'; m.href=(mapLink&&mapLink.getAttribute('href'))||'map/';
    m.innerHTML='<i class="ph-fill ph-map-trifold"></i><span>Map</span>'; list.appendChild(m);
    // topbar FLEET CMD pill (once)
    var h1=document.querySelector('header h1');
    if(h1&&!document.getElementById('hud-cmdpill')){ var p=document.createElement('span'); p.id='hud-cmdpill'; p.textContent='FLEET CMD'; h1.insertAdjacentElement('afterend',p); }
    syncActive();
    return true;
  }
  function syncActive(){
    var active=document.querySelector('header nav#nav button.active');
    var t=active?active.dataset.tab:null;
    var items=document.querySelectorAll('#hudRail .hud-navitem[data-tab]');
    for(var i=0;i<items.length;i++) items[i].classList.toggle('active', items[i].dataset.tab===t);
  }
  function tryInit(){ if(buildRail()){ var nav=document.getElementById('nav'); if(nav){ new MutationObserver(function(){buildRail();}).observe(nav,{childList:true}); } setInterval(syncActive,500); return true; } return false; }
  function start(){ if(tryInit())return; var n=0,iv=setInterval(function(){ if(tryInit()||++n>40)clearInterval(iv); },250); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
