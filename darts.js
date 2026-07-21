// ============================================================
// Darts Guy（ダーツガイ）の攻撃ロジック・的の演出
// ============================================================

let targetBurstPending = 0, targetBurstTimer = 0, targetBurstOrigin = null, targetBurstOwner = null;
const TARGET_BURST_TOTAL = 3;     // 放射攻撃の連射回数
const TARGET_BURST_INTERVAL = 14; // 連射の間隔（フレーム）

function updateDarts_shoot(attacker) {
  if (attacker.hp <= 0 || attacker.transformStun > 0) return;
  if (attacker.dartCooldown > 0) { attacker.dartCooldown--; return; }
  attacker.burstCount = 3;
  attacker.burstInterval = 0;
  attacker.dartCooldown = 115; // 3連射の間隔（フレーム）※長め化（元は75）
}
function updateDarts_burst(attacker) {
  if (!attacker.burstCount || attacker.burstCount <= 0) return;
  if (attacker.burstInterval > 0) { attacker.burstInterval--; return; }
  if (!target) return;
  const spd = 8.0; // ダーツの飛翔速度 ※高速化（元は5.0）
  const dx = target.x - attacker.x, dy = target.y - attacker.y;
  const d = Math.hypot(dx, dy) || 1;
  const spawnDist = attacker.r + 12; // 自分の体の外側から発射し、自己反射バグを防ぐ
  darts.push({
    x: attacker.x + (dx / d) * spawnDist,
    y: attacker.y + (dy / d) * spawnDist,
    vx: dx/d*spd, vy: dy/d*spd, stuck: false, stuckTimer: 0, owner: attacker
  });
  attacker.throwTimer = 18; // 投げモーション表示フレーム数
  attacker.burstCount--;
  attacker.burstInterval = 3;
}

// 的が0になった時の放射ダーツ攻撃：1回分（32本）を発射するヘルパー
function spawnDartTargetBurst(origin, owner) {
  const burstCount = 32;
  const burstSpd = 6.0;
  for (let bi = 0; bi < burstCount; bi++) {
    const ang = (Math.PI * 2 / burstCount) * bi;
    const bx = Math.cos(ang), by = Math.sin(ang);
    darts.push({
      x: origin.x + bx * (origin.r + 10),
      y: origin.y + by * (origin.r + 10),
      vx: bx * burstSpd, vy: by * burstSpd,
      stuck: false, stuckTimer: 0,
      owner: owner,
      isBurst: true
    });
  }
  spawnParticles(origin.x, origin.y, '#FF3300', 40);
}

