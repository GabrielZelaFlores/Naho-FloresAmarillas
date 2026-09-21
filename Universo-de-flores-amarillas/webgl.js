/* Native WebGL renderer: one continuous camera, flower geometry and seasonal light. */
(() => {
  const TAU = Math.PI * 2;
  const vertexWorld = `
    attribute vec3 aPosition; attribute vec3 aColor; attribute vec3 aNormal;
    uniform vec3 uCamera; uniform vec2 uPointer,uOrbit; uniform float uFocal, uAspect, uTime, uScene;
    varying vec3 vColor; varying float vDepth;
    void main(){
      vec3 p=aPosition;
      float wind=sin(uTime*.0008+p.z*.26+p.y*.5);
      p.x+=wind*(.035+abs(p.y)*.008);
      p.y+=sin(uTime*.00056+p.x*1.7+p.z*.13)*.018;
      p.x+=uPointer.x*(.024+abs(p.y)*.004);p.y+=uPointer.y*.018;
      if(aPosition.y< -2.5){p.y-=20.*(1.-smoothstep(.12,.95,uScene));}
      if(aPosition.z< -98.&&aPosition.y> -2.5){p.y-=32.*(1.-smoothstep(4.15,4.9,uScene));}
      if(aPosition.z>-.8&&aPosition.z<.8){float angle=sin(uTime*.00042)*.18;float oldX=p.x;p.x=oldX*cos(angle);p.z+=oldX*sin(angle);}
      if(aPosition.z< -95.4&&aPosition.z> -97.0){float bloom=.19+.81*smoothstep(4.25,4.95,uScene);p.xy=vec2(0.,1.3)+(p.xy-vec2(0.,1.3))*bloom;p.z=-96.+(p.z+96.)*bloom;}
      vec3 q=p-vec3(0.,0.,-101.);float cy=cos(uOrbit.x),sy=sin(uOrbit.x),cp=cos(uOrbit.y),sp=sin(uOrbit.y);
      q=vec3(q.x*cy+q.z*sy,q.y,-q.x*sy+q.z*cy);q=vec3(q.x,q.y*cp-q.z*sp,q.y*sp+q.z*cp);p=q+vec3(0.,0.,-101.);
      float d=uCamera.z-p.z; vDepth=d;
      gl_Position=vec4((p.x-uCamera.x)*uFocal/uAspect,(p.y-uCamera.y)*uFocal,d*1.002-.20,d);
      float light=.65+.35*max(dot(normalize(aNormal),normalize(vec3(-.35,.7,1.))),0.);
      vColor=aColor*light*(.92+.08*sin(uTime*.0011+p.z*.4));
    }`;
  const fragmentWorld = `precision mediump float; varying vec3 vColor; varying float vDepth;
    void main(){if(vDepth<.2)discard; vec3 color=vColor+pow(max(vColor.r-vColor.b,0.),2.)*vec3(.23,.15,.02);gl_FragColor=vec4(color,1.);}`;

  const vertexParticles = `
    attribute vec3 aPosition; attribute float aSeed;
    uniform vec3 uCamera; uniform vec2 uOrbit; uniform float uFocal,uAspect,uTime,uDpr,uSize,uScene,uBurst;
    varying float vSeed; varying float vDepth;
    void main(){
      vec3 p=aPosition;
      p.x+=sin(uTime*.0003+aSeed*17.+p.z*.12)*.18;
      p.y+=sin(uTime*.00048+aSeed*25.)*.12;
      if(uScene>2.5&&uScene<3.5){p.x+=sin(uTime*.0007+aSeed*30.)*.3;p.y-=mod(uTime*.00022+aSeed,1.)*1.8;}
      if(uScene>3.5&&uScene<4.5){p.y-=mod(uTime*.00013+aSeed,1.)*1.0;}
      vec2 direction=normalize(p.xy+vec2(sin(aSeed*31.),cos(aSeed*37.))*.4);
      p.xy+=direction*uBurst*(1.5+aSeed*4.);
      vec3 q=p-vec3(0.,0.,-101.);float cy=cos(uOrbit.x),sy=sin(uOrbit.x),cp=cos(uOrbit.y),sp=sin(uOrbit.y);
      q=vec3(q.x*cy+q.z*sy,q.y,-q.x*sy+q.z*cy);q=vec3(q.x,q.y*cp-q.z*sp,q.y*sp+q.z*cp);p=q+vec3(0.,0.,-101.);
      float d=uCamera.z-p.z;vDepth=d;vSeed=aSeed;
      gl_Position=vec4((p.x-uCamera.x)*uFocal/uAspect,(p.y-uCamera.y)*uFocal,d*1.002-.20,d);
      gl_PointSize=d>.2?min(35.,max(1.,(30.+aSeed*55.)*uSize*uDpr/d)):0.;
    }`;
  const fragmentParticles = `precision mediump float; uniform float uScene,uAlpha;varying float vSeed,vDepth;
    vec3 season(float s){
      if(s<1.)return mix(vec3(.72,.80,1.),vec3(1.,.86,.35),s);
      if(s<2.)return mix(vec3(1.,.86,.35),vec3(1.,.44,.67),s-1.);
      if(s<3.)return mix(vec3(1.,.44,.67),vec3(1.,.50,.17),s-2.);
      if(s<4.)return mix(vec3(1.,.50,.17),vec3(.56,.86,1.),s-3.);
      return mix(vec3(.56,.86,1.),vec3(1.,.91,.48),clamp(s-4.,0.,1.));
    }
    void main(){if(vDepth<.2)discard;vec2 p=gl_PointCoord-.5;float r=length(p);float halo=1.-smoothstep(.08,.5,r);float core=1.-smoothstep(0.,.12,r);float shape=halo;
      if(uScene>1.5&&uScene<2.5){vec2 q=abs(p);float wings=(1.-smoothstep(.06,.20,length((q-vec2(.22,.07))*vec2(.8,1.3))))+(1.-smoothstep(.05,.15,length((q-vec2(.14,.19))*vec2(1.1,1.2))));shape=max(core*.5,wings*.8);}
      if(uScene>2.5&&uScene<3.5){shape*=1.-smoothstep(.05,.45,abs(p.y*.7+p.x*.3));}
      if(uScene>3.5&&uScene<4.5){float crystal=max(1.-smoothstep(.02,.07,abs(p.x)),1.-smoothstep(.02,.07,abs(p.y)));shape=max(core,crystal*halo*.85);}
      float a=(halo*.38+core*.62)*shape*uAlpha*(.55+vSeed*.45);
      gl_FragColor=vec4(season(uScene)*a,a);
    }`;

  const vertexBackdrop = `attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
  const fragmentBackdrop = `precision mediump float;varying vec2 vUv;uniform float uScene,uTime,uAspect;uniform sampler2D uSpring,uSummer,uAutumn,uWinter;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    vec3 top(float s){if(s<1.)return mix(vec3(.018,.026,.105),vec3(.035,.16,.17),s);if(s<2.)return mix(vec3(.035,.16,.17),vec3(.28,.07,.28),s-1.);if(s<3.)return mix(vec3(.28,.07,.28),vec3(.16,.07,.12),s-2.);if(s<4.)return mix(vec3(.16,.07,.12),vec3(.018,.05,.19),s-3.);return mix(vec3(.018,.05,.19),vec3(.09,.12,.20),clamp(s-4.,0.,1.));}
    vec3 bottom(float s){if(s<1.)return mix(vec3(.09,.055,.17),vec3(.17,.28,.14),s);if(s<2.)return mix(vec3(.17,.28,.14),vec3(.56,.19,.24),s-1.);if(s<3.)return mix(vec3(.56,.19,.24),vec3(.27,.13,.08),s-2.);if(s<4.)return mix(vec3(.27,.13,.08),vec3(.06,.17,.24),s-3.);return mix(vec3(.06,.17,.24),vec3(.30,.22,.12),clamp(s-4.,0.,1.));}
    vec2 photoUv(vec2 uv){float imageAspect=1.777;float ratio=uAspect/imageAspect;if(ratio<1.)return vec2((uv.x-.5)*ratio+.5,uv.y);return vec2(uv.x,(uv.y-.5)/ratio+.5);}
    vec3 photo(float s,vec2 uv){vec2 p=photoUv(uv);if(s<1.)return texture2D(uSpring,p).rgb;if(s<2.)return mix(texture2D(uSpring,p).rgb,texture2D(uSummer,p).rgb,s-1.);if(s<3.)return mix(texture2D(uSummer,p).rgb,texture2D(uAutumn,p).rgb,s-2.);if(s<4.)return mix(texture2D(uAutumn,p).rgb,texture2D(uWinter,p).rgb,s-3.);return mix(texture2D(uWinter,p).rgb,texture2D(uSpring,p).rgb,clamp(s-4.,0.,1.));}
    float ridge(vec2 uv,float frequency,float phase){float x=uv.x*frequency+phase;return sin(x)*.042+sin(x*1.93+1.7)*.027+sin(x*3.71-.8)*.012;}
    void main(){vec2 uv=vUv;float t=uTime*.00015;vec3 c=mix(bottom(uScene),top(uScene),smoothstep(.05,.95,uv.y));
      float neb=sin(uv.x*7.+t+sin(uv.y*5.))*sin(uv.y*9.-t*.8);
      c+=vec3(.13,.08,.19)*pow(max(neb,0.),3.)*(1.-smoothstep(.4,1.5,uScene));
      float star=step(.997,hash(floor(uv*vec2(210.*uAspect,160.))))*(.3+.7*hash(floor(uv*vec2(71.,97.))));
      c+=vec3(.72,.77,1.)*star*(1.-smoothstep(.35,1.6,uScene))*.65;
      float sun=length((uv-vec2(.74,.58))*vec2(uAspect,1.));float summer=1.-smoothstep(.7,1.2,abs(uScene-2.));
      c+=vec3(1.,.47,.15)*(1.-smoothstep(.01,.23,sun))*summer*.55;
      float aur=sin(uv.x*13.+t*3.+sin(uv.x*5.+t)*2.)*.055+uv.y-.73;
      c+=vec3(.16,.72,.70)*exp(-abs(aur)*31.)*(1.-smoothstep(.45,1.1,abs(uScene-4.)))*.35;
      float warm=1.-smoothstep(.2,.75,length((uv-vec2(.5,.48))*vec2(uAspect,1.)));
      c+=vec3(.28,.17,.04)*warm*(1.-smoothstep(.45,1.,abs(uScene-5.)));
      float photoBlend=smoothstep(.1,1.,uScene)*.83;
      c=mix(c,photo(uScene,uv),photoBlend);
      // Layered golden mountains live behind the flower field through every chapter.
      float landscape=smoothstep(.12,.70,uScene);
      float farPeak=.50+ridge(uv,11.,.8)+.12*exp(-pow((uv.x-.23)*8.,2.))+.16*exp(-pow((uv.x-.77)*7.,2.));
      float middlePeak=.39+ridge(uv,16.,2.4)+.10*exp(-pow((uv.x-.54)*9.,2.));
      float nearPeak=.28+ridge(uv,22.,-.7);
      vec3 farColor=mix(vec3(.20,.25,.30),vec3(.48,.31,.28),smoothstep(1.,3.,uScene));
      vec3 middleColor=mix(vec3(.11,.24,.24),vec3(.28,.26,.22),smoothstep(1.,3.,uScene));
      c=mix(c,farColor,landscape*(1.-smoothstep(farPeak-.018,farPeak+.012,uv.y))*.92);
      c=mix(c,middleColor,landscape*(1.-smoothstep(middlePeak-.012,middlePeak+.012,uv.y))*.96);
      c+=vec3(1.,.74,.35)*exp(-abs(uv.y-farPeak)*180.)*landscape*.12;
      c+=vec3(.86,.77,.45)*exp(-abs(uv.y-middlePeak)*160.)*landscape*.075;
      c=mix(c,vec3(.045,.17,.12),landscape*(1.-smoothstep(nearPeak-.015,nearPeak+.02,uv.y))*.96);
      float horizonGlow=exp(-pow((uv.y-.50)*9.,2.));
      c+=vec3(.31,.18,.045)*horizonGlow*landscape*.28;
      c+=vec3(.18,.13,.03)*warm*(1.-smoothstep(.45,1.,abs(uScene-5.)));
      gl_FragColor=vec4(c,1.);
    }`;
  // One inexpensive bright-pass blur gives the luminous geometry a soft bloom.
  const fragmentPost = `precision mediump float;varying vec2 vUv;uniform sampler2D uSceneTex;uniform vec2 uTexel;uniform float uBloom;
    vec3 glow(vec2 offset){vec3 c=texture2D(uSceneTex,vUv+offset*uTexel).rgb;float bright=max(max(c.r,c.g),c.b);return c*max(0.,bright-.62);}
    void main(){vec3 base=texture2D(uSceneTex,vUv).rgb;vec3 blur=glow(vec2(-3.,0.))+glow(vec2(3.,0.))+glow(vec2(0.,-3.))+glow(vec2(0.,3.));
      blur+=glow(vec2(-2.,-2.))+glow(vec2(2.,-2.))+glow(vec2(-2.,2.))+glow(vec2(2.,2.));
      gl_FragColor=vec4(base+blur*uBloom*.12,1.);
    }`;

  function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  function program(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
  function pushVertex(out,p,c,n){out.push(p[0],p[1],p[2],c[0],c[1],c[2],n[0],n[1],n[2]);}
  function triangle(out,a,b,c,color,normal=[0,0,1]){pushVertex(out,a,color,normal);pushVertex(out,b,color,normal);pushVertex(out,c,color,normal);}
  function ring(out,x,y,z,r){for(let layer=0;layer<3;layer++){const radius=r*(1.05+layer*.24),thickness=r*.006;for(let i=0;i<96;i++){const a=i*TAU/96,b=(i+1)*TAU/96;const p=(d,t)=>[x+Math.cos(t)*d,y+Math.sin(t)*d,z];const c=layer===1?[.76,.50,.16]:[.35,.28,.11];triangle(out,p(radius-thickness,a),p(radius+thickness,a),p(radius-thickness,b),c);triangle(out,p(radius+thickness,a),p(radius+thickness,b),p(radius-thickness,b),c);}}}
  function flower(out,x,y,z,r,petalCount=18,final=false){
    // Each petal is a curved ribbon with four segments and a raised glowing tip.
    const inner=r*.25,outer=r,base=final?[1,.70,.17]:[.94,.59,.10],tip=final?[1,.97,.66]:[1,.88,.40];
    for(let p=0;p<petalCount;p++){const angle=p*TAU/petalCount,ca=Math.cos(angle),sa=Math.sin(angle),tx=-sa,ty=ca;
      function pair(t){const distance=inner+(outer-inner)*t,width=r*.23*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.75),curve=Math.sin(t*Math.PI)*r*.16;
        return [[x+ca*distance+tx*width,y+sa*distance+ty*width,z+curve],[x+ca*distance-tx*width,y+sa*distance-ty*width,z+curve]];}
      for(let s=0;s<5;s++){const t=s/5,u=(s+1)/5,a=pair(t),b=pair(u),mix=t*.75+.15,color=base.map((v,i)=>v*(1-mix)+tip[i]*mix);
        triangle(out,a[0],a[1],b[0],color);triangle(out,b[0],a[1],b[1],color);}
    }
    const segments=36,center=[x,y,z+r*.13];
    for(let i=0;i<segments;i++){const a=i*TAU/segments,b=(i+1)*TAU/segments;
      triangle(out,center,[x+Math.cos(a)*r*.28,y+Math.sin(a)*r*.28,z+r*.12],[x+Math.cos(b)*r*.28,y+Math.sin(b)*r*.28,z+r*.12],final?[.42,.22,.06]:[.30,.16,.08]);
      const c1=[x+Math.cos(a)*r*.28,y+Math.sin(a)*r*.28,z+r*.12],c2=[x+Math.cos(b)*r*.28,y+Math.sin(b)*r*.28,z+r*.12],e1=[x+Math.cos(a)*r*.33,y+Math.sin(a)*r*.33,z+r*.09],e2=[x+Math.cos(b)*r*.33,y+Math.sin(b)*r*.33,z+r*.09];
      triangle(out,c1,e1,c2,[1,.68,.16]);triangle(out,c2,e1,e2,[1,.68,.16]);
    }
    // A dark green stem gives each bloom a floating botanical silhouette.
    const sy=y-r*1.1,sw=r*.045;
    triangle(out,[x-sw,y-r*.22,z-.05],[x+sw,y-r*.22,z-.05],[x-sw,sy,z-.05],[.08,.38,.20]);
    triangle(out,[x+sw,y-r*.22,z-.05],[x+sw,sy,z-.05],[x-sw,sy,z-.05],[.08,.38,.20]);
  }
  function meadowBloom(out,x,y,z,r,phase){
    // Small flowers use a few triangles so the meadow stays fluid on phones.
    const count=9, gold=[1,.72+phase*.16,.13], light=[1,.94,.48];
    for(let i=0;i<count;i++){const a=i*TAU/count,ca=Math.cos(a),sa=Math.sin(a),tx=-sa,ty=ca;
      const root=[x+ca*r*.17,y+sa*r*.17,z],left=[x+ca*r*.76+tx*r*.23,y+sa*r*.76+ty*r*.23,z+.035],right=[x+ca*r*.76-tx*r*.23,y+sa*r*.76-ty*r*.23,z+.035],tip=[x+ca*r,y+sa*r,z+.10];
      triangle(out,root,left,tip,gold);triangle(out,root,tip,right,light);
    }
    const stemY=y-r*1.8,w=r*.045;triangle(out,[x-w,y,z-.08],[x+w,y,z-.08],[x-w,stemY,z-.08],[.09,.43,.18]);triangle(out,[x+w,y,z-.08],[x+w,stemY,z-.08],[x-w,stemY,z-.08],[.09,.43,.18]);
    for(let i=0;i<12;i++){const a=i*TAU/12,b=(i+1)*TAU/12;triangle(out,[x,y,z+.11],[x+Math.cos(a)*r*.22,y+Math.sin(a)*r*.22,z+.11],[x+Math.cos(b)*r*.22,y+Math.sin(b)*r*.22,z+.11],[.35,.19,.06]);}
  }
  function monumentalFlower(out,x,y,z,r,lean){
    // Sculptural blossoms replace the reference village's tall buildings.
    const base=-4.7,steps=12,stemWidth=r*.075;
    for(let i=0;i<steps;i++){const t=i/steps,u=(i+1)/steps;
      const ax=x+lean*t*t,ay=base+(y-base)*t,bx=x+lean*u*u,by=base+(y-base)*u;
      const w=stemWidth*(1-t*.48),w2=stemWidth*(1-u*.48);
      triangle(out,[ax-w,ay,z],[ax+w,ay,z],[bx-w2,by,z],[.075,.38,.19]);triangle(out,[ax+w,ay,z],[bx+w2,by,z],[bx-w2,by,z],[.10,.52,.23]);
      triangle(out,[ax,ay,z-w],[ax,ay,z+w],[bx,by,z-w2],[.05,.28,.16]);triangle(out,[ax,ay,z+w],[bx,by,z+w2],[bx,by,z-w2],[.11,.46,.20]);
    }
    for(let side of [-1,1]){const t=side<0?.38:.62,py=base+(y-base)*t,px=x+lean*t*t,len=r*(side<0?.65:.8);
      triangle(out,[px,py,z],[px+side*len*.45,py+len*.28,z+.13],[px+side*len,py+len*.08,z+.03],[.08,.43,.19]);
      triangle(out,[px,py,z],[px+side*len,py+len*.08,z+.03],[px+side*len*.52,py-len*.15,z+.10],[.12,.55,.23]);
      triangle(out,[px,py,z+.14],[px+side*len*.78,py+len*.09,z+.15],[px+side*len*.5,py+len*.06,z+.17],[.44,.73,.30]);
    }
    flower(out,x+lean,y,z,r,24,true);
    ring(out,x+lean,y,z-.4,r*1.12);
  }

  window.createFlowerWorld=function(canvas){
    const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance'})||canvas.getContext('experimental-webgl');
    if(!gl)throw Error('WebGL no disponible');
    const bg=program(gl,vertexBackdrop,fragmentBackdrop),mesh=program(gl,vertexWorld,fragmentWorld),points=program(gl,vertexParticles,fragmentParticles),post=program(gl,vertexBackdrop,fragmentPost);
    const textures=window.FLOWER_TEXTURES.map((source,index)=>{const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([24,28,46,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);const image=new Image();image.onload=()=>{gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image)};image.src=source;return texture;});
    const quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    let seed=21421;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    const mobile=matchMedia('(max-width:650px)').matches,geometry=[];
    // A real perspective meadow replaces the empty star corridor.
    for(let row=0;row<65;row++){const z=-8-row*1.9,z2=z-1.9,t=row/65;
      const c=[.025+t*.018,.13+t*.04,.065+t*.013],c2=[.04+t*.025,.18+t*.035,.076+t*.012];
      triangle(geometry,[-42,-4.8,z],[42,-4.8,z],[-42,-4.8,z2],row%2?c:c2,[0,1,0]);
      triangle(geometry,[42,-4.8,z],[42,-4.8,z2],[-42,-4.8,z2],row%2?c:c2,[0,1,0]);
    }
    // Rolling ridges give the garden a horizon instead of isolated props.
    for(let ridge=0;ridge<3;ridge++){const z=-115-ridge*8;for(let i=0;i<32;i++){const x=-48+i*3,x2=x+3;const hill=v=>-3.5+Math.sin(v*.12+ridge*1.7)*(.85+ridge*.18)+Math.sin(v*.29-ridge)*.33;
      const color=ridge===0?[.055,.25,.13]:ridge===1?[.045,.19,.12]:[.035,.14,.11];
      triangle(geometry,[x,-4.8,z],[x2,-4.8,z],[x,hill(x),z],color,[0,0,1]);triangle(geometry,[x2,-4.8,z],[x2,hill(x2),z],[x,hill(x),z],color,[0,0,1]);
    }}
    ring(geometry,0,-.12,-.42,1.85);flower(geometry,0,-.12,0,1.85,24,true);
    // A dense, irregular sea of sunflowers fills both sides of the journey.
    for(let i=0,n=mobile?500:1150;i<n;i++){const z=-9-rand()*118,x=(rand()-.5)*68,nearPath=Math.abs(x)<2.4;if(nearPath&&rand()<.90)continue;meadowBloom(geometry,x,-3.55+rand()*.9,z,.26+rand()*.53,rand());}
    for(let i=0,n=mobile?46:92;i<n;i++){const z=-11-i*(81/n)-rand()*3;flower(geometry,(rand()-.5)*25,(rand()-.5)*8,z,.56+rand()*.86,16,false);}
    // Tall blooms along the margins make the camera feel inside the garden.
    for(let i=0,n=mobile?32:72;i<n;i++){const z=-12-rand()*87,side=rand()<.5?-1:1,x=side*(5+rand()*14);monumentalFlower(geometry,x,-1.7+rand()*2,z,.55+rand()*.8,(rand()-.5)*.4);}
    ring(geometry,0,1.3,-96.42,2.75);flower(geometry,0,1.3,-96,2.75,30,true);
    monumentalFlower(geometry,-14,3.7,-111,3.4,.8);
    monumentalFlower(geometry,1,7.2,-119,5.0,-1.1);
    monumentalFlower(geometry,16,4.5,-108,3.9,-.7);
    monumentalFlower(geometry,-26,2.1,-123,2.4,.5);
    monumentalFlower(geometry,26,2.8,-126,2.7,-.5);
    for(let i=0,n=mobile?42:82;i<n;i++){const a=i*2.39996,r=3.8+Math.sqrt(i/n)*19;flower(geometry,Math.cos(a)*r,(rand()-.5)*9,-99-rand()*17,.43+rand()*.9,16,false);}
    const meshBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,meshBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geometry),gl.STATIC_DRAW);
    const particleData=[];for(let i=0,n=mobile?380:1100;i<n;i++)particleData.push((rand()-.5)*38,(rand()-.5)*23,5-rand()*117,rand());
    const particleBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,particleBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(particleData),gl.STATIC_DRAW);
    function attrib(p,name,count,stride,offset){const loc=gl.getAttribLocation(p,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,count,gl.FLOAT,false,stride,offset);}
    function uniform(p,name){return gl.getUniformLocation(p,name);}
    let width=1,height=1,dpr=1,renderWidth=1,renderHeight=1,burstStart=-10000,orbitYaw=0,orbitPitch=0,orbitZoom=0;
    let sceneTexture,framebuffer,depthBuffer;
    function resize(){width=canvas.clientWidth;height=canvas.clientHeight;dpr=Math.min(devicePixelRatio||1,mobile?1:1.45);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      renderWidth=Math.max(1,Math.round(canvas.width*(mobile?.82:1)));renderHeight=Math.max(1,Math.round(canvas.height*(mobile?.82:1)));
      if(sceneTexture)gl.deleteTexture(sceneTexture);if(framebuffer)gl.deleteFramebuffer(framebuffer);if(depthBuffer)gl.deleteRenderbuffer(depthBuffer);
      sceneTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,sceneTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,renderWidth,renderHeight,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sceneTexture,0);depthBuffer=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depthBuffer);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,renderWidth,renderHeight);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depthBuffer);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('No se pudo iniciar el brillo WebGL');gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    function render(progress,time,pointerX,pointerY){const stage=progress*5,cameraZ=8-progress*95+orbitZoom;const burst=Math.max(0,1-(time-burstStart)/1100);const shake=burst*burst*.095;const camX=pointerX*.65+Math.sin(time*.11)*shake,camY=pointerY*.42+Math.cos(time*.13)*shake;
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(0,0,renderWidth,renderHeight);
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(bg);gl.bindBuffer(gl.ARRAY_BUFFER,quad);attrib(bg,'aPosition',2,0,0);gl.uniform1f(uniform(bg,'uScene'),stage);gl.uniform1f(uniform(bg,'uTime'),time);gl.uniform1f(uniform(bg,'uAspect'),width/height);['uSpring','uSummer','uAutumn','uWinter'].forEach((name,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.uniform1i(uniform(bg,name),i)});gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(mesh);gl.bindBuffer(gl.ARRAY_BUFFER,meshBuffer);attrib(mesh,'aPosition',3,36,0);attrib(mesh,'aColor',3,36,12);attrib(mesh,'aNormal',3,36,24);gl.uniform3f(uniform(mesh,'uCamera'),camX,camY,cameraZ);gl.uniform2f(uniform(mesh,'uPointer'),pointerX,pointerY);gl.uniform2f(uniform(mesh,'uOrbit'),orbitYaw,orbitPitch);gl.uniform1f(uniform(mesh,'uFocal'),1.8);gl.uniform1f(uniform(mesh,'uAspect'),width/height);gl.uniform1f(uniform(mesh,'uTime'),time);gl.uniform1f(uniform(mesh,'uScene'),stage);gl.drawArrays(gl.TRIANGLES,0,geometry.length/9);
      gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.useProgram(points);gl.bindBuffer(gl.ARRAY_BUFFER,particleBuffer);attrib(points,'aPosition',3,16,0);attrib(points,'aSeed',1,16,12);gl.uniform3f(uniform(points,'uCamera'),camX,camY,cameraZ);gl.uniform2f(uniform(points,'uOrbit'),orbitYaw,orbitPitch);gl.uniform1f(uniform(points,'uFocal'),1.8);gl.uniform1f(uniform(points,'uAspect'),width/height);gl.uniform1f(uniform(points,'uTime'),time);gl.uniform1f(uniform(points,'uDpr'),dpr);gl.uniform1f(uniform(points,'uScene'),stage);gl.uniform1f(uniform(points,'uBurst'),burst);gl.uniform1f(uniform(points,'uSize'),1.7);gl.uniform1f(uniform(points,'uAlpha'),.17);gl.drawArrays(gl.POINTS,0,particleData.length/4);gl.uniform1f(uniform(points,'uSize'),.5);gl.uniform1f(uniform(points,'uAlpha'),.72);gl.drawArrays(gl.POINTS,0,particleData.length/4);gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.disable(gl.DEPTH_TEST);gl.useProgram(post);gl.bindBuffer(gl.ARRAY_BUFFER,quad);attrib(post,'aPosition',2,0,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sceneTexture);gl.uniform1i(uniform(post,'uSceneTex'),0);gl.uniform2f(uniform(post,'uTexel'),1/renderWidth,1/renderHeight);gl.uniform1f(uniform(post,'uBloom'),mobile?.58:.84);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
    resize();return{render,resize,setOrbit:(yaw,pitch,zoom)=>{orbitYaw=yaw;orbitPitch=pitch;orbitZoom=zoom},burst:()=>{burstStart=performance.now()},gl};
  };
})();
