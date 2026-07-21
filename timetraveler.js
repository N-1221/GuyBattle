// ============================================================
// Time Traveler Guy（タイムトラベラーガイ）のロジック（時間ループシミュレーション含む）
// ============================================================

function runTimeLoopSimulation(id1, id2) {
  const SIM_W = 500, SIM_H = 500;
  const enemyId = (id1 === 'timetraveler') ? id2 : id1;

  // シミュレーション用キャラ生成（実際のロジックに準拠）
  function makeSimChar(type, side) {
    const spd = 2.7;
    const a = Math.random() * Math.PI * 2;
    return {
      x: side === 'ttg' ? 120 : 380,
      y: 250,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      baseSpd: spd,
      r: 55, hp: 1000, maxHp: 1000,
      hitTimer: 0, hitstop: 0, knockback: 0,
      trail: [],
      type,
      // Boxing
      punchCooldown: 0, upperCooldown: 0, punchAnimTimer: 0, upperAnimTimer: 0, dodgeAnimTimer: 0, dodgeCooldown: 0,
      // Darts
      dartCooldown: 0, burstCount: 0, burstInterval: 0,
      // Tennis
      smashCooldown: 0, racketAngle: 0, swingTimer: 0, swingBaseAngle: 0,
      // PingPong
      ballFired: false, ballCooldown: 0,
      // TTG
      airCooldown: Math.floor(Math.random() * 60),
      // Landmine
      wallStopTimer: 0,
      // Gunman
      gunCooldown: 0, overheatCooldown: 0, aimDir: 1,
      // Twins
      sausageCooldown: 0, throwTimer: 0,
      // Ghost
      ghostDamageCooldown: 0,
    };
  }

  // シミュレーション用物理演算
  function simMove(c, simLandmines) {
    if (c.hitstop > 0) { c.hitstop--; return; }
    // 地雷ガイ：壁に激突した直後は数秒間その場から動けない
    if (c.type === 'landmine' && c.wallStopTimer > 0) {
      c.wallStopTimer--;
      if (c.hitTimer > 0) c.hitTimer--;
      return;
    }
    c.x += c.vx; c.y += c.vy;
    let hitWall = false, wallSide = null;
    if (c.x - c.r < 0)  { c.x = c.r;         c.vx =  Math.abs(c.vx); hitWall = true; wallSide = 'left'; }
    if (c.x + c.r > SIM_W) { c.x = SIM_W-c.r; c.vx = -Math.abs(c.vx); hitWall = true; wallSide = 'right'; }
    if (c.y - c.r < 0)  { c.y = c.r;         c.vy =  Math.abs(c.vy); hitWall = true; wallSide = 'top'; }
    if (c.y + c.r > SIM_H) { c.y = SIM_H-c.r; c.vy = -Math.abs(c.vy); hitWall = true; wallSide = 'bottom'; }
    // 地雷ガイ：壁に触れたらその場で停止し、壁際に地雷を設置
    if (c.type === 'landmine' && hitWall && c.hp > 0 && simLandmines) {
      c.wallStopTimer = LANDMINE_STOP_TIME;
      simPlantLandmine(c, wallSide, simLandmines);
    }
    if (c.hitTimer > 0) c.hitTimer--;
    if (c.knockback > 0) {
      c.knockback--;
      const spd = Math.hypot(c.vx, c.vy);
      const tgt = c.baseSpd + (spd - c.baseSpd) * 0.85;
      if (spd > 0) { c.vx = (c.vx/spd)*tgt; c.vy = (c.vy/spd)*tgt; }
    } else {
      const spd = Math.hypot(c.vx, c.vy);
      if (spd > 0) { c.vx = (c.vx/spd)*c.baseSpd; c.vy = (c.vy/spd)*c.baseSpd; }
    }
  }

  function simResolve(a, b) {
    // ゴーストガイ：本物同様、誰とぶつかっても弾かれず貫通する（ダメージはsimUpdateGhostで別途処理）
    if (a.type === 'ghost' || b.type === 'ghost') return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const minD = a.r + b.r;
    if (dist >= minD) return;
    const nx = dx/dist, ny = dy/dist;
    const overlap = (minD-dist)/2;
    a.x -= nx*overlap; a.y -= ny*overlap;
    b.x += nx*overlap; b.y += ny*overlap;
    const dvx = b.vx-a.vx, dvy = b.vy-a.vy;
    const dot = dvx*nx + dvy*ny;
    if (dot < 0) { a.vx += dot*nx; a.vy += dot*ny; b.vx -= dot*nx; b.vy -= dot*ny; }
  }

  // Boxing攻撃シミュレーション
  function simBoxing(attacker, defender) {
    if (attacker.hp <= 0 || defender.hp <= 0) return;
    if (attacker.upperCooldown > 0) attacker.upperCooldown--;
    if (attacker.punchCooldown > 0) { attacker.punchCooldown--; return; }
    const dx = defender.x - attacker.x, dy = defender.y - attacker.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= attacker.r + defender.r + 5) return;
    const absDxS = Math.abs(dx), absDyS = Math.abs(dy);
    const isTooStraightDownS = absDyS > absDxS * 3;
    const isUpperAngle = attacker.y > defender.y && attacker.upperCooldown === 0 && !isTooStraightDownS;
    if (defender.dodgeCooldown === 0 && Math.random() < 0.18) {
      defender.dodgeAnimTimer = 18;
      defender.dodgeCooldown = 60;
      attacker.punchCooldown = isUpperAngle ? 10 : 6;
      const ndx = dx / (dist || 1), ndy = dy / (dist || 1);
      defender.vx = -ndx * 6;
      defender.vy = -ndy * 6;
      defender.knockback = 16;
      return;
    }
    if (isUpperAngle) {
      defender.hp = Math.max(0, defender.hp - 120);
      defender.hitTimer = 15; attacker.upperCooldown = 120; attacker.punchCooldown = 20;
      attacker.punchAnimTimer = 20; attacker.upperAnimTimer = 20;
      defender.vx = dx/(dist||1)*2; defender.vy = -10; defender.knockback = 45; defender.hitstop = 8;
    } else {
      defender.hp = Math.max(0, defender.hp - 50);
      defender.hitTimer = 10; attacker.punchCooldown = 10;
    }
  }

  // Tennis攻撃シミュレーション
  function simTennis(attacker, defender, simDarts, simPingBalls) {
    if (attacker.hp <= 0) return;
    if (attacker.smashCooldown > 0) { attacker.smashCooldown--; return; }
    // ダーツ打ち返し
    for (const d of simDarts) {
      if (d.stuck || d.owner === attacker) continue;
      if (Math.hypot(attacker.x - d.x, attacker.y - d.y) < attacker.r + 40) {
        const tx = defender.x-d.x, ty = defender.y-d.y;
        const td = Math.hypot(tx,ty)||1;
        d.vx = (tx/td)*7; d.vy = (ty/td)*7; d.owner = attacker;
        attacker.smashCooldown = 115; return;
      }
    }
    // ピンポン打ち返し
    for (const b of simPingBalls) {
      if (b.owner === attacker) continue;
      if (Math.hypot(attacker.x - b.x, attacker.y - b.y) < attacker.r + b.r + 40) {
        const tx = defender.x-b.x, ty = defender.y-b.y;
        const td = Math.hypot(tx,ty)||1;
        const spd = Math.max(Math.hypot(b.vx,b.vy),10)*1.5;
        b.vx = (tx/td)*spd; b.vy = (ty/td)*spd;
        b.x = attacker.x+(tx/td)*(attacker.r+b.r);
        b.y = attacker.y+(ty/td)*(attacker.r+b.r);
        b.owner = attacker; attacker.smashCooldown = 115; return;
      }
    }
    // 直接打撃
    const dist = Math.hypot(defender.x-attacker.x, defender.y-attacker.y);
    if (defender.hp > 0 && dist < attacker.r + defender.r + 40) {
      const dmg = 50;
      defender.hp = Math.max(0, defender.hp - dmg);
      defender.hitTimer = 10; attacker.smashCooldown = 115;
      const ax = defender.x-attacker.x, ay = defender.y-attacker.y;
      const dAB = Math.hypot(ax,ay)||1;
      defender.vx = (ax/dAB)*defender.baseSpd*4;
      defender.vy = (ay/dAB)*defender.baseSpd*4;
      defender.knockback = 30;
    }
  }

  // Darts攻撃シミュレーション
  function simDartsShoot(attacker, simDarts, simTarget) {
    if (attacker.hp <= 0) return;
    if (attacker.dartCooldown > 0) { attacker.dartCooldown--; return; }
    attacker.burstCount = 3; attacker.burstInterval = 0; attacker.dartCooldown = 115;
  }
  function simDartsBurst(attacker, simDarts, simTarget) {
    if (!attacker.burstCount || attacker.burstCount <= 0) return;
    if (attacker.burstInterval > 0) { attacker.burstInterval--; return; }
    if (!simTarget) return;
    const spd = 8.0;
    const dx = simTarget.x - attacker.x, dy = simTarget.y - attacker.y;
    const d = Math.hypot(dx,dy)||1;
    simDarts.push({ x: attacker.x, y: attacker.y, vx: dx/d*spd, vy: dy/d*spd, stuck: false, stuckTimer: 0, owner: attacker });
    attacker.burstCount--; attacker.burstInterval = 3;
  }
  function simUpdateDarts(simDarts, simTarget, ttg, enemy) {
    for (let i = simDarts.length-1; i >= 0; i--) {
      const d = simDarts[i];
      if (d.stuck) { if (--d.stuckTimer <= 0) simDarts.splice(i,1); continue; }
      d.x += d.vx; d.y += d.vy;
      if (simTarget && Math.hypot(simTarget.x-d.x, simTarget.y-d.y) < simTarget.r+5) { simDarts.splice(i,1); continue; }
      // 壁反射なし→画面外は消滅
      if (d.x < 0 || d.x > SIM_W || d.y < 0 || d.y > SIM_H) { simDarts.splice(i,1); continue; }
      const tgt = d.owner === ttg ? enemy : ttg;
      if (tgt.hp > 0 && Math.hypot(tgt.x-d.x, tgt.y-d.y) < tgt.r+5) {
        const dmgPool = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,24,25,26,27,28,30,32,33,34,36,38,39,40,42,45,48,
                        50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,51,54,57,60];
        const dmg = dmgPool[Math.floor(Math.random()*dmgPool.length)];
        tgt.hp = Math.max(0, tgt.hp - dmg);
        tgt.hitTimer = 10;
        d.stuck = true; d.stuckTimer = 40;
      }
    }
  }

  // PingPong攻撃シミュレーション
  function simFirePingBall(owner, simPingBalls, enemy) {
    const dx = enemy.x-owner.x, dy = enemy.y-owner.y;
    const d = Math.hypot(dx,dy)||1;
    const spd = 12.0;
    simPingBalls.push({ x: owner.x, y: owner.y, vx: dx/d*spd, vy: dy/d*spd, r: 10, owner, trail: [], hitCooldown: 0, lastHit: null });
  }
  function simUpdatePingBalls(simPingBalls, ttg, enemy, simTarget) {
    for (let i = simPingBalls.length-1; i >= 0; i--) {
      const b = simPingBalls[i];
      if (b.hitCooldown > 0) b.hitCooldown--;
      const spd = Math.hypot(b.vx, b.vy);
      const steps = Math.ceil(spd/6);
      for (let s = 0; s < steps; s++) {
        b.x += b.vx/steps; b.y += b.vy/steps;
        if (b.x-b.r < 0)     { b.x = b.r;       b.vx =  Math.abs(b.vx); }
        if (b.x+b.r > SIM_W) { b.x = SIM_W-b.r; b.vx = -Math.abs(b.vx); }
        if (b.y-b.r < 0)     { b.y = b.r;       b.vy =  Math.abs(b.vy); }
        if (b.y+b.r > SIM_H) { b.y = SIM_H-b.r; b.vy = -Math.abs(b.vy); }
        if (simTarget && Math.hypot(simTarget.x-b.x, simTarget.y-b.y) < simTarget.r+b.r) {
          const nx = (b.x-simTarget.x)/(Math.hypot(b.x-simTarget.x,b.y-simTarget.y)||1);
          const ny = (b.y-simTarget.y)/(Math.hypot(b.x-simTarget.x,b.y-simTarget.y)||1);
          const dot = b.vx*nx+b.vy*ny;
          b.vx -= 2*dot*nx; b.vy -= 2*dot*ny;
          b.x = simTarget.x+nx*(simTarget.r+b.r); b.y = simTarget.y+ny*(simTarget.r+b.r);
          break;
        }
        for (const c of [ttg, enemy]) {
          if (c.hp <= 0) continue;
          if (Math.hypot(c.x-b.x, c.y-b.y) >= c.r+b.r) continue;
          if (b.hitCooldown > 0 && b.lastHit === c) continue;
          const nx = (b.x-c.x)/(Math.hypot(b.x-c.x,b.y-c.y)||1);
          const ny = (b.y-c.y)/(Math.hypot(b.x-c.x,b.y-c.y)||1);
          const dot = b.vx*nx+b.vy*ny;
          b.vx -= 2*dot*nx; b.vy -= 2*dot*ny;
          b.x = c.x+nx*(c.r+b.r); b.y = c.y+ny*(c.r+b.r);
          c.hp = Math.max(0, c.hp-50); c.hitTimer = 10;
          b.lastHit = c; b.hitCooldown = 15; break;
        }
      }
    }
  }

  // Landmineシミュレーション（壁激突→設置→接触で爆発）
  function simPlantLandmine(owner, wallSide, simLandmines) {
    const mineR = 20;
    let mx = owner.x, my = owner.y;
    if (wallSide === 'left')   mx = mineR;
    if (wallSide === 'right')  mx = SIM_W - mineR;
    if (wallSide === 'top')    my = mineR;
    if (wallSide === 'bottom') my = SIM_H - mineR;
    simLandmines.push({ x: mx, y: my, r: mineR, owner, armTimer: 18 });
  }
  function simUpdateLandmines(simLandmines, ttg, enemy) {
    if (simLandmines.length === 0) return;
    const chars = [ttg, enemy];
    for (let i = simLandmines.length - 1; i >= 0; i--) {
      const m = simLandmines[i];
      if (m.armTimer > 0) { m.armTimer--; continue; }
      let exploded = false;
      for (const c of chars) {
        if (c === m.owner || c.hp <= 0) continue;
        const d = Math.hypot(c.x - m.x, c.y - m.y);
        if (d < c.r + m.r) {
          const dmg = 180;
          c.hp = Math.max(0, c.hp - dmg);
          c.hitTimer = 22;
          const dx = c.x - m.x, dy = c.y - m.y;
          const dd = Math.hypot(dx, dy) || 1;
          c.vx = (dx/dd)*18; c.vy = (dy/dd)*18 - 8;
          c.knockback = 35;
          exploded = true;
          break;
        }
      }
      if (exploded) simLandmines.splice(i, 1);
    }
  }

  // Gunmanシミュレーション（横並びで発砲→弾が命中でダメージ）
  const SIM_GUNMAN_BURST_MAX = 4;
  const SIM_GUNMAN_OVERHEAT_TIME = 360;
  function simGunman(attacker, defender, simBullets) {
    if (attacker.hp <= 0 || defender.hp <= 0) return;
    if (attacker.overheatCooldown > 0) { attacker.overheatCooldown--; return; }
    if (attacker.gunCooldown > 0) { attacker.gunCooldown--; return; }
    if (attacker.burstCount > 0) {
      simFireBullet(attacker, attacker.aimDir || 1, simBullets);
    } else {
      const dx = defender.x - attacker.x, dy = defender.y - attacker.y;
      if (dx === 0) return;
      const alignThreshold = (attacker.r + defender.r) * 0.3;
      if (Math.abs(dy) > alignThreshold) return;
      simFireBullet(attacker, dx > 0 ? 1 : -1, simBullets);
    }
    attacker.burstCount = (attacker.burstCount || 0) + 1;
    if (attacker.burstCount >= SIM_GUNMAN_BURST_MAX) {
      attacker.burstCount = 0;
      attacker.overheatCooldown = SIM_GUNMAN_OVERHEAT_TIME;
    } else {
      attacker.gunCooldown = 4;
    }
  }
  function simFireBullet(owner, dir, simBullets) {
    const spd = 14;
    simBullets.push({ x: owner.x + dir*(owner.r+10), y: owner.y, vx: spd*dir, vy: 0, r: 6, owner });
    owner.aimDir = dir;
  }
  function simUpdateBullets(simBullets, ttg, enemy) {
    if (simBullets.length === 0) return;
    const chars = [ttg, enemy];
    for (let i = simBullets.length - 1; i >= 0; i--) {
      const b = simBullets[i];
      b.x += b.vx; b.y += b.vy;
      if (b.x < -20 || b.x > SIM_W + 20) { simBullets.splice(i, 1); continue; }
      let hit = false;
      for (const c of chars) {
        if (c === b.owner || c.hp <= 0) continue;
        if (Math.hypot(c.x - b.x, c.y - b.y) >= c.r + b.r) continue;
        c.hp = Math.max(0, c.hp - 60);
        c.hitTimer = 12;
        hit = true;
        break;
      }
      if (hit) simBullets.splice(i, 1);
    }
  }

  // Bombシミュレーション（接触で受け渡し、タイマー0で保持者に大ダメージ）
  const SIM_BOMB_TIME_LIMIT = 30 * 60;
  const SIM_BOMB_PASS_COOLDOWN = 20;
  function simUpdateBomb(bomb, ttg, enemy) {
    if (!bomb || bomb.exploded) return;
    if (bomb.passCooldown > 0) bomb.passCooldown--;
    const holder = bomb.holder;
    if (!holder || holder.hp <= 0) { bomb.exploded = true; return; }
    if (bomb.passCooldown <= 0) {
      const other = (holder === ttg) ? enemy : ttg;
      if (other.hp > 0) {
        const d = Math.hypot(other.x - holder.x, other.y - holder.y);
        if (d < holder.r + other.r + 6) {
          if (!bomb.started) bomb.started = true;
          bomb.holder = other;
          bomb.passCooldown = SIM_BOMB_PASS_COOLDOWN;
        }
      }
    }
    if (!bomb.started) return;
    bomb.timer--;
    if (bomb.timer <= 0) {
      const h = bomb.holder;
      bomb.exploded = true;
      h.hp = Math.max(0, h.hp - 1000);
      h.hitTimer = 24;
    }
  }

  // Twinsシミュレーション（ソーセージで攻撃/回復、HPはA・Bでリンク）
  function simTwinsLinkHp(twinA, twinB) {
    const minHp = Math.min(twinA.hp, twinB.hp);
    twinA.hp = minHp; twinB.hp = minHp;
  }
  function simTwinsThrow(twin, enemyTargets, simSausages) {
    if (twin.hp <= 0) return;
    if (twin.throwTimer > 0) twin.throwTimer--;
    if (twin.sausageCooldown > 0) { twin.sausageCooldown--; return; }
    let target = null, minDist = Infinity;
    for (const e of enemyTargets) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - twin.x, e.y - twin.y);
      if (d < minDist) { minDist = d; target = e; }
    }
    if (!target) return;
    const dx = target.x - twin.x, dy = target.y - twin.y;
    const d = Math.hypot(dx, dy) || 1;
    const spd = 7;
    simSausages.push({ x: twin.x, y: twin.y, vx: dx/d*spd, vy: dy/d*spd, r: 12, owner: twin, age: 0, maxAge: 120 });
    twin.throwTimer = 20;
    twin.sausageCooldown = 170;
  }
  function simUpdateSausages(simSausages, twinA, twinB, enemyTargets) {
    for (let i = simSausages.length - 1; i >= 0; i--) {
      const s = simSausages[i];
      s.x += s.vx; s.y += s.vy; s.age++;
      if (s.x < 0 || s.x > SIM_W || s.y > SIM_H + 20 || s.age >= s.maxAge) { simSausages.splice(i,1); continue; }
      let hit = false;
      // 敵に命中→ダメージ
      for (const e of enemyTargets) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x-s.x, e.y-s.y) >= e.r+s.r) continue;
        e.hp = Math.max(0, e.hp - 60);
        e.hitTimer = 12;
        simSausages.splice(i,1); hit = true; break;
      }
      if (hit) continue;
      // 味方（もう一方の双子）に命中→回復（リンクなので両方に反映）
      const friend = (s.owner === twinA) ? twinB : twinA;
      if (friend && friend.hp > 0 && friend !== s.owner && Math.hypot(friend.x-s.x, friend.y-s.y) < friend.r+s.r) {
        const heal = 70;
        const healed = Math.min(twinA.maxHp, twinA.hp + heal);
        twinA.hp = healed; twinB.hp = healed;
        simSausages.splice(i,1);
      }
    }
  }

  // 空気砲シミュレーション
  function simFireAir(shooter, enemy, simAirBullets) {
    if (enemy.hp <= 0) return;
    const lead = 15;
    const tx = enemy.x + enemy.vx*lead, ty = enemy.y + enemy.vy*lead;
    const dx = tx-shooter.x, dy = ty-shooter.y;
    const d = Math.hypot(dx,dy)||1;
    simAirBullets.push({ x: shooter.x, y: shooter.y, vx: (dx/d)*AIR_CANNON_SPEED, vy: (dy/d)*AIR_CANNON_SPEED, r: 13, owner: shooter, age: 0, maxAge: 85 });
  }
  function simUpdateAirBullets(simAirBullets, enemy) {
    for (let i = simAirBullets.length-1; i >= 0; i--) {
      const b = simAirBullets[i];
      b.x += b.vx; b.y += b.vy; b.age++;
      if (b.x-b.r < 0 || b.x+b.r > SIM_W || b.y-b.r < 0 || b.y+b.r > SIM_H || b.age >= b.maxAge) {
        simAirBullets.splice(i,1); continue;
      }
      if (enemy.hp > 0 && Math.hypot(enemy.x-b.x, enemy.y-b.y) < enemy.r+b.r) {
        enemy.hp = Math.max(0, enemy.hp-AIR_CANNON_DAMAGE);
        enemy.hitTimer = 10;
        const nx = (enemy.x-b.x)/(Math.hypot(enemy.x-b.x,enemy.y-b.y)||1);
        const ny = (enemy.y-b.y)/(Math.hypot(enemy.x-b.x,enemy.y-b.y)||1);
        enemy.vx = nx*4; enemy.vy = ny*4; enemy.knockback = 15;
        simAirBullets.splice(i,1); continue;
      }
    }
  }

  // Ghost攻撃シミュレーション（重なっている間ダメージを与え続ける。本物同様の間隔・威力）
  function simUpdateGhost(attacker, defender) {
    if (attacker.hp <= 0 || defender.hp <= 0) return;
    const dist = Math.hypot(defender.x - attacker.x, defender.y - attacker.y);
    const overlapping = dist < attacker.r + defender.r;
    if (overlapping) {
      if (defender.ghostDamageCooldown > 0) {
        defender.ghostDamageCooldown--;
      } else {
        defender.ghostDamageCooldown = GHOST_DAMAGE_TICK;
        defender.hp = Math.max(0, defender.hp - GHOST_DAMAGE);
        defender.hitTimer = 6;
      }
    } else {
      defender.ghostDamageCooldown = 0;
    }
  }

  // 的（ダーツ用ターゲット）のシミュレーション

  function makeSimTarget() {
    const tv = { vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6 };
    return { x: SIM_W/2, y: SIM_H/2, vx: tv.vx, vy: tv.vy, r: 25 };
  }
  function simMoveTarget(t) {
    t.x += t.vx; t.y += t.vy;
    if (t.x-t.r < 0) { t.x = t.r; t.vx = Math.abs(t.vx); }
    if (t.x+t.r > SIM_W) { t.x = SIM_W-t.r; t.vx = -Math.abs(t.vx); }
    if (t.y-t.r < 0) { t.y = t.r; t.vy = Math.abs(t.vy); }
    if (t.y+t.r > SIM_H) { t.y = SIM_H-t.r; t.vy = -Math.abs(t.vy); }
  }

  // ─── 複数回シミュレーションして収束値を求める ───
  const RUNS = 8;
  const FRAMES = 6000;
  const TTG_MAX = 1000;
  let samples = [];

  for (let run = 0; run < RUNS; run++) {
    const ttg = makeSimChar('timetraveler', 'ttg');
    const enemy = makeSimChar(enemyId, 'enemy');
    const simDarts = [];
    const simPingBalls = [];
    const simAirBullets = [];
    const simLandmines = [];
    const simBullets = [];
    const simSausages = [];
    const simTarget = (enemyId === 'darts') ? makeSimTarget() : null;
    // Bomb Guy戦：最初はBomb Guyが保持。誰かに触れた瞬間からタイマー始動
    const simBomb = (enemyId === 'bomb') ? { holder: enemy, timer: SIM_BOMB_TIME_LIMIT, started: false, exploded: false, passCooldown: 0 } : null;
    // Twins Guy戦：もう一方の双子（HPリンク）を追加生成
    let twinB = null;
    if (enemyId === 'twins') {
      twinB = makeSimChar('twins', 'enemyB');
      twinB.x = 380; twinB.y = 380;
      const a = Math.random() * Math.PI * 2;
      twinB.vx = Math.cos(a) * twinB.baseSpd; twinB.vy = Math.sin(a) * twinB.baseSpd;
      enemy.sausageCooldown = 90; twinB.sausageCooldown = 45;
    }
    let foundX = null;

    for (let f = 0; f < FRAMES && ttg.hp > 0 && enemy.hp > 0; f++) {
      simMove(ttg, null);
      simMove(enemy, enemyId === 'landmine' ? simLandmines : null);
      simResolve(ttg, enemy);
      if (twinB) { simMove(twinB, null); simResolve(ttg, twinB); simResolve(enemy, twinB); }
      if (simTarget) simMoveTarget(simTarget);

      // 敵の攻撃
      if (enemyId === 'boxing') simBoxing(enemy, ttg);
      if (enemyId === 'darts') { simDartsShoot(enemy, simDarts, simTarget); simDartsBurst(enemy, simDarts, simTarget); }
      if (enemyId === 'tennis') simTennis(enemy, ttg, simDarts, simPingBalls);
      if (enemyId === 'pingpong') {
        if (!enemy.ballFired) { enemy.ballFired = true; simFirePingBall(enemy, simPingBalls, ttg); }
      }
      if (enemyId === 'timetraveler') {
        if (enemy.airCooldown > 0) enemy.airCooldown--;
        else { simFireAir(enemy, ttg, simAirBullets); enemy.airCooldown = AIR_CANNON_COOLDOWN; }
      }
      if (enemyId === 'gunman') simGunman(enemy, ttg, simBullets);
      if (enemyId === 'ghost') simUpdateGhost(enemy, ttg);
      if (enemyId === 'landmine') simUpdateLandmines(simLandmines, ttg, enemy);
      if (enemyId === 'gunman') simUpdateBullets(simBullets, ttg, enemy);
      if (enemyId === 'bomb') simUpdateBomb(simBomb, ttg, enemy);
      if (enemyId === 'twins' && twinB) {
        simTwinsLinkHp(enemy, twinB);
        simTwinsThrow(enemy, [ttg], simSausages);
        simTwinsThrow(twinB, [ttg], simSausages);
        simUpdateSausages(simSausages, enemy, twinB, [ttg]);
      }

      // TTGの攻撃（空気砲。ツインズ戦は生きている方をランダムに狙う）
      if (ttg.airCooldown > 0) ttg.airCooldown--;
      else {
        const airTarget = (twinB && twinB.hp > 0 && Math.random() < 0.5) ? twinB : enemy;
        simFireAir(ttg, airTarget, simAirBullets);
        ttg.airCooldown = AIR_CANNON_COOLDOWN;
      }

      if (enemyId === 'darts') simUpdateDarts(simDarts, simTarget, ttg, enemy);
      if (enemyId === 'pingpong') simUpdatePingBalls(simPingBalls, ttg, enemy, simTarget);
      simUpdateAirBullets(simAirBullets, enemy);  // TTGの空気砲は敵に当てる
      if (twinB && twinB.hp > 0) simUpdateAirBullets(simAirBullets, twinB);
      if (twinB) simTwinsLinkHp(enemy, twinB);

      // TTGが500HP以下になった瞬間を記録
      if (ttg.hp < 500 && foundX === null) {
        foundX = ttg.hp;
        break;
      }
    }
    if (foundX === null) foundX = Math.max(0, Math.min(499, ttg.hp));
    samples.push(foundX);
  }

  // 外れ値を除いた中央値を収束値とする
  samples.sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  const median = samples.length % 2 !== 0 ? samples[mid] : Math.round((samples[mid-1]+samples[mid])/2);
  return Math.max(0, median);
}

