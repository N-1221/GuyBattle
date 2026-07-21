// ============================================================
// 物理・戦闘共通処理：移動/衝突判定・回避・パーティクル等の共通ユーティリティ
// ============================================================

// ============================================================
// 物理・攻撃ロジック
// ============================================================
function moveChar(c) {
  // 力尽きたキャラは完全に静止させる（描画もされないので、以後は一切動かさない）
  if (c.hp <= 0) return;
  // 登場演出（スケールイン）のタイマーを進める（移動自体には影響しない）
  if (c.spawnAnimTimer > 0) c.spawnAnimTimer--;
  // チェンジングガイ：HPが200減るごとに別のガイへ変身する
  if (c.isChangeGuy && c.hp > 0) {
    if (c.hpCheckpoint === undefined) c.hpCheckpoint = c.hp;
    while (c.hpCheckpoint - c.hp >= 200) {
      transformChangeGuy(c);
      c.hpCheckpoint -= 200;
    }
  }
  // 変身直後は一定時間、その場に固まって無防備になる（相手に反撃のスキを与える）
  if (c.transformStun > 0) {
    c.transformStun--;
    c.vx = 0; c.vy = 0;
    // 硬直が明けた瞬間に新しい向きの速度を与えておく。
    // これをしないと、下の通常移動処理では「速度が0でないときだけ
    // baseSpdに正規化する」ため、vx=vy=0のまま二度と動き出せず
    // その場に立ち止まり続けるバグになっていた。
    if (c.transformStun <= 0) {
      const v = randVel(c.baseSpd);
      c.vx = v.vx; c.vy = v.vy;
    }
    return;
  }
  if (c.hitstop > 0) { c.hitstop--; return; }
  // 地雷ガイ：クールダウンは動けない間・動ける間を問わず毎フレーム減らす
  if (c.type === 'landmine' && c.mineCooldown > 0) c.mineCooldown--;
  // 地雷ガイ：壁に激突した直後は数秒間その場から動けない
  if (c.type === 'landmine' && c.wallStopTimer > 0) {
    c.wallStopTimer--;
    if (c.hitTimer > 0) c.hitTimer--;
    return;
  }
  c.trail.push({ x: c.x, y: c.y });
  if (c.trail.length > 10) c.trail.shift();
  c.x += c.vx; c.y += c.vy;
  let hitWall = false;
  let wallSide = null;
  if (c.x - c.r < 0)  { c.x = c.r;     c.vx =  Math.abs(c.vx); hitWall = true; wallSide = 'left'; }
  if (c.x + c.r > W)  { c.x = W - c.r; c.vx = -Math.abs(c.vx); hitWall = true; wallSide = 'right'; }
  if (c.y - c.r < 0)  { c.y = c.r;     c.vy =  Math.abs(c.vy); hitWall = true; wallSide = 'top'; }
  if (c.y + c.r > H)  { c.y = H - c.r; c.vy = -Math.abs(c.vy); hitWall = true; wallSide = 'bottom'; }
  // 地雷ガイ：壁に触れたらその場で停止し、壁際に地雷を設置
  // ただしクールダウン中は停止も設置もせず、そのまま普通に跳ね返るだけにする
  if (c.type === 'landmine' && hitWall && c.hp > 0 && c.mineCooldown <= 0) {
    c.wallStopTimer = LANDMINE_STOP_TIME;
    c.mineCooldown = LANDMINE_STOP_TIME + LANDMINE_MINE_COOLDOWN;
    plantLandmine(c, wallSide);
  }
  // チェンジングガイ：以前は壁に反射するたびに変身していたが、
  // 現在はHPが200減るごとに変身する仕様に変更したため、ここでは何もしない
  // （変身処理は moveChar 冒頭のHPチェックで行う）
  if (c.hitTimer > 0) c.hitTimer--;
  if (c.dodgeCooldown > 0) c.dodgeCooldown--;
  // ノックバック中は徐々に減速して元の速度に戻す、それ以外は一定に保つ
  if (c.knockback > 0) {
    c.knockback--;
    const spd = Math.hypot(c.vx, c.vy);
    const target = c.baseSpd + (spd - c.baseSpd) * 0.85;
    if (spd > 0) { c.vx = (c.vx / spd) * target; c.vy = (c.vy / spd) * target; }
  } else {
    const spd = Math.hypot(c.vx, c.vy);
    // フットボールガイの突進中(charging)は、baseSpdではなく突進用の速度を維持する
    // （そうしないと毎フレームここでbaseSpdに巻き戻され、突進開始直後の1フレームしか速くならないバグになる）
    const targetSpd = (c.type === 'football' && c.footballState === 'charging' && c.footballChargeSpd)
      ? c.footballChargeSpd
      : c.baseSpd;
    if (spd > 0) { c.vx = (c.vx / spd) * targetSpd; c.vy = (c.vy / spd) * targetSpd; }
  }
}

