const express=require('express');
const http=require('http');
const WebSocket=require('ws');
const app=express();
const server=http.createServer(app);
const wss=new WebSocket.Server({server});
app.use(express.json());
app.use(express.static('public'));
const PORT=process.env.PORT||3000;
const WORLD=260, MAX_PLAYERS=20;
const animals=[
['Ver de terre',1,35,4,.75],['Fourmi',2,45,5,.82],['Scarabée',3,58,6,.9],['Souris',4,70,7,1],['Lapin',5,85,8,1.12],['Hérisson',6,105,10,1.25],['Renard',7,125,12,1.4],['Sanglier',8,150,14,1.58],['Cerf',9,175,16,1.78],['Loup',10,205,18,1.95],['Hyène',11,240,20,2.1],['Léopard',12,280,23,2.25],['Lion',13,330,26,2.42],['Tigre',14,385,30,2.58],['Ours',15,445,34,2.75],['Gorille',16,510,38,2.9],['Buffle',17,580,43,3.05],['Hippopotame',18,660,48,3.25],['Rhinocéros',19,750,54,3.5],['Éléphant',20,850,60,3.8]
];
const cosmetics=[
{id:'leaf',name:'Couronne de feuilles',cost:10,icon:'🍃'},
{id:'flower',name:'Fleur tropicale',cost:10,icon:'🌺'},
{id:'spots',name:'Taches sauvages',cost:10,icon:'🟤'},
{id:'gold',name:'Aura dorée',cost:15,icon:'✨'},
{id:'flame',name:'Aura de feu',cost:15,icon:'🔥'},
{id:'ice',name:'Aura de glace',cost:15,icon:'❄️'},
{id:'horn',name:'Cornes royales',cost:20,icon:'🦬'},
{id:'crown',name:'Petite couronne',cost:20,icon:'👑'},
{id:'vines',name:'Lianes sauvages',cost:20,icon:'🌿'},
{id:'shadow',name:'Ombre nocturne',cost:20,icon:'🌑'}
];
const players=new Map(),mobs=[]; let nextMob=1;
const plants=[],boosts=[]; let nextPickup=1;
function pickupSpawn(){
  const a=Math.random()*Math.PI*2,r=18+Math.random()*105;
  return {x:Math.cos(a)*r,z:Math.sin(a)*r};
}
for(let i=0;i<28;i++){const q=pickupSpawn();plants.push({id:'pl'+nextPickup++,x:q.x,z:q.z,type:i%3===0?'berry':'leaf'});}
for(let i=0;i<10;i++){const q=pickupSpawn();boosts.push({id:'bo'+nextPickup++,x:q.x,z:q.z,type:['speed','power','shield'][i%3]});}
const apiTokens=new Map();
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function zone(level){if(level<=2)return[-115,-65];if(level<=5)return[-80,-25];if(level<=8)return[-40,15];if(level<=11)return[0,55];if(level<=14)return[35,90];if(level<=17)return[70,120];return[100,125]}
function spawn(){const a=rand(0,Math.PI*2),r=Math.sqrt(Math.random())*7;return{x:Math.cos(a)*r,z:Math.sin(a)*r,rot:rand(-Math.PI,Math.PI)}}
function mob(level,harmless=false){let z=zone(level),hp=animals[level-1][2];return{id:'m'+nextMob++,level,x:rand(z[0],z[1]),z:rand(-WORLD/2,WORLD/2),rot:rand(-Math.PI,Math.PI),hp,maxHp:hp,harmless,lastAttack:0,wander:rand(0,7)}}
for(let l=1;l<=20;l++){let n=l<=5?3:l<=10?2:1;for(let i=0;i<n;i++)mobs.push(mob(l,l<=2))}
function pub(p){return{id:p.id,name:p.name,x:p.x,z:p.z,rot:p.rot,inLobby:p.inLobby,level:p.level,xp:p.xp,hp:p.hp,maxHp:p.maxHp,animal:animals[p.level-1][0],power:animals[p.level-1][3],dead:p.dead,spawnProtected:Date.now()<p.protectedUntil,kills:p.kills,coins:p.coins,owned:p.owned,equipped:p.equipped,stamina:p.stamina,maxStamina:p.maxStamina,speedBoost:Date.now()<p.speedBoostUntil,powerBoost:Date.now()<p.powerBoostUntil,shield:Date.now()<p.shieldUntil}}
function active(){return [...players.values()].filter(p=>!p.inLobby)}
function broadcast(o){let s=JSON.stringify(o);for(const p of players.values())if(!p.inLobby&&p.ws.readyState===WebSocket.OPEN)p.ws.send(s)}
function xpNeed(p){return animals[p.level-1][2]}
function gainXp(p,n){p.xp+=n;while(p.level<20&&p.xp>=xpNeed(p)){p.xp-=xpNeed(p);p.level++;p.maxHp=animals[p.level-1][2];p.hp=p.maxHp}}
function die(p,killerId){p.dead=true;p.hp=0;p.lastKiller=killerId||null;p.deathAt=Date.now()}
function respawn(p){let s=spawn();p.x=s.x;p.z=s.z;p.rot=s.rot;p.level=1;p.xp=0;p.maxHp=animals[0][2];p.hp=p.maxHp;p.dead=false;p.protectedUntil=Date.now()+5000;p.lastKiller=null;p.stamina=p.maxStamina}
function pickupFor(p){
  for(let i=plants.length-1;i>=0;i--){const q=plants[i];if(dist(p,q)<=2.1 && p.level<=5){plants.splice(i,1);p.hp=Math.min(p.maxHp,p.hp+8);gainXp(p,4);break}}
  for(let i=boosts.length-1;i>=0;i--){const q=boosts[i];if(dist(p,q)<=2.3){boosts.splice(i,1);const until=Date.now()+8000;if(q.type==='speed')p.speedBoostUntil=until;if(q.type==='power')p.powerBoostUntil=until;if(q.type==='shield')p.shieldUntil=until;break}}
}