// ============================================================
// Time Traveler Guy ロジック
// ============================================================
function spawnTimeTravelEffect(x, y) {
  timeTravelEffects.push({ x, y, life: 1.0, maxLife: 1.0 });
}

function spawnTTGFuture(ttg, enemy, x) {
  ttgFuture = spawnTTGFutureObj(ttg, enemy, x);
}

function spawnTTGFutureObj(ttg, enemy, x) {
  // 未来のTTGが出現（フィールドのランダムな位置）
  const side = ttg.x < W/2 ? 'right' : 'left';
  const fx = side === 'right' ? rnd(W-180, W-80) : rnd(80, 180);
  const fy = rnd(80, H-80);
  const sv = randVel(rnd(2.5, 3.5));
  const futureObj = {
    x: fx, y: fy,
    vx: sv.vx, vy: sv.vy, baseSpd: Math.hypot(sv.vx, sv.vy),
    r: 55, hp: x, maxHp: 1000,  // maxHpは通常TTGと同じ1000
    hitTimer: 0, hitstop: 0, knockback: 0,
    trail: [],
    name: 'Time Traveler Guy (未来)', emoji: '⌛',
    color: '#00838F', lightColor: '#4DD0E1',
    type: 'timetraveler_future',
    airCooldown: 60,
    owner: ttg,
    spawnImageTimer: 60  // 約3秒間 timetravel.png を表示（60fps想定）
  };
  spawnParticles(fx, fy, '#00BCD4', 30);
  return futureObj;
}

