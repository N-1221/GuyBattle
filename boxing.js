// ============================================================
// Boxing Guy（ボクシングガイ）の攻撃ロジック
// ============================================================

function updateBoxing(attacker, defender) {
  if (attacker.hp <= 0 || defender.hp <= 0 || attacker.transformStun > 0) return;
  // 連続パンチの間隔が空きすぎたらコンボをリセット（チェーンが途切れた場合）
  if (attacker.comboTimer > 0) attacker.comboTimer--;
  else attacker.comboCount = 0;
  if (attacker.upperCooldown > 0) attacker.upperCooldown--;
  // 被弾者がヒットストップ中はCDだけ進めて攻撃はしない
  if (defender.hitstop > 0) {
    if (attacker.punchCooldown > 0) attacker.punchCooldown--;
    return;
  }
  if (attacker.punchCooldown > 0) { attacker.punchCooldown--; return; }

  const dx = defender.x - attacker.x;
  const dy = defender.y - attacker.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= attacker.r + defender.r + 5) return;
  if (isFootballInvulnerable(defender)) return; // 突進中のフットボールガイにはパンチが当たらない
  if (isGhostIntangible(defender)) return; // ゴーストガイにはパンチが当たってもダメージが入らない（貫通する）

  // アッパーカット判定：攻撃者と守備者がほぼ縦に並んでいて、攻撃者が下にいるときのみ発動
  // 縦成分が横成分より大きい（上下方向に近い）＝真上・真下60°以内
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const isNearlyVertical = absDy > absDx * 1.5; // 真上/真下60°以内
  const isUpperAngle = attacker.y > defender.y && attacker.upperCooldown === 0 && isNearlyVertical; // 攻撃者が下→アッパー
  // 攻撃者が上にいて敵が下にいる場合は攻撃せず、ただ物理的に弾かれるだけにする
  const isBelowAttacker = attacker.y < defender.y && isNearlyVertical;

  if (isBelowAttacker) {
    // 何もしない：ダメージ・アニメーションなし、ただ反発するだけ（ゴーストガイは貫通するので反発しない）
    const ndx = dx / (dist || 1), ndy = dy / (dist || 1);
    if (!isGhostIntangible(defender)) {
      defender.vx = ndx * 4;
      defender.vy = ndy * 4;
    }
    attacker.vx = -ndx * 4;
    attacker.vy = -ndy * 4;
    attacker.punchCooldown = 6; // 連続反発を防ぐ最低限のクールダウン
    return;
  }

  if (isUpperAngle) {
    const dmg = 120;
    defender.hp = Math.max(0, defender.hp - dmg);
    defender.hitTimer = 15;
    attacker.upperCooldown = 0;
    attacker.punchCooldown = 20;
    attacker.punchAnimTimer = 20;
    attacker.upperAnimTimer = 20;
    attacker.comboCount = 0; // アッパーが入ったら連続パンチのコンボはリセット
    if (!isGhostIntangible(defender)) {
      defender.vx = dx / (dist || 1) * 2;
      defender.vy = -30; // 攻撃者が下から打ち上げる
      defender.knockback = 45;
    }
    // 被弾者のみ長めにストップ（攻撃者は動き続ける）
    defender.hitstop = 0;
    spawnParticles(defender.x, defender.y, '#FFD700', 20);
    spawnParticles(defender.x, defender.y, '#FF6B00', 10);
    spawnDmg(defender.x, defender.y - defender.r - 12, dmg, '#FFD700');
  } else {
    // 連続パンチのコンボを進める（一定時間内に次の一発が入らなければ上でリセットされる）
    attacker.comboCount = (attacker.comboCount || 0) + 1;
    attacker.comboTimer = 30;

    if (attacker.comboCount >= 3) {
      // 3発目：強烈な一発で「パーン！」と吹っ飛ばす
      const dmg = 45;
      defender.hp = Math.max(0, defender.hp - dmg);
      defender.hitTimer = 20;
      attacker.punchCooldown = 24;
      attacker.punchAnimTimer = 14;
      attacker.comboCount = 0; // 吹っ飛ばしたらコンボはリセットして次のチェーンへ
      spawnParticles(defender.x, defender.y, '#FFD700', 16);
      spawnParticles(defender.x, defender.y, '#FAC775', 10);
      spawnDmg(defender.x, defender.y - defender.r - 12, dmg, '#FFD700');
      // 攻撃者から離れる方向へ大きく吹っ飛ばす（ゴーストガイは貫通するので吹き飛ばさない）
      const distAB3 = dist || 1;
      if (!isGhostIntangible(defender)) {
        defender.vx = (dx / distAB3) * 22;
        defender.vy = (dy / distAB3) * 22 - 6; // 少し浮かせつつ大きく飛ばす
        defender.knockback = 45;
        defender.hitstop = 12;
      }
    } else {
      // 通常パンチ：被弾者だけ止めて連続パンチを可能に
      const dmg = 45;
      defender.hp = Math.max(0, defender.hp - dmg);
      defender.hitTimer = 20;
      attacker.punchCooldown = 12;   // CDを短くしてhitstop中に次が溜まる
      attacker.punchAnimTimer = 10;
      sfxPunch();
      spawnParticles(defender.x, defender.y, '#FAC775', 12);
      spawnDmg(defender.x, defender.y - defender.r - 12, dmg, '#FAC775');
      const distAB = dist || 1;
      if (!isGhostIntangible(defender)) {
        defender.vx = (dx / distAB) * 1.5;  // ノックバック弱め＝その場で止まる
        defender.vy = (dy / distAB) * 1.5;
        defender.knockback = 8;
      }
      // 被弾者のみヒットストップ（攻撃者はCDが空いたら即次の一発）ゴーストガイは貫通するので停止させない
      if (!isGhostIntangible(defender)) defender.hitstop = 14;
    }
  }
}

// Darts攻撃


// --- 画像アセット ---
// Boxing Guy 画像
const BOXER_IMG = new Image();
BOXER_IMG.src = "boxer.png"
const BOXER_PUNCH_IMG = new Image();
BOXER_PUNCH_IMG.src = "boxer_punchi.png"
const BOXER_UPPER_IMG = new Image();
BOXER_UPPER_IMG.src = "boxer_upper.png"
const BOXER_DODGE_IMG = new Image();
BOXER_DODGE_IMG.src = "boxer_dodge.png"
