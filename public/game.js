const $=id=>document.getElementById(id);
const CLIENT_ANIMALS=[
['Ver de terre',1,35,4,.75],['Fourmi',2,45,5,.82],['Scarabée',3,58,6,.9],['Souris',4,70,7,1],['Lapin',5,85,8,1.12],['Hérisson',6,105,10,1.25],['Renard',7,125,12,1.4],['Sanglier',8,150,14,1.58],['Cerf',9,175,16,1.78],['Loup',10,205,18,1.95],['Hyène',11,240,20,2.1],['Léopard',12,280,23,2.25],['Lion',13,330,26,2.42],['Tigre',14,385,30,2.58],['Ours',15,445,34,2.75],['Gorille',16,510,38,2.9],['Buffle',17,580,43,3.05],['Hippopotame',18,660,48,3.25],['Rhinocéros',19,750,54,3.5],['Éléphant',20,850,60,3.8]
];
const colors=[0x85582e,0x303a2c,0x4f3c26,0x8b6a42,0xd4bb83,0x777777,0xb66c36,0x5a3b20,0x9a6d3e,0x5e5a4b,0x654b39,0xc78943,0xd99b4e,0xb46c42,0x5c4938,0x444444,0x6c5a3d,0x64554a,0x77746a,0x9d895e];
let ws=null,apiToken=null,apiMode=false,apiPoll=null,meId=null,animals=CLIENT_ANIMALS,cosmetics=[{id:'leaf',name:'Liane',icon:'🌿',cost:10},{id:'flower',name:'Fleur tropicale',icon:'🌺',cost:10},{id:'crown',name:'Couronne jungle',icon:'👑',cost:20},{id:'horn',name:'Petites cornes',icon:'🦌',cost:15},{id:'spots',name:'Taches sauvages',icon:'🐆',cost:15},{id:'gold',name:'Aura dorée',icon:'✨',cost:20},{id:'vines',name:'Lianes',icon:'🍃',cost:10},{id:'shell',name:'Carapace',icon:'🐚',cost:10},{id:'fire',name:'Flamme',icon:'🔥',cost:20},{id:'star',name:'Étoile',icon:'⭐',cost:10}],players=new Map(),mobs=new Map(),scene,camera,renderer,clock,me,meshes=new Map(),mobMeshes=new Map(),keys={},audio=null,lobbyRenderer,lobbyScene,lobbyCamera,lobbyClock,lobbyAnimals=[],gameStarted=false,minimapCanvas,minimapCtx,plantMeshes=new Map(),boostMeshes=new Map(),camYaw=0,camPitch=.32,cameraDragging=false,lastMouseX=0,lastMouseY=0,lastMoveSend=0,waterfallParticles=null,mobileStick=null,mobileTouchId=null;

function rand(a,b){return a+Math.random()*(b-a)}
function animalData(lvl){return animals[lvl-1]||CLIENT_ANIMALS[lvl-1]}