function fireAirCannon(shooter, enemy) {
  if (enemy.hp <= 0) return;
  // 予測射撃（少し先を狙う）
  const lead = 15;
  const tx = enemy.x + enemy.vx * lead;
  const ty = enemy.y + enemy.vy * lead;
  const dx = tx - shooter.x, dy = ty - shooter.y;
  const d = Math.hypot(dx, dy) || 1;
  const spd = AIR_CANNON_SPEED;
  airBullets.push({
    x: shooter.x, y: shooter.y,
    vx: (dx/d)*spd, vy: (dy/d)*spd,
    r: 13, owner: shooter,
    trail: [], age: 0, maxAge: 85
  });
  spawnParticles(shooter.x, shooter.y, '#00E5FF', 5);
}

function updateTTGFuture(ttgPresent, enemy) {
  if (!ttgFuture || ttgFuture.hp <= 0) return;

  // 移動
  if (ttgFuture.hitstop > 0) { ttgFuture.hitstop--; }
  else {
    ttgFuture.trail.push({ x: ttgFuture.x, y: ttgFuture.y });
    if (ttgFuture.trail.length > 10) ttgFuture.trail.shift();
    ttgFuture.x += ttgFuture.vx; ttgFuture.y += ttgFuture.vy;
    if (ttgFuture.x - ttgFuture.r < 0)  { ttgFuture.x = ttgFuture.r;     ttgFuture.vx =  Math.abs(ttgFuture.vx); }
    if (ttgFuture.x + ttgFuture.r > W)  { ttgFuture.x = W - ttgFuture.r; ttgFuture.vx = -Math.abs(ttgFuture.vx); }
    if (ttgFuture.y - ttgFuture.r < 0)  { ttgFuture.y = ttgFuture.r;     ttgFuture.vy =  Math.abs(ttgFuture.vy); }
    if (ttgFuture.y + ttgFuture.r > H)  { ttgFuture.y = H - ttgFuture.r; ttgFuture.vy = -Math.abs(ttgFuture.vy); }
    if (ttgFuture.hitTimer > 0) ttgFuture.hitTimer--;
    if (ttgFuture.knockback > 0) {
      ttgFuture.knockback--;
      const spd = Math.hypot(ttgFuture.vx, ttgFuture.vy);
      const tgt = ttgFuture.baseSpd + (spd - ttgFuture.baseSpd) * 0.85;
      if (spd > 0) { ttgFuture.vx = (ttgFuture.vx/spd)*tgt; ttgFuture.vy = (ttgFuture.vy/spd)*tgt; }
    } else {
      const spd = Math.hypot(ttgFuture.vx, ttgFuture.vy);
      if (spd > 0) { ttgFuture.vx = (ttgFuture.vx/spd)*ttgFuture.baseSpd; ttgFuture.vy = (ttgFuture.vy/spd)*ttgFuture.baseSpd; }
    }
  }

  // TTGPresent と TTGFuture の衝突
  if (ttgPresent && ttgPresent.hp > 0) {
    resolveCollision(ttgPresent, ttgFuture);
  }

  // 敵ツインズBとの衝突（重なり防止）
  const ownerIsP1f = ttgFuture.owner === p1char;
  const futEnemyTwinB = ownerIsP1f ? p2twinB : p1twinB;
  if (futEnemyTwinB && futEnemyTwinB.hp > 0) {
    resolveCollision(futEnemyTwinB, ttgFuture);
  }

  // 空気砲発射（CDカウントダウンは常に進める、return しない）
  if (ttgFuture.airCooldown > 0) {
    ttgFuture.airCooldown--;
  } else if (enemy && enemy.hp > 0) {
    // 敵の双子B・召喚キャラが生きていればランダムで狙い分ける
    const enemyTwinBf = ownerIsP1f ? p2twinB : p1twinB;
    const enemySummonF = ownerIsP1f ? p2summon : p1summon;
    const altTargetsF = [enemyTwinBf, enemySummonF].filter(t => t && t.hp > 0);
    const airTarget = (altTargetsF.length > 0 && Math.random() < 0.5)
      ? altTargetsF[Math.floor(Math.random() * altTargetsF.length)]
      : enemy;
    fireAirCannon(ttgFuture, airTarget);
    ttgFuture.airCooldown = AIR_CANNON_COOLDOWN;
  }
}

