const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const WORLD = 260;
const MAX_PLAYERS = 20;

const animals = [
  ["Ver de terre", 1, 35, 4, 1.00],
  ["Fourmi", 2, 45, 5, 1.10],
  ["Scarabée", 3, 58, 6, 1.20],
  ["Souris", 4, 70, 7, 1.30],
  ["Lapin", 5, 85, 8, 1.45],
  ["Hérisson", 6, 105, 10, 1.60],
  ["Renard", 7, 125, 12, 1.80],
  ["Sanglier", 8, 150, 14, 2.00],
  ["Cerf", 9, 175, 16, 2.20],
  ["Loup", 10, 205, 18, 2.45],
  ["Hyène", 11, 240, 20, 2.70],
  ["Léopard", 12, 280, 23, 2.95],
  ["Lion", 13, 330, 26, 3.25],
  ["Tigre", 14, 385, 30, 3.55],
  ["Ours", 15, 445, 34, 3.90],
  ["Gorille", 16, 510, 38, 4.25],
  ["Buffle", 17, 580, 43, 4.65],
  ["Hippopotame", 18, 660, 48, 5.05],
  ["Rhinocéros", 19, 750, 54, 5.50],
  ["Éléphant", 20, 850, 60, 6.00]
];

const mobs = [];
let nextMobId = 1;

