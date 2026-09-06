const express=require('express');
const http=require('http');
const WebSocket=require('ws');
const app=express(); const server=http.createServer(app); const wss=new WebSocket.Server({server});
app.use(express.static('public')); const PORT=process.env.PORT||3000; const WORLD=260, MAX_PLAYERS=20;
const animals=[
['Ver de terre',1,35,4,0.75],['Fourmi',2,45,5,0.82],['Scarabée',3,58,6,0.9],['Souris',4,70,7,1.0],['Lapin',5,85,8,1.12],['Hérisson',6,105,10,1.25],['Renard',7,125,12,1.4],['Sanglier',8,150,14,1.58],['Cerf',9,175,16,1.78],['Loup',10,205,18,1.95],['Hyène',11,240,20,2.1],['Léopard',12,280,23,2.25],['Lion',13,330,26,2.42],['Tigre',14,385,30,2.58],['Ours',15,445,34,2.75],['Gorille',16,510,38,2.9],['Buffle',17,580,43,3.05],['Hippopotame',18,660,48,3.25],['Rhinocéros',19,750,54,3.5],['Éléphant',20,850,60,3.8]
];
const players=new Map(),mobs=[]; let nextMob=1;
const rand=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function zone(level){if(level<=2)return[-115,-65];if(level<=5)return[-80,-25];if(level<=8)return[-40,15];if(level<=11)return[0,55];if(level<=14)return[35,90];if(level<=17)return[70,120];return[100,125]}
function spawn(){return{x:rand(-10,10),z:rand(-10,10),rot:0}}
function mob(level,harmless=false){let z=zone(level);let hp=animals[level-1][2];return{id:'m'+nextMob++,level,x:rand(z[0],z[1]),z:rand(-WORLD/2,WORLD/2),rot:rand(-Math.PI,Math.PI),hp,maxHp:hp,harmless,lastAttack:0,wander:rand(0,7)}}
for(let l=1;l<=20;l++){let n=l<=2?9:l<=5?7:4;for(let i=0;i<n;i++)mobs.push(mob(l,l<=2))}
function pub(p){return{id:p.id,name:p.name,x:p.x,z:p.z,rot:p.rot,level:p.level,xp:p.xp,hp:p.hp,maxHp:p.maxHp,animal:animals[p.level-1][0],power:animals[p.level-1][3],dead:p.dead,spawnProtected:Date.now()<p.protectedUntil,kills:p.kills}}
function broadcast(o){let s=JSON.stringify(o);for(const p of players.values())if(p.ws.readyState===WebSocket.OPEN)p.ws.send(s)}
function xpNeed(p){return animals[p.level-1][2]}
function gainXp(p,n){p.xp+=n;while(p.level<20&&p.xp>=xpNeed(p)){p.xp-=xpNeed(p);p.level++;p.maxHp=animals[p.level-1][2];p.hp=p.maxHp}}
function die(p,killerId){p.dead=true;p.hp=0;p.lastKiller=killerId||null;p.deathAt=Date.now();p.x=0;p.z=0}
function respawn(p){let s=spawn();p.x=s.x;p.z=s.z;p.rot=0;p.level=1;p.xp=0;p.maxHp=animals[0][2];p.hp=p.maxHp;p.dead=false;p.protectedUntil=Date.now()+5000;p.kills=0;p.lastKiller=null}
function hurtPlayer(p,dmg,killer){if(p.dead||Date.now()<p.protectedUntil)return; p.hp-=dmg;p.lastHitBy=killer?.id||null; broadcast({type:'damage',target:p.id,amount:Math.round(dmg),x:p.x,z:p.z}); if(p.hp<=0){if(killer)killer.kills++;die(p,killer?.id)}}
wss.on('connection',ws=>{if(players.size>=MAX_PLAYERS){ws.send(JSON.stringify({type:'full'}));ws.close();return}let id=Math.random().toString(36).slice(2,10),s=spawn();let p={id,ws,name:'Joueur',...s,level:1,xp:0,maxHp:animals[0][2],hp:animals[0][2],dead:false,protectedUntil:Date.now()+5000,lastAttack:0,kills:0};players.set(id,p);
ws.send(JSON.stringify({type:'init',id,world,animals,players:[...players.values()].map(pub),mobs}));broadcast({type:'players',players:[...players.values()].map(pub)});
ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return};
if(m.type==='join')p.name=String(m.name||'Joueur').replace(/[^\p{L}\p{N}_ -]/gu,'').slice(0,16)||'Joueur';
if(m.type==='move'&&!p.dead){let turn=Number(m.turn)||0,forward=Number(m.forward)||0;let turnSpeed=.075;p.rot+=clamp(turn,-1,1)*turnSpeed;let speed=(.10+Math.min(p.level,20)*.002)*clamp(Math.abs(forward),0,1);p.x=clamp(p.x+Math.sin(p.rot)*speed*Math.sign(forward),-WORLD/2+2,WORLD/2-2);p.z=clamp(p.z+Math.cos(p.rot)*speed*Math.sign(forward),-WORLD/2+2,WORLD/2-2)}
if(m.type==='attack'&&!p.dead&&Date.now()-p.lastAttack>=550&&Date.now()>=p.protectedUntil){p.lastAttack=Date.now();let reach=3+animals[p.level-1][4]*.5,damage=animals[p.level-1][3];
for(const o of players.values())if(o.id!==p.id&&!o.dead&&Date.now()>=o.protectedUntil&&dist(p,o)<=reach)hurtPlayer(o,damage,p);
for(const mm of mobs)if(mm.hp>0&&dist(p,mm)<=reach){mm.hp-=damage;broadcast({type:'damageMob',id:mm.id,amount:Math.round(damage),x:mm.x,z:mm.z});if(mm.hp<=0){gainXp(p,Math.max(1,Math.floor(mm.level*8)));let z=zone(mm.level);mm.x=rand(z[0],z[1]);mm.z=rand(-WORLD/2,WORLD/2);mm.hp=mm.maxHp}}}
if(m.type==='respawn'&&p.dead)respawn(p);
});
ws.on('close',()=>{players.delete(id);broadcast({type:'players',players:[...players.values()].map(pub)})})});
setInterval(()=>{let now=Date.now();for(const m of mobs){if(m.hp<=0)continue;if(m.harmless){m.wander+=(Math.random()-.5)*.12;m.x+=Math.sin(m.wander)*.012;m.z+=Math.cos(m.wander)*.012;continue}let t=null,best=16;for(const p of players.values()){if(p.dead||now<p.protectedUntil)continue;let d=dist(m,p);if(d<best){best=d;t=p}}if(t){if(best>2.5){let dx=(t.x-m.x)/best,dz=(t.z-m.z)/best,sp=.018+Math.min(m.level,20)*.0018;m.x+=dx*sp;m.z+=dz*sp;m.rot=Math.atan2(dx,dz)}else if(now-m.lastAttack>900){m.lastAttack=now;hurtPlayer(t,animals[m.level-1][3]*.35,null)}}else{m.wander+=(Math.random()-.5)*.08;m.x+=Math.sin(m.wander)*.01;m.z+=Math.cos(m.wander)*.01}}
for(let l=1;l<=20;l++){let alive=mobs.filter(m=>m.level===l&&m.hp>0).length,w=l<=2?9:l<=5?7:4;for(let i=alive;i<w;i++)mobs.push(mob(l,l<=2))}
broadcast({type:'state',players:[...players.values()].map(pub),mobs:mobs.map(m=>({id:m.id,level:m.level,x:m.x,z:m.z,rot:m.rot,hp:m.hp,maxHp:m.maxHp,harmless:m.harmless}))})},66);
server.listen(PORT,()=>console.log('Evolution Arena listening on '+PORT));
