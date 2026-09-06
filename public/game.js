import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const $=id=>document.getElementById(id);
const CLIENT_ANIMALS=[
['Ver de terre',1,35,4,.75],['Fourmi',2,45,5,.82],['Scarabée',3,58,6,.9],['Souris',4,70,7,1],['Lapin',5,85,8,1.12],['Hérisson',6,105,10,1.25],['Renard',7,125,12,1.4],['Sanglier',8,150,14,1.58],['Cerf',9,175,16,1.78],['Loup',10,205,18,1.95],['Hyène',11,240,20,2.1],['Léopard',12,280,23,2.25],['Lion',13,330,26,2.42],['Tigre',14,385,30,2.58],['Ours',15,445,34,2.75],['Gorille',16,510,38,2.9],['Buffle',17,580,43,3.05],['Hippopotame',18,660,48,3.25],['Rhinocéros',19,750,54,3.5],['Éléphant',20,850,60,3.8]
];
const colors=[0x85582e,0x303a2c,0x4f3c26,0x8b6a42,0xd4bb83,0x777777,0xb66c36,0x5a3b20,0x9a6d3e,0x5e5a4b,0x654b39,0xc78943,0xd99b4e,0xb46c42,0x5c4938,0x444444,0x6c5a3d,0x64554a,0x77746a,0x9d895e];
let ws=null,meId=null,animals=CLIENT_ANIMALS,cosmetics=[],players=new Map(),mobs=new Map(),scene,camera,renderer,clock,me,meshes=new Map(),mobMeshes=new Map(),keys={},audio=null,lobbyRenderer,lobbyScene,lobbyCamera,lobbyClock,lobbyAnimals=[],gameStarted=false;

function rand(a,b){return a+Math.random()*(b-a)}
function animalData(lvl){return animals[lvl-1]||CLIENT_ANIMALS[lvl-1]}

// ---------- LOBBY ----------
function initLobby(){
  lobbyScene=new THREE.Scene();
  lobbyScene.background=new THREE.Color(0x07150a);
  lobbyScene.fog=new THREE.Fog(0x07150a,25,95);
  lobbyCamera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,150);lobbyCamera.position.set(0,5.5,18);lobbyCamera.lookAt(0,2,0);
  lobbyRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true});lobbyRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));lobbyRenderer.setSize(innerWidth,innerHeight);lobbyRenderer.domElement.className='lobby3d';$('lobbyCanvas').appendChild(lobbyRenderer.domElement);
  lobbyScene.add(new THREE.HemisphereLight(0x9edb93,0x18200f,2.2));let sun=new THREE.DirectionalLight(0xfff0c4,2.4);sun.position.set(-15,20,12);lobbyScene.add(sun);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(34,48),new THREE.MeshStandardMaterial({color:0x18371b,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.03;lobbyScene.add(ground);
  for(let i=0;i<80;i++){let x=rand(-34,34),z=rand(-25,20);let h=rand(.5,2);let leaf=new THREE.Mesh(new THREE.ConeGeometry(rand(.15,.35),h,6),new THREE.MeshStandardMaterial({color:i%2?0x356b30:0x4e8738,roughness:1}));leaf.position.set(x,h/2-.05,z);lobbyScene.add(leaf)}
  const levels=[1,4,7,10,13,16,18,20];
  levels.forEach((lvl,i)=>{let g=animalMesh(lvl,false);g.scale.multiplyScalar(.65);g.position.set(-12+i*3.45,0,rand(-3,4));g.rotation.y=Math.PI+(i%2)*.5;g.userData.lobbyOffset=i*.8;lobbyScene.add(g);lobbyAnimals.push(g)});
  lobbyClock=new THREE.Clock();requestAnimationFrame(lobbyLoop);
}
function lobbyLoop(){if(!lobbyRenderer)return;requestAnimationFrame(lobbyLoop);let t=lobbyClock.getElapsedTime();lobbyAnimals.forEach((g,i)=>{g.position.y=Math.sin(t*1.5+i)*.12;g.rotation.y=Math.PI+Math.sin(t*.35+i)*.35;g.position.z+=Math.sin(t*.22+i)*.002});lobbyRenderer.render(lobbyScene,lobbyCamera)}

function start(){if(gameStarted)return;gameStarted=true;$('menu').classList.add('hidden');$('lobbyCanvas').style.display='none';$('hud').classList.remove('hidden');connect();initGame();startJungleMusic()}
function connect(){ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);ws.onopen=()=>ws.send(JSON.stringify({type:'join',name:$('name').value.trim()||'Joueur'}));ws.onmessage=e=>handleMessage(JSON.parse(e.data));ws.onclose=()=>{if(gameStarted){gameStarted=false}}}
function handleMessage(m){
  if(m.type==='init'){meId=m.id;animals=m.animals||CLIENT_ANIMALS;cosmetics=m.cosmetics||[];players.clear();m.players.forEach(p=>players.set(p.id,p));m.mobs.forEach(x=>mobs.set(x.id,x));me=players.get(meId);renderShop()}
  if(m.type==='players'){players.clear();m.players.forEach(p=>players.set(p.id,p));me=players.get(meId)||me}
  if(m.type==='state'){players.clear();m.players.forEach(p=>players.set(p.id,p));mobs.clear();m.mobs.forEach(x=>mobs.set(x.id,x));me=players.get(meId)||me}
  if(m.type==='damage')damagePopup(m.amount,m.x,m.z);
  if(m.type==='damageMob')damagePopup(m.amount,m.x,m.z);
  if(m.type==='shop'&&m.id===meId){let p=players.get(meId);if(p){p.coins=m.coins;p.owned=m.owned;p.equipped=m.equipped}updateCoins();renderShop();}
  if(m.type==='reward'&&m.killer===meId){updateCoins();showReward()}
}

