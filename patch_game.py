from pathlib import Path
import re
p=Path('/mnt/data/v14work/public/game.js')
s=p.read_text()
# state vars
s=s.replace("minimapCanvas,minimapCtx;", "minimapCanvas,minimapCtx,plantMeshes=new Map(),boostMeshes=new Map(),camYaw=0,camPitch=.32,cameraDragging=false,lastMouseX=0,lastMouseY=0,lastMoveSend=0,mobileStick=null,mobileTouchId=null;")
# handle state/init pickups
s=s.replace("m.mobs.forEach(x=>mobs.set(x.id,x));me=players.get(meId);renderShop()", "m.mobs.forEach(x=>mobs.set(x.id,x));me=players.get(meId);syncPickups(m.plants||[],m.boosts||[]);renderShop()")
s=s.replace("mobs.clear();(m.mobs||[]).forEach(x=>mobs.set(x.id,x));me=players.get(meId)||me;", "mobs.clear();(m.mobs||[]).forEach(x=>mobs.set(x.id,x));me=players.get(meId)||me;syncPickups(m.plants||[],m.boosts||[]);")
# input keys q/d invert
s=s.replace("let f=(keys.z?1:0)+(keys.s?-1:0),t=(keys.q?1:0)+(keys.d?-1:0);", "let f=(keys.z?1:0)+(keys.s?-1:0),t=(keys.q?-1:0)+(keys.d?1:0);\n  if(mobileStick){f=mobileStick.forward;t=mobileStick.turn;}")
# initGame add mobile controls
s=s.replace("scene.add(new THREE.HemisphereLight(0xdfffd0,0x67513a,2.15));let sun=new THREE.DirectionalLight(0xfff5d8,1.8);sun.position.set(-40,90,30);scene.add(sun);makeWorld();clock=new THREE.Clock();requestAnimationFrame(gameLoop);", "scene.add(new THREE.HemisphereLight(0xdfffd0,0x67513a,2.15));let sun=new THREE.DirectionalLight(0xfff5d8,1.8);sun.position.set(-40,90,30);scene.add(sun);makeWorld();initMobileControls();initCameraControls();clock=new THREE.Clock();requestAnimationFrame(gameLoop);")
# terrain more dense and stronger continuous
s=s.replace("new THREE.PlaneGeometry(260,260,40,40)", "new THREE.PlaneGeometry(260,260,72,72)")
# add plants/boosts in world after makeAmbiences
s=s.replace("makeRiver(-48);makeRiver(52);makeWaterfall(52,-35);makeAmbiences();", "makeRiver(-48);makeRiver(52);makeWaterfall(52,-35);makeAmbiences();")
# replace animalMesh
pat=r"function animalMesh\(lvl,player=false\)\{.*?\n\}\nfunction healthBar"
new=r'''function animalMesh(lvl,player=false){
  const d=animalData(lvl),s=d?.[4]||1,c=colors[lvl-1]||0x777777,g=new THREE.Group();
  g.userData.level=lvl;g.userData.modelHeight=2.0*s;g.userData.baseY=0.05;g.userData.legs=[];g.userData.wormSegments=[];
  const fur=mat(c),dark=mat(0x30241d),light=mat(0xe5cfae),black=new THREE.MeshBasicMaterial({color:0x090909});
  const mouthMat=mat(0x32131b),tongueMat=mat(0xe77b86);
  const eye=(x,y,z,r)=>{const e=part(g,new THREE.SphereGeometry(r*s,10,8),black,x,y,z,1,1.08,.8);e.userData.eye=true;return e};
  const mouth=(x,y,z,scale)=>{const m=part(g,new THREE.SphereGeometry(.26*s,10,7),mouthMat,x,y,z,1.25,.75,.55);m.scale.multiplyScalar(scale);const t=part(g,new THREE.SphereGeometry(.10*s,8,6),tongueMat,x,y-.05*s,z+.13*s,1,.7,1);t.userData.tongue=true;return m};
  if(lvl===1){
    for(let i=0;i<8;i++){const seg=part(g,new THREE.SphereGeometry(.30*s,10,7),fur,(i-3.5)*.30*s,.34*s,0,1.28,.72,1.42);seg.name='wormSeg';g.userData.wormSegments.push(seg)}
    const head=part(g,new THREE.SphereGeometry(.40*s,12,9),light,1.0*s,.43*s,0,1.15,1,1.35);head.name='head';
    eye(.87*s,.58*s,.30*s,.105);eye(.87*s,.58*s,-.30*s,.105);mouth(1.12*s,.30*s,0,.9);g.userData.modelHeight=.78*s;g.userData.baseY=.02;
  } else {
    const insect=lvl<=3;
    if(insect){
      part(g,new THREE.SphereGeometry(.58*s,10,8),dark,0,.58*s,0,1.25,.75,1.25);
      part(g,new THREE.SphereGeometry(.42*s,11,8),light,0,.82*s,.55*s,1.25,1,1.15);
      eye(.16*s,1.08*s,.82*s,.10);eye(-.16*s,1.08*s,.82*s,.10);mouth(0,.75*s,.92*s,1);
      for(let side of [-1,1])for(let i=0;i<3;i++){const leg=part(g,new THREE.CylinderGeometry(.045*s,.07*s,.65*s,6),dark,side*.62*s,.34*s,(i-1)*.35*s);leg.name='leg';leg.userData.legIndex=(i+(side===1?3:0));g.userData.legs.push(leg)}
      g.userData.modelHeight=1.28*s;g.userData.baseY=.02;
    } else {
      // Large-headed, big-eyed cartoon wildlife silhouette inspired by the supplied worm reference.
      const body=part(g,new THREE.CapsuleGeometry(.58*s,.92*s,6,10),fur,0,1.0*s,0,1.05,1.0,1.35);
      body.name='body';
      const chest=part(g,new THREE.SphereGeometry(.62*s,12,9),fur,0,1.25*s,.25*s,1.1,1.0,1.25);
      const head=part(g,new THREE.SphereGeometry(.72*s,12,10),light,0,1.72*s,1.05*s,1.15,1.08,1.18);head.name='head';
      eye(-.25*s,1.93*s,1.57*s,.17);eye(.25*s,1.93*s,1.57*s,.17);
      mouth(0,1.48*s,1.72*s,1.35);
      // ears / horns
      if([4,5,6,7,10,11,12,13,14,15].includes(lvl))for(let side of [-1,1]){const e=part(g,new THREE.ConeGeometry(.20*s,.55*s,8),fur,side*.43*s,2.28*s,1.0*s);e.rotation.z=side*.18}
      if([8,9,17,19].includes(lvl))for(let side of [-1,1]){const h=part(g,new THREE.ConeGeometry(.12*s,.78*s,8),light,side*.34*s,2.28*s,1.03*s);h.rotation.z=side*.35}
      const legY=.50*s;
      for(const side of [-1,1])for(const z of [-.66,.70]){const leg=part(g,new THREE.CapsuleGeometry(.13*s,.56*s,4,6),fur,side*.45*s,legY,z*s,1,1,1);leg.name='leg';leg.userData.legIndex=g.userData.legs.length;g.userData.legs.push(leg);part(g,new THREE.SphereGeometry(.17*s,8,6),dark,side*.45*s,.10*s,z*s,1,.65,1.15)}
      const tail=part(g,new THREE.CapsuleGeometry(.10*s,.62*s,4,6),fur,0,1.08*s,-1.45*s);tail.rotation.x=Math.PI/2;
      if(lvl===6)for(let i=0;i<8;i++){const spike=part(g,new THREE.ConeGeometry(.06*s,.30*s,6),dark,rand(-.65,.65)*s,1.45*s,rand(-.6,.75)*s);spike.rotation.z=rand(-.25,.25)}
      if(lvl===12||lvl===14){for(let i=0;i<7;i++){const spot=part(g,new THREE.SphereGeometry(.09*s,7,5),dark,rand(-.7,.7)*s,1.35*s,rand(.2,1.2)*s);spot.scale.z=.45}}
      if(lvl===20){const trunk=part(g,new THREE.CylinderGeometry(.17*s,.24*s,1.2*s,8),dark,0,1.05*s,1.92*s);for(let side of [-1,1]){const tusk=part(g,new THREE.ConeGeometry(.08*s,.65*s,7),light,side*.28*s,1.22*s,1.75*s);tusk.rotation.x=-.55}}
      g.userData.modelHeight=2.5*s;g.userData.baseY=.02;
    }
  }
  if(player){const ring=new THREE.Mesh(new THREE.RingGeometry(.95*s,1.05*s,20),new THREE.MeshBasicMaterial({color:0xb9ee55,transparent:true,opacity:.55,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.02;g.add(ring)}
  return g;
}
function healthBar'''
s2,repl=re.subn(pat,new,s,flags=re.S)
if repl!=1: raise SystemExit(f'animal replace {repl}')
s=s2
# Replace sync with animated + pickups
pat=r"function sync\(\)\{.*?\n\}\nlet last=0;function gameLoop"
new=r'''function sync(){
  const t=performance.now()*.001;
  for(const [id,p] of players){
    let m=meshes.get(id);if(!m||m.userData.level!==p.level){if(m)scene.remove(m);m=animalMesh(p.level,true);scene.add(m);meshes.set(id,m)}
    const y=surfaceY(p.x,p.z)+m.userData.baseY,tx=p.x,tz=p.z;
    m.position.x += (tx-m.position.x)*.30;m.position.z += (tz-m.position.z)*.30;m.position.y=y;
    m.rotation.y += Math.atan2(Math.sin(p.rot-m.rotation.y),Math.cos(p.rot-m.rotation.y))*.30;
    const moving=Math.hypot(tx-m.position.x,tz-m.position.z)>.004;
    if(m.userData.legs?.length){m.userData.legs.forEach((leg,i)=>{const phase=i%2?Math.PI:0;leg.rotation.z=Math.sin(t*9+phase)*(moving?.32:0);leg.rotation.x=Math.sin(t*9+phase)*.12*(moving?1:0)})}
    if(m.userData.wormSegments?.length)m.userData.wormSegments.forEach((seg,i)=>{seg.position.z=Math.sin(t*7+i*.75)*.10*sSafe(p.level);seg.position.y=.34*animalData(p.level)[4]+Math.abs(Math.sin(t*7+i*.75))*.035})
    m.visible=!p.dead;healthBar(m,p.hp,p.maxHp);applyCosmetic(m,p.equipped);
  }
  for(const [id,x] of mobs){
    let m=mobMeshes.get(id);if(!m){m=animalMesh(x.level);scene.add(m);mobMeshes.set(id,m)}
    const y=surfaceY(x.x,x.z)+m.userData.baseY;m.position.x += (x.x-m.position.x)*.30;m.position.z += (x.z-m.position.z)*.30;m.position.y=y;
    m.rotation.y += Math.atan2(Math.sin(x.rot-m.rotation.y),Math.cos(x.rot-m.rotation.y))*.28;m.visible=x.hp>0;healthBar(m,x.hp,x.maxHp);
    const moving=Math.hypot(x.x-m.position.x,x.z-m.position.z)>.004;if(m.userData.legs?.length)m.userData.legs.forEach((leg,i)=>{const phase=i%2?Math.PI:0;leg.rotation.z=Math.sin(t*7+phase)*.27*(moving?1:0);leg.rotation.x=Math.sin(t*7+phase)*.10*(moving?1:0)});
    if(m.userData.wormSegments?.length)m.userData.wormSegments.forEach((seg,i)=>seg.position.z=Math.sin(t*6+i*.75)*.10*sSafe(x.level));
  }
  syncPickupsVisual();
}
function sSafe(level){return Math.min(1,animalData(level)?.[4]||1)}
function makePickupMesh(kind){
  const g=new THREE.Group();
  if(kind==='plant'){const stem=new THREE.Mesh(new THREE.CylinderGeometry(.035,.055,.38,5),new THREE.MeshBasicMaterial({color:0x4c8f3d}));stem.position.y=.19;g.add(stem);for(let side of [-1,1]){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.12,6,5),new THREE.MeshBasicMaterial({color:0x78b84c}));leaf.scale.set(1,.5,1.6);leaf.position.set(side*.10,.28,0);g.add(leaf)}}
  else {const col=kind==='speed'?0x5ad7ff:kind==='power'?0xffa14b:0xb68cff;const r=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,0),new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.3}));g.add(r);const ring=new THREE.Mesh(new THREE.RingGeometry(.38,.44,16),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.55,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;g.add(ring)}
  return g;
}
function syncPickupsVisual(){
  const wantedPlants=new Set((window.__plants||[]).map(x=>x.id));for(const [id,m] of plantMeshes){if(!wantedPlants.has(id)){scene.remove(m);plantMeshes.delete(id)}}for(const q of (window.__plants||[])){let m=plantMeshes.get(q.id);if(!m){m=makePickupMesh('plant');scene.add(m);plantMeshes.set(q.id,m)}m.position.set(q.x,surfaceY(q.x,q.z)+.03,q.z);m.rotation.y+=.015}
  const wantedBoosts=new Set((window.__boosts||[]).map(x=>x.id));for(const [id,m] of boostMeshes){if(!wantedBoosts.has(id)){scene.remove(m);boostMeshes.delete(id)}}for(const q of (window.__boosts||[])){let m=boostMeshes.get(q.id);if(!m){m=makePickupMesh(q.type);scene.add(m);boostMeshes.set(q.id,m)}m.position.set(q.x,surfaceY(q.x,q.z)+.45+Math.sin(performance.now()*.003+q.x)*.08,q.z);m.rotation.y+=.02}
}
function syncPickups(plants,boosts){window.__plants=plants||[];window.__boosts=boosts||[]}
let last=0;function gameLoop'''
s2,repl=re.subn(pat,new,s,flags=re.S)
if repl!=1: raise SystemExit(f'sync replace {repl}')
s=s2
# Replace gameLoop camera and sendMove section through initMinimap
pat=r"let last=0;function gameLoop.*?\nfunction initMinimap"
# our prior replacement created duplicate prefix; use regex from current
new=r'''let last=0;function gameLoop(t){requestAnimationFrame(gameLoop);if(!renderer)return;if(t-last>32){sendMove();last=t}sync();if(me){let m=meshes.get(meId);if(m){const d=animalData(me.level),back=8+d[4]*2.0;const yaw=me.rot+camYaw;const horiz=Math.cos(camPitch)*back;const target=new THREE.Vector3(m.position.x-Math.sin(yaw)*horiz, m.position.y+2.2+Math.sin(camPitch)*back, m.position.z-Math.cos(yaw)*horiz);camera.position.lerp(target,.16);camera.lookAt(m.position.x,m.position.y+1.0,m.position.z)}}hudUpdate();renderer.render(scene,camera)}
function sendMove(){if((!apiMode&&(!ws||ws.readyState!==1))||!me||me.dead)return;let f=(keys.z?1:0)+(keys.s?-1:0),t=(keys.q?-1:0)+(keys.d?1:0);if(mobileStick){f=mobileStick.forward;t=mobileStick.turn}if(f||t||keys.shift||mobileStick?.sprint)sendMsg({type:'move',forward:f,turn:t,sprint:!!(keys.shift||mobileStick?.sprint)})}
function initCameraControls(){
  if(!renderer)return;renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
  renderer.domElement.addEventListener('mousedown',e=>{if(e.button===2){cameraDragging=true;lastMouseX=e.clientX;lastMouseY=e.clientY}});
  window.addEventListener('mouseup',e=>{if(e.button===2)cameraDragging=false});
  window.addEventListener('mousemove',e=>{if(!cameraDragging)return;camYaw-=(e.clientX-lastMouseX)*.006;camPitch+=(e.clientY-lastMouseY)*.004;camPitch=Math.max(-.05,Math.min(.9,camPitch));lastMouseX=e.clientX;lastMouseY=e.clientY});
}
function initMobileControls(){
  if(document.getElementById('mobileControls'))return;
  const wrap=document.createElement('div');wrap.id='mobileControls';wrap.innerHTML='<div id="mobileStick"><div id="mobileKnob"></div></div><div class="mobile-actions"><button id="mobileAttack">⚔</button><button id="mobileSprint">⚡</button></div><div id="mobileLook"></div>';document.body.appendChild(wrap);
  const stick=document.getElementById('mobileStick'),knob=document.getElementById('mobileKnob'),attack=document.getElementById('mobileAttack'),sprint=document.getElementById('mobileSprint'),look=document.getElementById('mobileLook');
  const moveStick=e=>{const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.38,len=Math.hypot(dx,dy);if(len>max){dx*=max/len;dy*=max/len}knob.style.transform=`translate(${dx}px,${dy}px)`;mobileStick={forward:Math.max(-1,Math.min(1,-dy/max)),turn:Math.max(-1,Math.min(1,dx/max)),sprint:mobileStick?.sprint||false}};
  stick.addEventListener('pointerdown',e=>{e.preventDefault();mobileTouchId=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e)});stick.addEventListener('pointermove',e=>{if(e.pointerId===mobileTouchId)moveStick(e)});stick.addEventListener('pointerup',()=>{mobileTouchId=null;mobileStick=null;knob.style.transform='translate(0,0)'});stick.addEventListener('pointercancel',()=>{mobileTouchId=null;mobileStick=null;knob.style.transform='translate(0,0)'});
  attack.addEventListener('pointerdown',e=>{e.preventDefault();if(me&&!me.dead)sendMsg({type:'attack'});attackSound()});
  sprint.addEventListener('pointerdown',e=>{e.preventDefault();mobileStick=mobileStick||{forward:0,turn:0};mobileStick.sprint=true;sprint.classList.add('pressed')});['pointerup','pointercancel','pointerleave'].forEach(ev=>sprint.addEventListener(ev,()=>{if(mobileStick)mobileStick.sprint=false;sprint.classList.remove('pressed')}));
  let lookId=null,lx=0,ly=0;look.addEventListener('pointerdown',e=>{e.preventDefault();lookId=e.pointerId;lx=e.clientX;ly=e.clientY;look.setPointerCapture(e.pointerId)});look.addEventListener('pointermove',e=>{if(e.pointerId!==lookId)return;camYaw-=(e.clientX-lx)*.006;camPitch+=(e.clientY-ly)*.004;camPitch=Math.max(-.05,Math.min(.9,camPitch));lx=e.clientX;ly=e.clientY});look.addEventListener('pointerup',()=>lookId=null);look.addEventListener('pointercancel',()=>lookId=null);
}
function initMinimap'''
s2,repl=re.subn(pat,new,s,flags=re.S)
if repl!=1: raise SystemExit(f'loop replace {repl}')
s=s2
p.write_text(s)