function resolveCollision(a, b) {
  // ゴーストガイ：誰とぶつかっても弾かれず、そのまま貫通する（ダメージ処理はupdateGhostで別途行う）
  if (a.type === 'ghost' || b.type === 'ghost') return;
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const minD = a.r + b.r;
  if (dist >= minD) return;
  const nx = dx / dist, ny = dy / dist;
  const overlap = minD - dist;

  // 突進中のフットボールガイ：スーパーアーマーで自身は弾かれない（速度・進路を維持する）。
  // 以前はここで衝突処理自体を丸ごとスキップしていたため、位置の重なりが解消されず
  // 相手の体を貫通してすり抜けて見えるバグがあった。
  // → 突進中の本人の位置・速度は動かさず、代わりに相手側だけを重ならない位置まで押し出す。
  const aInv = isFootballInvulnerable(a);
  const bInv = isFootballInvulnerable(b);
  if (aInv && bInv) {
    // 突進中同士がぶつかる稀なケースは、従来どおりお互い貫通を許容する
    return;
  } else if (aInv) {
    b.x += nx * overlap; b.y += ny * overlap;
    return;
  } else if (bInv) {
    a.x -= nx * overlap; a.y -= ny * overlap;
    return;
  }

  a.x -= nx * (overlap / 2); a.y -= ny * (overlap / 2);
  b.x += nx * (overlap / 2); b.y += ny * (overlap / 2);
  const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
  const dot = dvx * nx + dvy * ny;
  if (dot < 0) {
    a.vx += dot * nx; a.vy += dot * ny;
    b.vx -= dot * nx; b.vy -= dot * ny;
  }
}

// ============================================================
// ボクシングガイの回避（ドッジ）共通処理
// パンチ・突進・格闘などの近接攻撃には反応しない。
// ダーツ・ピンポン玉・銃弾・卵・空気砲・ソーセージなど「飛び道具」が
// 命中する直前にのみ呼び出すことで、ボクサーガイは飛び道具に対してだけ
// 身をかわして被弾を避けられるようにする。
// 近接攻撃を回避対象から外した分、乱発を防ぐためクールタイムは長めに設定。
// 回避が成立した場合は true を返すので、呼び出し側はダメージ処理を行わないこと。
// ============================================================
const BOXER_DODGE_COOLDOWN = 480; // 飛び道具回避のクールタイム（約8秒、60fps想定）
function tryBoxerDodge(defender, srcX, srcY) {
  if (!defender || defender.type !== 'boxing') return false;
  if (defender.hp <= 0) return false;
  if (defender.dodgeCooldown > 0) return false;
  defender.dodgeAnimTimer = 18;
  defender.dodgeCooldown = BOXER_DODGE_COOLDOWN;
  const dx = defender.x - srcX, dy = defender.y - srcY;
  const d = Math.hypot(dx, dy) || 1;
  defender.vx = (dx / d) * 6;
  defender.vy = (dy / d) * 6;
  defender.knockback = 16;
  return true;
}

function moveTarget() {
  target.trail.push({ x: target.x, y: target.y });
  if (target.trail.length > 8) target.trail.shift();
  target.x += target.vx; target.y += target.vy;
  if (target.x - target.r < 0)  { target.x = target.r;     target.vx =  Math.abs(target.vx); }
  if (target.x + target.r > W)  { target.x = W - target.r; target.vx = -Math.abs(target.vx); }
  if (target.y - target.r < 0)  { target.y = target.r;     target.vy =  Math.abs(target.vy); }
  if (target.y + target.r > H)  { target.y = H - target.r; target.vy = -Math.abs(target.vy); }
}

// 味方チーム判定（p1側 / p2側）。地雷などの「味方には反応しない」判定に使う。
// トレーナーガイ本体・その召喚キャラ・ツインズの双子は同じチームとして扱う。
function getTeamSide(c) {
  if (!c) return null;
  if (c === p1char || c === p1twinB || c === p1summon) return 'p1';
  if (c === p2char || c === p2twinB || c === p2summon) return 'p2';
  if (c.owner) return getTeamSide(c.owner); // TTG未来など、owner経由でチームを辿る
  if (c.summonOwner) return getTeamSide(c.summonOwner); // 召喚キャラが入れ替わって現在のp1summon/p2summonと一致しなくなった場合の保険
  return null;
}

// 候補の中から attacker に最も近い生存キャラを返す（召喚キャラの攻撃対象選びに使用）
function nearestAliveTarget(attacker, candidates) {
  let best = null, bestD = Infinity;
  for (const c of candidates) {
    if (!c || c.hp <= 0) continue;
    const d = Math.hypot(c.x - attacker.x, c.y - attacker.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function spawnParticles(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rnd(1.5, 4);
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 1, color, r: rnd(2, 4) });
  }
}
function spawnDmg(x, y, dmg, color) {
  dmgTexts.push({ x, y: y - 76, text: `-${dmg}`, life: 1, color });
}

// ============================================================
// Football Guy攻撃：数秒立ち止まった後、相手めがけて突進する
// ============================================================