window.addEventListener('pointerdown',()=>startJungleMusic(),{once:false});
$('play').onclick=()=>start();$('name').onkeydown=e=>{if(e.key==='Enter')start()};
$('respawn').onclick=()=>ws?.send(JSON.stringify({type:'respawn'}));
$('lobbyBtn').onclick=()=>goLobby();
window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==='r'&&me?.dead)ws?.send(JSON.stringify({type:'respawn'}));if(e.code==='Space')e.preventDefault()});
window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
window.addEventListener('mousedown',e=>{if(e.button===0&&me&&!me.dead&&gameStarted){ws?.send(JSON.stringify({type:'attack'}));attackSound())}});

document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab-panel').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$(btn.dataset.tab).classList.add('active');if(btn.dataset.tab==='shopTab')renderShop()});

function goLobby(){
  ws?.send(JSON.stringify({type:'lobby'}));
  gameStarted=false;me=null;players.clear();
  $('dead').classList.add('hidden');$('hud').classList.add('hidden');$('menu').classList.remove('hidden');$('lobbyCanvas').style.display='block';
  renderer?.domElement.classList.remove('dead-bg');
  document.querySelector('[data-tab="playTab"]').click();
  $('name').focus();
}
function updateCoins(){let p=players.get(meId);$('coins').textContent=p?.coins??0;$('gameCoins').textContent=p?.coins??0}
function renderShop(){
  const p=players.get(meId),owned=p?.owned||[],equipped=p?.equipped||null;
  $('coins').textContent=p?.coins??0;
  if(!cosmetics.length){$('shopGrid').innerHTML='<div style="opacity:.5">Boutique en chargement...</div>';return}
  $('shopGrid').innerHTML=cosmetics.map(c=>{let own=owned.includes(c.id),eq=equipped===c.id;let label=eq?'ÉQUIPÉ':own?'ÉQUIPER':`🪙 ${c.cost}`;return `<div class="shop-item"><div class="shop-icon">${c.icon}</div><div><div class="shop-name">${c.name}</div><div class="shop-cost">${own?'Possédé':c.cost+' pièces'}</div></div><button class="shop-btn ${own?'owned':''} ${eq?'equipped':''}" data-shop="${c.id}">${label}</button></div>`}).join('');
  document.querySelectorAll('[data-shop]').forEach(b=>b.onclick=()=>{let id=b.dataset.shop;if((p?.owned||[]).includes(id))ws?.send(JSON.stringify({type:'equip',id:id}));else ws?.send(JSON.stringify({type:'buy',id:id}))});
}
function showReward(){let v=document.createElement('div');v.className='damage';v.textContent='+10 🪙';v.style.left='50%';v.style.top='34%';document.body.appendChild(v);setTimeout(()=>v.remove(),900)}