// ---------- LOBBY ----------
function initLobby(){
  lobbyScene=new THREE.Scene();
  lobbyScene.background=new THREE.Color(0x061109);
  lobbyScene.fog=new THREE.Fog(0x061109,18,85);
  lobbyCamera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,160);
  lobbyCamera.position.set(0,6.5,21); lobbyCamera.lookAt(0,2.3,0);
  lobbyRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  lobbyRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  lobbyRenderer.setSize(innerWidth,innerHeight);
  lobbyRenderer.domElement.className='lobby3d';
  lobbyRenderer.domElement.style.pointerEvents='none';
  $('lobbyCanvas').appendChild(lobbyRenderer.domElement);
  lobbyScene.add(new THREE.HemisphereLight(0xcfffb4,0x12200f,2.1));
  const sun=new THREE.DirectionalLight(0xfff0c4,2.4);sun.position.set(-15,24,18);lobbyScene.add(sun);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(42,64),new THREE.MeshStandardMaterial({color:0x173b1c,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.05;lobbyScene.add(ground);
  // Chemin central du lobby.
  const path=new THREE.Mesh(new THREE.PlaneGeometry(14,55),new THREE.MeshStandardMaterial({color:0x735b3a,roughness:1}));
  path.rotation.x=-Math.PI/2;path.position.set(0,.005,-3);lobbyScene.add(path);
  for(let i=0;i<90;i++){
    const x=rand(-38,38),z=rand(-27,16),s=rand(.55,1.7);
    if(Math.abs(x)<8&&z>-25)continue;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.08*s,.13*s,.9*s,6),new THREE.MeshStandardMaterial({color:0x5b3d24}));
    trunk.position.set(x,.45*s,z);lobbyScene.add(trunk);
    const crown=new THREE.Mesh(new THREE.SphereGeometry(.55*s,7,6),new THREE.MeshStandardMaterial({color:i%3?0x397536:0x4e8b3d}));
    crown.position.set(x,.95*s,z);lobbyScene.add(crown);
  }
  const levels=[1,4,7,10,13,16,18,20];
  levels.forEach((lvl,i)=>{
    const g=animalMesh(lvl,false);g.scale.multiplyScalar(.62);g.position.set(-12+i*3.45,0,rand(-1.5,3.5));g.rotation.y=Math.PI;g.userData.lobbyOffset=i*.8;lobbyScene.add(g);lobbyAnimals.push(g)
  });
  lobbyClock=new THREE.Clock();requestAnimationFrame(lobbyLoop);
}
function lobbyLoop(){
  if(!lobbyRenderer)return;requestAnimationFrame(lobbyLoop);
  const t=lobbyClock.getElapsedTime();
  lobbyAnimals.forEach((g,i)=>{g.position.y=Math.sin(t*1.4+i)*.1;g.rotation.y=Math.PI+Math.sin(t*.35+i)*.3;});
  lobbyRenderer.render(lobbyScene,lobbyCamera)
}
function start(){
  const name=(($('name')?.value)||'').trim().slice(0,16)||'Joueur';
  $('lobbyError').classList.add('hidden');
  if(ws&&ws.readyState===WebSocket.OPEN){enterGame(name);return}
  $('play').disabled=true;$('play').innerHTML='<span>CONNEXION...</span><b>…</b>';
  connect(name);
}
function sendMsg(msg){
  if(apiMode){
    fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:apiToken,message:msg})}).then(r=>r.json()).then(d=>{(d.messages||[]).forEach(handleMessage);if(d.state)handleMessage(d.state)}).catch(()=>{});
    return true;
  }
  if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify(msg));return true;}
  return false;
}
function enterGame(name){
  sendMsg({type:'join',name});
}
async function connectApi(name){
  try{const r=await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw new Error('api');const d=await r.json();apiToken=d.token;apiMode=true;handleMessage(d);enterGame(name);if(apiPoll)clearInterval(apiPoll);apiPoll=setInterval(()=>{if(!apiToken)return;fetch('/api/state?token='+encodeURIComponent(apiToken)).then(r=>r.json()).then(handleMessage).catch(()=>{})},180);startJungleMusic();startWaterfallSound();$('play').disabled=false;$('play').innerHTML='<span>SPAWN</span><b>↗</b>';return true}catch(e){apiMode=false;return false}
}
function connect(name){
  if(apiMode){enterGame(name);return}
  if(ws&&ws.readyState===WebSocket.CONNECTING)return;
  try{ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws')}
  catch(e){connectApi(name);return}
  let opened=false;
  const failTimer=setTimeout(async()=>{if(!opened&&ws?.readyState!==WebSocket.OPEN){try{ws.close()}catch{};if(!(await connectApi(name)))showLobbyError('Le serveur ne répond pas.');}},3500);
  ws.onopen=()=>{opened=true;clearTimeout(failTimer);apiMode=false;enterGame(name);try{startJungleMusic();startWaterfallSound()}catch{}};
  ws.onmessage=e=>{try{handleMessage(JSON.parse(e.data))}catch(err){console.error(err)}};
  ws.onerror=async()=>{if(!gameStarted){clearTimeout(failTimer);try{ws.close()}catch{};if(!(await connectApi(name))){$('play').disabled=false;$('play').innerHTML='<span>SPAWN</span><b>↗</b>';showLobbyError('Connexion impossible au serveur.')}}};
  ws.onclose=async()=>{if(gameStarted){gameStarted=false;$('hud').classList.add('hidden');$('menu').classList.remove('hidden');$('lobbyCanvas').style.display='block'}if(!apiMode){if(!(await connectApi(($('name')?.value||'Joueur').trim()))){$('play').disabled=false;$('play').innerHTML='<span>SPAWN</span><b>↗</b>'}}};
}
function showLobbyError(text){const el=$('lobbyError');if(el){el.textContent=text;el.classList.remove('hidden')}}

function handleMessage(m){
  if(m.type==='init'){meId=m.id;animals=m.animals||CLIENT_ANIMALS;cosmetics=m.cosmetics||[];players.clear();m.players.forEach(p=>players.set(p.id,p));m.mobs.forEach(x=>mobs.set(x.id,x));me=players.get(meId);syncPickups(m.plants||[],m.boosts||[]);renderShop()}
  if(m.type==='players'){
    players.clear();(m.players||[]).forEach(p=>players.set(p.id,p));me=players.get(meId)||me;
    // Le serveur confirme le join avec la liste des joueurs actifs.
    // C'est ce message qui doit réellement faire passer le client du lobby au jeu.
    if(me && !me.inLobby && !gameStarted){
      gameStarted=true;
      $('menu').classList.add('hidden');
      $('hud').classList.remove('hidden');
      $('lobbyCanvas').style.display='none';
      if(!renderer)initGame();
      $('play').disabled=false;$('play').innerHTML='<span>SPAWN</span><b>↗</b>';
    }
  }
  if(m.type==='state'){
    players.clear();(m.players||[]).forEach(p=>players.set(p.id,p));
    mobs.clear();(m.mobs||[]).forEach(x=>mobs.set(x.id,x));me=players.get(meId)||me;syncPickups(m.plants||[],m.boosts||[]);
    if(me && !me.inLobby && !gameStarted){
      gameStarted=true;$('menu').classList.add('hidden');$('hud').classList.remove('hidden');$('lobbyCanvas').style.display='none';
      if(!renderer)initGame();
    }
  }
  if(m.type==='damage')damagePopup(m.amount,m.x,m.z);
  if(m.type==='damageMob')damagePopup(m.amount,m.x,m.z);
  if(m.type==='lobby'&&m.player&&m.player.id===meId){players.set(meId,m.player);me=m.player;updateCoins();return}
  if(m.type==='shop'&&m.id===meId){let p=players.get(meId);if(p){p.coins=m.coins;p.owned=m.owned;p.equipped=m.equipped}updateCoins();renderShop();}
  if(m.type==='reward'&&m.killer===meId){updateCoins();showReward()}
}

window.addEventListener('pointerdown',()=>startJungleMusic(),{once:false});
function bindLobby(){
  const play=$('play'),name=$('name'),tabPlay=$('tabPlay'),tabShop=$('tabShop');
  const openTab=(tab)=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.panel-view').forEach(x=>x.classList.remove('active'));
    tab.classList.add('active');
    $(tab===tabPlay?'playTab':'shopTab').classList.add('active');
    if(tab===tabShop)renderShop();
  };
  tabPlay?.addEventListener('click',e=>{e.preventDefault();openTab(tabPlay)});
  tabShop?.addEventListener('click',e=>{e.preventDefault();openTab(tabShop)});
  play?.addEventListener('click',e=>{e.preventDefault();start()});
  name?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();start()}});
  // Une touche dédiée pour spawn depuis le lobby.
  window.addEventListener('keydown',e=>{if($('menu')&&!$('menu').classList.contains('hidden')&&e.key==='Enter'&&document.activeElement!==name){e.preventDefault();start()}});
}
bindLobby();
$('respawn').onclick=()=>{sendMsg({type:'respawn'});};
$('lobbyBtn').onclick=()=>goLobby();
window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==='r'&&me?.dead)sendMsg({type:'respawn'});if(e.code==='Space')e.preventDefault()});
window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
window.addEventListener('mousedown',e=>{if(e.button===0&&me&&!me.dead&&gameStarted){sendMsg({type:'attack'});attackSound()}});

