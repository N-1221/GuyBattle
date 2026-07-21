// ============================================================
// Twins Guy（ツインズガイ）のロジック
// ============================================================

function updateTwins(twinA, twinB, enemies) {
  // 両者の HP をリンク（ダメージを受けた側に合わせる）
  const minHp = Math.min(twinA.hp, twinB.hp);
  if (twinA.hp !== minHp) {
    const diff = twinA.hp - minHp;
    twinA.hp = minHp;
    twinA.hitTimer = Math.max(twinA.hitTimer, 8);
    spawnParticles(twinA.x, twinA.y, '#F48FB1', 6);
    spawnDmg(twinA.x, twinA.y - twinA.r - 10, diff, '#F48FB1');
  }
  if (twinB.hp !== minHp) {
    const diff = twinB.hp - minHp;
    twinB.hp = minHp;
    twinB.hitTimer = Math.max(twinB.hitTimer, 8);
    spawnParticles(twinB.x, twinB.y, '#F48FB1', 6);
    spawnDmg(twinB.x, twinB.y - twinB.r - 10, diff, '#F48FB1');
  }

  // ソーセージ投擲
  for (const twin of [twinA, twinB]) {
    if (twin.hp <= 0) continue;
    if (twin.throwTimer > 0) twin.throwTimer--;
    if (twin.sausageCooldown > 0) { twin.sausageCooldown--; continue; }
    // 最も近い敵に向けて投げる
    let target = null, minDist = Infinity;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - twin.x, e.y - twin.y);
      if (d < minDist) { minDist = d; target = e; }
    }
    if (!target) continue;
    const dx = target.x - twin.x, dy = target.y - twin.y;
    const d = Math.hypot(dx, dy) || 1;
    const spd = 7;
    sausages.push({
      x: twin.x, y: twin.y,
      vx: dx / d * spd, vy: dy / d * spd,
      r: 12, owner: twin, ownerTeam: twinA, // チーム識別用
      side: getTeamSide(twin), // どちらの陣営が投げた/最後に打ち返したかを明示的に記録
      age: 0, maxAge: 120,
      trail: []
    });
    twin.throwTimer = 20;
    twin.sausageCooldown = 170;
    spawnParticles(twin.x, twin.y, '#FF8F00', 5);
  }
}

function updateSausages(p1A, p1B, p1Enemies, p2Enemies, p2A, p2B) {
  for (let i = sausages.length - 1; i >= 0; i--) {
    const s = sausages[i];
    s.trail.push({ x: s.x, y: s.y });
    if (s.trail.length > 8) s.trail.shift();
    s.x += s.vx; s.y += s.vy;
    s.age++;

    if (s.x < 0 || s.x > W || s.y > H + 20 || s.age >= s.maxAge) {
      sausages.splice(i, 1); continue;
    }

    // オーナーのチームを特定（打ち返された場合も対応できるよう、記録されたsideを優先して使う）
    const isP1Team = s.side ? (s.side === 'p1') : (s.owner === p1A || s.owner === p1B);
    const enemies  = isP1Team ? p1Enemies : p2Enemies;
    const friendA  = isP1Team ? p1A : p2A;
    const friendB  = isP1Team ? p1B : p2B;

    let hit = false;

    // 敵に命中 → ダメージ
    for (const e of enemies) {
      if (!e || e.hp <= 0) continue;
      if (isFootballInvulnerable(e)) continue; // 突進中のフットボールガイには当たらない
      if (Math.hypot(e.x - s.x, e.y - s.y) >= e.r + s.r) continue;
      if (tryBoxerDodge(e, s.x, s.y)) {
        sausages.splice(i, 1); hit = true; break;
      }
      const dmg = 60;
      e.hp = Math.max(0, e.hp - dmg);
      e.hitTimer = 12;
      sfxPunch();
      spawnParticles(e.x, e.y, '#FF8F00', 14);
      spawnParticles(e.x, e.y, '#FFCC02', 8);
      spawnDmg(e.x, e.y - e.r - 12, dmg, '#FF8F00');
      sausages.splice(i, 1); hit = true; break;
    }
    if (hit) continue;

    // 味方に命中 → 回復（投げた本人以外）
    for (const f of [friendA, friendB]) {
      if (!f || f.hp <= 0 || f === s.owner) continue;
      if (Math.hypot(f.x - s.x, f.y - s.y) >= f.r + s.r) continue;
      const heal = 70;
      const before = f.hp;
      f.hp = Math.min(f.maxHp, f.hp + heal);
      const actual = f.hp - before;
      if (actual > 0) {
        // リンク回復：もう一方にも同量回復
        const other = (f === friendA) ? friendB : friendA;
        if (other && other.hp > 0) {
          other.hp = Math.min(other.maxHp, other.hp + actual);
          spawnParticles(other.x, other.y, '#69F0AE', 8);
          spawnDmg(other.x, other.y - other.r - 12, actual, '#69F0AE');
        }
        spawnParticles(f.x, f.y, '#69F0AE', 12);
        spawnDmg(f.x, f.y - f.r - 12, actual, '#69F0AE');
      }
      sausages.splice(i, 1); hit = true; break;
    }
  }
}