// ---------- GAME ----------
function initGame(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x9bc86b);scene.fog=new THREE.Fog(0x9bc86b,85,245);
  camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,400);
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.domElement.className='gamecanvas';document.body.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xdfffd0,0x67513a,2.1));let sun=new THREE.DirectionalLight(0xfff5d8,2.7);sun.position.set(-40,90,30);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);makeWorld();clock=new THREE.Clock();requestAnimationFrame(gameLoop);
}
function makeWorld(){let g=new THREE.PlaneGeometry(260,260,60,60),pos=g.attributes.position;for(let i=0;i<pos.count;i++){let x=pos.getX(i),z=pos.getY(i);pos.setZ(i,Math.sin(x*.055)*1.8+Math.cos(z*.045)*1.5+Math.sin((x+z)*.02)*2)}g.computeVertexNormals();let ground=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x6f9b45,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);makeRiver(-48);makeRiver(52);makeWaterfall(52,-35);for(let i=0;i<210;i++){let x=(Math.random()-.5)*250,z=(Math.random()-.5)*250;if(Math.abs(x)<15&&Math.abs(z)<15)continue;Math.random()<.72?tree(x,z):rock(x,z)}}
function makeRiver(x){let water=new THREE.Mesh(new THREE.PlaneGeometry(10,260),new THREE.MeshStandardMaterial({color:0x3c94ad,transparent:true,opacity:.78,roughness:.25,metalness:.1}));water.rotation.x=-Math.PI/2;water.position.set(x,.35,0);scene.add(water);for(let i=0;i<45;i++){let foam=new THREE.Mesh(new THREE.SphereGeometry(.12+Math.random()*.22,6,4),new THREE.MeshBasicMaterial({color:0xd9f6ed,transparent:true,opacity:.35}));foam.position.set(x+rand(-4,4),.43,rand(-125,125));scene.add(foam)}}
function makeWaterfall(x,z){let cliff=new THREE.Mesh(new THREE.BoxGeometry(14,5,7),new THREE.MeshStandardMaterial({color:0x665b48,roughness:1}));cliff.position.set(x,2.2,z);scene.add(cliff);let fall=new THREE.Mesh(new THREE.PlaneGeometry(9,6),new THREE.MeshStandardMaterial({color:0x70c9df,transparent:true,opacity:.8,side:THREE.DoubleSide}));fall.position.set(x,3.3,z+3.5);scene.add(fall)}
function tree(x,z){let s=.7+Math.random()*.9;let trunk=new THREE.Mesh(new THREE.CylinderGeometry(.3*s,.55*s,3.2*s,7),new THREE.MeshStandardMaterial({color:0x65452c,roughness:1}));trunk.position.set(x,1.6*s,z);trunk.castShadow=true;scene.add(trunk);for(let j=0;j<3;j++){let c=new THREE.Mesh(new THREE.IcosahedronGeometry((1.6-j*.18)*s,1),new THREE.MeshStandardMaterial({color:j===0?0x2f7436:0x3f873d,roughness:1}));c.position.set(x+rand(-.5,.5),3.2*s+j*1.2*s,z+rand(-.5,.5));c.castShadow=true;scene.add(c)}}
function rock(x,z){let r=new THREE.Mesh(new THREE.DodecahedronGeometry(1+Math.random()*1.5,1),new THREE.MeshStandardMaterial({color:0x77766a,roughness:1}));r.position.set(x,.7,z);r.scale.y=.65;r.castShadow=true;scene.add(r)}

