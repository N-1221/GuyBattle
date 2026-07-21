// ============================================================
// Amefot Guy（フットボールガイ）の攻撃・移動ロジック
// ============================================================

const FOOTBALL_WINDUP_TIME = 100;   // 突進前に立ち止まる時間
const FOOTBALL_CHARGE_MAX_TIME = 240; // 突進の最大継続時間（壁に届かなかった場合の保険）
const FOOTBALL_CHARGE_SPEED_MUL = 10; // 突進時の速度倍率
const FOOTBALL_CHARGE_COOLDOWN = 110;  // 突進終了後、次のwindupが始まるまでの時間
const FOOTBALL_STOP_AFTER_HIT_TIME = 20; // 相手にヒットした瞬間、その場で静止する時間
const FOOTBALL_TACKLE_IMG_EXTRA_TIME = 60; // 突進終了後もタックル画像を表示し続ける時間（約1秒、60fps想定）
const FOOTBALL_DAMAGE_NEAR = 200;   // 突進開始時、相手がすぐ近くにいた場合のダメージ
const FOOTBALL_DAMAGE_FAR = 75;     // 突進開始時、相手が遠くにいた場合のダメージ
const FOOTBALL_DAMAGE_FALLOFF_DIST = 450; // このくらい離れていると最小ダメージになる基準距離

// 突進開始位置と相手との距離からダメージを算出（近いほど高く、遠いほど低い）
function calcFootballDamage(dist) {
  const t = Math.max(0, Math.min(1, dist / FOOTBALL_DAMAGE_FALLOFF_DIST));
  return Math.round(FOOTBALL_DAMAGE_NEAR + (FOOTBALL_DAMAGE_FAR - FOOTBALL_DAMAGE_NEAR) * t);
}

// 突進中（charging）のフットボールガイはスーパーアーマー状態とし、
// 被ダメージ・ノックバックを一切受け付けない（突進の勢いを止めさせない）
function isFootballInvulnerable(c) {
  return !!c && c.type === 'football' && c.footballState === 'charging';
}