function goLobby(){
  sendMsg({type:'lobby'});
  gameStarted=false;
  $('dead').classList.add('hidden');$('hud').classList.add('hidden');$('menu').classList.remove('hidden');$('lobbyCanvas').style.display='block';
  renderer?.domElement.classList.remove('dead-bg');
  if(minimapCanvas){minimapCanvas.remove();minimapCanvas=null;minimapCtx=null;}
  const playTab=document.getElementById('tabPlay');if(playTab)playTab.click();
  $('play').disabled=false;$('play').textContent='ENTRER DANS LA JUNGLE ▶';
  $('lobbyError').classList.add('hidden');
  $('name').focus();
}
function updateBoostHud(){let el=$('boostStatus');if(!el)return;const a=me?.activeBoosts||[];el.innerHTML=a.map(b=>{const n=b.type==='speed'?'⚡ VITESSE':b.type==='power'?'💥 DÉGÂTS':'🛡️ BOUCLIER';return `<div><b>${n}</b><span>${b.remaining}s</span></div>`}).join('');el.classList.toggle('hidden',a.length===0)}
function updateCoins(){let p=players.get(meId);$('coins').textContent=p?.coins??0;$('gameCoins').textContent=p?.coins??0}
function renderShop(){
  const p=players.get(meId),owned=p?.owned||[],equipped=p?.equipped||null;
  $('coins').textContent=p?.coins??0;
  if(!cosmetics.length){$('shopGrid').innerHTML='<div style="opacity:.5">Boutique en chargement...</div>';return}
  $('shopGrid').innerHTML=cosmetics.map(c=>{let own=owned.includes(c.id),eq=equipped===c.id;let label=eq?'ÉQUIPÉ':own?'ÉQUIPER':(p?`🪙 ${c.cost}`:'JOUER POUR ACHETER');return `<div class="shop-item"><div class="shop-icon">${c.icon}</div><div><div class="shop-name">${c.name}</div><div class="shop-cost">${own?'Possédé':c.cost+' pièces'}</div></div><button class="shop-btn ${own?'owned':''} ${eq?'equipped':''}" data-shop="${c.id}" ${p?'':'disabled'}>${label}</button></div>`}).join('');
  document.querySelectorAll('[data-shop]').forEach(b=>b.onclick=()=>{let id=b.dataset.shop;if((p?.owned||[]).includes(id))sendMsg({type:'equip',id:id});else sendMsg({type:'buy',id:id})});
}
function showReward(){let v=document.createElement('div');v.className='damage';v.textContent='+10 🪙';v.style.left='50%';v.style.top='34%';document.body.appendChild(v);setTimeout(()=>v.remove(),900)}