function updateTTGFuture2(ttgPresent, enemy) {
  if (!ttgFuture2 || ttgFuture2.hp <= 0) return;
  const c = ttgFuture2;

  // 移動
  if (c.hitstop > 0) { c.hitstop--; }
  else {
    c.trail.push({ x: c.x, y: c.y });
    if (c.trail.length > 10) c.trail.shift();
    c.x += c.vx; c.y += c.vy;
    if (c.x - c.r < 0)  { c.x = c.r;     c.vx =  Math.abs(c.vx); }
    if (c.x + c.r > W)  { c.x = W - c.r; c.vx = -Math.abs(c.vx); }
    if (c.y - c.r < 0)  { c.y = c.r;     c.vy =  Math.abs(c.vy); }
    if (c.y + c.r > H)  { c.y = H - c.r; c.vy = -Math.abs(c.vy); }
    if (c.hitTimer > 0) c.hitTimer--;
    if (c.knockback > 0) {
      c.knockback--;
      const spd = Math.hypot(c.vx, c.vy);
      const tgt = c.baseSpd + (spd - c.baseSpd) * 0.85;
      if (spd > 0) { c.vx = (c.vx/spd)*tgt; c.vy = (c.vy/spd)*tgt; }
    } else {
      const spd = Math.hypot(c.vx, c.vy);
      if (spd > 0) { c.vx = (c.vx/spd)*c.baseSpd; c.vy = (c.vy/spd)*c.baseSpd; }
    }
  }

  // 現在のTTGとの衝突
  if (ttgPresent && ttgPresent.hp > 0) {
    resolveCollision(ttgPresent, c);
  }
  // ttgFuture と ttgFuture2 の衝突
  if (ttgFuture && ttgFuture.hp > 0) {
    resolveCollision(ttgFuture, c);
  }

  // 空気砲発射（CDカウントダウンは常に進める、return しない）
  if (c.airCooldown > 0) {
    c.airCooldown--;
  } else if (enemy && enemy.hp > 0) {
    fireAirCannon(c, enemy);
    c.airCooldown = AIR_CANNON_COOLDOWN;
  }
}