function animalMesh(lvl,player=false){let d=animalData(lvl),s=d?.[4]||1,c=colors[lvl-1]||0x777;let g=new THREE.Group();
 let mat=new THREE.MeshStandardMaterial({color:c,roughness:.9});let body=new THREE.Mesh(new THREE.SphereGeometry(1,10,7),mat);body.scale.set(1.25*s,.82*s,1.65*s);body.position.y=1*s;g.add(body);
 let head=new THREE.Mesh(new THREE.SphereGeometry(.7,10,7),mat);head.position.set(0,1.5*s,1.45*s);g.add(head);
 for(let side of [-1,1]){let eye=new THREE.Mesh(new THREE.SphereGeometry(.09*s,6,5),new THREE.MeshBasicMaterial({color:0x111111}));eye.position.set(side*.25*s,1.65*s,2.05*s);g.add(eye)}
 for(let x of [-.55,.55])for(let z of [-.6,.65]){let leg=new THREE.Mesh(new THREE.CylinderGeometry(.13*s,.2*s,.9*s,6),mat);leg.position.set(x*s,.48*s,z*s);g.add(leg)}
 if(lvl<=6)for(let side of [-1,1]){let ear=new THREE.Mesh(new THREE.ConeGeometry(.22*s,.65*s,5),mat);ear.position.set(side*.45*s,1.95*s,1.35*s);g.add(ear)}
 if([8,9,10,11,13,14,15,16,17,18,19,20].includes(lvl)){let tail=new THREE.Mesh(new THREE.CylinderGeometry(.1*s,.18*s,1.8*s,6),mat);tail.rotation.x=Math.PI/2;tail.position.set(0,1*s,-1.9*s);g.add(tail)}
 if([9,13,14,17,19].includes(lvl))for(let side of [-1,1]){let horn=new THREE.Mesh(new THREE.ConeGeometry(.12*s,.8*s,6),new THREE.MeshStandardMaterial({color:0xd8c99b}));horn.position.set(side*.35*s,2*s,1.25*s);horn.rotation.z=side*.45;g.add(horn)}
 if(lvl===20){let trunk=new THREE.Mesh(new THREE.CylinderGeometry(.16*s,.25*s,1.8*s,7),mat);trunk.rotation.x=Math.PI/2;trunk.position.set(0,1.15*s,2.2*s);g.add(trunk)}
 if(player)g.add(new THREE.Mesh(new THREE.RingGeometry(1.1*s,1.22*s,24),new THREE.MeshBasicMaterial({color:0xb9ee55,transparent:true,opacity:.55,side:THREE.DoubleSide})));
 return g}
