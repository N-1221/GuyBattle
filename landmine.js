// ============================================================
// Landmine Guy（地雷ガイ）のロジック
// ============================================================

// ============================================================
// Landmine Guy（地雷ガイ）
// ============================================================
// 壁に激突した瞬間に、その場（足元）へ地雷を1つ設置する
function plantLandmine(owner, wallSide) {
  const mineR = 20;
  let mx = owner.x, my = owner.y;
  // 壁際にぴったりくっつくように座標を補正する
  if (wallSide === 'left')   mx = mineR;
  if (wallSide === 'right')  mx = W - mineR;
  if (wallSide === 'top')    my = mineR;
  if (wallSide === 'bottom') my = H - mineR;
  // 設置者が「今」どちらの陣営か（p1/p2）をこの時点で確定して記録しておく。
  // owner参照だけに頼ると、召喚キャラが後で死んで別の新しい召喚キャラに
  // 置き換わった際にowner===p1summon等の一致判定が崩れ、味方誤爆の原因になるため。
  const side = getTeamSide(owner);
  landmines.push({ x: mx, y: my, r: mineR, owner, side, armTimer: 18, wallSide });
  // 個数制限なし：設置した地雷はすべて残る
  owner.mineSmileTimer = 150; // 設置後しばらく（約2.5秒）は笑顔画像を表示
  spawnParticles(mx, my, '#8D6E63', 12);
  spawnParticles(mx, my, '#5D4037', 8);
}

// 毎フレーム、設置済みの地雷と全キャラの接触判定を行う（設置者自身には反応しない）
function updateLandmines() {
  if (landmines.length === 0) return;
  const allChars = [p1char, p2char, p1twinB, p2twinB, p1summon, p2summon, ttgFuture, ttgFuture2].filter(c => c && c.hp > 0);
  for (let i = landmines.length - 1; i >= 0; i--) {
    const m = landmines[i];
    if (m.armTimer > 0) { m.armTimer--; continue; } // 設置直後の誤爆防止
    let exploded = false;
    const ownerTeam = m.side || getTeamSide(m.owner);
    for (const c of allChars) {
      if (c === m.owner) continue; // 設置した本人には反応しない
      if (ownerTeam && getTeamSide(c) === ownerTeam) continue; // 味方（トレーナーガイ本体や他の召喚キャラなど）にも反応しない
      if (isFootballInvulnerable(c)) continue; // 突進中のフットボールガイは地雷を踏んでも起爆しない
      const d = Math.hypot(c.x - m.x, c.y - m.y);
      if (d < c.r + m.r) {
        explodeLandmine(m, c);
        exploded = true;
        break;
      }
    }
    if (exploded) landmines.splice(i, 1);
  }
}

function explodeLandmine(m, victim) {
  spawnParticles(m.x, m.y, '#FF7043', 32);
  spawnParticles(m.x, m.y, '#FFEB3B', 18);
  spawnParticles(m.x, m.y, '#3E2723', 16);
  const dmg = 180;
  victim.hp = Math.max(0, victim.hp - dmg);
  victim.hitTimer = 22;
  const dx = victim.x - m.x, dy = victim.y - m.y;
  const d = Math.hypot(dx, dy) || 1;
  victim.vx = (dx / d) * 18;
  victim.vy = (dy / d) * 18 - 8; // 少し浮かせて吹き飛ばす
  victim.knockback = 35;
  spawnDmg(victim.x, victim.y - victim.r - 12, dmg, '#FF5722');
}

function drawLandmine(m) {
  ctx.save();
  ctx.translate(m.x, m.y);
  // 設置された壁ごとに向き（平べったい面と影の方向）を回転させる
  let mineAngle = 0;
  if (m.wallSide === 'bottom') mineAngle = Math.PI;
  else if (m.wallSide === 'left') mineAngle = -Math.PI / 2;
  else if (m.wallSide === 'right') mineAngle = Math.PI / 2;
  ctx.rotate(mineAngle);
  const armed = m.armTimer <= 0;
  // 影
  ctx.beginPath();
  ctx.ellipse(0, m.r * 0.15, m.r * 1.05, m.r * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();
  // 本体（ドーム状の地雷）
  ctx.beginPath();
  ctx.ellipse(0, 0, m.r, m.r * 0.62, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#4E342E';
  ctx.fill();
  ctx.strokeStyle = '#2b1a13';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 起爆スイッチ用のトゲ
  for (let a = 0; a < 6; a++) {
    const ang = (Math.PI * 2 / 6) * a;
    const sx = Math.cos(ang) * m.r * 0.55;
    const sy = Math.sin(ang) * m.r * 0.32;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(ang) * 8, sy + Math.sin(ang) * 5 - 4);
    ctx.strokeStyle = '#212121';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // 中央のランプ（起爆準備完了後は赤く点滅）
  const pulse = (Math.sin(Date.now() / 130) + 1) / 2;
  ctx.beginPath();
  ctx.arc(0, -2, m.r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = armed ? (pulse > 0.5 ? '#FF5252' : '#B71C1C') : '#757575';
  ctx.fill();
  ctx.restore();
}



// --- 画像アセット ---
const LandmineGuy_IMG = new Image();
LandmineGuy_IMG.src = "LandmineGuy.png"
const LandmineGuy_smile_IMG = new Image();
LandmineGuy_smile_IMG.src = "LandmineGuy_smile.png"
