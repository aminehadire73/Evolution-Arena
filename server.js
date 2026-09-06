const express=require('express');
const http=require('http');
const WebSocket=require('ws');
const app=express();
const server=http.createServer(app);
const wss=new WebSocket.Server({server});
app.use(express.json());
app.use(express.static('public'));
const PORT=process.env.PORT||3000;
const WORLD={w:2400,h:1600};
const MAX_PLAYERS=20;
const animals=[
['Ver de terre',1,35,4,18],['Fourmi',2,45,5,20],['Scarabée',3,58,6,22],['Souris',4,70,7,24],['Lapin',5,85,8,26],['Hérisson',6,105,10,28],['Renard',7,125,12,30],['Sanglier',8,150,14,33],['Cerf',9,175,16,35],['Loup',10,205,18,37],['Hyène',11,240,20,39],['Léopard',12,280,23,41],['Lion',13,330,26,43],['Tigre',14,385,30,45],['Ours',15,445,34,47],['Gorille',16,510,38,49],['Buffle',17,580,43,51],['Hippopotame',18,660,48,53],['Rhinocéros',19,750,54,55],['Éléphant',20,850,60,57]
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
const BOOSTS=[['speed','TURBO'],['damage','DÉGÂTS x2'],['shield','BOUCLIER'],['heal','RÉGÉNÉRATION']];
const players=new Map(),tokens=new Map(),mobs=[],boosts=[],plants=[];
let mobId=1,boostId=1,plantId=1;
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function safeSpawn(){return{x:WORLD.w/2+rand(-100,100),y:WORLD.h/2+rand(-100,100),angle:rand(-Math.PI,Math.PI)}}
function pub(p){return{id:p.id,name:p.name,x:p.x,y:p.y,angle:p.angle,inLobby:p.inLobby,dead:p.dead,level:p.level,xp:p.xp,hp:p.hp,maxHp:p.maxHp,animal:animals[p.level-1][0],power:animals[p.level-1][3],kills:p.kills,coins:p.coins,owned:p.owned,equipped:p.equipped,stamina:p.stamina,maxStamina:p.maxStamina,boost:p.boost||null}}
function active(){return [...players.values()].filter(p=>!p.inLobby)}
function send(p,msg){if(p?.ws?.readyState===WebSocket.OPEN)p.ws.send(JSON.stringify(msg))}
function broadcast(msg){const s=JSON.stringify(msg);for(const p of active())if(p.ws.readyState===WebSocket.OPEN)p.ws.send(s)}
function xpNeed(p){return animals[p.level-1][2]}
function gainXp(p,n){p.xp+=n;while(p.level<20&&p.xp>=xpNeed(p)){p.xp-=xpNeed(p);p.level++;p.maxHp=animals[p.level-1][2];p.hp=p.maxHp}}
function die(p,killer){p.dead=true;p.hp=0;p.lastKiller=killer?.id||null}
function respawn(p){const s=safeSpawn();Object.assign(p,s,{level:1,xp:0,maxHp:35,hp:35,dead:false,inLobby:false,protectedUntil:Date.now()+5000,stamina:100,boost:null})}
function hurt(p,dmg,killer){if(p.dead||p.inLobby||Date.now()<p.protectedUntil)return;if(p.boost?.type==='shield')dmg*=.45;p.hp-=dmg;broadcast({type:'damage',target:p.id,amount:Math.round(dmg)});if(p.hp<=0){if(killer){killer.kills++;killer.coins+=10;send(killer,{type:'reward',coins:10,kills:killer.kills})}die(p,killer)}}
function makeMob(level){return{id:'m'+mobId++,level,x:rand(100,WORLD.w-100),y:rand(100,WORLD.h-100),angle:rand(-Math.PI,Math.PI),hp:animals[level-1][2],maxHp:animals[level-1][2],wander:rand(0,Math.PI*2),lastAttack:0,harmless:level<=2}}
// 14 mobs maximum, deliberately sparse.
for(let i=0;i<14;i++){const lvl=i<4?1:i<6?2:i<8?3:i<10?4:i<11?5:i<12?6:7+Math.floor(Math.random()*4);mobs.push(makeMob(Math.min(lvl,10)))}
function makeBoost(){const type=BOOSTS[Math.floor(Math.random()*BOOSTS.length)];boosts.push({id:'b'+boostId++,type:type[0],name:type[1],x:rand(120,WORLD.w-120),y:rand(120,WORLD.h-120)})}
for(let i=0;i<7;i++)makeBoost();
function makePlant(){plants.push({id:'p'+plantId++,x:rand(130,WORLD.w-130),y:rand(130,WORLD.h-130),kind:Math.random()<.5?'berry':'leaf'})}
for(let i=0;i<28;i++)makePlant();
const waterfall={x:WORLD.w*.72,y:WORLD.h*.30,w:180,h:210};
const river={x:WORLD.w*.48,w:150};
function inWaterfall(x,y){return x>waterfall.x-waterfall.w/2&&x<waterfall.x+waterfall.w/2&&y>waterfall.y-waterfall.h/2&&y<waterfall.y+waterfall.h/2}
function clampWorld(p){p.x=clamp(p.x,35,WORLD.w-35);p.y=clamp(p.y,35,WORLD.h-35);if(inWaterfall(p.x,p.y)){const left=waterfall.x-waterfall.w/2-35,right=waterfall.x+waterfall.w/2+35; if(Math.abs(p.x-left)<Math.abs(p.x-right))p.x=left;else p.x=right;}}
function state(){return{type:'state',players:active().map(pub),mobs:mobs.map(m=>({id:m.id,level:m.level,x:m.x,y:m.y,angle:m.angle,hp:m.hp,maxHp:m.maxHp,harmless:m.harmless})),boosts,plants,world:WORLD,river,waterfall}}
function handle(p,m){
 if(m.type==='join'){p.name=String(m.name||'Joueur').replace(/[^\p{L}\p{N}_ -]/gu,'').slice(0,16)||'Joueur';p.inLobby=false;p.dead=false;p.protectedUntil=Date.now()+5000;const s=safeSpawn();p.x=s.x;p.y=s.y;p.angle=s.angle;p.stamina=p.maxStamina;p.boost=null;send(p,{type:'joined',player:pub(p)});broadcast(state());return}
 if(m.type==='lobby'){p.inLobby=true;p.dead=false;p.boost=null;send(p,{type:'lobby',player:pub(p)});broadcast(state());return}
 if(m.type==='respawn'&&p.dead){respawn(p);send(p,{type:'joined',player:pub(p)});broadcast(state());return}
 if(m.type==='move'&&!p.dead&&!p.inLobby){const forward=clamp(Number(m.forward)||0,-1,1),turn=clamp(Number(m.turn)||0,-1,1);p.angle+=turn*.095;const sprint=!!m.sprint&&forward>0&&p.stamina>0;if(sprint)p.stamina=Math.max(0,p.stamina-.9);else p.stamina=Math.min(p.maxStamina,p.stamina+.6);let speed=animals[p.level-1][4]*.075*(sprint?1.65:1)*(p.boost?.type==='speed'?1.45:1);p.x+=Math.sin(p.angle)*speed*forward;p.y+=Math.cos(p.angle)*speed*forward;clampWorld(p);for(let i=boosts.length-1;i>=0;i--){if(dist(p,boosts[i])<30){const b=boosts[i];p.boost={type:b.type,name:b.name,until:Date.now()+9000};if(b.type==='heal')p.hp=p.maxHp;boosts.splice(i,1)}}for(let i=plants.length-1;i>=0;i--){if(dist(p,plants[i])<28&&p.level<=6){p.hp=Math.min(p.maxHp,p.hp+7);gainXp(p,3);plants.splice(i,1)}}return}
 if(m.type==='attack'&&!p.dead&&!p.inLobby&&Date.now()-p.lastAttack>500&&Date.now()>p.protectedUntil){p.lastAttack=Date.now();let reach=75+animals[p.level-1][4],damage=animals[p.level-1][3]*(p.boost?.type==='damage'?2:1);for(const o of active()){if(o.id!==p.id&&dist(p,o)<reach)hurt(o,damage,p)}for(const mob of mobs){if(mob.hp>0&&dist(p,mob)<reach){mob.hp-=damage;broadcast({type:'damageMob',id:mob.id,amount:Math.round(damage)});if(mob.hp<=0){gainXp(p,Math.max(1,mob.level*5));const replacement=makeMob(Math.min(10,mob.level));Object.assign(mob,replacement,{id:mob.id});}}}return}
 if(m.type==='buy'){const c=cosmetics.find(x=>x.id===m.id);if(c&&!p.owned.includes(c.id)&&p.coins>=c.cost){p.coins-=c.cost;p.owned.push(c.id);send(p,{type:'shop',player:pub(p)})}return}
 if(m.type==='equip'&&(!m.id||p.owned.includes(m.id))){p.equipped=m.id||null;send(p,{type:'shop',player:pub(p)});return}
}
app.get('/api/health',(req,res)=>res.json({ok:true,service:'Evolution Arena 2D'}));
app.get('/api/info',(req,res)=>res.json({ok:true,world:WORLD,animals,cosmetics}));
wss.on('connection',ws=>{
 if(players.size>=MAX_PLAYERS){ws.send(JSON.stringify({type:'full'}));ws.close();return}
 const id=Math.random().toString(36).slice(2,10),s=safeSpawn();
 const p={id,ws,name:'Joueur',...s,inLobby:true,dead:false,level:1,xp:0,maxHp:35,hp:35,protectedUntil:Date.now()+3000,lastAttack:0,kills:0,coins:0,owned:[],equipped:null,stamina:100,maxStamina:100,boost:null};players.set(id,p);
 send(p,{type:'init',id,world:WORLD,animals,cosmetics,players:active().map(pub),mobs,boosts,plants,river,waterfall});
 ws.on('message',raw=>{try{handle(p,JSON.parse(raw))}catch(e){}});
 ws.on('close',()=>{players.delete(id);broadcast(state())});
});
setInterval(()=>{
 const now=Date.now();
 for(const p of players.values())if(!p.inLobby&&!p.dead)p.stamina=Math.min(p.maxStamina,p.stamina+.45);
 for(const m of mobs){if(m.hp<=0)continue;let target=null,best=480;for(const p of active()){if(p.dead||now<p.protectedUntil)continue;const d=dist(m,p);if(d<best){best=d;target=p}}if(target){if(best>70){const dx=(target.x-m.x)/best,dy=(target.y-m.y)/best,sp=.55+.03*Math.min(m.level,10);m.x+=dx*sp;m.y+=dy*sp;m.angle=Math.atan2(dx,dy)}else if(now-m.lastAttack>950){m.lastAttack=now;hurt(target,animals[m.level-1][3]*.32,m)}}else{m.wander+=(Math.random()-.5)*.15;m.x+=Math.sin(m.wander)*.25;m.y+=Math.cos(m.wander)*.25}m.x=clamp(m.x,50,WORLD.w-50);m.y=clamp(m.y,50,WORLD.h-50);if(inWaterfall(m.x,m.y))m.x=waterfall.x-waterfall.w/2-20}
 if(boosts.length<7&&Math.random()<.03)makeBoost();
 if(plants.length<28&&Math.random()<.05)makePlant();
 for(const p of players.values())if(p.boost&&p.boost.until<=now)p.boost=null;
 broadcast(state());
},100);
server.listen(PORT,'0.0.0.0',()=>console.log('Evolution Arena 2D listening on '+PORT));