// ---------- GAME ----------
function initGame(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x9bc86b);scene.fog=new THREE.Fog(0x9bc86b,85,245);
  camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,400);
  renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.1));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=false;renderer.domElement.className='gamecanvas';document.body.appendChild(renderer.domElement);initMinimap();
  scene.add(new THREE.HemisphereLight(0xdfffd0,0x67513a,2.15));let sun=new THREE.DirectionalLight(0xfff5d8,1.8);sun.position.set(-40,90,30);scene.add(sun);makeWorld();initMobileControls();initCameraControls();clock=new THREE.Clock();requestAnimationFrame(gameLoop);
}
function rawTerrainHeight(x,z){return Math.sin(x*.055)*1.8+Math.cos(z*.045)*1.5+Math.sin((x+z)*.02)*2}
function terrainHeight(x,z){const d=Math.hypot(x,z);if(d<=24)return 0;const blend=Math.min(1,(d-24)/16);return rawTerrainHeight(x,z)*blend}
function makeWorld(){
  const g=new THREE.PlaneGeometry(260,260,72,72),pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getY(i);pos.setZ(i,terrainHeight(x,z))}
  g.computeVertexNormals();
  const ground=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x6f9b45,roughness:1,metalness:0}));
  ground.rotation.x=-Math.PI/2;scene.add(ground);
  makeRiver(-48);makeRiver(52);makeWaterfall(52,-35);makeAmbiences();
  for(let i=0;i<125;i++){const x=(Math.random()-.5)*250,z=(Math.random()-.5)*250;if(Math.hypot(x,z)<13)continue;Math.random()<.68?tree(x,z):rock(x,z)}
}
function surfaceY(x,z){return terrainHeight(x,z)}
function makeRiver(x){const water=new THREE.Mesh(new THREE.PlaneGeometry(8,260),new THREE.MeshBasicMaterial({color:0x3f9bc0,transparent:true,opacity:.58}));water.rotation.x=-Math.PI/2;water.position.set(x,.28,0);scene.add(water)}
function makeWaterfall(x,z){const cliff=new THREE.Mesh(new THREE.BoxGeometry(12,4,7),new THREE.MeshStandardMaterial({color:0x625743,roughness:1}));cliff.position.set(x,1.8,z);scene.add(cliff);const fall=new THREE.Mesh(new THREE.PlaneGeometry(7,5),new THREE.MeshBasicMaterial({color:0x75d3e9,transparent:true,opacity:.62,side:THREE.DoubleSide}));fall.position.set(x,2.9,z+3.4);scene.add(fall)}
function makeWaterfallFX(x,z){const geo=new THREE.BufferGeometry(),count=80,arr=new Float32Array(count*3);for(let i=0;i<count;i++){arr[i*3]=x+rand(-3,3);arr[i*3+1]=rand(.3,5.2);arr[i*3+2]=z+rand(2.4,5.2)}geo.setAttribute('position',new THREE.BufferAttribute(arr,3));const matp=new THREE.PointsMaterial({color:0xb9f5ff,size:.12,transparent:true,opacity:.72});const pts=new THREE.Points(geo,matp);pts.userData.waterfall=true;scene.add(pts);pts.userData.base=arr;waterfallParticles=pts;}
function makeAmbiences(){
  // Prairie centrale
  for(let i=0;i<34;i++){const x=rand(-22,22),z=rand(-22,22);const f=new THREE.Mesh(new THREE.ConeGeometry(.035,.45,5),new THREE.MeshBasicMaterial({color:i%2?0xe6d879:0xd98d9e}));f.position.set(x,.12,z);scene.add(f)}
  // Marais humide
  for(let i=0;i<22;i++){const x=rand(-105,-60),z=rand(35,105);const r=new THREE.Mesh(new THREE.CylinderGeometry(.025,.045,1.3,5),new THREE.MeshBasicMaterial({color:0x557a43}));r.position.set(x,.65,z);scene.add(r)}
  // Sous-bois champignons
  for(let i=0;i<18;i++){const x=rand(60,110),z=rand(-105,-45);const st=new THREE.Mesh(new THREE.CylinderGeometry(.04,.06,.25,5),new THREE.MeshBasicMaterial({color:0xd6c9a2}));st.position.set(x,.13,z);scene.add(st);const cap=new THREE.Mesh(new THREE.SphereGeometry(.16,7,5),new THREE.MeshBasicMaterial({color:i%2?0xb64f3e:0xe6a65c}));cap.scale.y=.45;cap.position.set(x,.31,z);scene.add(cap)}
  // Rocheux / savane
  for(let i=0;i<14;i++){const x=rand(85,120),z=rand(45,115);rock(x,z,0.55+Math.random()*.5)}
}
function tree(x,z){const s=.7+Math.random()*1.15;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.24*s,.45*s,2.7*s,6),new THREE.MeshStandardMaterial({color:0x65452c,roughness:1}));trunk.position.set(x,1.35*s,z);scene.add(trunk);for(let j=0;j<2;j++){const c=new THREE.Mesh(new THREE.IcosahedronGeometry((1.35-j*.12)*s,0),new THREE.MeshStandardMaterial({color:j?0x3d833d:0x2d6c32,roughness:1}));c.position.set(x+rand(-.4,.4),2.8*s+j*.95*s,z+rand(-.4,.4));scene.add(c)}}
function rock(x,z,mult=1){const r=new THREE.Mesh(new THREE.DodecahedronGeometry((.8+Math.random()*1.1)*mult,0),new THREE.MeshStandardMaterial({color:0x77766a,roughness:1}));r.position.set(x,surfaceY(x,z)+.35,z);r.scale.y=.55;scene.add(r)}

