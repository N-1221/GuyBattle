// ============================================================
// Ghost Guy（ゴーストガイ）の攻撃・移動ロジック
// ============================================================

function isGhostIntangible(c) {
  return !!c && c.type === 'ghost';
}


const GHOST_DAMAGE = 15;
const GHOST_DAMAGE_TICK = 8; // ダメージが入る間隔（フレーム数）

function updateGhost(attacker, defender) {
  if (attacker.hp <= 0 || defender.hp <= 0 || attacker.transformStun > 0) return;
  const dist = Math.hypot(defender.x - attacker.x, defender.y - attacker.y);
  const overlapping = dist < attacker.r + defender.r;
  // クールダウンは「防御側ごと」に持たせる（attacker側で一括管理すると、TTGの本体と
  // 未来の分身を同時に攻撃するケースで片方の判定がもう片方のクールダウンをリセットしてしまい、
  // ダメージ間隔が本来より短くなるバグになるため）
  if (overlapping && !isFootballInvulnerable(defender)) {
    if (defender.ghostDamageCooldown > 0) {
      defender.ghostDamageCooldown--;
    } else {
      defender.ghostDamageCooldown = GHOST_DAMAGE_TICK;
      defender.hp = Math.max(0, defender.hp - GHOST_DAMAGE);
      defender.hitTimer = 6;
      spawnParticles(defender.x, defender.y, '#B39DDB', 6);
      spawnDmg(defender.x, defender.y - defender.r - 12, GHOST_DAMAGE, '#B39DDB');
    }
  } else {
    // 離れたら次に重なった時すぐダメージが入るようクールダウンをリセット
    defender.ghostDamageCooldown = 0;
  }
}

// Boxing攻撃


// --- 画像アセット ---
const GhostGuy_IMG = new Image();
GhostGuy_IMG.src = "GhostGuy.png"