function drawSausage(s) {
  const angle = Math.atan2(s.vy, s.vx);
  // トレイル
  for (let i = 0; i < s.trail.length; i++) {
    const a = (i / s.trail.length) * 0.25;
    ctx.beginPath();
    ctx.arc(s.trail[i].x, s.trail[i].y, s.r * 0.4 * (i / s.trail.length), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(160,82,45,${a})`;
    ctx.fill();
  }

  const img = (Sausage_IMG.complete && Sausage_IMG.naturalWidth > 0) ? Sausage_IMG : null;
  if (img) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);
    const imgW = img.naturalWidth, imgH = img.naturalHeight;
    // 長さ(s.r*4.4)を基準に画像サイズをスケール
    const scale = (s.r * 4.4) / Math.max(imgW, imgH);
    const dw = imgW * scale, dh = imgH * scale;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(angle);

  const len = s.r * 2.2;  // 長さ（半分）
  const wid = s.r * 0.65; // 太さ（半分）

  // ソーセージ本体：先端を細くとがらせたカプセル形
  ctx.beginPath();
  // 右先端（やや尖る）
  ctx.moveTo(len, 0);
  ctx.bezierCurveTo(len * 0.85, wid * 0.6,  len * 0.5, wid, 0, wid);
  ctx.bezierCurveTo(-len * 0.5, wid, -len * 0.85, wid * 0.6, -len, 0);
  ctx.bezierCurveTo(-len * 0.85, -wid * 0.6, -len * 0.5, -wid, 0, -wid);
  ctx.bezierCurveTo(len * 0.5, -wid, len * 0.85, -wid * 0.6, len, 0);
  ctx.closePath();

  // グラデーション（焼き色）
  const grad = ctx.createLinearGradient(0, -wid, 0, wid);
  grad.addColorStop(0, '#C8733A');
  grad.addColorStop(0.35, '#A0522D');
  grad.addColorStop(0.7, '#7B3B1E');
  grad.addColorStop(1, '#5C2A10');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#4A1F0A'; ctx.lineWidth = 1.5;
  ctx.stroke();

  // 表面のテクスチャ線（縦しわ）
  ctx.strokeStyle = 'rgba(80,35,10,0.4)'; ctx.lineWidth = 1;
  for (const ox of [-len * 0.45, 0, len * 0.45]) {
    const hw = wid * Math.sqrt(Math.max(0, 1 - (ox / len) ** 2)) * 0.9;
    ctx.beginPath();
    ctx.moveTo(ox, -hw);
    ctx.lineTo(ox, hw);
    ctx.stroke();
  }

  // ハイライト
  ctx.beginPath();
  ctx.ellipse(-len * 0.1, -wid * 0.3, len * 0.5, wid * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,220,180,0.35)';
  ctx.fill();

  ctx.restore();
}

function drawTwinsChar(c, enemy) {
  if (c.hp <= 0) { ctx.globalAlpha = 0.25; }
  // トレイル
  for (let i = 0; i < c.trail.length; i++) {
    const a = (i / c.trail.length) * 0.25;
    ctx.beginPath(); ctx.arc(c.trail[i].x, c.trail[i].y, c.r * (i / c.trail.length), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(233,30,99,${a})`; ctx.fill();
  }
  // 本体円
  ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  ctx.fillStyle = c.hitTimer > 0 ? c.lightColor : c.color;
  ctx.fill();
  ctx.strokeStyle = '#880E4F'; ctx.lineWidth = 3; ctx.stroke();
  // 絵文字
  ctx.globalAlpha = c.hp <= 0 ? 0.25 : 1;
  ctx.font = '34px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(c.emoji, c.x, c.y + 2);
  // A/Bラベル
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  ctx.strokeText(c.twinId, c.x, c.y + c.r - 10);
  ctx.fillText(c.twinId, c.x, c.y + c.r - 10);
  // ダメージフラッシュ
  if (c.hitTimer > 0) {
    const flashAlpha = Math.min(1, c.hitTimer / 5);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = flashAlpha;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}


function drawHpCross(c) {
  if (c.hp <= 0) return;
  ctx.save(); // ← 全体をsave/restoreで囲んで色漏れを防ぐ
  const S = c.r * 1.3;
  const s = S / 3;
  const margin = 4;
  let cx = c.x;
  let cy = c.y - c.r - 6 - S / 2;
  // 上端でクロスが切れてしまわないように、はみ出す分だけキャラの下側（体に重ねる形）へ逃がす
  if (cy - S / 2 < margin) cy = margin + S / 2;
  // 左右端でも切れないようにクランプ
  if (cx - S / 2 < margin) cx = margin + S / 2;
  if (cx + S / 2 > W - margin) cx = W - margin - S / 2;
  const left = cx - S / 2, top = cy - S / 2;

  function crossPath() {
    ctx.beginPath();
    ctx.moveTo(left + s,   top);
    ctx.lineTo(left + 2*s, top);
    ctx.lineTo(left + 2*s, top + s);
    ctx.lineTo(left + 3*s, top + s);
    ctx.lineTo(left + 3*s, top + 2*s);
    ctx.lineTo(left + 2*s, top + 2*s);
    ctx.lineTo(left + 2*s, top + 3*s);
    ctx.lineTo(left + s,   top + 3*s);
    ctx.lineTo(left + s,   top + 2*s);
    ctx.lineTo(left,       top + 2*s);
    ctx.lineTo(left,       top + s);
    ctx.lineTo(left + s,   top + s);
    ctx.closePath();
  }

  const pct = Math.max(0, Math.min(1, c.hp / c.maxHp));
  const critical = pct <= 0.3;

  ctx.save();
  crossPath();
  ctx.clip();
  ctx.fillStyle = critical ? '#e23a3a' : '#ffffff';
  ctx.fillRect(left, top, S, S);
  const lostH = S * (1 - pct);
  if (lostH > 0.5) {
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(left, top, S, lostH);
  }
  ctx.restore();

  crossPath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  ctx.stroke();

  const hpText = Math.max(0, Math.round(c.hp));
  ctx.font = '800 20px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = '#000';
  ctx.strokeText(hpText, cx, cy);
  ctx.fillStyle = '#fff';
  ctx.fillText(hpText, cx, cy);

  ctx.restore(); // ← 全体のrestore
}



// --- 画像アセット ---
const Sausage_IMG = new Image();
Sausage_IMG.src = "Sausage.png"
