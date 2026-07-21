// ============================================================
// Ping Pong Guy（ピンポンガイ）の攻撃ロジック
// ============================================================

function updatePingpong(attacker, defender) {
  if (attacker.hp <= 0 || attacker.transformStun > 0) return;
  // 初回1秒後に発射
  if (!attacker.ballFired) {
    if (!attacker.ballDelay) attacker.ballDelay = 60;
    if (--attacker.ballDelay <= 0) { attacker.ballFired = true; firePingBall(attacker, defender); }
  }
  // swingTimerカウントダウン（drawChar内でも減らしているが念のため）
}

function firePingBall(owner, target) {
  // owner === p1char という単純比較だと、トレーナーガイが召喚した卓球ガイ（p1summon）が
  // 発射した場合に「敵」がp1char（自陣）になってしまうバグがあったため、
  // チーム判定(getTeamSide)を使って正しい敵を狙うようにする。
  // targetが明示的に渡された場合はそちらを優先する（敵の召喚キャラを狙う場合など）
  let enemy = target;
  if (!enemy || enemy.hp <= 0) {
    const ownerSide = getTeamSide(owner);
    enemy = ownerSide === 'p1' ? p2char : p1char;
  }
  const dx = enemy.x - owner.x, dy = enemy.y - owner.y;
  const d = Math.hypot(dx, dy) || 1;
  const spd = PINGPONG_BALL_SPEED;
  pingBalls.push({
    x: owner.x, y: owner.y,
    vx: (dx / d) * spd, vy: (dy / d) * spd,
    r: 10, spd,
    // 発射直後に自分自身（owner）へ即ヒット判定されて打ち返されてしまい、
    // 敵に当たる前にボールの軌道が乱されるバグを防ぐため、
    // hitCooldownを発射時から有効にして自身への衝突をしばらく無視する
    trail: [], hitCooldown: 15, lastHit: owner,
    origin: owner, // 何度打ち返されても変わらない「本来の発射者」（チェンジングガイの後始末用）
    lastDamaged: null, damageCooldown: 0
  });
  sfxPingFire();
}

