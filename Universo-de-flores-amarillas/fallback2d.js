/* Canvas 2D renderer for browsers or devices where WebGL cannot start. */
(() => {
  function makeFlower(size){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const c=canvas.getContext('2d'),r=size*.43;c.translate(size/2,size/2);
    for(let i=0;i<20;i++){c.save();c.rotate(i*Math.PI/10);const g=c.createLinearGradient(0,-r*.25,0,-r);g.addColorStop(0,'#a95410');g.addColorStop(.45,'#f4b733');g.addColorStop(.82,'#ffe887');g.addColorStop(1,'#fff7c7');c.fillStyle=g;c.beginPath();c.moveTo(-r*.13,-r*.2);c.bezierCurveTo(-r*.35,-r*.66,-r*.18,-r,0,-r);c.bezierCurveTo(r*.18,-r,r*.35,-r*.66,r*.13,-r*.2);c.fill();c.restore();}
    const core=c.createRadialGradient(-r*.08,-r*.09,1,0,0,r*.37);core.addColorStop(0,'#ca8c37');core.addColorStop(.55,'#804319');core.addColorStop(1,'#32190e');c.fillStyle=core;c.beginPath();c.arc(0,0,r*.36,0,Math.PI*2);c.fill();c.strokeStyle='#f5bb41';c.lineWidth=size*.011;c.stroke();
    return canvas;
  }

  window.createCanvasWorld=function(canvas){
    const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Canvas 2D no disponible');
    const mobile=matchMedia('(max-width:650px)').matches;
    const pictures=window.FLOWER_TEXTURES.map(source=>{const image=new Image();image.src=source;return image});
    const flower=makeFlower(256),largeFlower=makeFlower(512);
    let seed=21421;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    const flowers=Array.from({length:mobile?24:42},(_,i)=>({x:(random()-.5)*18,y:(random()-.5)*10,z:-12-i*(77/(mobile?24:42))-random()*2,r:.48+random()*.8,angle:random()*6.28}));
    flowers.push({x:0,y:-.12,z:0,r:1.85,angle:0,hero:true});
    flowers.push({x:0,y:1.3,z:-96,r:2.75,angle:0,final:true});
    [[-14,3.7,-111,3.4],[1,7.2,-119,5],[16,4.5,-108,3.9],[-26,2.1,-123,2.4],[26,2.8,-126,2.7]].forEach(([x,y,z,r])=>flowers.push({x,y,z,r,angle:0,landmark:true}));
    for(let i=0,n=mobile?170:320;i<n;i++){const x=(random()-.5)*56;if(Math.abs(x)<2.6&&random()<.8)continue;flowers.push({x,y:-3.3+random()*.7,z:-10-random()*115,r:.23+random()*.49,angle:random()*6.28,meadow:true});}
    for(let i=0,n=mobile?38:68;i<n;i++){const a=i*2.39996,r=3.8+Math.sqrt(i/n)*19;flowers.push({x:Math.cos(a)*r,y:(random()-.5)*9,z:-99-random()*17,r:.43+random()*.9,angle:random()*6.28,garden:true});}
    flowers.sort((a,b)=>a.z-b.z);
    const dust=Array.from({length:mobile?120:240},()=>({x:(random()-.5)*40,y:(random()-.5)*24,z:4-random()*112,size:.5+random()*1.6,seed:random()}));
    let width=1,height=1,ratio=1,burstStart=-10000,orbitYaw=0,orbitPitch=0,orbitZoom=0;
    const palette=['#f8e6ae','#ffe36d','#ffad9e','#ffc275','#c7eaff','#ffe18b'];
    function resize(){width=canvas.clientWidth;height=canvas.clientHeight;ratio=Math.min(devicePixelRatio||1,mobile?1:1.25);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);}
    function cover(image,alpha){if(!image.complete||!image.naturalWidth||alpha<=0)return;const imageRatio=image.naturalWidth/image.naturalHeight,viewRatio=width/height;let sx=0,sy=0,sw=image.naturalWidth,sh=image.naturalHeight;if(viewRatio<imageRatio){sw=image.naturalHeight*viewRatio;sx=(image.naturalWidth-sw)/2}else{sh=image.naturalWidth/viewRatio;sy=(image.naturalHeight-sh)/2}ctx.globalAlpha=alpha;ctx.drawImage(image,sx,sy,sw,sh,0,0,width,height);ctx.globalAlpha=1;}
    function project(x,y,z,camera,px,py){let qz=z+101;const cy=Math.cos(orbitYaw),sy=Math.sin(orbitYaw),cp=Math.cos(orbitPitch),sp=Math.sin(orbitPitch),nx=x*cy+qz*sy,nz=-x*sy+qz*cy;z=y*sp+nz*cp-101;y=y*cp-nz*sp;x=nx;const depth=camera-z;if(depth<.9)return null;const focal=Math.min(width,height)*.88;return{x:width/2+(x-px*.65)*focal/depth,y:height/2-(y-py*.42)*focal/depth,scale:focal/depth,depth};}
    function render(progress,time,pointerX,pointerY){const stage=progress*5,camera=8-progress*95+orbitZoom,burst=Math.max(0,1-(time-burstStart)/1100);ctx.clearRect(0,0,width,height);
      const gradient=ctx.createLinearGradient(0,0,0,height);gradient.addColorStop(0,stage>3.5?'#081a38':stage>1.5?'#2d153a':'#090e2c');gradient.addColorStop(1,stage>3.5?'#162838':stage>1.5?'#663324':'#21182e');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
      if(stage>0){if(stage<1)cover(pictures[0],stage);else{const i=Math.min(3,Math.floor(stage-1)),f=stage-1-i;cover(pictures[i],1);if(i<3)cover(pictures[i+1],f);else cover(pictures[0],Math.max(0,stage-4));}}
      if(stage>.2){
      // Keep the same layered mountain horizon when WebGL is unavailable.
      const landscape=Math.min(1,Math.max(0,(stage-.2)/.5));ctx.save();ctx.globalAlpha=landscape;
      for(const layer of [{base:.57,amp:.12,color:'#756a71',phase:.8},{base:.65,amp:.075,color:'#405c50',phase:2.4},{base:.76,amp:.035,color:'#183d2c',phase:-.7}]){
        ctx.beginPath();ctx.moveTo(0,height);for(let x=0;x<=width+8;x+=8){const n=x/width;const peak=layer.base-Math.sin(n*11+layer.phase)*layer.amp*.35-Math.sin(n*23+layer.phase)*layer.amp*.22-layer.amp*Math.exp(-Math.pow((n-.72)*7,2));ctx.lineTo(x,height*peak)}ctx.lineTo(width,height);ctx.closePath();ctx.fillStyle=layer.color;ctx.fill();
      }ctx.restore();
      const horizon=height*.56;const field=ctx.createLinearGradient(0,horizon,0,height);field.addColorStop(0,'#244d3155');field.addColorStop(.18,'#17452dca');field.addColorStop(1,'#071b18');ctx.fillStyle=field;ctx.fillRect(0,horizon,width,height);
      const path=ctx.createLinearGradient(0,horizon,0,height);path.addColorStop(0,'#ffe5a800');path.addColorStop(1,'#b88c4355');ctx.fillStyle=path;ctx.beginPath();ctx.moveTo(width*.49,horizon);ctx.lineTo(width*.51,horizon);ctx.lineTo(width*.63,height);ctx.lineTo(width*.37,height);ctx.closePath();ctx.fill();}
      const shade=ctx.createLinearGradient(0,0,0,height);shade.addColorStop(0,'#07101c45');shade.addColorStop(.5,'#0a0b2238');shade.addColorStop(1,'#05081399');ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);
      const focal=Math.min(width,height)*.88;
      for(const particle of dust){let z=particle.z-camera;while(z>-1)z-=112;const depth=-z;if(depth<1)continue;let x=width/2+(particle.x-pointerX*.6)*focal/depth,y=height/2-(particle.y-pointerY*.4)*focal/depth;const wave=Math.sin(time*.0007+particle.seed*19)*7;x+=wave;const dx=x-width/2,dy=y-height/2;x+=dx*burst*(.4+particle.seed);y+=dy*burst*(.4+particle.seed);if(x<0||x>width||y<0||y>height)continue;ctx.fillStyle=palette[Math.min(5,Math.round(stage))];ctx.globalAlpha=Math.min(.8,.25+particle.seed*.5);const size=Math.min(4,particle.size*focal/depth*.1+.4);ctx.fillRect(x,y,size,size)}ctx.globalAlpha=1;
      for(const bloom of flowers){if((bloom.meadow&&stage<.4)||(bloom.landmark&&stage<4.25))continue;const point=project(bloom.x,bloom.y,bloom.z,camera,pointerX,pointerY);if(!point)continue;let radius=bloom.r*point.scale;if(bloom.final)radius*=.2+.8*Math.max(0,Math.min(1,(stage-4.25)/.75));if(radius<2||point.x<-radius||point.x>width+radius||point.y<-radius||point.y>height+radius)continue;radius=Math.min(radius,Math.max(width,height));if(bloom.landmark){const ground=project(bloom.x,-4.7,bloom.z,camera,pointerX,pointerY);if(ground){ctx.strokeStyle="#28773f";ctx.lineWidth=Math.max(2,radius*.09);ctx.beginPath();ctx.moveTo(ground.x,ground.y);ctx.quadraticCurveTo(point.x-radius*.2,(ground.y+point.y)*.5,point.x,point.y);ctx.stroke();}}ctx.save();ctx.translate(point.x,point.y);ctx.rotate(bloom.angle+Math.sin(time*.00038+bloom.z)*.1);ctx.globalAlpha=Math.min(1,(point.depth-1)/4);if(bloom.hero||bloom.final){ctx.strokeStyle='#ffe3a370';ctx.lineWidth=1;for(let ring=1;ring<=3;ring++){ctx.beginPath();ctx.ellipse(0,0,radius*(1+.17*ring),radius*(.4+.07*ring),-.18,0,Math.PI*2);ctx.stroke()}ctx.shadowColor='#ffd45c';ctx.shadowBlur=Math.min(35,radius*.25)}ctx.drawImage(bloom.hero||bloom.final||bloom.landmark?largeFlower:flower,-radius,-radius,radius*2,radius*2);ctx.restore();}
      const glow=ctx.createRadialGradient(width*.5,height*.5,0,width*.5,height*.5,Math.min(width,height)*.6);glow.addColorStop(0,stage>4.5?'#ffcf5624':'#a365bc12');glow.addColorStop(1,'#0000');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    }
    resize();return{render,resize,setOrbit:(yaw,pitch,zoom)=>{orbitYaw=yaw;orbitPitch=pitch;orbitZoom=zoom},burst:()=>{burstStart=performance.now()},mode:'canvas2d'};
  };
})();