// ゴーストガイは実体がないため、パンチや突進など物理的な攻撃を素通りする
// （ボクシングガイ・フットボールガイの攻撃はダメージ・ノックバックとも無効化）
function updateFootball(attacker, defender) {
  if (attacker.hp <= 0 || attacker.transformStun > 0) return;
  // タックル画像の表示延長タイマー：突進終了後も1秒間はタックル画像を表示し続ける
  if (attacker.footballTackleImgTimer > 0) attacker.footballTackleImgTimer--;
  if (attacker.footballState === 'wander') {
    // 通常移動中：カウントダウンして0になったら立ち止まり(windup)開始
    if (--attacker.footballCooldown <= 0) {
      attacker.footballState = 'windup';
      attacker.footballTimer = FOOTBALL_WINDUP_TIME;
      attacker.vx = 0; attacker.vy = 0;
    }
  } else if (attacker.footballState === 'windup') {
    // 立ち止まり中：位置を完全に固定する
    attacker.vx = 0; attacker.vy = 0;
    if (--attacker.footballTimer <= 0) {
      // 突進開始：その瞬間の相手の位置へ向けて加速する
      const dx = defender.x - attacker.x, dy = defender.y - attacker.y;
      const d = Math.hypot(dx, dy) || 1;
      const chargeSpd = attacker.baseSpd * FOOTBALL_CHARGE_SPEED_MUL;
      attacker.vx = (dx / d) * chargeSpd;
      attacker.vy = (dy / d) * chargeSpd;
      attacker.footballChargeSpd = chargeSpd; // moveChar側の速度正規化で通常速度に巻き戻されないよう保持
      attacker.footballState = 'charging';
      attacker.footballTimer = FOOTBALL_CHARGE_MAX_TIME;
      attacker.footballHitDone = false;
      attacker.footballChargeStartDist = d; // 突進開始時点の相手との距離（ダメージ計算に使う）
      spawnParticles(attacker.x, attacker.y, '#8D6E63', 14);
    }
  } else if (attacker.footballState === 'charging') {
    // 突進中：相手に当たったら一度だけダメージ＋ノックバック（突進自体は止めず継続）
    // ダメージは突進開始時の距離に応じて変動（近距離から突っ込むほど高威力、遠距離だと威力が下がる）
    let hitLanded = false; // 敵にヒットしたら突進を打ち切るためのフラグ
    if (!attacker.footballHitDone && defender.hp > 0) {
      const dist = Math.hypot(defender.x - attacker.x, defender.y - attacker.y);
      if (dist < attacker.r + defender.r) {
        attacker.footballHitDone = true; // 回避されても同じ突進で再ヒット判定はしない
        if (isGhostIntangible(defender)) {
          // ゴーストガイには当たってもダメージが入らない（貫通するので突進も止めない）
        } else {
          hitLanded = true; // 実際にヒットしたので突進を終了させる
          const dmg = calcFootballDamage(attacker.footballChargeStartDist || 0);
          defender.hp = Math.max(0, defender.hp - dmg);
          defender.hitTimer = 12;
          const ax = defender.x - attacker.x, ay = defender.y - attacker.y;
          const dd = Math.hypot(ax, ay) || 1;
          defender.vx = (ax / dd) * defender.baseSpd * 5;
          defender.vy = (ay / dd) * defender.baseSpd * 5;
          defender.knockback = 30;
          spawnParticles(defender.x, defender.y, '#8D6E63', 18);
          spawnParticles(defender.x, defender.y, '#ffffff', 8);
          spawnDmg(defender.x, defender.y - defender.r - 12, dmg, '#8D6E63');
        }
      }
    }
    // 壁に到達するか敵にヒットしたら突進を止める（moveChar側で座標が壁際にクランプされているかで判定）
    const atWall = attacker.x <= attacker.r + 0.5 || attacker.x >= W - attacker.r - 0.5 ||
                   attacker.y <= attacker.r + 0.5 || attacker.y >= H - attacker.r - 0.5;
    if (hitLanded) {
      // 相手に触れた瞬間、その場でピタッと静止する（相手だけが吹っ飛ぶ）
      attacker.footballState = 'stopped';
      attacker.footballTimer = FOOTBALL_STOP_AFTER_HIT_TIME;
      attacker.vx = 0; attacker.vy = 0;
      attacker.footballTackleImgTimer = FOOTBALL_TACKLE_IMG_EXTRA_TIME; // 突進終了後もタックル画像を1秒間表示し続ける
    } else if (atWall || --attacker.footballTimer <= 0) {
      // 突進終了（壁激突 or タイムアウト）：通常の徘徊速度に戻し、しばらく経ったらまた立ち止まる
      attacker.footballState = 'wander';
      attacker.footballCooldown = FOOTBALL_CHARGE_COOLDOWN;
      attacker.footballTackleImgTimer = FOOTBALL_TACKLE_IMG_EXTRA_TIME; // 突進終了後もタックル画像を1秒間表示し続ける
      const v = randVel(attacker.baseSpd);
      attacker.vx = v.vx; attacker.vy = v.vy;
    }
  } else if (attacker.footballState === 'stopped') {
    // 相手にヒットした直後の静止期間：完全に位置を固定する
    attacker.vx = 0; attacker.vy = 0;
    if (--attacker.footballTimer <= 0) {
      attacker.footballState = 'wander';
      attacker.footballCooldown = FOOTBALL_CHARGE_COOLDOWN;
      const v = randVel(attacker.baseSpd);
      attacker.vx = v.vx; attacker.vy = v.vy;
    }
  }
}

// ============================================================
// Ghost Guy攻撃：敵と重なっても弾かれず貫通し、重なっている間ダメージを与え続ける
// ============================================================


// --- 画像アセット ---
const AmefotGuy_IMG = new Image();
AmefotGuy_IMG.src = "AmefotGuy.png"
const AmefotGuy_Tackle_IMG = new Image();
AmefotGuy_Tackle_IMG.src = "AmefotGuy_Tackle.png"
