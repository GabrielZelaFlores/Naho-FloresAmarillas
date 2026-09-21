/* Scroll, text and sound are kept separate from the WebGL renderer. */
(() => {
  let canvas=document.getElementById('world');
  const experience=document.getElementById('experience');
  const cover=document.getElementById('cover');
  const messages=[...document.querySelectorAll('.message')];
  const fill=document.getElementById('timeline-fill');
  const stageName=document.getElementById('stage-name');
  const stageNumber=document.getElementById('stage-number');
  const hint=document.getElementById('scroll-hint');
  const pulse=document.getElementById('pulse');
  const sound=document.getElementById('sound');
  const stage=document.querySelector('.stage');
  const exploreButton=document.getElementById('explore');
  const exploreUi=document.getElementById('explore-ui');
  const exploreStatus=document.getElementById('explore-status');
  const letterProgress=document.getElementById('letter-progress');
  const movePad=document.getElementById('move-pad');
  const letterDialog=document.getElementById('letter-dialog');
  const orientationTip=document.getElementById('orientation-tip');
  const fallback=document.getElementById('fallback');
  const referenceWorld=document.getElementById('reference-world');
  const mobile=matchMedia('(max-width:650px)').matches;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const names=['EL COMIENZO','PRIMAVERA','VERANO','OTOÑO','INVIERNO','LA LUZ REGRESA'];
  let world;
  try{world=createFlowerWorld(canvas);}catch(error){
    console.warn('WebGL no pudo iniciarse. Activando Canvas 2D.',error);
    try{const replacement=document.createElement('canvas');replacement.id='world';replacement.setAttribute('aria-label',canvas.getAttribute('aria-label'));canvas.replaceWith(replacement);canvas=replacement;world=createCanvasWorld(canvas);}
    catch(secondError){console.error(secondError);fallback.textContent='No se pudo iniciar la animación en este navegador.';fallback.hidden=false;return;}
  }
  // Wrap words once so each scene can assemble from light without changing its copy.
  for(const card of messages){let order=0;for(const block of card.querySelectorAll('h2,p,strong')){
    const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){const fragment=document.createDocumentFragment();for(const token of node.textContent.split(/(\s+)/)){if(!token)continue;if(/^\s+$/.test(token)){fragment.append(token);continue;}const word=document.createElement('span');word.className='kinetic-word';word.textContent=token;word.style.setProperty('--delay',`${Math.min(order++*48,1050)}ms`);fragment.append(word)}node.replaceWith(fragment)}
  }}
  for(const card of messages){let timer;const pulseText=()=>{if(card.hidden)return;card.classList.remove('text-pulse');void card.offsetWidth;card.classList.add('text-pulse');clearTimeout(timer);timer=setTimeout(()=>card.classList.remove('text-pulse'),850)};card.addEventListener('pointerenter',pulseText);card.addEventListener('pointerdown',pulseText)}

  let target=0,display=0,pointerX=0,pointerY=0,aimX=0,aimY=0,lastFrame=0,lastPointerTime=0,finaleBurst=false;
  let exploring=false,dragging=false,lastDragX=0,lastDragY=0,dragDistance=0,orbitYaw=0,orbitPitch=.08;
  const overviewPointers=new Map();
  let pinchDistance=0;
  const foundLetters=new Set();
  let overviewShown=false;
  const heldKeys=new Set(),heldPad=new Set();
  let orientationDismissed=false;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function updateOrientationTip(){orientationTip.hidden=orientationDismissed||!matchMedia('(pointer:coarse)').matches||innerWidth>innerHeight;}
  document.getElementById('dismiss-orientation').addEventListener('click',()=>{orientationDismissed=true;orientationTip.hidden=true;});
  updateOrientationTip();
  function showOverview(){
    if(overviewShown)return;
    overviewShown=true;
    heldKeys.clear();heldPad.clear();
    movePad.hidden=true;
    stage.classList.add('garden-complete');
    exploreStatus.textContent='Encontraste todas las cartas. Mira el jardín desde aquí.';
    document.querySelector('.desktop-instructions').textContent='Arrastra para girar · rueda para acercar o alejar';
    document.querySelector('.touch-instructions').textContent='Arrastra para girar · pellizca para acercar o alejar';
    window.flowerGardenShowOverview?.();
  }
  function closeLetter(){
    const wasOpen=!letterDialog.hidden;
    letterDialog.hidden=true;
    if(wasOpen&&exploring&&foundLetters.size===6)showOverview();
  }
  function openLetter(letter){
    if(!letter||!Number.isInteger(letter.index)||letter.index<0||letter.index>=6)return;
    if(!foundLetters.has(letter.index)){
      foundLetters.add(letter.index);
      letterProgress.textContent=`CARTAS ENCONTRADAS ${foundLetters.size} / 6`;
      window.flowerGardenMarkLetterFound?.(letter.index);
    }
    document.getElementById('letter-number').textContent=`CARTA ${String(letter.index+1).padStart(2,'0')} / 06`;
    document.getElementById('letter-text').textContent=letter.text;
    letterDialog.hidden=false;
    document.getElementById('close-letter').focus();
  }
  document.getElementById('close-letter').addEventListener('click',closeLetter);
  letterDialog.addEventListener('click',event=>{if(event.target===letterDialog)closeLetter();});
  function stopExplore(){exploring=false;dragging=false;overviewPointers.clear();pinchDistance=0;heldKeys.clear();heldPad.clear();stage.classList.remove('exploring');exploreUi.hidden=true;movePad.hidden=true;closeLetter();orbitYaw=0;orbitPitch=.08;world.setOrbit(0,0,0);window.flowerGardenStopExplore?.();}
  exploreButton.addEventListener('click',()=>{exploring=true;orbitYaw=0;orbitPitch=.08;stage.classList.add('exploring');exploreUi.hidden=false;movePad.hidden=overviewShown;world.burst();window.flowerGardenStartExplore?.();if(overviewShown)window.flowerGardenShowOverview?.();});
  document.getElementById('leave-explore').addEventListener('click',()=>{stopExplore();scrollTo({top:experience.offsetTop,behavior:reducedMotion?'instant':'smooth'});});
  for(const button of movePad.querySelectorAll('button')){
    const direction=button.dataset.move;
    button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);heldPad.add(direction);button.classList.add('is-held');});
    const release=()=>{heldPad.delete(direction);button.classList.remove('is-held');};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  }
  addEventListener('keydown',event=>{if(!exploring)return;const key=event.key.toLowerCase();if(key==='escape'){if(!letterDialog.hidden)closeLetter();return;}if(key==='e'&&letterDialog.hidden){openLetter(window.flowerGardenNearbyLetter?.());return;}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();heldKeys.add(key);}});
  addEventListener('keyup',event=>heldKeys.delete(event.key.toLowerCase()));
  addEventListener('blur',()=>{heldKeys.clear();heldPad.clear();});
  canvas.addEventListener('wheel',event=>{if(!exploring||!letterDialog.hidden)return;event.preventDefault();if(overviewShown)window.flowerGardenOrbitOverview?.(0,0,event.deltaY);else window.flowerGardenMove?.(clamp(-event.deltaY/120,-1,1),0,orbitYaw,orbitPitch,.14);},{passive:false});
  function updateScroll(){const rect=experience.getBoundingClientRect();target=Math.max(0,Math.min(1,-rect.top/Math.max(1,experience.offsetHeight-innerHeight)));if(exploring&&target<.88)stopExplore();}
  addEventListener('scroll',updateScroll,{passive:true});
  addEventListener('resize',()=>{world.resize();if(exploring)scrollTo({top:experience.offsetTop+experience.offsetHeight-innerHeight,behavior:'instant'});updateScroll();updateOrientationTip()},{passive:true});
  updateScroll();

  canvas.addEventListener('pointermove',event=>{
    if(exploring&&overviewShown&&overviewPointers.has(event.pointerId)){
      const previous=overviewPointers.get(event.pointerId);
      overviewPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(overviewPointers.size>1){
        const [a,b]=[...overviewPointers.values()];
        const distance=Math.hypot(a.x-b.x,a.y-b.y);
        if(pinchDistance)window.flowerGardenOrbitOverview?.(0,0,(pinchDistance-distance)*2);
        pinchDistance=distance;
      }else window.flowerGardenOrbitOverview?.((event.clientX-previous.x)*.006,(event.clientY-previous.y)*.005);
      return;
    }
    if(exploring&&dragging){const dx=event.clientX-lastDragX,dy=event.clientY-lastDragY;dragDistance+=Math.hypot(dx,dy);orbitYaw+=dx*.006;orbitPitch=clamp(orbitPitch+dy*.005,-1.1,1.1);lastDragX=event.clientX;lastDragY=event.clientY;return;}
    if(event.pointerType==='touch')return;
    lastPointerTime=performance.now();
    aimX=(event.clientX/innerWidth-.5)*2;
    aimY=(event.clientY/innerHeight-.5)*2;
  },{passive:true});
  canvas.addEventListener('pointerleave',()=>{if(!exploring){aimX=0;aimY=0}});
  canvas.addEventListener('pointerdown',event=>{
    if(exploring){if(!letterDialog.hidden)return;canvas.setPointerCapture(event.pointerId);if(overviewShown){overviewPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(overviewPointers.size===2){const [a,b]=[...overviewPointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}return;}dragging=true;dragDistance=0;lastDragX=event.clientX;lastDragY=event.clientY;return;}
    if(event.pointerType==='touch'){
      lastPointerTime=performance.now();
      aimX=(event.clientX/innerWidth-.5)*1.5;
      aimY=(event.clientY/innerHeight-.5)*1.5;
    }
  },{passive:true});
  canvas.addEventListener('pointerup',event=>{if(overviewPointers.delete(event.pointerId)){pinchDistance=0;return;}if(exploring&&dragging&&dragDistance<10&&letterDialog.hidden)openLetter(window.flowerGardenPickLetter?.(event.clientX,event.clientY));dragging=false;});
  canvas.addEventListener('pointercancel',event=>{overviewPointers.delete(event.pointerId);pinchDistance=0;dragging=false;});
  addEventListener('deviceorientation',event=>{if(performance.now()-lastPointerTime<2000||!Number.isFinite(event.gamma)||!Number.isFinite(event.beta))return;aimX=Math.max(-1,Math.min(1,event.gamma/30));aimY=Math.max(-1,Math.min(1,(event.beta-45)/35));},{passive:true});

  function enter(){
    if(target>.25)return;
    world.burst();
    pulse.classList.remove('active');void pulse.offsetWidth;pulse.classList.add('active');
    const distance=experience.offsetHeight-innerHeight;
    setTimeout(()=>scrollTo({top:experience.offsetTop+distance/5,behavior:reducedMotion?'instant':'smooth'}),270);
  }
  document.getElementById('enter').addEventListener('click',enter);
  canvas.addEventListener('click',()=>{if(target<.22)enter()});

  // A strict single-active-card rule prevents overlapping text even on fast scroll.
  function updateInterface(){
    const position=display*5;
    if(position>4.72&&!finaleBurst){world.burst();finaleBurst=true;}
    if(position<4.1)finaleBurst=false;
    const coverAlpha=Math.max(0,1-position/.44);
    cover.style.opacity=coverAlpha;
    cover.style.visibility=coverAlpha<.01?'hidden':'visible';
    cover.style.transform=`translateY(${-position*15}px)`;
    const active=Math.max(1,Math.min(5,Math.round(position)));
    for(let i=0;i<messages.length;i++){
      const card=messages[i],index=i+1;
      const opacity=index===active?Math.max(0,1-Math.abs(position-index)/.40):0;
      card.hidden=opacity<.01;
      if(card.hidden)card.classList.remove('is-active');else card.classList.add('is-active');
      if(!card.hidden){card.style.opacity=opacity;card.style.transform=`translateY(${(1-opacity)*25}px) scale(${.97+opacity*.03})`;}
    }
    const marker=Math.min(5,Math.floor(position+.5));
    stageName.textContent=names[marker];
    stageNumber.textContent=`${String(marker).padStart(2,'0')} / 05`;
    fill.style.width=`${display*100}%`;
    hint.style.opacity=Math.max(0,1-position/.7);
  }

  function frame(time){
    requestAnimationFrame(frame);
    if(document.hidden||time-lastFrame<(mobile?34:23))return;
    const seconds=Math.min((time-lastFrame)/1000,.15);
    lastFrame=time;
    display+=(target-display)*(reducedMotion?1:.16);
    pointerX+=(aimX-pointerX)*.07;
    pointerY+=(aimY-pointerY)*.07;
    if(exploring&&!overviewShown){
      const forward=letterDialog.hidden?Number(heldKeys.has('w')||heldKeys.has('arrowup')||heldPad.has('forward'))-Number(heldKeys.has('s')||heldKeys.has('arrowdown')||heldPad.has('back')):0;
      const strafe=letterDialog.hidden?Number(heldKeys.has('d')||heldKeys.has('arrowright')||heldPad.has('right'))-Number(heldKeys.has('a')||heldKeys.has('arrowleft')||heldPad.has('left')):0;
      window.flowerGardenMove?.(forward,strafe,orbitYaw,orbitPitch,seconds);
    }
    world.setOrbit(0,0,0);
    const scenePosition=display*5;
    window.flowerGardenSetActive?.(scenePosition>.08||exploring);
    const gardenVisible=window.flowerGardenReady?clamp((scenePosition-.18)/.36,0,1):0;
    referenceWorld.style.opacity=String(gardenVisible);
    if(scenePosition<.65||!window.flowerGardenReady)world.render(display,time,pointerX,pointerY);
    updateInterface();
  }
  requestAnimationFrame(frame);

  // Music starts only after a deliberate tap. No audio asset or network request.
  let audio,playing=false,timer;
  function note(freq,start,length,volume){
    const osc=audio.createOscillator(),gain=audio.createGain();
    osc.type='sine';osc.frequency.value=freq;
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(volume,start+.09);
    gain.gain.exponentialRampToValueAtTime(.0001,start+length);
    osc.connect(gain).connect(audio.destination);osc.start(start);osc.stop(start+length+.04);
  }
  function phrase(){if(!playing)return;const t=audio.currentTime;
    [392,493.88,587.33,659.25,587.33,493.88,440,392].forEach((f,i)=>{note(f,t+i*.43,1.4,.022);if(i%2===0)note(f/2,t+i*.43,1.9,.009)});
    timer=setTimeout(phrase,3900);
  }
  async function toggleSound(){
    if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();
    if(playing){playing=false;clearTimeout(timer);await audio.suspend();sound.setAttribute('aria-label','Activar música ambiental');sound.setAttribute('aria-pressed','false');}
    else{await audio.resume();playing=true;phrase();sound.setAttribute('aria-label','Silenciar música ambiental');sound.setAttribute('aria-pressed','true');}
    sound.querySelector('.sound-icon').textContent=playing?'♫':'♪';
  }
  sound.addEventListener('click',toggleSound);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback.hidden=false;});
})();
