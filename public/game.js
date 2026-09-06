import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const $=id=>document.getElementById(id);
const menu=$("menu"), hud=$("hud"), nameInput=$("name");
const ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host);

let myId=null, animals=[], world=260, myState=null;
let players=new Map(), mobs=new Map();
let keys={}, attacking=false, mouseX=0, cameraYaw=0;
let scene,camera,renderer,clock;
const playerMeshes=new Map(), mobMeshes=new Map();

nameInput.focus();
$("play").onclick=join;
nameInput.onkeydown=e=>{if(e.key==="Enter")join()};
function join(){
  const n=nameInput.value.trim()||"Joueur";
  ws.send(JSON.stringify({type:"join",name:n}));
  menu.classList.add("hidden"); hud.classList.remove("hidden");
  init3D();
}
window.addEventListener("keydown",e=>{
  keys[e.key.toLowerCase()]=true;
  if(e.code==="Space"){e.preventDefault(); attacking=true; attack();}
});
window.addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
window.addEventListener("mousedown",()=>{attacking=true;attack()});
window.addEventListener("mouseup",()=>attacking=false);
window.addEventListener("mousemove",e=>{ if(document.pointerLockElement) cameraYaw-=e.movementX*.003; });
window.addEventListener("click",()=>renderer?.domElement.requestPointerLock?.());

function attack(){
  if(ws.readyState===1) ws.send(JSON.stringify({type:"attack"}));
  soundAttack();
}

ws.onmessage=e=>{
  const m=JSON.parse(e.data);
  if(m.type==="full"){alert("La partie est pleine.");return}
  if(m.type==="init"){
    myId=m.id; world=m.world; animals=m.animals;
    for(const p of m.players) players.set(p.id,p);
    for(const mob of m.mobs) mobs.set(mob.id,mob);
  }
  if(m.type==="players"){players.clear();for(const p of m.players)players.set(p.id,p)}
  if(m.type==="state"){
    players.clear();for(const p of m.players)players.set(p.id,p);
    mobs.clear();for(const mob of m.mobs)mobs.set(mob.id,mob);
    myState=players.get(myId);
  }
};

function init3D(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x86bd4c);
  scene.fog=new THREE.Fog(0x86bd4c,90,230);
  camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,400);
  renderer=new THREE.WebGLRenderer({antialias:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;
  document.body.appendChild(renderer.domElement);

  const hemi=new THREE.HemisphereLight(0xd9ffd0,0x74502f,2.0); scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffffff,2.4); sun.position.set(40,80,20); sun.castShadow=true; scene.add(sun);

  makeWorld();
  clock=new THREE.Clock();
  animate();
}

function makeWorld(){
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(world,world),new THREE.MeshLambertMaterial({color:0x9bd94a}));
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);

  // Low-poly progression rings.
  const zoneColors=[0x77b83d,0x8fd148,0x9ddc50,0xa8dc55,0xb3d95a,0x8bcf5c,0x74bd66];
  const ranges=[[-115,-65],[-80,-25],[-40,15],[0,55],[35,90],[70,120],[100,125]];
  for(let i=0;i<ranges.length;i++){
    const mid=(ranges[i][0]+ranges[i][1])/2;
    const width=ranges[i][1]-ranges[i][0];
    const mat=new THREE.MeshLambertMaterial({color:zoneColors[i],transparent:true,opacity:.22});
    const g=new THREE.PlaneGeometry(width,world);
    const mesh=new THREE.Mesh(g,mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(mid,0.006,0);scene.add(mesh);
  }

  // Simple low-poly trees / rocks.
  for(let i=0;i<170;i++){
    const x=(Math.random()-.5)*world, z=(Math.random()-.5)*world;
    if(Math.abs(x)<18 && Math.abs(z)<18) continue;
    if(Math.random()<.68) makeTree(x,z); else makeRock(x,z);
  }

  // Spawn platform.
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(13,13,.3,12),new THREE.MeshLambertMaterial({color:0x56694a}));
  ring.position.y=.15; scene.add(ring);
  const inner=new THREE.Mesh(new THREE.CylinderGeometry(9,9,.32,12),new THREE.MeshLambertMaterial({color:0xb3e55b}));
  inner.position.y=.32;scene.add(inner);
}