function mat(color,rough=.85){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:0})}
function part(g,geo,material,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m}
function animalMesh(lvl,player=false){
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
  if(lvl===1)g.rotation.y=Math.PI/2;
  if(player){const ring=new THREE.Mesh(new THREE.RingGeometry(.95*s,1.05*s,20),new THREE.MeshBasicMaterial({color:0xb9ee55,transparent:true,opacity:.55,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.02;g.add(ring)}
  return g;
}
function healthBar(obj,hp,max){if(!obj)return;let group=obj.getObjectByName('hp');if(!group){group=new THREE.Group();group.name='hp';const bg=new THREE.Mesh(new THREE.PlaneGeometry(1.7,.12),new THREE.MeshBasicMaterial({color:0x151515}));const fill=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.08),new THREE.MeshBasicMaterial({color:0xe65c62}));fill.position.z=.01;group.add(bg,fill);group.userData.fill=fill;obj.add(group)}const ratio=Math.max(0,Math.min(1,hp/(max||1)));group.userData.fill.scale.x=ratio;group.userData.fill.position.x=-(1-ratio)*.8;group.position.y=(obj.userData.modelHeight||2)+.35;group.lookAt(camera?.position||new THREE.Vector3(0,10,0))}
function applyCosmetic(obj,id){if(!obj||obj.userData.cosmetic===id)return;let old=obj.getObjectByName('cosmetic');if(old)obj.remove(old);obj.userData.cosmetic=id;if(!id)return;let lvl=obj.userData.level||1,s=animalData(lvl)?.[4]||1,g=new THREE.Group();g.name='cosmetic';
 const ring=(color)=>{let r=new THREE.Mesh(new THREE.RingGeometry(1.35*s,1.48*s,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,side:THREE.DoubleSide}));r.rotation.x=-Math.PI/2;r.position.y=.08;g.add(r)};
 if(['gold','flame','ice','shadow'].includes(id))ring({gold:0xffd65a,flame:0xff5b2e,ice:0x83dfff,shadow:0x9d6cff}[id]);
 if(id==='crown'){let c=new THREE.Mesh(new THREE.ConeGeometry(.7*s,.55*s,5),new THREE.MeshStandardMaterial({color:0xf5c84c,metalness:.6,roughness:.25}));c.position.set(0,2.25*s,1.35*s);g.add(c)}
 if(id==='flower'){let f=new THREE.Mesh(new THREE.TorusGeometry(.32*s,.08*s,6,12),new THREE.MeshStandardMaterial({color:0xff6b9e}));f.position.set(.45*s,2*s,1.4*s);g.add(f)}
 if(id==='leaf'||id==='vines'){for(let side of [-1,1]){let v=new THREE.Mesh(new THREE.TorusGeometry(.55*s,.07*s,5,12,.0,Math.PI*1.6),new THREE.MeshStandardMaterial({color:0x4f9b3b}));v.position.set(side*.55*s,1.55*s,.2*s);v.rotation.y=side*.7;g.add(v)}}
 if(id==='horn'){for(let side of [-1,1]){let h=new THREE.Mesh(new THREE.ConeGeometry(.16*s,.8*s,7),new THREE.MeshStandardMaterial({color:0xe8d49d}));h.position.set(side*.42*s,2.05*s,1.35*s);h.rotation.z=side*.5;g.add(h)}}
 if(id==='spots'){for(let i=0;i<5;i++){let sp=new THREE.Mesh(new THREE.SphereGeometry(.12*s,6,5),new THREE.MeshStandardMaterial({color:0x24170f}));sp.position.set(rand(-.7,.7)*s,1.1*s+rand(-.3,.4)*s,rand(.2,1.2)*s);g.add(sp)}}
 obj.add(g)}