function healthBar(obj,hp,max){if(!obj)return;let old=obj.getObjectByName('hp');if(old)obj.remove(old);let group=new THREE.Group();group.name='hp';let bg=new THREE.Mesh(new THREE.PlaneGeometry(2.1,.16),new THREE.MeshBasicMaterial({color:0x151515}));let fill=new THREE.Mesh(new THREE.PlaneGeometry(2,.1),new THREE.MeshBasicMaterial({color:0xe65c62}));fill.position.z=.01;let ratio=Math.max(0,hp/max);fill.scale.x=ratio;fill.position.x=-(1-ratio);group.add(bg,fill);group.position.y=3.1;group.rotation.x=-.08;obj.add(group)}
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
 for(let [id,p] of players){let m=meshes.get(id);if(!m){m=animalMesh(p.level,true);scene.add(m);meshes.set(id,m);m.userData.level=p.level;m.userData.cosmetic=null}if(m.userData.level!==p.level){let q=m.position.clone(),r=m.rotation.y;scene.remove(m);m=animalMesh(p.level,true);m.position.copy(q);m.rotation.y=r;scene.add(m);meshes.set(id,m);m.userData.level=p.level;m.userData.cosmetic=null}m.position.set(p.x,0,p.z);m.rotation.y=p.rot;m.visible=!p.dead;healthBar(m,p.hp,p.maxHp);applyCosmetic(m,p.equipped)}
 for(let [id,x] of mobs){let m=mobMeshes.get(id);if(!m){m=animalMesh(x.level);scene.add(m);mobMeshes.set(id,m)}m.position.set(x.x,0,x.z);m.rotation.y=x.rot;m.visible=true;healthBar(m,x.hp,x.maxHp)}
}
let last=0;function gameLoop(t){requestAnimationFrame(gameLoop);if(!renderer)return;if(t-last>45){sendMove();last=t}sync();if(me){let m=meshes.get(meId);if(m){let back=10+animalData(me.level)[4]*1.7;let target=new THREE.Vector3(m.position.x-Math.sin(me.rot)*back,5.8+animalData(me.level)[4]*1.2,m.position.z-Math.cos(me.rot)*back);camera.position.lerp(target,.12);camera.lookAt(m.position.x,1.1,m.position.z)}hudUpdate()}renderer.render(scene,camera)}
function sendMove(){if(!ws||ws.readyState!==1||!me||me.dead)return;let f=(keys.z?1:0)+(keys.s?-1:0),t=(keys.d?1:0)+(keys.q?-1:0);if(f||t)ws.send(JSON.stringify({type:'move',forward:f,turn:t}))}
function hudUpdate(){let a=animalData(me.level);$('animal').textContent=a[0];$('level').textContent=me.level;$('lvlBig').textContent=me.level;$('power').textContent=a[3];$('xpText').textContent=`${Math.floor(me.xp)} / ${a[2]}`;$('hpText').textContent=`${Math.max(0,Math.ceil(me.hp))} / ${me.maxHp}`;$('xpbar').style.width=Math.min(100,me.xp/a[2]*100)+'%';$('hpbar').style.width=Math.max(0,me.hp/me.maxHp*100)+'%';let z=me.level<=2?1:me.level<=5?2:me.level<=8?3:me.level<=11?4:me.level<=14?5:me.level<=17?6:7;$('zone').textContent='ZONE '+z+(z===7?' — COLOSSES':'');$('dead').classList.toggle('hidden',!me.dead);renderer?.domElement.classList.toggle('dead-bg',!!me.dead);updateCoins();$('scores').innerHTML=[...players.values()].sort((a,b)=>b.level-a.level||b.xp-a.xp).slice(0,10).map((p,i)=>`<div class="row ${p.id===meId?'me':''}"><span>${i+1}. ${esc(p.name)}</span><span>Niv. ${p.level}</span></div>`).join('')}
function esc(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function damagePopup(amount,x,z){let v=document.createElement('div');v.className='damage';v.textContent='-'+amount;v.style.left='50%';v.style.top='42%';document.body.appendChild(v);setTimeout(()=>v.remove(),700)}
function attackSound(){try{if(!audio)return;let o=audio.createOscillator(),g=audio.createGain();o.type='sawtooth';o.frequency.setValueAtTime(150,audio.currentTime);o.frequency.exponentialRampToValueAtTime(60,audio.currentTime+.1);g.gain.setValueAtTime(.025,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.12);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.13)}catch{}}
function startJungleMusic(){try{if(audio){if(audio.state==='suspended')audio.resume();return}audio=new (window.AudioContext||window.webkitAudioContext)();let master=audio.createGain();master.gain.value=.025;master.connect(audio.destination);let notes=[146.83,174.61,220,174.61,130.81,164.81,196,164.81],i=0;setInterval(()=>{if(audio.state==='suspended')return;let o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.value=notes[i++%notes.length];g.gain.setValueAtTime(0,audio.currentTime);g.gain.linearRampToValueAtTime(1,audio.currentTime+.08);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+1.1);o.connect(g).connect(master);o.start();o.stop(audio.currentTime+1.15)},800);setInterval(()=>{if(audio.state==='suspended')return;let b=audio.createOscillator(),g=audio.createGain();b.type='sine';b.frequency.value=73.42;g.gain.setValueAtTime(.03,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.45);b.connect(g).connect(master);b.start();b.stop(audio.currentTime+.5)},1600)}catch{}}
window.onresize=()=>{if(camera&&renderer){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}if(lobbyCamera&&lobbyRenderer){lobbyCamera.aspect=innerWidth/innerHeight;lobbyCamera.updateProjectionMatrix();lobbyRenderer.setSize(innerWidth,innerHeight)}};
initLobby();