function makeTree(x,z){
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.5,.75,4,5),new THREE.MeshLambertMaterial({color:0x7c512c}));
  trunk.position.set(x,2,z);trunk.castShadow=true;scene.add(trunk);
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(2.7,0),new THREE.MeshLambertMaterial({color:0x3f8f39}));
  crown.position.set(x,5,z);crown.castShadow=true;scene.add(crown);
}
function makeRock(x,z){
  const r=new THREE.Mesh(new THREE.DodecahedronGeometry(1.4+Math.random()*1.5,0),new THREE.MeshLambertMaterial({color:0x827e6d}));
  r.position.set(x,.9,z);r.scale.y=.7;r.castShadow=true;scene.add(r);
}

function animalMesh(level,isPlayer){
  const colorList=[0x7b4b28,0x454545,0x2f3a26,0x7b6a45,0xd0b67b,0x777777,0xc77735,0x55391f,0x8a6336,0x6c6a58,0x6b4936,0xc78c43,0xd89b4d,0xb87845,0x674b35,0x3f3f3f,0x5c5035,0x655849,0x77736a,0x9b8b62];
  const c=colorList[Math.min(level-1,colorList.length-1)];
  const group=new THREE.Group();
  const s=animals[level-1]?.[4]||1;
  const body=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:c}));
  body.scale.set(1.35*s,.8*s,1.8*s);body.position.y=1.1*s;body.castShadow=true;group.add(body);

  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.7,0),new THREE.MeshLambertMaterial({color:c}));
  head.position.set(0,1.45*s,1.5*s);head.castShadow=true;group.add(head);

  const eyeMat=new THREE.MeshBasicMaterial({color:0x111111});
  for(const side of [-1,1]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.09*s,6,6),eyeMat);
    eye.position.set(side*.26*s,1.58*s,2.04*s);group.add(eye);
  }

  // Legs.
  for(const x of [-.55,.55]) for(const z of [-.6,.65]){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.16*s,.22*s,.85*s,5),new THREE.MeshLambertMaterial({color:c}));
    leg.position.set(x*s,.48*s,z*s);leg.castShadow=true;group.add(leg);
  }

  // Distinctive ears/horns/tail.
  if([2,3,4,5,6].includes(level)){
    const earMat=new THREE.MeshLambertMaterial({color:c});
    for(const side of [-1,1]){
      const ear=new THREE.Mesh(new THREE.ConeGeometry(.25*s,.7*s,5),earMat);
      ear.position.set(side*.48*s,1.85*s,1.45*s);group.add(ear);
    }
  }
  if([8,9,10,13,14,15,16,17,18,19,20].includes(level)){
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(.12*s,.2*s,1.8*s,5),new THREE.MeshLambertMaterial({color:c}));
    tail.rotation.x=Math.PI/2;tail.position.set(0,.9*s,-2*s);group.add(tail);
  }
  if([9,13,14,17,19,20].includes(level)){
    for(const side of [-1,1]){
      const horn=new THREE.Mesh(new THREE.ConeGeometry(.16*s,.9*s,5),new THREE.MeshLambertMaterial({color:0xe2d7a2}));
      horn.position.set(side*.38*s,1.95*s,1.3*s);horn.rotation.z=side*.45;group.add(horn);
    }
  }
  if(level===20){
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18*s,.25*s,1.8*s,6),new THREE.MeshLambertMaterial({color:c}));
    trunk.rotation.x=Math.PI/2;trunk.position.set(0,1.1*s,2.15*s);group.add(trunk);
  }

  if(isPlayer){
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.5,8),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.16}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=.02;group.add(shadow);
  }
  return group;
}