// TTG vs TTG のとき p2 の空気砲（p1に当てる）を処理する
function updateAirBulletsSide(targetChar) {
  for (let i = airBullets.length - 1; i >= 0; i--) {
    const b = airBullets[i];
    // owner が p2char か ttgFuture2 の弾のみ
    if (b.owner !== p2char && b.owner !== ttgFuture2) continue;
    // この弾は既に updateAirBullets(p2char) で処理済みのためスキップ
    // ここでは p1char を標的にする
    if (targetChar.hp > 0 && !isFootballInvulnerable(targetChar) && Math.hypot(targetChar.x - b.x, targetChar.y - b.y) < targetChar.r + b.r) {
      if (!tryBoxerDodge(targetChar, b.x, b.y)) {
        const dmg = AIR_CANNON_DAMAGE;
        targetChar.hp = Math.max(0, targetChar.hp - dmg);
        targetChar.hitTimer = 10;
        const nx = (targetChar.x - b.x) / (Math.hypot(targetChar.x - b.x, targetChar.y - b.y) || 1);
        const ny = (targetChar.y - b.y) / (Math.hypot(targetChar.x - b.x, targetChar.y - b.y) || 1);
        targetChar.vx = nx * 4; targetChar.vy = ny * 4;
        targetChar.knockback = 15;
        spawnParticles(targetChar.x, targetChar.y, '#00E5FF', 10);
        spawnParticles(targetChar.x, targetChar.y, '#80DEEA', 6);
        spawnDmg(targetChar.x, targetChar.y - targetChar.r - 12, dmg, '#00E5FF');
      }
      airBullets.splice(i, 1); continue;
    }
  }
}