function hurtPlayer(p,dmg,killer){if(p.dead||Date.now()<p.protectedUntil)return;if(Date.now()<p.shieldUntil)dmg*=.35;p.hp-=dmg;p.lastHitBy=killer?.id||null;broadcast({type:'damage',target:p.id,amount:Math.round(dmg),x:p.x,z:p.z});if(p.hp<=0){if(killer){killer.kills++;killer.coins+=10;broadcast({type:'reward',killer:killer.id,coins:10})}die(p,killer?.id)}}
app.get('/api/health',(req,res)=>res.json({ok:true,service:'Evolution Arena'}));
app.post('/api/connect',(req,res)=>{
  if(players.size>=MAX_PLAYERS)return res.status(503).json({error:'full'});
  let id=Math.random().toString(36).slice(2,10),s=spawn();
  let p={id,ws:{readyState:WebSocket.OPEN,send:()=>{}},name:'Joueur',...s,inLobby:true,level:1,xp:0,maxHp:animals[0][2],hp:animals[0][2],dead:false,protectedUntil:Date.now()+3000,lastAttack:0,kills:0,coins:0,owned:[],equipped:null,stamina:100,maxStamina:100,speedBoostUntil:0,powerBoostUntil:0,shieldUntil:0,api:true};
  players.set(id,p);let token=Math.random().toString(36).slice(2)+Date.now().toString(36);apiTokens.set(token,id);
  res.json({token,type:'init',id,world:WORLD,animals,cosmetics,players:[pub(p)],mobs});
});
app.post('/api/action',(req,res)=>{
  const id=apiTokens.get(req.body?.token),p=players.get(id); if(!p)return res.status(401).json({error:'session'});
  const messages=[]; handleMessage(p,req.body?.message||{},m=>messages.push(m));
  res.json({ok:true,messages,state:{type:'state',players:active().map(pub),mobs:mobs.map(m=>({id:m.id,level:m.level,x:m.x,z:m.z,rot:m.rot,hp:m.hp,maxHp:m.maxHp,harmless:m.harmless})),plants,boosts}});
});
app.get('/api/state',(req,res)=>{
  const id=apiTokens.get(req.query.token),p=players.get(id); if(!p)return res.status(401).json({error:'session'});
  res.json({type:'state',players:active().map(pub),mobs:mobs.map(m=>({id:m.id,level:m.level,x:m.x,z:m.z,rot:m.rot,hp:m.hp,maxHp:m.maxHp,harmless:m.harmless})),plants,boosts});
});