function sync(){
  const t=performance.now()*.001;
  for(const [id,p] of players){
    let m=meshes.get(id);if(!m||m.userData.level!==p.level){if(m)scene.remove(m);m=animalMesh(p.level,true);scene.add(m);meshes.set(id,m)}
    const y=surfaceY(p.x,p.z)+Math.max(.10,m.userData.baseY||0),tx=p.x,tz=p.z;
    m.position.x += (tx-m.position.x)*.30;m.position.z += (tz-m.position.z)*.30;m.position.y=y;
    m.rotation.y += Math.atan2(Math.sin(p.rot-m.rotation.y),Math.cos(p.rot-m.rotation.y))*.30;
    const moving=Math.hypot(tx-m.position.x,tz-m.position.z)>.004;
    if(m.userData.legs?.length){m.userData.legs.forEach((leg,i)=>{const phase=(i%2?Math.PI:0);const stride=Math.sin(t*(p.stamina<20?7.5:10)+phase)*.42*(moving?1:0);leg.rotation.x=stride;leg.rotation.z=Math.sin(t*5+i)*.06*(moving?1:0)})}
    if(m.userData.wormSegments?.length)m.userData.wormSegments.forEach((seg,i)=>{seg.position.z=Math.sin(t*7+i*.75)*.10*sSafe(p.level);seg.position.y=.34*animalData(p.level)[4]+Math.abs(Math.sin(t*7+i*.75))*.035})
    m.visible=!p.dead;healthBar(m,p.hp,p.maxHp);applyCosmetic(m,p.equipped);
  }
  for(const [id,x] of mobs){
    let m=mobMeshes.get(id);if(!m){m=animalMesh(x.level);scene.add(m);mobMeshes.set(id,m)}
    const y=surfaceY(x.x,x.z)+Math.max(.10,m.userData.baseY||0);m.position.x += (x.x-m.position.x)*.30;m.position.z += (x.z-m.position.z)*.30;m.position.y=y;
    m.rotation.y += Math.atan2(Math.sin(x.rot-m.rotation.y),Math.cos(x.rot-m.rotation.y))*.28;m.visible=x.hp>0;healthBar(m,x.hp,x.maxHp);
    const moving=Math.hypot(x.x-m.position.x,x.z-m.position.z)>.004;if(m.userData.legs?.length)m.userData.legs.forEach((leg,i)=>{const phase=(i%2?Math.PI:0);leg.rotation.x=Math.sin(t*8+phase)*.34*(moving?1:0);leg.rotation.z=Math.sin(t*4+i)*.05*(moving?1:0)});
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
let last=0;function gameLoop(t){requestAnimationFrame(gameLoop);if(!renderer)return;if(t-last>32){sendMove();last=t}sync();if(waterfallParticles){const a=waterfallParticles.geometry.attributes.position.array;for(let i=1;i<a.length;i+=3){a[i]-=.035;if(a[i]<.2)a[i]=5.2}waterfallParticles.geometry.attributes.position.needsUpdate=true}if(me){let m=meshes.get(meId);if(m){const d=animalData(me.level),back=8+d[4]*2.0;const yaw=me.rot+camYaw;const horiz=Math.cos(camPitch)*back;const target=new THREE.Vector3(m.position.x-Math.sin(yaw)*horiz, m.position.y+2.2+Math.sin(camPitch)*back, m.position.z-Math.cos(yaw)*horiz);camera.position.lerp(target,.16);camera.lookAt(m.position.x,m.position.y+1.0,m.position.z)}}hudUpdate();renderer.render(scene,camera)}
function sendMove(){if((!apiMode&&(!ws||ws.readyState!==1))||!me||me.dead)return;let f=(keys.z?1:0)+(keys.s?-1:0),t=(keys.q?1:0)+(keys.d?-1:0);if(mobileStick){f=mobileStick.forward;t=mobileStick.turn}if(f||t||keys.shift||mobileStick?.sprint)sendMsg({type:'move',forward:f,turn:t,sprint:!!(keys.shift||mobileStick?.sprint)})}
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
function initMinimap(){
  minimapCanvas=document.createElement('canvas');minimapCanvas.id='minimap';minimapCanvas.width=220;minimapCanvas.height=220;document.body.appendChild(minimapCanvas);minimapCtx=minimapCanvas.getContext('2d');
}
function drawMinimap(){
  if(!minimapCtx||!me||me.inLobby)return;
  const c=minimapCtx,w=c.width,h=c.height,r=w/2-7;
  minimapCtx.clearRect(0,0,w,h);
  minimapCtx.save();minimapCtx.beginPath();minimapCtx.arc(w/2,h/2,r,0,Math.PI*2);minimapCtx.clip();
  minimapCtx.fillStyle='#17351b';minimapCtx.fillRect(0,0,w,h);
  // subtle world grid / terrain
  minimapCtx.strokeStyle='rgba(190,230,150,.12)';minimapCtx.lineWidth=1;
  for(let i=-130;i<=130;i+=20){let px=w/2+(i-me.x)*(r/130), py=h/2+(i-me.z)*(r/130);minimapCtx.beginPath();minimapCtx.moveTo(px,0);minimapCtx.lineTo(px,h);minimapCtx.stroke();minimapCtx.beginPath();minimapCtx.moveTo(0,py);minimapCtx.lineTo(w,py);minimapCtx.stroke()}
  const sx=r/130;
  // rivers
  minimapCtx.strokeStyle='rgba(70,160,210,.55)';minimapCtx.lineWidth=5;minimapCtx.beginPath();minimapCtx.moveTo(w/2+(-120-me.x)*sx,h/2+(-100-me.z)*sx);minimapCtx.lineTo(w/2+(120-me.x)*sx,h/2+(-35-me.z)*sx);minimapCtx.stroke();
  minimapCtx.strokeStyle='rgba(90,190,225,.42)';minimapCtx.lineWidth=3;minimapCtx.beginPath();minimapCtx.moveTo(w/2+(-70-me.x)*sx,h/2+(125-me.z)*sx);minimapCtx.lineTo(w/2+(70-me.x)*sx,h/2+(70-me.z)*sx);minimapCtx.stroke();
  // cascade / zone repere
  minimapCtx.fillStyle='#8feaff';minimapCtx.beginPath();minimapCtx.arc(w/2+(52-me.x)*sx,h/2+(-35-me.z)*sx,5,0,Math.PI*2);minimapCtx.fill();
  for(const p of players.values()){if(p.dead||p.inLobby)continue;let x=w/2+(p.x-me.x)*sx,y=h/2+(p.z-me.z)*sx;if(Math.hypot(x-w/2,y-h/2)<r){minimapCtx.fillStyle=p.id===meId?'#fff08a':'#ff6570';minimapCtx.beginPath();minimapCtx.arc(x,y,p.id===meId?5:4,0,Math.PI*2);minimapCtx.fill()}}
  for(const m of mobs.values()){let x=w/2+(m.x-me.x)*sx,y=h/2+(m.z-me.z)*sx;if(Math.hypot(x-w/2,y-h/2)<r&&m.hp>0){minimapCtx.fillStyle='#57d66b';minimapCtx.fillRect(x-1.5,y-1.5,3,3)}}
  minimapCtx.fillStyle='#fff';minimapCtx.beginPath();minimapCtx.moveTo(w/2,h/2-8);minimapCtx.lineTo(w/2-5,h/2+6);minimapCtx.lineTo(w/2+5,h/2+6);minimapCtx.closePath();minimapCtx.fill();
  minimapCtx.restore();minimapCtx.strokeStyle='rgba(235,255,210,.75)';minimapCtx.lineWidth=3;minimapCtx.beginPath();minimapCtx.arc(w/2,h/2,r,0,Math.PI*2);minimapCtx.stroke();
}

function hudUpdate(){if(me)drawMinimap();let a=animalData(me.level);$('animal').textContent=a[0];$('level').textContent=me.level;$('lvlBig').textContent=me.level;$('power').textContent=a[3];$('xpText').textContent=`${Math.floor(me.xp)} / ${a[2]}`;$('hpText').textContent=`${Math.max(0,Math.ceil(me.hp))} / ${me.maxHp}`;$('xpbar').style.width=Math.min(100,me.xp/a[2]*100)+'%';$('hpbar').style.width=Math.max(0,me.hp/me.maxHp*100)+'%';$('staminabar').style.width=Math.max(0,(me.stamina??100)/(me.maxStamina??100)*100)+'%';let z=me.level<=2?1:me.level<=5?2:me.level<=8?3:me.level<=11?4:me.level<=14?5:me.level<=17?6:7;$('zone').textContent='ZONE '+z+(z===7?' — COLOSSES':'');$('dead').classList.toggle('hidden',!me.dead);renderer?.domElement.classList.toggle('dead-bg',!!me.dead);updateCoins();updateBoostHud();$('scores').innerHTML=[...players.values()].sort((a,b)=>b.level-a.level||b.xp-a.xp).slice(0,10).map((p,i)=>`<div class="row ${p.id===meId?'me':''}"><span>${i+1}. ${esc(p.name)}</span><span>Niv. ${p.level}</span></div>`).join('')}
function esc(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function damagePopup(amount,x,z){let v=document.createElement('div');v.className='damage';v.textContent='-'+amount;v.style.left='50%';v.style.top='42%';document.body.appendChild(v);setTimeout(()=>v.remove(),700)}
function attackSound(){try{if(!audio)return;const now=audio.currentTime;let o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(240,now);o.frequency.exponentialRampToValueAtTime(110,now+.16);g.gain.setValueAtTime(.018,now);g.gain.exponentialRampToValueAtTime(.001,now+.17);o.connect(g).connect(audio.destination);o.start(now);o.stop(now+.18)}catch{}}
function startWaterfallSound(){try{if(!audio)return;const len=audio.sampleRate*2,buf=audio.createBuffer(1,len,audio.sampleRate),data=buf.getChannelData(0);for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*.32;const src=audio.createBufferSource(),filter=audio.createBiquadFilter(),g=audio.createGain();src.buffer=buf;src.loop=true;filter.type='lowpass';filter.frequency.value=1300;g.gain.value=.018;src.connect(filter).connect(g).connect(audio.destination);src.start()}catch{}}
function startJungleMusic(){try{if(audio){if(audio.state==='suspended')audio.resume();return}audio=new (window.AudioContext||window.webkitAudioContext)();const master=audio.createGain();master.gain.value=.014;master.connect(audio.destination);const chords=[[146.83,185,220],[130.81,164.81,196],[123.47,155.56,185],[138.59,174.61,207.65]];let bar=0;function chord(){if(audio.state==='suspended')return;const notes=chords[bar++%chords.length],now=audio.currentTime;notes.forEach((n,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=n;g.gain.setValueAtTime(.0001,now);g.gain.linearRampToValueAtTime(.35,now+.25);g.gain.exponentialRampToValueAtTime(.0001,now+3.2);o.connect(g).connect(master);o.start(now);o.stop(now+3.3)});const pluck=audio.createOscillator(),pg=audio.createGain();pluck.type='triangle';pluck.frequency.value=notes[1]*2;pg.gain.setValueAtTime(.0001,now+1.1);pg.gain.linearRampToValueAtTime(.07,now+1.18);pg.gain.exponentialRampToValueAtTime(.0001,now+2);pluck.connect(pg).connect(master);pluck.start(now+1.1);pluck.stop(now+2.05)}chord();setInterval(chord,3200);setInterval(()=>{if(audio.state==='suspended')return;const now=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.value=[196,220,246.94,293.66,329.63][Math.floor(Math.random()*5)];g.gain.setValueAtTime(.0001,now);g.gain.linearRampToValueAtTime(.018,now+.04);g.gain.exponentialRampToValueAtTime(.0001,now+.7);o.connect(g).connect(master);o.start(now);o.stop(now+.75)},1800);setInterval(()=>{if(audio.state==='suspended')return;const now=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=65.4;g.gain.setValueAtTime(.012,now);g.gain.exponentialRampToValueAtTime(.0001,now+.55);o.connect(g).connect(master);o.start(now);o.stop(now+.6)},6400)}catch{}}
window.onresize=()=>{if(camera&&renderer){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}if(lobbyCamera&&lobbyRenderer){lobbyCamera.aspect=innerWidth/innerHeight;lobbyCamera.updateProjectionMatrix();lobbyRenderer.setSize(innerWidth,innerHeight)}};
initLobby();