function updateDartProjectiles() {
  // 的の放射ダーツ攻撃（3連）の残り発射を処理
  if (targetBurstPending > 0) {
    targetBurstTimer--;
    if (targetBurstTimer <= 0) {
      spawnDartTargetBurst(targetBurstOrigin, targetBurstOwner);
      targetBurstPending--;
      targetBurstTimer = TARGET_BURST_INTERVAL;
    }
  }
  for (let i = darts.length - 1; i >= 0; i--) {
    const d = darts[i];
    if (d.stuck) {
      if (--d.stuckTimer <= 0) darts.splice(i, 1);
      continue;
    }
    d.x += d.vx; d.y += d.vy;
    // 的に当たる
    if (target && Math.hypot(target.x - d.x, target.y - d.y) < target.r + 7) {
      // ダーツだけが的にダメージを与える（バーストダーツはダメージ固定50）
      const dmgPool = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,24,25,26,27,28,30,32,33,34,36,38,39,40,42,45,48,50];
      const remaining = target.hp;
      // 的の残りHPがちょうど1のときは「フィニッシュ」を決めやすいよう、
      // 攻撃力1のダーツを引く確率を通常よりかなり高くする
      const DART_FINISH_BOOST_CHANCE = 0.5;
      let dmg;
      if (d.isBurst) {
        dmg = 50;
      } else if (remaining === 1 && Math.random() < DART_FINISH_BOOST_CHANCE) {
        dmg = 1;
      } else {
        dmg = dmgPool[Math.floor(Math.random() * dmgPool.length)];
      }
      // 本物のダーツ#301ルールと同様：残りHPを超過(バースト)する場合はそのダメージはなかったことにする
      if (dmg > remaining) {
        spawnParticles(target.x, target.y, '#999999', 5);
        d.stuck = true; d.stuckTimer = 40;
        continue;
      }
      const prevHp = target.hp;
      target.hp = Math.max(0, target.hp - dmg);
      spawnParticles(target.x, target.y, '#FFD700', 6);
      spawnDmg(target.x, target.y, dmg, '#FFD700');
      // ぴったり0になったら的から32本のダーツが放射状に発射（3連、ダメージはすべて50）
      if (prevHp > 0 && target.hp === 0) {
        // 的をリセット
        const tv2 = randVel(rnd(2.5, 3.5));
        target.hp = target.maxHp;
        target.vx = tv2.vx; target.vy = tv2.vy;
        // 放射ダーツ攻撃を3連発に設定（1発目は即発射、残り2発は間隔を空けて発射）
        targetBurstOrigin = { x: target.x, y: target.y, r: target.r };
        targetBurstOwner = d.owner;
        spawnDartTargetBurst(targetBurstOrigin, targetBurstOwner);
        targetBurstPending = TARGET_BURST_TOTAL - 1;
        targetBurstTimer = TARGET_BURST_INTERVAL;
      }
      d.stuck = true; d.stuckTimer = 40;
      continue;
    }
    // 相手に命中
    const enemy = d.owner === p1char ? p2char : p1char;
    // TTG未来も命中対象に含める
    const dartTargets = [enemy];
    if (ttgFuture && ttgFuture.hp > 0 && d.owner !== ttgFuture) dartTargets.push(ttgFuture);
    if (ttgFuture2 && ttgFuture2.hp > 0 && d.owner !== ttgFuture2) dartTargets.push(ttgFuture2);
    let dartHit = false;
    for (const tgt of dartTargets) {
      if (tgt.hp > 0 && Math.hypot(tgt.x - d.x, tgt.y - d.y) < tgt.r + 7 && !isFootballInvulnerable(tgt)) {
        if (tryBoxerDodge(tgt, d.x, d.y)) {
          // 回避成功：ダーツはその場に落ちる（ダメージなし）
        } else {
          const dmgPool = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,24,25,26,27,28,30,32,33,34,36,38,39,40,42,45,48,50];
          const dmg = d.isBurst ? 50 : dmgPool[Math.floor(Math.random() * dmgPool.length)];
          tgt.hp = Math.max(0, tgt.hp - dmg);
          tgt.hitTimer = 10;
          spawnParticles(tgt.x, tgt.y, '#F0997B', 8);
          spawnDmg(tgt.x, tgt.y - tgt.r - 12, dmg, '#F09595');
        }
        d.stuck = true; d.stuckTimer = 40; dartHit = true; break;
      }
    }
    if (dartHit) continue;
    // ピンポン玉との衝突
    for (let j = pingBalls.length - 1; j >= 0; j--) {
      const b = pingBalls[j];
      const DR = 8; // ダーツの当たり判定半径
      const dist = Math.hypot(b.x - d.x, b.y - d.y);
      if (dist < b.r + DR) {
        const nx = (d.x - b.x) / (dist || 1);
        const ny = (d.y - b.y) / (dist || 1);
        // ダーツを跳ね返す
        const dot = d.vx * nx + d.vy * ny;
        d.vx -= 2 * dot * nx; d.vy -= 2 * dot * ny;
        // 押し出し：rに合わせた位置へ
        d.x = b.x + nx * (b.r + DR);
        d.y = b.y + ny * (b.r + DR);
        // ピンポン玉にも反力
        const bdot = b.vx * (-nx) + b.vy * (-ny);
        b.vx -= 2 * bdot * (-nx); b.vy -= 2 * bdot * (-ny);
        b.x = d.x - nx * (b.r + DR);
        b.y = d.y - ny * (b.r + DR);
        spawnParticles(d.x, d.y, '#CE93D8', 5);
        break;
      }
    }
    // 味方に反射
    if (d.owner.hp > 0 && Math.hypot(d.owner.x - d.x, d.owner.y - d.y) < d.owner.r + 7) {
      const nx2 = (d.x - d.owner.x) / (Math.hypot(d.x - d.owner.x, d.y - d.owner.y) || 1);
      const ny2 = (d.y - d.owner.y) / (Math.hypot(d.x - d.owner.x, d.y - d.owner.y) || 1);
      const dot2 = d.vx * nx2 + d.vy * ny2;
      d.vx -= 2 * dot2 * nx2; d.vy -= 2 * dot2 * ny2;
      d.x = d.owner.x + nx2 * (d.owner.r + 6);
      d.y = d.owner.y + ny2 * (d.owner.r + 6);
    }
  }
}

// ============================================================
// Tennis Guy攻撃
// ============================================================

function drawTarget() {
  for (let i = 0; i < target.trail.length; i++) {
    const a = (i / target.trail.length) * 0.25;
    ctx.beginPath();
    ctx.arc(target.trail[i].x, target.trail[i].y, target.r * 0.5 * (i / target.trail.length), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,220,50,${a})`;
    ctx.fill();
  }
  const { x, y, r } = target;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r*0.75, 0, Math.PI*2); ctx.fillStyle = '#e22'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r*0.48, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r*0.24, 0, Math.PI*2); ctx.fillStyle = '#e22'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,50,0.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r+4, 0, Math.PI*2); ctx.stroke();

  // HPバー
  if (target.hp !== undefined && target.maxHp) {
    const barW = r * 2.4;
    const barH = 7;
    const barX = x - barW / 2;
    const barY = y + r + 6;
    const pct = Math.max(0, target.hp / target.maxHp);
    ctx.fillStyle = '#222';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = pct > 0.5 ? '#4caf50' : pct > 0.25 ? '#ff9800' : '#e22';
    ctx.fillRect(barX, barY, barW * pct, barH);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    // HP数値
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.max(0, Math.round(target.hp))}/${target.maxHp}`, x, barY + 9);
  }
}


function drawDart(d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(Math.atan2(d.vy, d.vx));
  ctx.scale(1.4, 1.4);
  if (d.stuck) ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#aaa8a0';
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(-9, -4.5); ctx.lineTo(-6, 0); ctx.lineTo(-9, 4.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#D85A30';
  ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(15, -4.0); ctx.lineTo(12, 3.75); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}



// --- 画像アセット ---
const dartsGuy_IMG = new Image();
dartsGuy_IMG.src = "dartsGuy.png"
const dartsGuy_throw_IMG = new Image();
dartsGuy_throw_IMG.src = "Darts_throw.png"
