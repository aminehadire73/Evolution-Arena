from pathlib import Path
p=Path('/mnt/data/v14work/server.js')
s=p.read_text()
# add pickups after players maps
s=s.replace("const players=new Map(),mobs=[]; let nextMob=1;", "const players=new Map(),mobs=[]; let nextMob=1;\nconst plants=[],boosts=[]; let nextPickup=1;\nfunction pickupSpawn(){\n  const a=Math.random()*Math.PI*2,r=18+Math.random()*105;\n  return {x:Math.cos(a)*r,z:Math.sin(a)*r};\n}\nfor(let i=0;i<28;i++){const q=pickupSpawn();plants.push({id:'pl'+nextPickup++,x:q.x,z:q.z,type:i%3===0?'berry':'leaf'});}\nfor(let i=0;i<10;i++){const q=pickupSpawn();boosts.push({id:'bo'+nextPickup++,x:q.x,z:q.z,type:['speed','power','shield'][i%3]});}")
# pub add buffs
s=s.replace("stamina:p.stamina,maxStamina:p.maxStamina}", "stamina:p.stamina,maxStamina:p.maxStamina,speedBoost:Date.now()<p.speedBoostUntil,powerBoost:Date.now()<p.powerBoostUntil,shield:Date.now()<p.shieldUntil}")
# spawn respawn reset buffs
s=s.replace("p.stamina=p.maxStamina;p.lastKiller=null}", "p.stamina=p.maxStamina;p.lastKiller=null;p.speedBoostUntil=0;p.powerBoostUntil=0;p.shieldUntil=0}")
# damage shield/power
s=s.replace("if(p.dead||Date.now()<p.protectedUntil)return;p.hp-=dmg;", "if(p.dead||Date.now()<p.protectedUntil)return;if(Date.now()<p.shieldUntil)dmg*=.35;p.hp-=dmg;")
# Add pickup helper before hurtPlayer
needle="function hurtPlayer(p,dmg,killer){"
helper="""function pickupFor(p){\n  for(let i=plants.length-1;i>=0;i--){const q=plants[i];if(dist(p,q)<=2.1 && p.level<=5){plants.splice(i,1);p.hp=Math.min(p.maxHp,p.hp+8);gainXp(p,4);break}}\n  for(let i=boosts.length-1;i>=0;i--){const q=boosts[i];if(dist(p,q)<=2.3){boosts.splice(i,1);const until=Date.now()+8000;if(q.type==='speed')p.speedBoostUntil=until;if(q.type==='power')p.powerBoostUntil=until;if(q.type==='shield')p.shieldUntil=until;break}}\n}\n\n"""
s=s.replace(needle,helper+needle)
# Init player fields API and WS
s=s.replace("stamina:100,maxStamina:100,api:true", "stamina:100,maxStamina:100,speedBoostUntil:0,powerBoostUntil:0,shieldUntil:0,api:true")
s=s.replace("stamina:100,maxStamina:100};", "stamina:100,maxStamina:100,speedBoostUntil:0,powerBoostUntil:0,shieldUntil:0};")
# state responses include pickups
s=s.replace("state:{type:'state',players:active().map(pub),mobs:mobs.map(m=>({id:m.id,level:m.level,x:m.x,z:m.z,rot:m.rot,hp:m.hp,maxHp:m.maxHp,harmless:m.harmless}))}", "state:{type:'state',players:active().map(pub),mobs:mobs.map(m=>({id:m.id,level:m.level,x:m.x,z:m.z,rot:m.rot,hp:m.hp,maxHp:m.maxHp,harmless:m.harmless})),plants,boosts}")
s=s.replace("res.json({type:'state',players:active().map(pub),mobs:mobs.map(m=>({id:m.id,level:m.level,x:m.x,z:m.z,rot:m.rot,hp:m.hp,maxHp:m.maxHp,harmless:m.harmless}))});", "res.json({type:'state',players:active().map(pub),mobs:mobs.map(m=>({id:m.id,level:m.level,x:m.x,z:m.z,rot:m.rot,hp:m.hp,maxHp:m.maxHp,harmless:m.harmless})),plants,boosts});")
# init ws add pickups
s=s.replace("mobs}));", "mobs,plants,boosts}));")
# join send players remains
# move: change turn sign? User asks client inverse Q/D, so server generic.
# sprint multiplier with buff
s=s.replace("let speed=(.10+Math.min(p.level,20)*.002)*(sprint?1.72:1)*clamp", "pickupFor(p);let speed=(.10+Math.min(p.level,20)*.002)*(sprint?1.72:1)*(Date.now()<p.speedBoostUntil?1.5:1)*clamp")
# attack power boost
s=s.replace("let reach=3+animals[p.level-1][4]*.5,damage=animals[p.level-1][3];", "let reach=3+animals[p.level-1][4]*.5,damage=animals[p.level-1][3]*(Date.now()<p.powerBoostUntil?1.75:1);")
# attack mob XP replenish pickup maybe
# state broadcast add pickups
s=s.replace("mobs:mobs.map(m=>({id:m.id,level:m.level,x:m.x,z:m.z,rot:m.rot,hp:m.hp,maxHp:m.maxHp,harmless:m.harmless}))});", "mobs:mobs.map(m=>({id:m.id,level:m.level,x:m.x,z:m.z,rot:m.rot,hp:m.hp,maxHp:m.maxHp,harmless:m.harmless})),plants,boosts});")
# replenish pickups in interval before broadcast
needle="for(let l=1;l<=20;l++){let alive=mobs.filter(m=>m.level===l&&m.hp>0).length,w=l<=5?3:l<=10?2:1;for(let i=alive;i<w;i++)mobs.push(mob(l,l<=2))}\n"
rep=needle+"\n if(plants.length<28&&Math.random()<.08){const q=pickupSpawn();plants.push({id:'pl'+nextPickup++,x:q.x,z:q.z,type:Math.random()<.35?'berry':'leaf'})}\n if(boosts.length<10&&Math.random()<.025){const q=pickupSpawn();boosts.push({id:'bo'+nextPickup++,x:q.x,z:q.z,type:['speed','power','shield'][Math.floor(Math.random()*3)]})}\n"
s=s.replace(needle,rep)
p.write_text(s)
