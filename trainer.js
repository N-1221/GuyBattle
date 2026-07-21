// ============================================================
// Trainer Guy（トレーナーガイ）の召喚ロジック
// ============================================================

// ============================================================
// Trainer Guy（トレーナーガイ）：卵を投げて仲間を召喚する
// ============================================================
// 毎フレーム呼ばれる：召喚キャラが生きている間は待機し、いなくなったら
// クールダウン終了後に卵を投げる（＝召喚キャラが倒されても何度でも投げ直す）
function updateTrainer(attacker, defender, mySummon) {
  if (attacker.hp <= 0 || defender.hp <= 0) return;
  if (mySummon && mySummon.hp > 0) {
    // 召喚キャラがいる間はクールダウンを溜めておき、倒された直後にすぐ次を投げられるようにする
    attacker.eggCooldown = Math.min(attacker.eggCooldown, 45);
    return;
  }
  if (attacker.eggCooldown > 0) { attacker.eggCooldown--; return; }
  throwEgg(attacker, defender);
  attacker.eggCooldown = TRAINER_EGG_COOLDOWN;
}

function throwEgg(owner, target) {
  const dx = target.x - owner.x, dy = target.y - owner.y;
  const d = Math.hypot(dx, dy) || 1;
  eggs.push({
    x: owner.x + (dx / d) * (owner.r + 16),
    y: owner.y + (dy / d) * (owner.r + 16),
    vx: (dx / d) * TRAINER_EGG_SPEED, vy: (dy / d) * TRAINER_EGG_SPEED,
    r: 13, owner, trail: []
  });
}

// 毎フレーム、飛んでいる卵の移動・命中（敵or壁）判定を行う
function updateEggs() {
  if (eggs.length === 0) return;
  for (let i = eggs.length - 1; i >= 0; i--) {
    const e = eggs[i];
    e.trail.push({ x: e.x, y: e.y });
    if (e.trail.length > 6) e.trail.shift();
    e.x += e.vx; e.y += e.vy;

    // 壁に当たったら、そこで割れて仲間が飛び出す
    if (e.x - e.r < 0 || e.x + e.r > W || e.y - e.r < 0 || e.y + e.r > H) {
      e.x = Math.max(e.r, Math.min(W - e.r, e.x));
      e.y = Math.max(e.r, Math.min(H - e.r, e.y));
      breakEgg(e);
      eggs.splice(i, 1);
      continue;
    }

    // 敵本体・敵の召喚キャラに当たったら割れる（自分の陣営には当たらない）
    const enemy = e.owner === p1char ? p2char : p1char;
    const enemySummon = e.owner === p1char ? p2summon : p1summon;
    // TTGの未来クローンも対象に含める（owner側と逆サイドの未来体のみ）
    const enemyFuture = [ttgFuture, ttgFuture2].filter(f => f && f.hp > 0 && getTeamSide(f) !== getTeamSide(e.owner));
    const candidates = [enemy, enemySummon, ...enemyFuture].filter(c => c && c.hp > 0);
    let hit = false;
    for (const c of candidates) {
      if (Math.hypot(c.x - e.x, c.y - e.y) >= c.r + e.r) continue;
      if (isFootballInvulnerable(c)) continue; // 突進中のフットボールガイには当たらない
      if (!tryBoxerDodge(c, e.x, e.y)) {
        const dmg = TRAINER_EGG_DAMAGE;
        c.hp = Math.max(0, c.hp - dmg);
        c.hitTimer = 10;
        spawnParticles(c.x, c.y, '#FFF9C4', 6);
        spawnDmg(c.x, c.y - c.r - 12, dmg, '#FFF9C4');
      }
      breakEgg(e);
      eggs.splice(i, 1);
      hit = true;
      break;
    }
    if (hit) continue;
  }
}

// 卵が割れる：エフェクト＋ランダムな仲間キャラの召喚
function breakEgg(e) {
  spawnParticles(e.x, e.y, '#FFF9C4', 14);
  spawnParticles(e.x, e.y, '#FFE082', 10);
  spawnSummon(e.owner, e.x, e.y);
}

// 卵の中からランダムなキャラクターを1体召喚する（各サイド同時に1体まで）
function spawnSummon(owner, x, y) {
  const formId = TRAINER_SUMMON_FORMS[Math.floor(Math.random() * TRAINER_SUMMON_FORMS.length)];
  const def = ROSTER.find(d => d.id === formId);
  if (!def) return;
  const side = owner === p1char ? 'p1' : 'p2';
  const s = def.makeChar(side);
  s.x = Math.max(s.r, Math.min(W - s.r, x));
  s.y = Math.max(s.r, Math.min(H - s.r, y));
  const v = randVel(rnd(2.4, 3.4));
  s.vx = v.vx; s.vy = v.vy; s.baseSpd = Math.hypot(v.vx, v.vy);
  s.r = Math.round(s.r * TRAINER_SUMMON_R_SCALE);
  s.hp = TRAINER_SUMMON_HP; s.maxHp = TRAINER_SUMMON_HP;
  s.name = s.name + '（召喚）';
  s.isSummon = true;
  s.summonOwner = owner;
  if (owner === p1char) p1summon = s; else p2summon = s;
  spawnParticles(x, y, s.color, 18);
}

function drawEgg(e) {
  ctx.save();
  for (let i = 0; i < e.trail.length; i++) {
    const a = (i / e.trail.length) * 0.35;
    ctx.beginPath();
    ctx.arc(e.trail[i].x, e.trail[i].y, e.r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,224,130,${a})`;
    ctx.fill();
  }
  ctx.translate(e.x, e.y);
  ctx.rotate(Math.atan2(e.vy, e.vx) + Math.PI / 2);
  ctx.beginPath();
  ctx.ellipse(0, 0, e.r * 0.75, e.r, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFDE7';
  ctx.fill();
  ctx.strokeStyle = '#D8C170';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#E6C866';
  [[-3, -6], [4, -1], [-2, 6]].forEach(([sx, sy]) => {
    ctx.beginPath(); ctx.arc(sx, sy, 1.4, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}



// --- 画像アセット ---
const TrainerGuy_IMG = new Image();
TrainerGuy_IMG.src = "TrainerGuy.png"