function updatePingBalls() {
  for (let i = pingBalls.length - 1; i >= 0; i--) {
    const b = pingBalls[i];
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 8) b.trail.shift();
    // 連続ヒット防止クールダウンを更新
    if (b.hitCooldown > 0) b.hitCooldown--;
    if (b.damageCooldown > 0) b.damageCooldown--;

    // サブステップで貫通防止
    const spd = Math.hypot(b.vx, b.vy);
    const steps = Math.ceil(spd / 6);
    let hit = false;

    for (let s = 0; s < steps && !hit; s++) {
      b.x += b.vx / steps; b.y += b.vy / steps;

      // 壁反射（反射のたびにボールの速度を少しだけ落とす。打ち返し時の速度はここでは変更しない）
      const WALL_BOUNCE_SLOWDOWN = 0.94; // 反射1回あたりの速度倍率
      const WALL_BOUNCE_MIN_SPD = 8;     // 減速しすぎて止まらないよう最低速度を確保
      if (b.x - b.r < 0)  { b.x = b.r;     b.vx =  Math.abs(b.vx); sfxPingWall(); if (b.spd) b.spd = Math.max(WALL_BOUNCE_MIN_SPD, b.spd * WALL_BOUNCE_SLOWDOWN); }
      if (b.x + b.r > W)  { b.x = W - b.r; b.vx = -Math.abs(b.vx); sfxPingWall(); if (b.spd) b.spd = Math.max(WALL_BOUNCE_MIN_SPD, b.spd * WALL_BOUNCE_SLOWDOWN); }
      if (b.y - b.r < 0)  { b.y = b.r;     b.vy =  Math.abs(b.vy); sfxPingWall(); if (b.spd) b.spd = Math.max(WALL_BOUNCE_MIN_SPD, b.spd * WALL_BOUNCE_SLOWDOWN); }
      if (b.y + b.r > H)  { b.y = H - b.r; b.vy = -Math.abs(b.vy); sfxPingWall(); if (b.spd) b.spd = Math.max(WALL_BOUNCE_MIN_SPD, b.spd * WALL_BOUNCE_SLOWDOWN); }
      // 速度を一定に保つ（打ち返し時はb.spdがその都度設定されるため、ここでは壁反射で減速したb.spdに揃えるだけ）
      const curSpd = Math.hypot(b.vx, b.vy);
      if (curSpd > 0 && b.spd) { b.vx = (b.vx / curSpd) * b.spd; b.vy = (b.vy / curSpd) * b.spd; }

      // 的に当たる
      if (target && Math.hypot(target.x - b.x, target.y - b.y) < target.r + b.r) {
        const nx = (b.x - target.x) / (Math.hypot(b.x - target.x, b.y - target.y) || 1);
        const ny = (b.y - target.y) / (Math.hypot(b.x - target.x, b.y - target.y) || 1);
        const dot = b.vx * nx + b.vy * ny;
        b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
        b.x = target.x + nx * (target.r + b.r);
        b.y = target.y + ny * (target.r + b.r);
        hit = true; break;
      }

      // 両キャラ＋TTG未来それぞれチェック
      const pingTargets = [p1char, p2char];
      if (p1summon && p1summon.hp > 0) pingTargets.push(p1summon);
      if (p2summon && p2summon.hp > 0) pingTargets.push(p2summon);
      if (ttgFuture && ttgFuture.hp > 0) pingTargets.push(ttgFuture);
      if (ttgFuture2 && ttgFuture2.hp > 0) pingTargets.push(ttgFuture2);
      for (const c of pingTargets) {
        if (c.hp <= 0) continue;
        if (isFootballInvulnerable(c)) continue; // 突進中のフットボールガイには当たらない
        if (Math.hypot(c.x - b.x, c.y - b.y) >= c.r + b.r) continue;
        // 味方（同じチーム）にはダメージも打ち返しも発生させない
        // （トレーナーガイが召喚した卓球ガイのボールが味方に当たってしまうバグの修正）
        // ただし「自分自身」への跳ね返り（壁に当たって自打球が戻ってくる）は
        // 打ち返し処理自体は必要なので、ここではブロックしない
        if (c !== b.lastHit && getTeamSide(c) && getTeamSide(c) === getTeamSide(b.lastHit)) continue;
        // 連続ヒット防止（同じキャラへの連打をクールダウンで防ぐ）
        if (b.hitCooldown > 0 && b.lastHit === c) continue;
        if (b.damageCooldown > 0 && b.lastDamaged === c) continue;

        // ダメージのみ（貫通・反射なし）
        {
          if (c.type === 'pingpong') {
            // pingpongキャラはボールを打ち返す。相手が打った球を打ち返した時のみダメージが入る
            // （壁などに跳ねて自分が打った球が自分に戻ってきた場合はダメージなし）
            const isOwnBall = (b.lastHit === c);
            if (!isOwnBall) {
              c.hp = Math.max(0, c.hp - 50);
              c.hitTimer = 10;
              spawnParticles(c.x, c.y, '#CE93D8', 10);
              spawnDmg(c.x, c.y - c.r - 12, 50, '#CE93D8');
            }
            c.swingTimer = 18;
            sfxPingReturn();
            if (Math.abs(b.vx) >= Math.abs(b.vy)) {
              b.vx = -b.vx;
            } else {
              b.vy = -b.vy;
            }
            b.lastHit = c;
            b.hitCooldown = 15;
            continue;
          } else if (c.type === 'tennis' && c.smashCooldown <= 0) {
            // テニスガイはラケットでボールを打ち返す（ダメージなし）※クールダウン中は打ち返せない
            const cSide = getTeamSide(c);
            const enemyC = cSide === 'p1' ? p2char : p1char;
            const tx = enemyC.x - b.x, ty = enemyC.y - b.y;
            const td = Math.hypot(tx, ty) || 1;
            const retSpd = Math.max(b.spd || PINGPONG_BALL_SPEED, PINGPONG_BALL_SPEED);
            b.vx = (tx / td) * retSpd;
            b.vy = (ty / td) * retSpd;
            b.spd = retSpd;
            c.racketAngle = Math.atan2(ty, tx);
            c.swingBaseAngle = c.racketAngle; c.swingTimer = 18;
            c.smashCooldown = 115;
            spawnParticles(c.x, c.y, '#A5D6A7', 8);
            b.lastHit = c;
            b.hitCooldown = 20;
            continue;
          } else if (c !== b.lastHit) {
            // c === b.lastHit の場合は「自分が打ち返した球が壁などに跳ねて戻ってきた」だけなので、
            // クールダウン中でもダメージを受けない（自分の球で自爆してしまうバグの修正）
            if (!tryBoxerDodge(c, b.x, b.y)) {
              c.hp = Math.max(0, c.hp - 50);
              c.hitTimer = 10;
              sfxPingHit();
              spawnParticles(c.x, c.y, '#CE93D8', 10);
              spawnDmg(c.x, c.y - c.r - 12, 50, '#CE93D8');
            }
            // 卓球ガイの「自分が打った球かどうか」の判定（lastHit）はここでは更新しない。
            // ここは打ち返しではなく素通しの直撃なので、別カウンタで連続ヒットだけ防ぐ。
            b.lastDamaged = c;
            b.damageCooldown = 15;
          }
        }
        // 貫通：hit フラグを立てずループ継続
      }
    }
  }
}

function drawPingBall(b) {
  // トレイル
  for (let i = 0; i < b.trail.length; i++) {
    const a = (i / b.trail.length) * 0.3;
    ctx.beginPath();
    ctx.arc(b.trail[i].x, b.trail[i].y, b.r * (i / b.trail.length), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,183,94,${a})`;
    ctx.fill();
  }
  // 本体
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fillStyle = '#FFE0B2';
  ctx.fill();
  ctx.strokeStyle = '#FFB74D'; ctx.lineWidth = 2;
  ctx.stroke();
}



// --- 画像アセット ---
const pingpongGuy_IMG = new Image();
pingpongGuy_IMG.src = "pingpongGuy.png"
const pingpongGuy_shot_IMG = new Image();
pingpongGuy_shot_IMG.src = "pingpongGuy_shot.png"
