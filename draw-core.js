// ============================================================
// 描画共通処理：全キャラ共通のスプライト描画・HPバッジ・リザルト用ヘルパー
// ============================================================

function drawChar(c, enemy) {
  const dead = c.hp <= 0;
  if (dead) return; // 力尽きたキャラは完全に消す（半透明表示はしない）

  // 新キャラ登場直後：中心から弾むようにスケールインさせ、画面が急に切り替わった感を消す
  let spawnScale = 1;
  if (c.spawnAnimTimer > 0) {
    const p = 1 - (c.spawnAnimTimer / SPAWN_ANIM_FRAMES);
    spawnScale = Math.max(0.05, easeOutBack(p));
  }
  if (spawnScale !== 1) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(spawnScale, spawnScale);
    ctx.translate(-c.x, -c.y);
  }
  // トレイル
  for (let i = 0; i < c.trail.length; i++) {
    const a = (i / c.trail.length) * 0.3;
    if (c.type !== 'boxing' && c.type !== 'darts' && c.type !== 'timetraveler' && c.type !== 'pingpong' && c.type !== 'tennis' && c.type !== 'landmine' && c.type !== 'gunman' && c.type !== 'football' && c.type !== 'ghost' && c.type !== 'bomb' && c.type !== 'trainer') {
      ctx.fillStyle = c.color + Math.round(a * 255).toString(16).padStart(2, '0');
      ctx.fill();
    }
  }
  // 本体（ボクシング・ダーツガイ・タイムトラベラーガイ・ピンポンガイ・フットボールガイ・ゴーストガイ・爆弾ガイ・トレーナーガイは画像を使うので円は描かない）
  if (c.type !== 'boxing' && c.type !== 'darts' && c.type !== 'timetraveler' && c.type !== 'pingpong' && c.type !== 'tennis' && c.type !== 'landmine' && c.type !== 'gunman' && c.type !== 'football' && c.type !== 'ghost' && c.type !== 'bomb' && c.type !== 'trainer') {
    ctx.save();
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fillStyle = c.hitTimer > 0 ? c.lightColor : c.color;
    ctx.fill();
    if (c.hitTimer > 0) { ctx.strokeStyle = '#FAC775'; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.restore();
  }
  // 絵文字 or 画像
  ctx.globalAlpha = 1;
  if (c.type === 'boxing' && BOXER_IMG.complete && BOXER_IMG.naturalWidth > 0) {
    // パンチ中（攻撃直後）はパンチ画像、それ以外は通常画像
    const isPunching = c.punchAnimTimer > 0;
    const isUppering = c.upperAnimTimer > 0;
    const isDodging = c.dodgeAnimTimer > 0;
    if (c.punchAnimTimer > 0) c.punchAnimTimer--;
    if (c.upperAnimTimer > 0) c.upperAnimTimer--;
    if (c.dodgeAnimTimer > 0) c.dodgeAnimTimer--;
    let img = BOXER_IMG;
    let flipY = false;
    if (isDodging && BOXER_DODGE_IMG.complete && BOXER_DODGE_IMG.naturalWidth > 0) {
      img = BOXER_DODGE_IMG;
    } else if (isUppering && BOXER_UPPER_IMG.complete && BOXER_UPPER_IMG.naturalWidth > 0) {
      img = BOXER_UPPER_IMG;
    } else if (isPunching && BOXER_PUNCH_IMG.complete && BOXER_PUNCH_IMG.naturalWidth > 0) {
      img = BOXER_PUNCH_IMG;
    }
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const scale = (c.r * 2.2) / Math.max(imgW, imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    // 敵が左にいる場合は左右反転（元画像は右向き）
    const flipX = enemy && enemy.x < c.x;
    ctx.save();
    ctx.translate(c.x, c.y);
    if (flipX) ctx.scale(-1, 1);
    if (flipY) ctx.scale(1, -1);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  } else if (c.type === 'darts' && dartsGuy_IMG.complete && dartsGuy_IMG.naturalWidth > 0) {
    if (c.throwTimer > 0) c.throwTimer--;
    const isThrow = c.throwTimer > 0;
    const dartsImg = (isThrow && dartsGuy_throw_IMG.complete && dartsGuy_throw_IMG.naturalWidth > 0)
      ? dartsGuy_throw_IMG : dartsGuy_IMG;
    const imgW = dartsImg.naturalWidth;
    const imgH = dartsImg.naturalHeight;
    const sizeBoost = isThrow ? 1.15 : 1; // 投擲モーション画像は一回り大きく表示
    const scale = (c.r * 2.2 * sizeBoost) / Math.max(imgW, imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    // 的が右にいる場合は左右反転（元画像は左向き）
    const flipX = target && target.x > c.x;
    ctx.save();
    ctx.translate(c.x, c.y);
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(dartsImg, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  } else if (c.type === 'timetraveler' && timetravelarGuy_IMG.complete && timetravelarGuy_IMG.naturalWidth > 0) {
    const imgW = timetravelarGuy_IMG.naturalWidth;
    const imgH = timetravelarGuy_IMG.naturalHeight;
    const scale = (c.r * 2.2) / Math.max(imgW, imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    const flipX = enemy && enemy.x < c.x;
    ctx.save();
    ctx.translate(c.x, c.y);
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(timetravelarGuy_IMG, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  } else if (c.type === 'pingpong') {
    // swingTimer カウントダウン
    if (c.swingTimer > 0) c.swingTimer--;
    // swingTimer > 0 のとき（打ち返し中）はshot画像、それ以外は通常画像
    const isShot = c.swingTimer > 0;
    const img = (isShot && pingpongGuy_shot_IMG.complete && pingpongGuy_shot_IMG.naturalWidth > 0)
      ? pingpongGuy_shot_IMG
      : (pingpongGuy_IMG.complete && pingpongGuy_IMG.naturalWidth > 0 ? pingpongGuy_IMG : null);
    if (img) {
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const scale = (c.r * 2.2) / Math.max(imgW, imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const flipX = enemy && enemy.x < c.x;
      ctx.save();
      ctx.translate(c.x, c.y);
      if (flipX) ctx.scale(-1, 1);
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  } else if (c.type === 'tennis') {
    // swingTimer カウントダウン（スイング演出自体は画像切替のみ）
    if (c.swingTimer > 0) c.swingTimer--;
    // クールタイム中（smashCooldown > 0）はショット画像、それ以外は通常画像
    const isShot = c.smashCooldown > 0;
    const img = (isShot && TennisGuy_shot_IMG.complete && TennisGuy_shot_IMG.naturalWidth > 0)
      ? TennisGuy_shot_IMG
      : (TennisGuy_IMG.complete && TennisGuy_IMG.naturalWidth > 0 ? TennisGuy_IMG : null);
    if (img) {
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const flipX = enemy && enemy.x < c.x;
      ctx.save();
      ctx.translate(c.x, c.y);
      if (flipX) ctx.scale(-1, 1);
      if (isShot) {
        // ショット画像（腕を広げて横に大きい）は高さ基準でスケールして体の大きさを保つ
        // ※以前は1.15倍のブーストをかけていたが、他キャラのショット/攻撃モーション画像と
        //   比べて目立って大きく見えたため等倍に調整
        const sizeBoost = 1.0;
        const scale = (c.r * 2.2 * sizeBoost) / imgH;
        const dw = imgW * scale, dh = imgH * scale;
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      } else {
        // 通常画像はラケットを持つ腕を伸ばしたポーズで画像全体が縦長になっているため、
        // 画像全体ではなく胴体（頭〜腰）の実サイズを基準にスケールし、
        // 胴体の中心がキャラの位置(c.x, c.y)に来るよう描画位置をオフセットする
        const sizeBoost = 0.95;
        const scale = (c.r * 2.2 * sizeBoost) / TENNIS_BODY_H;
        const dw = imgW * scale, dh = imgH * scale;
        const offsetX = -TENNIS_BODY_CX * scale;
        const offsetY = -TENNIS_BODY_CY * scale;
        ctx.drawImage(img, offsetX, offsetY, dw, dh);
      }
      ctx.restore();
    }
  } else if (c.type === 'landmine') {
    // 地雷設置後しばらくは笑顔画像、それ以外は通常画像
    if (c.mineSmileTimer > 0) c.mineSmileTimer--;
    const isSmile = c.mineSmileTimer > 0;
    const img = (isSmile && LandmineGuy_smile_IMG.complete && LandmineGuy_smile_IMG.naturalWidth > 0)
      ? LandmineGuy_smile_IMG
      : (LandmineGuy_IMG.complete && LandmineGuy_IMG.naturalWidth > 0 ? LandmineGuy_IMG : null);
    if (img) {
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const scale = (c.r * 2.2) / Math.max(imgW, imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const flipX = enemy && enemy.x < c.x;
      ctx.save();
      ctx.translate(c.x, c.y);
      if (flipX) ctx.scale(-1, 1);
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  } else if (c.type === 'gunman') {
    // gunFireTimerが発砲中(ショット画像表示)の残りフレームを管理する
    if (c.gunFireTimer > 0) c.gunFireTimer--;
    // 発砲中はショット画像、それ以外は通常画像
    const isShooting = c.gunFireTimer > 0;
    const img = (isShooting && GunmanGuy_shot_IMG.complete && GunmanGuy_shot_IMG.naturalWidth > 0)
      ? GunmanGuy_shot_IMG
      : (GunmanGuy_IMG.complete && GunmanGuy_IMG.naturalWidth > 0 ? GunmanGuy_IMG : null);
    if (img) {
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const scale = (c.r * 2.2) / Math.max(imgW, imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const flipX = enemy && enemy.x < c.x;
      ctx.save();
      ctx.translate(c.x, c.y);
      if (flipX) ctx.scale(-1, 1);
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  } else if (c.type === 'football') {
    // 突進中（タックル中）、およびその後1秒間はタックル画像、それ以外は通常画像
    const isTackling = c.footballState === 'charging' || c.footballTackleImgTimer > 0;
    const img = (isTackling && AmefotGuy_Tackle_IMG.complete && AmefotGuy_Tackle_IMG.naturalWidth > 0)
      ? AmefotGuy_Tackle_IMG
      : (AmefotGuy_IMG.complete && AmefotGuy_IMG.naturalWidth > 0 ? AmefotGuy_IMG : null);
    if (img) {
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const scale = (c.r * 2.2) / Math.max(imgW, imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const flipX = enemy && enemy.x < c.x;
      // 突進前の立ち止まり（windup）中：溜めている感を出すため、描画位置だけを小刻みに震わせる
      // （実座標c.x/c.yは動かさないので、当たり判定や物理には一切影響しない見た目だけの演出）
      let shakeX = 0, shakeY = 0;
      if (c.footballState === 'windup') {
        const progress = 1 - (c.footballTimer / FOOTBALL_WINDUP_TIME); // 突進が近づくほど1に近づく
        const shakeAmp = 1 + progress * 4; // 徐々に震えが大きくなる（最大でも±5px程度）
        shakeX = (Math.random() - 0.5) * 2 * shakeAmp;
        shakeY = (Math.random() - 0.5) * 2 * shakeAmp;
      }
      ctx.save();
      ctx.translate(c.x + shakeX, c.y + shakeY);
      if (flipX) ctx.scale(-1, 1);
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  } else if (c.type === 'ghost') {
    // ゴーストガイ：半透明にして「実体のなさ」を表現する
    const img = (GhostGuy_IMG.complete && GhostGuy_IMG.naturalWidth > 0) ? GhostGuy_IMG : null;
    if (img) {
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const scale = (c.r * 2.2) / Math.max(imgW, imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const flipX = enemy && enemy.x < c.x;
      ctx.save();
      ctx.globalAlpha *= 0.55;
      ctx.translate(c.x, c.y);
      if (flipX) ctx.scale(-1, 1);
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  } else if (c.type === 'bomb') {
    const img = (BombGuy_IMG.complete && BombGuy_IMG.naturalWidth > 0) ? BombGuy_IMG : null;
    if (img) {
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const scale = (c.r * 2.2) / Math.max(imgW, imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const flipX = enemy && enemy.x < c.x;
      ctx.save();
      ctx.translate(c.x, c.y);
      if (flipX) ctx.scale(-1, 1);
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  } else if (c.type === 'trainer') {
    const img = (TrainerGuy_IMG.complete && TrainerGuy_IMG.naturalWidth > 0) ? TrainerGuy_IMG : null;
    if (img) {
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const scale = (c.r * 2.2) / Math.max(imgW, imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const flipX = enemy && enemy.x < c.x;
      ctx.save();
      ctx.translate(c.x, c.y);
      if (flipX) ctx.scale(-1, 1);
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  } else if (c.type !== 'boxing' && c.type !== 'timetraveler' && c.type !== 'pingpong' && c.type !== 'darts' && c.type !== 'landmine' && c.type !== 'gunman') {
    ctx.font = '40px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.emoji, c.x, c.y + 2);
  }
  // ダメージフラッシュ（全キャラ共通：hitTimer中は体を白く塗りつぶす）
  if (c.hitTimer > 0) {
    const flashAlpha = Math.min(1, c.hitTimer / 5);
    if (c.type === 'boxing' || c.type === 'darts' || c.type === 'timetraveler' || c.type === 'pingpong' || c.type === 'tennis' || c.type === 'landmine' || c.type === 'gunman' || c.type === 'football' || c.type === 'ghost' || c.type === 'bomb' || c.type === 'trainer') {
      // 画像ベースのキャラ：直前に描画した画像の輪郭（シルエット）に沿って白く塗る
      if (!c._flashCanvas) {
        c._flashCanvas = document.createElement('canvas');
        c._flashCtx = c._flashCanvas.getContext('2d');
      }
      // テニスガイの通常画像はラケットを持つ腕が大きくはみ出すため、フラッシュ用キャンバスを広めに確保する
      const flashSizeMul = (c.type === 'tennis' && c.smashCooldown <= 0) ? 5.0 : 3.0;
      const fw = Math.ceil(c.r * flashSizeMul), fh = Math.ceil(c.r * flashSizeMul);
      if (c._flashCanvas.width !== fw || c._flashCanvas.height !== fh) {
        c._flashCanvas.width = fw; c._flashCanvas.height = fh;
      }
      const fctx = c._flashCtx;
      fctx.clearRect(0, 0, fw, fh);
      fctx.save();
      fctx.translate(fw / 2, fh / 2);
      // 直前の描画と同じ画像・反転状態を再現
      let img = null, flipX = false, flipY = false, sizeBoost = 1, useHeightBasis = false;
      if (c.type === 'boxing') {
        img = BOXER_IMG;
        if (c.dodgeAnimTimer > 0 && BOXER_DODGE_IMG.complete && BOXER_DODGE_IMG.naturalWidth > 0) img = BOXER_DODGE_IMG;
        else if (c.upperAnimTimer > 0 && BOXER_UPPER_IMG.complete && BOXER_UPPER_IMG.naturalWidth > 0) img = BOXER_UPPER_IMG;
        else if (c.punchAnimTimer > 0 && BOXER_PUNCH_IMG.complete && BOXER_PUNCH_IMG.naturalWidth > 0) img = BOXER_PUNCH_IMG;
        flipX = enemy && enemy.x < c.x;
      } else if (c.type === 'darts') {
        const isThrow = c.throwTimer > 0 && dartsGuy_throw_IMG.complete && dartsGuy_throw_IMG.naturalWidth > 0;
        img = isThrow ? dartsGuy_throw_IMG : dartsGuy_IMG;
        sizeBoost = isThrow ? 1.15 : 1;
        flipX = target && target.x > c.x;
      } else if (c.type === 'timetraveler') {
        img = timetravelarGuy_IMG;
        flipX = enemy && enemy.x < c.x;
      } else if (c.type === 'pingpong') {
        img = (c.swingTimer > 0 && pingpongGuy_shot_IMG.complete && pingpongGuy_shot_IMG.naturalWidth > 0) ? pingpongGuy_shot_IMG : pingpongGuy_IMG;
        flipX = enemy && enemy.x < c.x;
      } else if (c.type === 'tennis') {
        const isShot = c.smashCooldown > 0 && TennisGuy_shot_IMG.complete && TennisGuy_shot_IMG.naturalWidth > 0;
        img = isShot ? TennisGuy_shot_IMG : TennisGuy_IMG;
        flipX = enemy && enemy.x < c.x;
        if (isShot) {
          // ショット画像（高さ基準でスケール）
          // ※他キャラのショット/攻撃モーション画像と大きさを揃えるため等倍に調整
          sizeBoost = 1.0;
          useHeightBasis = true;
        } else {
          // 通常画像は胴体（頭〜腰）の実サイズを基準にスケール・位置調整する
          sizeBoost = 0.95;
          useHeightBasis = true;
        }
      } else if (c.type === 'landmine') {
        img = (c.mineSmileTimer > 0 && LandmineGuy_smile_IMG.complete && LandmineGuy_smile_IMG.naturalWidth > 0) ? LandmineGuy_smile_IMG : LandmineGuy_IMG;
        flipX = enemy && enemy.x < c.x;
      } else if (c.type === 'gunman') {
        img = (c.gunFireTimer > 0 && GunmanGuy_shot_IMG.complete && GunmanGuy_shot_IMG.naturalWidth > 0) ? GunmanGuy_shot_IMG : GunmanGuy_IMG;
        flipX = enemy && enemy.x < c.x;
      } else if (c.type === 'football') {
        img = ((c.footballState === 'charging' || c.footballTackleImgTimer > 0) && AmefotGuy_Tackle_IMG.complete && AmefotGuy_Tackle_IMG.naturalWidth > 0) ? AmefotGuy_Tackle_IMG : AmefotGuy_IMG;
        flipX = enemy && enemy.x < c.x;
      } else if (c.type === 'ghost') {
        img = GhostGuy_IMG;
        flipX = enemy && enemy.x < c.x;
      } else if (c.type === 'bomb') {
        img = BombGuy_IMG;
        flipX = enemy && enemy.x < c.x;
      } else if (c.type === 'trainer') {
        img = TrainerGuy_IMG;
        flipX = enemy && enemy.x < c.x;
      }
      if (img && img.complete && img.naturalWidth > 0) {
        const imgW = img.naturalWidth, imgH = img.naturalHeight;
        const isTennisNormal = (c.type === 'tennis') && (img === TennisGuy_IMG);
        const scaleBasis = isTennisNormal ? TENNIS_BODY_H : (useHeightBasis ? imgH : Math.max(imgW, imgH));
        const scale = (c.r * 2.2 * sizeBoost) / scaleBasis;
        const dw = imgW * scale, dh = imgH * scale;
        const dx = isTennisNormal ? -TENNIS_BODY_CX * scale : -dw / 2;
        const dy = isTennisNormal ? -TENNIS_BODY_CY * scale : -dh / 2;
        if (flipX) fctx.scale(-1, 1);
        if (flipY) fctx.scale(1, -1);
        fctx.drawImage(img, dx, dy, dw, dh);
        fctx.globalCompositeOperation = 'source-in';
        fctx.fillStyle = '#ffffff';
        fctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      }
      fctx.restore();
      ctx.save();
      ctx.globalAlpha = flashAlpha;
      ctx.drawImage(c._flashCanvas, c.x - fw / 2, c.y - fh / 2);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = flashAlpha;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  if (spawnScale !== 1) ctx.restore();
}

// ============================================================
// Twins Guy（ツインズガイ）
// ============================================================

function draw() {
  // 物理キャンバス全体をクリア
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1FA5CB'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!p1char || !p2char) return;

  // 画面シェイク中は、残り時間に応じて減衰するランダムなオフセットを加える（爆発などの演出用）
  let shakeX = 0, shakeY = 0;
  if (screenShake.time > 0) {
    const shakeMul = screenShake.power * (screenShake.time / 22);
    shakeX = rnd(-shakeMul, shakeMul);
    shakeY = rnd(-shakeMul, shakeMul);
  }
  ctx.setTransform(1, 0, 0, 1, shakeX, shakeY);
  for (const s of shockwaves) {
    const alpha = Math.max(0, Math.min(1, s.life));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.strokeStyle = s.color + Math.round(alpha * 220).toString(16).padStart(2, '0');
    ctx.lineWidth = 4 * alpha + 1;
    ctx.stroke();
  }
  for (const p of particles) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fillStyle = p.color + Math.round(p.life * 160).toString(16).padStart(2, '0');
    ctx.fill();
  }
  if (target) drawTarget();
  for (const d of darts) drawDart(d);
  for (const b of pingBalls) drawPingBall(b);
  for (const a of airBullets) drawAirBullet(a);
  for (const s of sausages) drawSausage(s);
  for (const m of landmines) drawLandmine(m);
  for (const b of bullets) drawBullet(b);
  for (const e of eggs) drawEgg(e);
  // リザルト画面(over===true)では、敗者側のキャラクター本体は描画しない
  if (!(over && resultLoserSide === 'p1')) drawChar(p1char, p2char);
  if (!(over && resultLoserSide === 'p2')) drawChar(p2char, p1char);
  // ツインズBを描画
  if (p1twinB) drawTwinsChar(p1twinB, p2char);
  if (p2twinB) drawTwinsChar(p2twinB, p1char);
  // トレーナーガイの召喚キャラを描画
  if (p1summon && p1summon.hp > 0) drawChar(p1summon, p2char);
  if (p2summon && p2summon.hp > 0) drawChar(p2summon, p1char);
  drawTTGFuture();
  if (ttgFuture2) drawTTGFutureObj(ttgFuture2);
  for (const e of timeTravelEffects) drawTimeTravelEffect(e);
  drawBomb();
  for (const t of dmgTexts) {
    ctx.font = '500 30px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = t.color + Math.round(t.life * 255).toString(16).padStart(2, '0');
    ctx.fillText(t.text, t.x, t.y);
  }
  // HPバー（クロス型）はDOMオーバーレイで描画する（枠外にはみ出せるように）
  const hpBarChars = [p1char, p2char, p1twinB, p2twinB, p1summon, p2summon, ttgFuture, ttgFuture2].filter(c => c && c.hp > 0);
  renderHpBadges(hpBarChars);
}

// ============================================================
// HPクロスバッジ（DOMオーバーレイ / 上に飛び出せる版）
// ============================================================
const hpBadgesEl = document.getElementById('hp-badges');
const hpBadgeEls = new Map(); // character object -> DOM要素

function renderHpBadges(chars) {
  if (!hpBadgesEl) return;

  const seen = new Set();
  for (const c of chars) {
    seen.add(c);
    const S = c.r * 1.3;
    const s = S / 3;
    const cx = c.x;
    const cy = c.y - c.r - 6 - S / 2; // キャラの頭上。画面外(負の値)になっても構わない＝飛び出す
    // カメラのズーム・パンを反映した画面座標に変換
    const topLeft = worldToScreen(cx - S / 2, cy - S / 2);
    const left = topLeft.x;
    const top = topLeft.y;
    const size = S * topLeft.scale;
    const pct = Math.max(0, Math.min(1, c.hp / c.maxHp));
    const critical = pct <= 0.3;
    const lostH = 3 * (1 - pct); // viewBox 0-3 の座標系での「欠損」高さ
    const hpText = Math.max(0, Math.round(c.hp));

    let el = hpBadgeEls.get(c);
    if (!el) {
      el = document.createElement('div');
      el.className = 'hp-badge';
      el.innerHTML =
        '<svg viewBox="0 0 3 3" xmlns="http://www.w3.org/2000/svg">' +
          '<defs><clipPath id="hpclip-' + hpBadgeEls.size + '-' + Math.random().toString(36).slice(2,7) + '">' +
            '<polygon points="1,0 2,0 2,1 3,1 3,2 2,2 2,3 1,3 1,2 0,2 0,1 1,1"/>' +
          '</clipPath></defs>' +
          '<polygon class="hp-base" points="1,0 2,0 2,1 3,1 3,2 2,2 2,3 1,3 1,2 0,2 0,1 1,1" stroke="#000" stroke-width="0.13" stroke-linejoin="round"/>' +
          '<rect class="hp-lost" x="0" y="0" width="3" fill="#2b2b2b"/>' +
          '<polygon class="hp-outline" points="1,0 2,0 2,1 3,1 3,2 2,2 2,3 1,3 1,2 0,2 0,1 1,1" fill="none" stroke="#000" stroke-width="0.13" stroke-linejoin="round"/>' +
          '<text class="hp-num" x="1.5" y="1.58" text-anchor="middle" font-weight="800" font-family="sans-serif" stroke="#000" stroke-width="0.16" paint-order="stroke" fill="#fff"></text>' +
        '</svg>';
      hpBadgesEl.appendChild(el);
      hpBadgeEls.set(c, el);
      // クリップパスIDをrectに紐付け
      const clipId = el.querySelector('clipPath').id;
      el.querySelector('.hp-lost').setAttribute('clip-path', 'url(#' + clipId + ')');
    }
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    const base = el.querySelector('.hp-base');
    base.setAttribute('fill', critical ? '#e23a3a' : '#ffffff');
    el.querySelector('.hp-lost').setAttribute('height', lostH.toFixed(3));
    const numEl = el.querySelector('.hp-num');
    numEl.setAttribute('font-size', '0.95');
    numEl.textContent = hpText;
  }
  // 死亡・退場したキャラのバッジは削除
  for (const [c, el] of hpBadgeEls) {
    if (!seen.has(c)) { el.remove(); hpBadgeEls.delete(c); }
  }
}

// ============================================================
// リザルト画面：敗者側キャラクター・関連オブジェクトの排除
// ============================================================
// 飛翔物などのオブジェクトの持ち主（味方）側を判定する（owner/originのどちらの
// プロパティ名を使っているオブジェクトにも対応）
function getArtifactSide(item) {
  if (item && item.side) return item.side; // 地雷は設置時の所属サイドを直接持っているので優先する
  const holder = item.owner || item.origin || item;
  return getTeamSide(holder);
}

function clearLoserSideArtifacts(loserSide) {
  if (!loserSide) return;

  // 敗者側が発射した飛翔物・設置物をすべて取り除く
  darts = darts.filter(d => getArtifactSide(d) !== loserSide);
  pingBalls = pingBalls.filter(b => getArtifactSide(b) !== loserSide);
  airBullets = airBullets.filter(a => getArtifactSide(a) !== loserSide);
  sausages = sausages.filter(s => getArtifactSide(s) !== loserSide);
  landmines = landmines.filter(m => getArtifactSide(m) !== loserSide);
  bullets = bullets.filter(b => getArtifactSide(b) !== loserSide);
  eggs = eggs.filter(e => getArtifactSide(e) !== loserSide);

  // 敗者側の双子（ツインズ）・召喚キャラ（トレーナーガイ）を排除
  if (loserSide === 'p1') { p1twinB = null; p1summon = null; }
  else { p2twinB = null; p2summon = null; }

  // 敗者側が持ち主の未来のタイムトラベラーガイも排除
  if (ttgFuture && getTeamSide(ttgFuture.owner) === loserSide) ttgFuture = null;
  if (ttgFuture2 && getTeamSide(ttgFuture2.owner) === loserSide) ttgFuture2 = null;

  // 敗者側が持ち主の爆弾ガイの爆弾も排除
  if (bomb && getTeamSide(bomb.holder || bomb.owner) === loserSide) bomb = null;
}

// ============================================================
// 勝敗判定
// ============================================================

const TENNIS_BODY_CX = 325;   // 胴体の中心X（画像ピクセル座標）
const TENNIS_BODY_CY = 436;   // 胴体の中心Y（画像ピクセル座標）
const TENNIS_BODY_H = 428;    // 胴体（頭上〜裾）の高さ（画像ピクセル）
