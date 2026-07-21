// ============================================================
// Bomb Guy（爆弾ガイ）のロジック
// ============================================================

// ============================================================
// Bomb Guy（爆弾ガイ）
// ============================================================
// 通常攻撃は持たず、「爆弾を持っている」という状態だけを管理する。
// 爆弾は最初は爆弾ガイ自身が保持。敵に初めて触れた瞬間にタイマーが始動し、
// 以後は誰か（敵味方問わず）に触れるたびに持ち主が変わるホットポテト方式。
// タイマーが0になると保持者だけが大ダメージ（実質即死）を受ける。
function updateBomb() {
  if (!bomb || bomb.exploded) return;
  if (bomb.passCooldown > 0) bomb.passCooldown--;

  const holder = bomb.holder;
  if (!holder || holder.hp <= 0) {
    // 保持者が（爆弾以外の理由で）既に倒れている場合は爆弾を消して終了
    bomb.exploded = true;
    return;
  }

  // 接触判定：保持者以外の生存キャラに触れたら爆弾を受け渡す
  if (bomb.passCooldown <= 0) {
    const others = [p1char, p2char, p1twinB, p2twinB, ttgFuture, ttgFuture2]
      .filter(c => c && c !== holder && c.hp > 0);
    for (const other of others) {
      const d = Math.hypot(other.x - holder.x, other.y - holder.y);
      // resolveCollisionが距離をちょうど「半径の合計」まで補正するため、
      // 厳密な不等号(<)だとほぼ判定が成立しない。余裕(+6)を持たせて確実に検出する。
      if (d < holder.r + other.r + 6) {
        if (!bomb.started) bomb.started = true; // 最初に敵へ触れた瞬間にタイマー始動
        bomb.holder = other;
        bomb.passCooldown = BOMB_PASS_COOLDOWN;
        spawnParticles(other.x, other.y, '#FFD54F', 12);
        break;
      }
    }
  }

  if (!bomb.started) return; // まだ誰にも触れていないのでタイマーは進まない

  bomb.timer--;
  bomb.blinking = bomb.timer <= BOMB_BLINK_TIME;

  if (bomb.timer <= 0) {
    // 爆発！保持者のみ大ダメージ（周囲への巻き込みなし）
    const h = bomb.holder;
    bomb.exploded = true;
    h.hp = Math.max(0, h.hp - 1000);
    h.hitTimer = 24;
    // 爆炎パーティクル（色を増やし量も強化して派手な爆発に）
    spawnParticles(h.x, h.y, '#FFFFFF', 14);
    spawnParticles(h.x, h.y, '#FFEB3B', 26);
    spawnParticles(h.x, h.y, '#FF7043', 40);
    spawnParticles(h.x, h.y, '#FF5722', 24);
    spawnParticles(h.x, h.y, '#212121', 20);
    // 拡大する衝撃波リングを二重に発生
    spawnShockwave(h.x, h.y, '#FFEB3B', 90, 1);
    spawnShockwave(h.x, h.y, '#FF7043', 140, 1.2);
    // 画面全体を大きく揺らす
    triggerShake(14, 22);
    spawnDmg(h.x, h.y - h.r - 12, 1000, '#FF5722');
  }
}

function drawBomb() {
  if (!bomb || bomb.exploded) return;
  const h = bomb.holder;
  if (!h || h.hp <= 0) return;
  const bx = h.x;
  // お腹らへんに時限爆弾画像を配置
  const by = h.y + h.r * 0.15;
  // 残り3秒からは高速点滅（赤い光）で警告
  const blinkOn = bomb.blinking && (Math.floor(bomb.timer / 4) % 2 === 0);

  const img = (TimeBomb_IMG.complete && TimeBomb_IMG.naturalWidth > 0) ? TimeBomb_IMG : null;
  let bombDh = h.r * 1.3; // LCDパネルの位置計算に使うため保持
  if (img) {
    const imgW = img.naturalWidth, imgH = img.naturalHeight;
    const scale = (h.r * 1.3) / Math.max(imgW, imgH);
    const dw = imgW * scale, dh = imgH * scale;
    bombDh = dh;
    ctx.save();
    ctx.translate(bx, by);
    if (blinkOn) {
      ctx.shadowColor = '#FF5252';
      ctx.shadowBlur = 16;
    }
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  // デジタルLCD風タイマー表示（始動前は出さない）
  if (bomb.started) {
    const secsNum = Math.max(0, bomb.timer / 60);
    const secsStr = secsNum.toFixed(2).padStart(5, '0'); // 例: "08.42" / "20.00"
    const panelW = 70, panelH = 26;
    const panelY = by + bombDh / 2 + 18;
    ctx.save();
    ctx.translate(bx, panelY);
    // 筐体（黒いLCDパネル）
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-panelW / 2, -panelH / 2, panelW, panelH, 5);
    } else {
      ctx.rect(-panelW / 2, -panelH / 2, panelW, panelH);
    }
    ctx.fillStyle = '#0d0d0d';
    ctx.fill();
    ctx.strokeStyle = blinkOn ? '#FF3B30' : '#555555';
    ctx.lineWidth = blinkOn ? 3 : 2;
    ctx.stroke();
    // デジタル数字
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = blinkOn ? '#FF5252' : '#39FF6A';
    ctx.shadowColor = blinkOn ? '#FF5252' : '#39FF6A';
    ctx.shadowBlur = 6;
    ctx.fillText(secsStr, 0, 1);
    ctx.restore();
  }
}



// --- 画像アセット ---
const TimeBomb_IMG = new Image();
TimeBomb_IMG.src = "TimeBomb.png"
const BombGuy_IMG = new Image();
BombGuy_IMG.src = "BombGuy.png"
