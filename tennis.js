// ============================================================
// Tennis Guy（テニスガイ）の攻撃ロジック
// ============================================================

function updateTennis(attacker, defender) {
  if (attacker.hp <= 0 || attacker.transformStun > 0) return;
  if (attacker.smashCooldown > 0) { attacker.smashCooldown--; return; }

  // 敵のダーツを打ち返す
  for (let i = darts.length - 1; i >= 0; i--) {
    const d = darts[i];
    if (d.stuck) continue;
    if (d.owner === attacker) continue; // 自分のダーツは打ち返さない
    const dist = Math.hypot(attacker.x - d.x, attacker.y - d.y);
    if (dist < attacker.r + 40) {
      // 敵に向けて打ち返す
      const tx = defender.x - d.x, ty = defender.y - d.y;
      const td = Math.hypot(tx, ty) || 1;
      d.vx = (tx / td) * 7;
      d.vy = (ty / td) * 7;
      d.owner = attacker;
      attacker.swingBaseAngle = attacker.racketAngle; attacker.swingTimer = 18;
      spawnParticles(attacker.x, attacker.y, '#A5D6A7', 6);
      attacker.smashCooldown = 115;
      sfxTennisHit();
      break;
    }
  }

  // (テニスガイのピンポン球打ち返し処理は削除：pingpongガイ側で自動打ち返し済み)

  // 敵のソーセージ（ツインズガイ）を打ち返す
  for (let i = sausages.length - 1; i >= 0; i--) {
    const s = sausages[i];
    const attackerSide = getTeamSide(attacker);
    if (s.side && s.side === attackerSide) continue; // 自陣のソーセージは打ち返さない
    const dist = Math.hypot(attacker.x - s.x, attacker.y - s.y);
    if (dist < attacker.r + s.r + 40) {
      // 敵に向けて打ち返す（以後は打ち返した側のソーセージとして扱う）
      const tx = defender.x - s.x, ty = defender.y - s.y;
      const td = Math.hypot(tx, ty) || 1;
      const spd = Math.hypot(s.vx, s.vy) || 7;
      s.vx = (tx / td) * spd;
      s.vy = (ty / td) * spd;
      s.owner = attacker;
      s.side = attackerSide;
      s.age = 0; // 打ち返した分、少し延命させる
      attacker.swingBaseAngle = attacker.racketAngle; attacker.swingTimer = 18;
      spawnParticles(attacker.x, attacker.y, '#A5D6A7', 6);
      attacker.smashCooldown = 115;
      sfxTennisHit();
      break;
    }
  }

  // 直接打撃（打ち返す）- ラケットリーチ込み
  const REACH = 40;
  const dist = Math.hypot(defender.x - attacker.x, defender.y - attacker.y);
  // ラケットの向きを敵方向へ更新
  attacker.racketAngle = Math.atan2(defender.y - attacker.y, defender.x - attacker.x);
  if (defender.hp > 0 && dist < attacker.r + defender.r + REACH && !isFootballInvulnerable(defender)) {
    attacker.smashCooldown = 115;
    attacker.swingBaseAngle = attacker.racketAngle; attacker.swingTimer = 18;
    const dmg = 50;
    defender.hp = Math.max(0, defender.hp - dmg);
    defender.hitTimer = 10;
    const ax = defender.x - attacker.x, ay = defender.y - attacker.y;
    const distAB = Math.hypot(ax, ay) || 1;
    // 強く弾き飛ばす（baseSpdの4倍）
    defender.vx = (ax / distAB) * defender.baseSpd * 4;
    defender.vy = (ay / distAB) * defender.baseSpd * 4;
    defender.knockback = 30;
    spawnParticles(defender.x, defender.y, '#A5D6A7', 16);
    spawnDmg(defender.x, defender.y - defender.r - 12, dmg, '#A5D6A7');
    sfxTennisHit();
  }
}

// ============================================================
// Ping Pong Guy攻撃
// ============================================================


// --- 画像アセット ---
const TennisGuy_IMG = new Image();
TennisGuy_IMG.src = "TennisGuy.png"
// TennisGuy.png はラケットを持つ腕を大きく伸ばしたポーズのため、画像全体（腕・ラケット込み）を
// 基準にスケールすると体が小さく見えてしまう。頭〜腰までの実際の胴体部分の
// サイズ・中心座標（元画像ピクセル座標）をあらかじめ計測しておき、そこを基準に表示する。
const TennisGuy_shot_IMG = new Image();
TennisGuy_shot_IMG.src = "TennisGuy_shot.png"