function updateAirBullets(defaultEnemy) {
  // TTG vs TTG のとき、弾の owner に応じて標的を決める
  const isTTGvsTTG = (p1char.type === 'timetraveler' && p2char.type === 'timetraveler');

  for (let i = airBullets.length - 1; i >= 0; i--) {
    const b = airBullets[i];
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 6) b.trail.shift();
    b.x += b.vx; b.y += b.vy;
    b.age++;

    // 壁や寿命で消滅
    if (b.x - b.r < 0 || b.x + b.r > W || b.y - b.r < 0 || b.y + b.r > H || b.age >= b.maxAge) {
      airBullets.splice(i, 1); continue;
    }

    // 標的リストを決定（ownerの反対陣営のキャラ全員）
    let targets;
    if (isTTGvsTTG) {
      const ownerIsP1 = (b.owner === p1char || b.owner === ttgFuture);
      if (ownerIsP1) {
        // p1側の弾 → p2char と ttgFuture2 に当たる
        targets = [p2char];
        if (ttgFuture2 && ttgFuture2.hp > 0) targets.push(ttgFuture2);
      } else {
        // p2側の弾 → p1char と ttgFuture に当たる
        targets = [p1char];
        if (ttgFuture && ttgFuture.hp > 0) targets.push(ttgFuture);
      }
    } else {
      // 通常（TTG vs 非TTG）: defaultEnemy と、存在すれば ttgFuture も対象
      targets = [defaultEnemy];
      // ツインズの双子Bも標的に含める
      const defTwinB = (defaultEnemy === p1char) ? p1twinB : (defaultEnemy === p2char ? p2twinB : null);
      if (defTwinB && defTwinB.hp > 0) targets.push(defTwinB);
      // トレーナーガイの召喚キャラも標的に含める
      const defSummon = (defaultEnemy === p1char) ? p1summon : (defaultEnemy === p2char ? p2summon : null);
      if (defSummon && defSummon.hp > 0) targets.push(defSummon);
      // 非TTG側が撃った弾はttgFutureにも当たる
      if (b.owner !== p1char && b.owner !== ttgFuture && ttgFuture && ttgFuture.hp > 0) targets.push(ttgFuture);
    }

    let hit = false;
    for (const enemy of targets) {
      if (!enemy || enemy.hp <= 0) continue;
      if (isFootballInvulnerable(enemy)) continue; // 突進中のフットボールガイには当たらない
      if (Math.hypot(enemy.x - b.x, enemy.y - b.y) >= enemy.r + b.r) continue;
      if (!tryBoxerDodge(enemy, b.x, b.y)) {
        const dmg = AIR_CANNON_DAMAGE;
        enemy.hp = Math.max(0, enemy.hp - dmg);
        enemy.hitTimer = 10;
        const nx = (enemy.x - b.x) / (Math.hypot(enemy.x - b.x, enemy.y - b.y) || 1);
        const ny = (enemy.y - b.y) / (Math.hypot(enemy.x - b.x, enemy.y - b.y) || 1);
        enemy.vx = nx * 4; enemy.vy = ny * 4;
        enemy.knockback = 15;
        spawnParticles(enemy.x, enemy.y, '#00E5FF', 10);
        spawnParticles(enemy.x, enemy.y, '#80DEEA', 6);
        spawnDmg(enemy.x, enemy.y - enemy.r - 12, dmg, '#00E5FF');
      }
      hit = true;
      break;
    }
    if (hit) { airBullets.splice(i, 1); continue; }
  }
}