wss.on('connection',ws=>{
 if(players.size>=MAX_PLAYERS){ws.send(JSON.stringify({type:'full'}));ws.close();return}
 let id=Math.random().toString(36).slice(2,10),s=spawn();
 let p={id,ws,name:'Joueur',...s,inLobby:true,level:1,xp:0,maxHp:animals[0][2],hp:animals[0][2],dead:false,protectedUntil:Date.now()+3000,lastAttack:0,kills:0,coins:0,owned:[],equipped:null,stamina:100,maxStamina:100,speedBoostUntil:0,powerBoostUntil:0,shieldUntil:0};
 players.set(id,p);
 ws.send(JSON.stringify({type:'init',id,world:WORLD,animals,cosmetics,players:[pub(p)],mobs,plants,boosts}));
 broadcast({type:'players',players:active().map(pub)});
 function handleMessage(p,m,send){
  if(!p||!m)return;
  if(m.type==='join'){p.name=String(m.name||'Joueur').replace(/[^\p{L}\p{N}_ -]/gu,'').slice(0,16)||'Joueur';p.inLobby=false;p.dead=false;p.stamina=p.maxStamina;p.protectedUntil=Date.now()+5000;let s=spawn();p.x=s.x;p.z=s.z;p.rot=s.rot;send({type:'players',players:active().map(pub)});broadcast({type:'players',players:active().map(pub)});return}
  if(m.type==='lobby'){p.inLobby=true;p.dead=false;send({type:'lobby',player:pub(p)});broadcast({type:'players',players:active().map(pub)});return}
  if(m.type==='move'&&!p.dead&&!p.inLobby){let turn=Number(m.turn)||0,forward=Number(m.forward)||0;p.rot+=clamp(turn,-1,1)*.075;let sprint=!!m.sprint&&forward>0&&p.stamina>1;if(sprint)p.stamina=Math.max(0,p.stamina-.85);else p.stamina=Math.min(p.maxStamina,p.stamina+.45);pickupFor(p);let speed=(.10+Math.min(p.level,20)*.002)*(sprint?1.72:1)*(Date.now()<p.speedBoostUntil?1.5:1)*clamp(Math.abs(forward),0,1);p.x=clamp(p.x+Math.sin(p.rot)*speed*Math.sign(forward),-WORLD/2+2,WORLD/2-2);p.z=clamp(p.z+Math.cos(p.rot)*speed*Math.sign(forward),-WORLD/2+2,WORLD/2-2);return}
  if(m.type==='attack'&&!p.dead&&!p.inLobby&&Date.now()-p.lastAttack>=550&&Date.now()>=p.protectedUntil){p.lastAttack=Date.now();let reach=3+animals[p.level-1][4]*.5,damage=animals[p.level-1][3]*(Date.now()<p.powerBoostUntil?1.75:1);for(const o of players.values())if(o.id!==p.id&&!o.dead&&Date.now()>=o.protectedUntil&&dist(p,o)<=reach)hurtPlayer(o,damage,p);for(const mm of mobs)if(mm.hp>0&&dist(p,mm)<=reach){mm.hp-=damage;broadcast({type:'damageMob',id:mm.id,amount:Math.round(damage),x:mm.x,z:mm.z});if(mm.hp<=0){gainXp(p,Math.max(1,Math.floor(mm.level*8)));let z=zone(mm.level);mm.x=rand(z[0],z[1]);mm.z=rand(-WORLD/2,WORLD/2);mm.hp=mm.maxHp}}return}
  if(m.type==='respawn'&&p.dead&&!p.inLobby){respawn(p);return}
  if(m.type==='buy'){let item=cosmetics.find(c=>c.id===m.id);if(item&&!p.owned.includes(item.id)&&p.coins>=item.cost){p.coins-=item.cost;p.owned.push(item.id);send({type:'shop',id:p.id,coins:p.coins,owned:p.owned,equipped:p.equipped,stamina:p.stamina,maxStamina:p.maxStamina,speedBoost:Date.now()<p.speedBoostUntil,powerBoost:Date.now()<p.powerBoostUntil,shield:Date.now()<p.shieldUntil});}return}
  if(m.type==='equip'){if(m.id===null||p.owned.includes(m.id)){p.equipped=m.id;send({type:'shop',id:p.id,coins:p.coins,owned:p.owned,equipped:p.equipped,stamina:p.stamina,maxStamina:p.maxStamina,speedBoost:Date.now()<p.speedBoostUntil,powerBoost:Date.now()<p.powerBoostUntil,shield:Date.now()<p.shieldUntil});}return}
 }
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return};handleMessage(p,m,msg=>ws.send(JSON.stringify(msg)))});
 ws.on('close',()=>{players.delete(id);broadcast({type:'players',players:active().map(pub)})});
});
setInterval(()=>{let now=Date.now();for(const p of players.values()) if(!p.inLobby&&!p.dead) p.stamina=Math.min(p.maxStamina,p.stamina+.8); for(const m of mobs){if(m.hp<=0)continue;if(m.harmless){m.wander+=(Math.random()-.5)*.12;m.x+=Math.sin(m.wander)*.012;m.z+=Math.cos(m.wander)*.012;continue}let t=null,best=16;for(const p of players.values()){if(p.inLobby||p.dead||now<p.protectedUntil)continue;let d=dist(m,p);if(d<best){best=d;t=p}}if(t){if(best>2.5){let dx=(t.x-m.x)/best,dz=(t.z-m.z)/best,sp=.018+Math.min(m.level,20)*.0018;m.x+=dx*sp;m.z+=dz*sp;m.rot=Math.atan2(dx,dz)}else if(now-m.lastAttack>900){m.lastAttack=now;hurtPlayer(t,animals[m.level-1][3]*.35)}}else{m.wander+=(Math.random()-.5)*.08;m.x+=Math.sin(m.wander)*.01;m.z+=Math.cos(m.wander)*.01}}
 for(let l=1;l<=20;l++){let alive=mobs.filter(m=>m.level===l&&m.hp>0).length,w=l<=5?3:l<=10?2:1;for(let i=alive;i<w;i++)mobs.push(mob(l,l<=2))}

 if(plants.length<28&&Math.random()<.08){const q=pickupSpawn();plants.push({id:'pl'+nextPickup++,x:q.x,z:q.z,type:Math.random()<.35?'berry':'leaf'})}
 if(boosts.length<10&&Math.random()<.025){const q=pickupSpawn();boosts.push({id:'bo'+nextPickup++,x:q.x,z:q.z,type:['speed','power','shield'][Math.floor(Math.random()*3)]})}
 broadcast({type:'state',players:active().map(pub),mobs:mobs.map(m=>({id:m.id,level:m.level,x:m.x,z:m.z,rot:m.rot,hp:m.hp,maxHp:m.maxHp,harmless:m.harmless})),plants,boosts});
},66);
server.listen(PORT,()=>console.log('Evolution Arena listening on '+PORT));