function rand(a,b){ return a + Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function dist(a,b){ return Math.hypot(a.x-b.x,a.z-b.z); }

function zoneForLevel(level){
  if(level <= 2) return {min:-115,max:-65};
  if(level <= 5) return {min:-80,max:-25};
  if(level <= 8) return {min:-40,max:15};
  if(level <= 11) return {min:0,max:55};
  if(level <= 14) return {min:35,max:90};
  if(level <= 17) return {min:70,max:120};
  return {min:100,max:125};
}

function createMob(level, harmless=false){
  const z = zoneForLevel(level);
  const m = {
    id: "m"+(nextMobId++),
    level,
    x: rand(z.min,z.max),
    z: rand(-WORLD/2,WORLD/2),
    hp: animals[level-1][2],
    maxHp: animals[level-1][2],
    harmless: !!harmless,
    target: null,
    lastAttack: 0,
    wander: Math.random()*Math.PI*2
  };
  return m;
}

function desiredMobCount(level){
  return level <= 2 ? 8 : 5;
}

// Populate several level bands so the world feels like a progression.
for(let level=1; level<=20; level++){
  const count = level <= 2 ? 9 : (level <= 5 ? 7 : 4);
  for(let i=0;i<count;i++) mobs.push(createMob(level, level<=2));
}

const players = new Map();

function safeSpawn(){
  return {x: rand(-12,12), z: rand(-12,12)};
}

function publicPlayer(p){
  return {
    id:p.id, name:p.name, x:p.x, z:p.z, rot:p.rot,
    level:p.level, xp:p.xp, hp:p.hp, maxHp:p.maxHp,
    animal:animals[p.level-1][0], power:animals[p.level-1][3],
    spawnProtected: Date.now() < p.protectedUntil
  };
}

function broadcast(obj){
  const msg = JSON.stringify(obj);
  for(const p of players.values()){
    if(p.ws.readyState === WebSocket.OPEN) p.ws.send(msg);
  }
}

function gainXp(p, amount){
  p.xp += amount;
  while(p.level < animals.length && p.xp >= animals[p.level-1][2]){
    p.xp -= animals[p.level-1][2];
    p.level++;
    p.maxHp = animals[p.level-1][2];
    p.hp = p.maxHp;
  }
}

function resetPlayer(p){
  const s=safeSpawn();
  p.x=s.x; p.z=s.z; p.level=1; p.xp=0;
  p.maxHp=animals[0][2]; p.hp=p.maxHp;
  p.protectedUntil=Date.now()+5000;
  p.kills=0;
}

function damagePlayer(p, dmg){
  if(Date.now() < p.protectedUntil) return;
  p.hp -= dmg;
  if(p.hp <= 0){
    const killer = p.lastHitBy && players.get(p.lastHitBy);
    if(killer) killer.kills++;
    resetPlayer(p);
  }
}

wss.on("connection",(ws)=>{
  if(players.size >= MAX_PLAYERS){
    ws.send(JSON.stringify({type:"full"}));
    ws.close();
    return;
  }

  const id = Math.random().toString(36).slice(2,10);
  const s=safeSpawn();
  const p={
    id, ws, name:"Joueur", x:s.x,z:s.z,rot:0,
    level:1,xp:0,hp:animals[0][2],maxHp:animals[0][2],
    protectedUntil:Date.now()+5000,lastAttack:0,kills:0,lastHitBy:null
  };
  players.set(id,p);

  ws.send(JSON.stringify({
    type:"init", id, world:WORLD, animals,
    players:[...players.values()].map(publicPlayer),
    mobs
  }));

  broadcast({type:"players", players:[...players.values()].map(publicPlayer)});

  ws.on("message",(raw)=>{
    let msg;
    try{ msg=JSON.parse(raw.toString()); }catch{return;}

    if(msg.type==="join"){
      p.name=String(msg.name||"Joueur").replace(/[^\p{L}\p{N}_ -]/gu,"").slice(0,16) || "Joueur";
      broadcast({type:"players", players:[...players.values()].map(publicPlayer)});
    }

    if(msg.type==="input"){
      const dx=clamp(Number(msg.dx)||0,-1,1);
      const dz=clamp(Number(msg.dz)||0,-1,1);
      const len=Math.hypot(dx,dz)||1;
      const speed=0.14 + Math.min(p.level,20)*0.002;
      p.x=clamp(p.x+(dx/len)*speed,-WORLD/2+2,WORLD/2-2);
      p.z=clamp(p.z+(dz/len)*speed,-WORLD/2+2,WORLD/2-2);
      p.rot=Number(msg.rot)||p.rot;
    }

    if(msg.type==="attack"){
      const now=Date.now();
      if(now-p.lastAttack < 550) return;
      p.lastAttack=now;
      if(Date.now() < p.protectedUntil) return;

      const reach=3.2 + animals[p.level-1][4]*0.18;
      const damage=animals[p.level-1][3];

      for(const other of players.values()){
        if(other.id===p.id || Date.now()<other.protectedUntil) continue;
        if(dist(p,other)<=reach){
          other.lastHitBy=p.id;
          damagePlayer(other,damage);
        }
      }

      for(const m of mobs){
        if(m.hp<=0) continue;
        if(dist(p,m)<=reach){
          m.hp-=damage;
          m.target=p.id;
          if(m.hp<=0){
            gainXp(p, Math.max(1, Math.floor(m.level*8)));
            m.hp=m.maxHp;
            const z=zoneForLevel(m.level);
            m.x=rand(z.min,z.max); m.z=rand(-WORLD/2,WORLD/2);
          }
        }
      }
    }
  });

  ws.on("close",()=>{
    players.delete(id);
    broadcast({type:"players", players:[...players.values()].map(publicPlayer)});
  });
});

setInterval(()=>{
  const now=Date.now();

  // Simple server-side mob AI: chase the nearest nearby player if it is not harmless.
  for(const m of mobs){
    if(m.hp<=0) continue;
    if(m.harmless){
      m.wander += (Math.random()-.5)*0.25;
      m.x += Math.cos(m.wander)*0.018;
      m.z += Math.sin(m.wander)*0.018;
      continue;
    }

    let target=null, best=999;
    for(const p of players.values()){
      if(now < p.protectedUntil) continue;
      const d=dist(m,p);
      // Mobs mainly stay around their own progression area.
      if(d<best && d<16){best=d;target=p;}
    }
    if(target){
      if(best>2.5){
        const dx=(target.x-m.x)/(best||1), dz=(target.z-m.z)/(best||1);
        const speed=0.025+Math.min(m.level,20)*0.0018;
        m.x += dx*speed; m.z += dz*speed;
      }else if(now-m.lastAttack>900){
        m.lastAttack=now;
        const dmg=animals[m.level-1][3]*0.35;
        target.lastHitBy=null;
        damagePlayer(target,dmg);
      }
    }else{
      m.wander += (Math.random()-.5)*0.12;
      m.x += Math.cos(m.wander)*0.012;
      m.z += Math.sin(m.wander)*0.012;
    }
  }

  // Keep mob populations alive.
  for(let level=1; level<=20; level++){
    const alive=mobs.filter(m=>m.level===level && m.hp>0).length;
    const wanted=level<=2?9:(level<=5?7:4);
    for(let i=alive;i<wanted;i++) mobs.push(createMob(level,level<=2));
  }

  broadcast({
    type:"state",
    players:[...players.values()].map(publicPlayer),
    mobs:mobs.map(m=>({id:m.id,level:m.level,x:m.x,z:m.z,hp:m.hp,maxHp:m.maxHp,harmless:m.harmless}))
  });
}, 1000/15);

server.listen(PORT,()=>console.log(`Evolution Arena: http://localhost:${PORT}`));