function drawAirBullet(b) {
  const fade = 1 - b.age / b.maxAge;
  const angle = Math.atan2(b.vy, b.vx);

  // トレイル
  for (let i = 0; i < b.trail.length; i++) {
    const a = (i / b.trail.length) * 0.2;
    ctx.beginPath();
    ctx.arc(b.trail[i].x, b.trail[i].y, b.r * (i / b.trail.length), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,229,255,${a})`;
    ctx.fill();
  }

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(angle);

  // 後方に残る圧縮空気の余韻リング（発射時の名残。進むにつれ薄く小さくなる）
  for (let i = 1; i <= 2; i++) {
    const t = i * 0.4;
    const ex = -b.r * (1.6 + t * 2.4);
    const shrink = 1 - t * 0.3;
    ctx.beginPath();
    ctx.ellipse(ex, 0, b.r * 0.5 * shrink, b.r * shrink, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,229,255,${fade * (0.32 - i * 0.1)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 空気弾本体：進行方向から見た「渦輪（air vortex ring）」を横から見た形＝扁平な輪
  ctx.beginPath();
  ctx.ellipse(0, 0, b.r * 0.6, b.r, 0, 0, Math.PI * 2);
  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, b.r);
  coreGrad.addColorStop(0, `rgba(6,26,32,${fade * 0.25})`);
  coreGrad.addColorStop(0.55, `rgba(0,229,255,${fade * 0.25})`);
  coreGrad.addColorStop(0.85, `rgba(255,255,255,${fade * 0.95})`);
  coreGrad.addColorStop(1, `rgba(0,188,212,${fade * 0.5})`);
  ctx.fillStyle = coreGrad;
  ctx.fill();

  // 輪の縁を強調する明るいストローク
  ctx.beginPath();
  ctx.ellipse(0, 0, b.r * 0.6, b.r, 0, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(224,247,250,${fade * 0.9})`;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 先端の突風（進行方向に伸びる圧力の尖り）
  ctx.beginPath();
  ctx.moveTo(b.r * 0.9, 0);
  ctx.lineTo(b.r * 0.35, -b.r * 0.4);
  ctx.lineTo(b.r * 0.35, b.r * 0.4);
  ctx.closePath();
  ctx.fillStyle = `rgba(0,229,255,${fade * 0.35})`;
  ctx.fill();

  ctx.restore();
}

function drawTimeTravelEffect(e) {
  if (!timetravel_IMG.complete || timetravel_IMG.naturalWidth === 0) return;
  const imgW = timetravel_IMG.naturalWidth;
  const imgH = timetravel_IMG.naturalHeight;
  const size = 140;
  const scale = size / Math.max(imgW, imgH);
  const dw = imgW * scale;
  const dh = imgH * scale;
  ctx.save();
  ctx.globalAlpha = Math.min(1, e.life / e.maxLife * 1.5);
  ctx.drawImage(timetravel_IMG, e.x - dw / 2, e.y - dh / 2, dw, dh);
  ctx.restore();
}

function drawTTGFuture() {
  if (!ttgFuture) return;
  drawTTGFutureObj(ttgFuture);
}

function drawTTGFutureObj(c) {
  if (!c) return;
  if (c.hp <= 0) return;
  // 本体（出現直後はtimetravel.png、その後はtimetravelarGuy.png）
  if (c.spawnImageTimer > 0) {
    c.spawnImageTimer--;
    if (timetravel_IMG.complete && timetravel_IMG.naturalWidth > 0) {
      const imgW = timetravel_IMG.naturalWidth;
      const imgH = timetravel_IMG.naturalHeight;
      const scale = (c.r * 2.2) / Math.max(imgW, imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.drawImage(timetravel_IMG, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  } else if (timetravelarGuy_IMG.complete && timetravelarGuy_IMG.naturalWidth > 0) {
    const imgW = timetravelarGuy_IMG.naturalWidth;
    const imgH = timetravelarGuy_IMG.naturalHeight;
    const scale = (c.r * 2.2) / Math.max(imgW, imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.drawImage(timetravelarGuy_IMG, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }
}




// --- 画像アセット ---
const timetravelarGuy_IMG = new Image();
timetravelarGuy_IMG.src = "timetravelarGuy.png"
const timetravel_IMG = new Image();
timetravel_IMG.src = "timetravel.png"
