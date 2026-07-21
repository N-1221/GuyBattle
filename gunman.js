// ============================================================
// Gunman Guy（ガンマンガイ）の攻撃ロジック
// ============================================================

// ============================================================
// Gunman Guy（ガンマンガイ）
// ============================================================
const GUNMAN_BURST_MAX = 4;        // 連続で撃てる弾数
const GUNMAN_OVERHEAT_TIME = 360;  // 連射後のクールダウン（延長：約4秒→約6秒）

// 真横に並んだ瞬間に発砲を開始したら、以降は整列が崩れてもクールダウンに入るまで撃ち続ける
function updateGunman(attacker, defender) {
  if (attacker.hp <= 0 || defender.hp <= 0 || attacker.transformStun > 0) return;
  if (attacker.overheatCooldown > 0) { attacker.overheatCooldown--; return; }
  if (attacker.gunCooldown > 0) { attacker.gunCooldown--; return; }

  if (attacker.burstCount > 0) {
    // 既に連射を開始している：整列チェックはせず、最初に狙った方向へ撃ち続ける
    fireBullet(attacker, attacker.aimDir || 1);
  } else {
    // まだ連射を始めていない：真横に並んでいる時だけ発砲を開始する
    const dx = defender.x - attacker.x;
    const dy = defender.y - attacker.y;
    if (dx === 0) return;
    // 高さの差が半径の合計の一定割合以内なら「真横」とみなす
    const alignThreshold = (attacker.r + defender.r) * 0.3;
    if (Math.abs(dy) > alignThreshold) return;
    fireBullet(attacker, dx > 0 ? 1 : -1);
  }

  attacker.burstCount = (attacker.burstCount || 0) + 1;
  if (attacker.burstCount >= GUNMAN_BURST_MAX) {
    // 連射しすぎたら弾切れ→クールダウンに入る
    attacker.burstCount = 0;
    attacker.overheatCooldown = GUNMAN_OVERHEAT_TIME;
  } else {
    attacker.gunCooldown = 4;
  }
}

function fireBullet(owner, dir) {
  const spd = 14;
  bullets.push({
    x: owner.x + dir * (owner.r + 10), y: owner.y,
    vx: spd * dir, vy: 0, r: 6,
    owner, trail: []
  });
  owner.gunFireTimer = 10;
  owner.aimDir = dir;
  spawnParticles(owner.x + dir * (owner.r + 6), owner.y, '#FFD54F', 6);
}

// 毎フレーム、発射済みの銃弾の移動・命中判定を行う
function updateBullets() {
  if (bullets.length === 0) return;
  const allChars = [p1char, p2char, p1twinB, p2twinB, p1summon, p2summon, ttgFuture, ttgFuture2].filter(c => c && c.hp > 0);
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 6) b.trail.shift();
    b.x += b.vx; b.y += b.vy;
    if (b.x < -20 || b.x > W + 20) { bullets.splice(i, 1); continue; }
    let hit = false;
    for (const c of allChars) {
      // 発射者本人だけでなく、同じチームの味方にも銃弾は当たらないようにする
      if (getTeamSide(c) && getTeamSide(c) === getTeamSide(b.owner)) continue;
      if (isFootballInvulnerable(c)) continue; // 突進中のフットボールガイには当たらない
      if (Math.hypot(c.x - b.x, c.y - b.y) >= c.r + b.r) continue;
      if (!tryBoxerDodge(c, b.x, b.y)) {
        const dmg = 60;
        c.hp = Math.max(0, c.hp - dmg);
        c.hitTimer = 12;
        spawnParticles(c.x, c.y, '#FFD54F', 10);
        spawnParticles(c.x, c.y, '#795548', 6);
        spawnDmg(c.x, c.y - c.r - 12, dmg, '#FFD54F');
      }
      hit = true;
      break;
    }
    if (hit) bullets.splice(i, 1);
  }
}


function drawBullet(b) {
  // 丸い弾ではなく、進行方向に伸びる「光の筋」にすることでスピード感を出す
  const angle = Math.atan2(b.vy, b.vx);
  const speed = Math.hypot(b.vx, b.vy) || 14;
  const len = Math.max(34, speed * 2.6); // 弾速が速いほど筋を長くする
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(angle);
  // 後方にフェードアウトする光の筋（先端が最も明るい）
  const grad = ctx.createLinearGradient(-len, 0, 0, 0);
  grad.addColorStop(0, 'rgba(255,241,158,0)');
  grad.addColorStop(0.55, 'rgba(255,213,79,0.55)');
  grad.addColorStop(1, 'rgba(255,253,231,0.95)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(-len / 2, 0, len / 2, b.r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 先端の輝く核
  ctx.beginPath();
  ctx.arc(0, 0, b.r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFDE7';
  ctx.fill();
  ctx.restore();
}

// ============================================================
// 時間ループシミュレーション（実際の戦闘ロジックで計算）
// ============================================================


// --- 画像アセット ---
const GunmanGuy_IMG = new Image();
GunmanGuy_IMG.src = "GunmanGuy.png"
const GunmanGuy_shot_IMG = new Image();
GunmanGuy_shot_IMG.src = "GunmanGuy_shot.png"