function updateEntities(){
  if(!myState) return;
  for(const [id,p] of players){
    let mesh=playerMeshes.get(id);
    if(!mesh){mesh=animalMesh(p.level,true);scene.add(mesh);playerMeshes.set(id,mesh)}
    mesh.position.set(p.x,0,p.z);
    mesh.rotation.y=p.rot;
    mesh.visible=!p.spawnProtected;
    if(id===myId) myState=p;
    if(mesh.userData.level!==p.level){
      const old=mesh; const pos=old.position.clone(); const rot=old.rotation.y;
      scene.remove(old);mesh=animalMesh(p.level,true);mesh.position.copy(pos);mesh.rotation.y=rot;scene.add(mesh);playerMeshes.set(id,mesh);
    }
    mesh.userData.level=p.level;
  }

  for(const [id,m] of mobs){
    let mesh=mobMeshes.get(id);
    if(!mesh){mesh=animalMesh(m.level,false);scene.add(mesh);mobMeshes.set(id,mesh)}
    mesh.position.set(m.x,0,m.z);
    mesh.userData.level=m.level;
    mesh.visible=true;
  }
}

function sendInput(){
  if(ws.readyState!==1 || !myState) return;
  let x=0,z=0;
  if(keys.w||keys.z)x-=1;if(keys.s)x+=1;if(keys.a||keys.q)z-=1;if(keys.d)z+=1;
  if(!x&&!z)return;
  const angle=cameraYaw;
  const dx=x*Math.cos(angle)-z*Math.sin(angle);
  const dz=x*Math.sin(angle)+z*Math.cos(angle);
  ws.send(JSON.stringify({type:"input",dx,dz,rot:cameraYaw}));
}

let lastInput=0;
function animate(){
  requestAnimationFrame(animate);
  const now=performance.now();
  if(now-lastInput>55){sendInput();lastInput=now}
  updateEntities();

  if(myState){
    const me=playerMeshes.get(myId);
    if(me){
      const desired=new THREE.Vector3(me.position.x+Math.sin(cameraYaw)*12,9,me.position.z+Math.cos(cameraYaw)*12);
      camera.position.lerp(desired,.12);
      camera.lookAt(me.position.x,0.7,me.position.z);
    }
    updateHud();
  }

  renderer.render(scene,camera);
}

function updateHud(){
  const p=myState, a=animals[p.level-1];
  $("animal").textContent=a[0];$("level").textContent=p.level;$("lvlBig").textContent=p.level;
  $("power").textContent=a[3];
  const need=a[2], prev=p.level===1?0:animals[p.level-2][2];
  const xp=Math.max(0,p.xp);
  $("xpbar").style.width=Math.min(100,xp/need*100)+"%";
  $("hpbar").style.width=Math.max(0,Math.min(100,p.hp/p.maxHp*100))+"%";
  $("xpText").textContent=`${Math.floor(xp)} / ${need}`;
  $("hpText").textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;
  const z=p.level<=2?1:p.level<=5?2:p.level<=8?3:p.level<=11?4:p.level<=14?5:p.level<=17?6:7;
  $("zone").textContent=`ZONE ${z} — ${z===1?"PETITS ANIMAUX":z===2?"SOUS-BOIS":z===3?"FORÊT":z===4?"PRÉDATEURS":z===5?"GRANDS PRÉDATEURS":z===6?"GÉANTS": "COLOSSes"}`;
  renderScores();
}
function renderScores(){
  const arr=[...players.values()].sort((a,b)=>b.level-a.level||b.xp-a.xp).slice(0,10);
  $("scores").innerHTML=arr.map((p,i)=>`<div class="row ${p.id===myId?"me":""}"><span>${i+1}. ${escapeHtml(p.name)}</span><span>Niv. ${p.level}</span></div>`).join("");
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function soundAttack(){
  try{
    const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
    const ac=new A(),o=ac.createOscillator(),g=ac.createGain();
    o.type="triangle";o.frequency.setValueAtTime(130,ac.currentTime);o.frequency.exponentialRampToValueAtTime(65,ac.currentTime+.12);
    g.gain.setValueAtTime(.045,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.14);
    o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+.15);
  }catch{}
}
window.addEventListener("resize",()=>{if(camera&&renderer){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}});

// Gentle ambient synth: generated locally, no external audio files.
setInterval(()=>{
  if(!hud.classList.contains("hidden")){
    try{
      const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
      const ac=new A(),o=ac.createOscillator(),g=ac.createGain();
      o.type="sine";o.frequency.value=180+Math.random()*50;g.gain.value=.004;
      o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+.35);
    }catch{}
  }
},5000);
