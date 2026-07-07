// ============================================================
// ユーティリティ
// ============================================================
function rnd(a, b) { return a + Math.random() * (b - a); }
function randVel(spd) {
  const a = Math.random() * Math.PI * 2;
  return { vx: Math.cos(a) * spd, vy: Math.sin(a) * spd };
}

// ============================================================
// キャンバス
// ============================================================
const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');
// ゲームロジック上の論理サイズ（この値を変えるとキャラ・フィールドの比率が変わってしまうため固定）
const W = 500, H = 500;
// 画面全体を拡大する倍率。実際のキャンバス解像度だけを引き伸ばし、
// 描画時にctx側で拡大することでキャラ・フィールドの比率はそのまま保つ
const GAME_SCALE = 1.3;
canvas.width = W * GAME_SCALE;
canvas.height = H * GAME_SCALE;

// ============================================================
// 追尾カメラ（対戦者たちを追いかけてズーム/パンする）
// ============================================================
const CAMERA_MIN_ZOOM = 1.0;   // 通常時（フィールド全体表示）
const CAMERA_MAX_ZOOM = 1.7;   // 最大ズーム（キャラ同士が近いとき）
const CAMERA_PADDING = 130;    // 被写体の周囲に確保する余白（論理px）
const CAMERA_SMOOTH = 0.08;    // 追従の滑らかさ（0-1、大きいほど素早く追従）
let camX = W / 2, camY = H / 2, camZoom = CAMERA_MIN_ZOOM;

// 現在のカメラ目標（被写体の中心・ズーム）を計算して、なめらかに追従させる
function updateCamera() {
  if (!p1char || !p2char) return;
  const targets = [p1char, p2char, p1twinB, p2twinB, p1summon, p2summon]
    .filter(c => c && c.hp > 0);
  if (targets.length === 0) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of targets) {
    minX = Math.min(minX, c.x - c.r);
    maxX = Math.max(maxX, c.x + c.r);
    minY = Math.min(minY, c.y - c.r);
    maxY = Math.max(maxY, c.y + c.r);
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY) + CAMERA_PADDING * 2;

  // 被写体が収まる最大のズームを算出（狭いほど大きくズーム、離れるほど1.0に近づく）
  let targetZoom = W / span;
  targetZoom = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, targetZoom));

  // ズームに応じた表示範囲がフィールド内に収まるよう中心をクランプ
  const halfView = (W / targetZoom) / 2;
  const targetX = Math.max(halfView, Math.min(W - halfView, centerX));
  const targetY = Math.max(halfView, Math.min(H - halfView, centerY));

  // なめらかに追従
  camX += (targetX - camX) * CAMERA_SMOOTH;
  camY += (targetY - camY) * CAMERA_SMOOTH;
  camZoom += (targetZoom - camZoom) * CAMERA_SMOOTH;
}

// ワールド座標(論理px) -> canvasのCSS表示座標（HPバッジ等のDOMオーバーレイ用）
function worldToScreen(wx, wy) {
  const rectScale = (canvas.clientWidth || canvas.width) / canvas.width;
  const px = (wx - camX) * GAME_SCALE * camZoom + canvas.width / 2;
  const py = (wy - camY) * GAME_SCALE * camZoom + canvas.height / 2;
  return { x: px * rectScale, y: py * rectScale, scale: GAME_SCALE * camZoom * rectScale };
}

// ============================================================
// サウンドエンジン（Web Audio API）
// ============================================================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// 効果音全体のマスターボリューム（全体的に下げる場合はここを調整）
const SFX_MASTER_VOLUME = 0.6;

// 卓球ボール音（mp3）
const BALL_HIT_SOUND_SRC = "the-sound-of-hitting-the-ball.mp3"
function playBallHitSound(vol = 0.5) {
  const a = new Audio(BALL_HIT_SOUND_SRC);
  a.volume = vol * SFX_MASTER_VOLUME;
  a.play().catch(() => {});
}

// ボクシングの鐘の音（決着時）
const BOXING_BELL_SOUND_SRC = "試合終了のゴング.mp3";
function playBoxingBell() {
  const a = new Audio(BOXING_BELL_SOUND_SRC);
  a.volume = 0.25;
  a.play().catch(() => {});
}

// ============================================================
// 各アクション別効果音（音声ファイルを使うものだけ残す）
// ============================================================

// 🥊 通常パンチ：打撃音（mp3）
const PUNCH_SOUND_SRC = "中パンチ.mp3";
function sfxPunch() {
  const a = new Audio(PUNCH_SOUND_SRC);
  a.volume = 0.45 * SFX_MASTER_VOLUME;
  a.play().catch(() => {});
}

// 🏓 ピンポン発射：「カッ」
function sfxPingFire() {
  playBallHitSound(0.4);
}

// 🏓 ピンポン壁反射：「カンッ」（高め・短い）
function sfxPingWall() {
  playBallHitSound(0.35);
}

// 🏓 ピンポン命中：「コンッ」（やや低め）
function sfxPingHit() {
  playBallHitSound(0.5);
}

// 🏓 ピンポンガイの打ち返し：「コンッ」（ラケット風・少し硬め）
function sfxPingReturn() {
  playBallHitSound(0.45);
}

// 🎾 テニスガイ攻撃音（mp3）
const TENNIS_HIT_SOUND_SRC = "テニス.mp3";
function sfxTennisHit() {
  const a = new Audio(TENNIS_HIT_SOUND_SRC);
  a.volume = 0.6 * SFX_MASTER_VOLUME;
  a.play().catch(() => {});
}

// 勝利ファンファーレ（ボクシングの鐘）
function sfxWin() {
  playBoxingBell();
}

// ============================================================
// ゲーム状態
// ============================================================
let running = false, over = false, animId = null;
let sc1 = 0, sc2 = 0;
let p1char, p2char, target;
let resultWinner = null; // リザルト画面で動き続ける勝者
let darts = [], pingBalls = [], particles = [], dmgTexts = [], airBullets = [], timeTravelEffects = [];
// ダーツの的が0になった時の放射ダーツ攻撃（3連）の状態管理
let targetBurstPending = 0, targetBurstTimer = 0, targetBurstOrigin = null, targetBurstOwner = null;
const TARGET_BURST_TOTAL = 3;     // 放射攻撃の連射回数
const TARGET_BURST_INTERVAL = 14; // 連射の間隔（フレーム）
let ttgFuture = null; // タイムトラベラーガイ（未来）
let ttgFuture2 = null; // タイムトラベラーガイ（未来）P2側（TTG vs TTG 用）
// 空気砲（タイムトラベラーガイの通常攻撃）※上方修正でダメージ増加・クールタイム短縮
const AIR_CANNON_DAMAGE = 34;
const AIR_CANNON_COOLDOWN = 105;
const AIR_CANNON_SPEED = 7;
let sausages = []; // ツインズガイのソーセージ弾
let p1twinB = null, p2twinB = null; // ツインズ側の双子B（p1char/p2charはA）
let bomb = null; // 爆弾ガイの爆弾の状態（持ち主・タイマー・点滅など）
const BOMB_TIME_LIMIT = 30 * 60;   // 制限時間30秒（60fps想定）
const BOMB_BLINK_TIME = 3 * 60;    // 残り3秒から点滅警告
const BOMB_PASS_COOLDOWN = 20;     // 受け渡し直後の連続受け渡し防止フレーム数
let landmines = []; // 地雷ガイが設置した地雷の配列
const LANDMINE_STOP_TIME = 150;    // 壁に激突してから動けるようになるまでのフレーム数（約2.5秒）
const LANDMINE_MINE_COOLDOWN = 90; // 動けるようになった後、次の地雷を設置できるようになるまでの追加クールダウン（約1.5秒）
const LANDMINE_MAX_PER_OWNER = 4;  // 1人が同時に設置できる地雷の上限（超えたら古いものから消える）
let bullets = []; // ガンマンガイの銃弾の配列
const PINGPONG_BALL_SPEED = 18.0; // 卓球ボールの基本速度 ※少しだけ上方修正（元は16.0）
let eggs = []; // トレーナーガイの卵の配列
let p1summon = null, p2summon = null; // トレーナーガイが卵から召喚した仲間キャラ（各サイド1体まで）
const TRAINER_SUMMON_FORMS = ['boxing', 'tennis', 'pingpong', 'gunman', 'landmine', 'football', 'ghost']; // 卵から出てくる候補（共有ステートを必要としないキャラのみ）
const TRAINER_EGG_COOLDOWN = 65;   // 召喚キャラがいない間、次の卵を投げるまでの間隔（フレーム）※上方修正で短縮
const TRAINER_EGG_SPEED = 6.2;     // 卵の飛翔速度
const TRAINER_EGG_DAMAGE = 38;     // 卵が命中した時のダメージ ※上方修正で増加
const TRAINER_SUMMON_HP = 550;     // 召喚キャラのHP（本家の1000に対して低め）※上方修正で増加
const TRAINER_SUMMON_R_SCALE = 0.9; // 召喚キャラの見た目の大きさ（本家より一回り小さく）※上方修正でやや拡大


// ============================================================
// キャラ選択UI
// ============================================================
let selectedP1 = null, selectedP2 = null;

function buildCharSelect() {
  ['p1', 'p2'].forEach(player => {
    const container = document.getElementById('cs-' + player);
    container.innerHTML = '';
    ROSTER.forEach(def => {
      const card = document.createElement('div');
      card.className = 'cs-card';
      // 前回の選択を復元
      if ((player === 'p1' && selectedP1 === def.id) || (player === 'p2' && selectedP2 === def.id)) {
        card.classList.add('selected');
      }
      card.innerHTML = `<span class="cs-emoji">${def.emoji}</span><div class="cs-name">${def.name}</div>`;
      card.addEventListener('click', () => {
        container.querySelectorAll('.cs-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        if (player === 'p1') selectedP1 = def.id;
        else selectedP2 = def.id;
        document.getElementById('cs-start').classList.toggle('ready', !!(selectedP1 && selectedP2));
      });
      container.appendChild(card);
    });
  });
}

document.getElementById('cs-start').addEventListener('click', () => {
  if (!selectedP1 || !selectedP2) return;
  getAudioCtx(); // ユーザー操作でAudioContext初期化
  document.getElementById('char-select').style.display = 'none';
  document.getElementById('battle').style.display = 'flex';
  startBattle(selectedP1, selectedP2);
});

// ============================================================
// バトル開始
// ============================================================
function startBattle(id1, id2) {
  const def1 = ROSTER.find(r => r.id === id1);
  const def2 = ROSTER.find(r => r.id === id2);

  // タイムトラベラーが含まれる場合、時間ループシミュレーションを実行
  const hasTTG = (id1 === 'timetraveler' || id2 === 'timetraveler');
  let loopX = null;
  if (hasTTG) {
    loopX = runTimeLoopSimulation(id1, id2);
  }

  p1char = def1.makeChar('p1');
  p2char = def2.makeChar('p2');

  // タイムループ収束値を設定（TTG vs TTG の場合は両方にそれぞれシミュレーション）
  if (hasTTG) {
    if (id1 === 'timetraveler' && id2 === 'timetraveler') {
      // 両方TTG：それぞれ相手キャラとしてシミュレーション
      p1char.timeLoopX = runTimeLoopSimulation('timetraveler', 'timetraveler');
      p2char.timeLoopX = runTimeLoopSimulation('timetraveler', 'timetraveler');
    } else {
      const ttgChar = (p1char.type === 'timetraveler') ? p1char : p2char;
      ttgChar.timeLoopX = loopX;
    }
  }

  const hasDarts = (id1 === 'darts' || id2 === 'darts');
  if (hasDarts) {
    const tv = randVel(rnd(2.5, 3.5));
    target = { x: rnd(W/2-60, W/2+60), y: rnd(80, H-80), vx: tv.vx, vy: tv.vy, r: 25, trail: [], hp: 301, maxHp: 301 };
  } else {
    target = null;
  }
  darts = []; pingBalls = []; particles = []; dmgTexts = []; airBullets = []; timeTravelEffects = []; sausages = [];
  landmines = []; bullets = []; eggs = []; p1summon = null; p2summon = null;
  targetBurstPending = 0; targetBurstTimer = 0; targetBurstOrigin = null; targetBurstOwner = null;
  ttgFuture = null;
  ttgFuture2 = null;
  // ツインズの双子Bを初期化
  p1twinB = (p1char.type === 'twins') ? p1char.twinB : null;
  p2twinB = (p2char.type === 'twins') ? p2char.twinB : null;
  // 爆弾ガイの爆弾を初期化（最初は爆弾ガイ自身が保持。まだタイマーは始動しない）
  if (p1char.type === 'bomb' || p2char.type === 'bomb') {
    bomb = {
      holder: (p1char.type === 'bomb') ? p1char : p2char,
      timer: BOMB_TIME_LIMIT,
      started: false,
      blinking: false,
      exploded: false,
      passCooldown: 0
    };
  } else {
    bomb = null;
  }
  over = false; running = true;
  // 追尾カメラをフィールド全体表示にリセット
  camX = W / 2; camY = H / 2; camZoom = CAMERA_MIN_ZOOM;
  document.getElementById('name1').textContent = def1.emoji + ' ' + def1.name;
  document.getElementById('name2').textContent = def2.emoji + ' ' + def2.name;
  document.getElementById('msg').textContent = '戦闘中...';
  document.getElementById('btn-toggle').textContent = '⏸ 一時停止';
  animId = requestAnimationFrame(loop);
}

// ============================================================
// リセット → 選択画面へ
// ============================================================
function doReset() {
  running = false; over = false;
  resultWinner = null;
  cancelAnimationFrame(animId);
  darts = []; pingBalls = []; particles = []; dmgTexts = []; airBullets = []; timeTravelEffects = []; sausages = [];
  landmines = []; bullets = []; eggs = []; p1summon = null; p2summon = null;
  targetBurstPending = 0; targetBurstTimer = 0; targetBurstOrigin = null; targetBurstOwner = null;
  ttgFuture = null;
  ttgFuture2 = null;
  p1twinB = null; p2twinB = null;
  bomb = null;
  document.getElementById('battle').style.display = 'none';
  document.getElementById('char-select').style.display = 'flex';
  // 前回の選択を保持したままUIを再構築
  buildCharSelect();
  if (selectedP1 && selectedP2) {
    document.getElementById('cs-start').classList.add('ready');
  }
}

document.getElementById('btn-reset').addEventListener('click', doReset);
document.getElementById('btn-toggle').addEventListener('click', () => {
  if (over) { doReset(); return; }
  running = !running;
  if (running) {
    document.getElementById('btn-toggle').textContent = '⏸ 一時停止';
    document.getElementById('msg').textContent = '戦闘中...';
    animId = requestAnimationFrame(loop);
  } else {
    document.getElementById('btn-toggle').textContent = '▶ 再開';
    cancelAnimationFrame(animId);
  }
});
document.addEventListener('keydown', e => {
  if (e.key === ' ' && document.getElementById('battle').style.display !== 'none') {
    e.preventDefault();
    document.getElementById('btn-toggle').click();
  }
});

// ============================================================
// Changing Guy：HPが200減るたびに別のガイへランダム変身する
// ============================================================
// 変身先の候補（的やツインズB、爆弾保持者、タイムループなど
// 専用の共有ステート・セットアップを必要としないキャラのみに限定）
const CHANGE_GUY_FORMS = ['boxing', 'tennis', 'pingpong', 'gunman', 'landmine', 'football', 'ghost'];
// 変身時も「Changing Guy」としての見た目のアイデンティティ（名前・絵文字）と
// 座標・速度・HPなど共通ステータスは維持する
const CHANGE_GUY_KEEP_KEYS = new Set([
  'x', 'y', 'vx', 'vy', 'baseSpd', 'r', 'hp', 'maxHp',
  'trail', 'hitTimer', 'hitstop', 'knockback',
  'name', 'emoji', 'isChangeGuy', 'form', 'hpCheckpoint',
  '_flashCanvas', '_flashCtx'
]);

// 変身直後に無防備になる時間（フレーム数）。戦闘開始時の初回フォーム決定では発生させない
const CHANGE_GUY_TRANSFORM_STUN = 40;

function transformChangeGuy(c, isInitial) {
  // 直前と同じフォームには変身しないようにする（毎回ちゃんと「変わった」とわかるように）
  const oldForm = c.form;
  const pool = CHANGE_GUY_FORMS.filter(id => id !== oldForm);
  const nextForm = pool[Math.floor(Math.random() * pool.length)];
  const def = ROSTER.find(d => d.id === nextForm);
  if (!def) return;
  // 新フォームのテンプレートキャラを作り、攻撃クールダウンなど
  // フォーム固有のプロパティだけを取り込む（座標・速度・HP等は維持）
  const template = def.makeChar('p1');
  for (const key in template) {
    if (!CHANGE_GUY_KEEP_KEYS.has(key)) c[key] = template[key];
  }
  c.type = nextForm;
  c.form = nextForm;
  // 卓球ガイでなくなったら、自分が発射した卓球玉は残さず消す（打ち返されて所有者表示が変わっていても対象にする）
  if (oldForm === 'pingpong' && nextForm !== 'pingpong') {
    for (let i = pingBalls.length - 1; i >= 0; i--) {
      if (pingBalls[i].origin === c) pingBalls.splice(i, 1);
    }
  }
  // HPが減って変身した場合のみ、その場に固まって無防備になる隙を発生させる
  // （戦闘開始時の初回フォーム決定ではノーリスクで即行動できるようにする）
  if (!isInitial) c.transformStun = CHANGE_GUY_TRANSFORM_STUN;
  spawnParticles(c.x, c.y, '#FFC107', 26);
  spawnParticles(c.x, c.y, '#ffffff', 12);
}

// ============================================================
// 物理・攻撃ロジック
// ============================================================
function moveChar(c) {
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
    if (spd > 0) { c.vx = (c.vx / spd) * c.baseSpd; c.vy = (c.vy / spd) * c.baseSpd; }
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
// これまでは updateBoxing 内のパンチ判定にしか回避が実装されておらず、
// フットボールの突進・ダーツ・銃弾・地雷・空気砲・ソーセージなど
// ボクシング以外の攻撃には一切回避が発生しないバグがあった。
// ここに共通化し、各攻撃の命中判定の直前で呼び出すことで、
// ボクサーガイはどんな攻撃に対しても一定確率で回避できるようにする。
// 回避が成立した場合は true を返すので、呼び出し側はダメージ処理を行わないこと。
// ============================================================
function tryBoxerDodge(defender, srcX, srcY) {
  if (!defender || defender.type !== 'boxing') return false;
  if (defender.hp <= 0) return false;
  if (defender.dodgeCooldown > 0) return false;
  if (Math.random() >= 0.18) return false;
  defender.dodgeAnimTimer = 18;
  defender.dodgeCooldown = 60;
  const dx = defender.x - srcX, dy = defender.y - srcY;
  const d = Math.hypot(dx, dy) || 1;
  defender.vx = (dx / d) * 6;
  defender.vy = (dy / d) * 6;
  defender.knockback = 16;
  dmgTexts.push({ x: defender.x, y: defender.y - defender.r - 24, text: 'DODGE!', life: 1.0, color: '#7CF7FF' });
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
const FOOTBALL_WINDUP_TIME = 100;   // 突進前に立ち止まる時間（フレーム数、約1.7秒）
const FOOTBALL_CHARGE_MAX_TIME = 240; // 突進の最大継続時間（壁に届かなかった場合の保険）
const FOOTBALL_CHARGE_SPEED_MUL = 8.5; // 突進時の速度倍率（baseSpd比）※強化前は7.5
const FOOTBALL_CHARGE_COOLDOWN = 110;  // 突進終了後、次のwindupが始まるまでの時間
const FOOTBALL_DAMAGE_NEAR = 200;   // 突進開始時、相手がすぐ近くにいた場合のダメージ（至近距離＝最大）※強化前は180
const FOOTBALL_DAMAGE_FAR = 75;     // 突進開始時、相手が遠くにいた場合のダメージ（遠距離＝最小）※強化前は60
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
function isGhostIntangible(c) {
  return !!c && c.type === 'ghost';
}

function updateFootball(attacker, defender) {
  if (attacker.hp <= 0 || attacker.transformStun > 0) return;
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
      attacker.footballState = 'charging';
      attacker.footballTimer = FOOTBALL_CHARGE_MAX_TIME;
      attacker.footballHitDone = false;
      attacker.footballChargeStartDist = d; // 突進開始時点の相手との距離（ダメージ計算に使う）
      spawnParticles(attacker.x, attacker.y, '#8D6E63', 14);
    }
  } else if (attacker.footballState === 'charging') {
    // 突進中：相手に当たったら一度だけダメージ＋ノックバック（突進自体は止めず継続）
    // ダメージは突進開始時の距離に応じて変動（近距離から突っ込むほど高威力、遠距離だと威力が下がる）
    if (!attacker.footballHitDone && defender.hp > 0) {
      const dist = Math.hypot(defender.x - attacker.x, defender.y - attacker.y);
      if (dist < attacker.r + defender.r) {
        attacker.footballHitDone = true; // 回避されても同じ突進で再ヒット判定はしない
        if (isGhostIntangible(defender)) {
          // ゴーストガイには当たってもダメージが入らない（貫通する）
        } else if (tryBoxerDodge(defender, attacker.x, attacker.y)) {
          // 回避成功：ダメージなし
        } else {
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
    // 壁に到達するまで突進を止めない（moveChar側で座標が壁際にクランプされているかで判定）
    const atWall = attacker.x <= attacker.r + 0.5 || attacker.x >= W - attacker.r - 0.5 ||
                   attacker.y <= attacker.r + 0.5 || attacker.y >= H - attacker.r - 0.5;
    if (atWall || --attacker.footballTimer <= 0) {
      // 突進終了：通常の徘徊速度に戻し、しばらく経ったらまた立ち止まる
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
const GHOST_DAMAGE = 15;
const GHOST_DAMAGE_TICK = 8; // ダメージが入る間隔（フレーム数）

function updateGhost(attacker, defender) {
  if (attacker.hp <= 0 || defender.hp <= 0 || attacker.transformStun > 0) return;
  const dist = Math.hypot(defender.x - attacker.x, defender.y - attacker.y);
  const overlapping = dist < attacker.r + defender.r;
  if (overlapping && !isFootballInvulnerable(defender)) {
    if (attacker.ghostDamageCooldown > 0) {
      attacker.ghostDamageCooldown--;
    } else {
      attacker.ghostDamageCooldown = GHOST_DAMAGE_TICK;
      if (!tryBoxerDodge(defender, attacker.x, attacker.y)) {
        defender.hp = Math.max(0, defender.hp - GHOST_DAMAGE);
        defender.hitTimer = 6;
        spawnParticles(defender.x, defender.y, '#B39DDB', 6);
        spawnDmg(defender.x, defender.y - defender.r - 12, GHOST_DAMAGE, '#B39DDB');
      }
    }
  } else {
    // 離れたら次に重なった時すぐダメージが入るようクールダウンをリセット
    attacker.ghostDamageCooldown = 0;
  }
}

// Boxing攻撃
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

  // 躱し判定（被弾側がCDなしなら一定確率で回避）
  if (defender.dodgeCooldown === 0 && Math.random() < 0.18) {
    defender.dodgeAnimTimer = 18;
    defender.dodgeCooldown = 60;
    attacker.punchCooldown = isUpperAngle ? 10 : 6;
    attacker.comboCount = 0; // 躱されたら連続パンチは途切れる
    // 攻撃者から離れる方向へ後退（ゴーストガイは貫通するので後退させない）
    const ndx = dx / (dist || 1), ndy = dy / (dist || 1);
    if (!isGhostIntangible(defender)) {
      defender.vx = -ndx * 6;
      defender.vy = -ndy * 6;
      defender.knockback = 16;
    }
    dmgTexts.push({ x: defender.x, y: defender.y - defender.r - 24, text: 'DODGE!', life: 1.0, color: '#7CF7FF' });
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
    dmgTexts.push({ x: attacker.x, y: attacker.y - attacker.r - 24, text: 'UPPER!!', life: 1.2, color: '#FFD700' });
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
      dmgTexts.push({ x: attacker.x, y: attacker.y - attacker.r - 24, life: 1.2, color: '#FFD700' });
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
function updateDarts_shoot(attacker) {
  if (attacker.hp <= 0 || attacker.transformStun > 0) return;
  if (attacker.dartCooldown > 0) { attacker.dartCooldown--; return; }
  attacker.burstCount = 3;
  attacker.burstInterval = 0;
  attacker.dartCooldown = 75;
}
function updateDarts_burst(attacker) {
  if (!attacker.burstCount || attacker.burstCount <= 0) return;
  if (attacker.burstInterval > 0) { attacker.burstInterval--; return; }
  if (!target) return;
  const spd = 5.0;
  const dx = target.x - attacker.x, dy = target.y - attacker.y;
  const d = Math.hypot(dx, dy) || 1;
  const spawnDist = attacker.r + 12; // 自分の体の外側から発射し、自己反射バグを防ぐ
  darts.push({
    x: attacker.x + (dx / d) * spawnDist,
    y: attacker.y + (dy / d) * spawnDist,
    vx: dx/d*spd, vy: dy/d*spd, stuck: false, stuckTimer: 0, owner: attacker
  });
  attacker.throwTimer = 18; // 投げモーション表示フレーム数
  attacker.burstCount--;
  attacker.burstInterval = 3;
}

// 的が0になった時の放射ダーツ攻撃：1回分（32本）を発射するヘルパー
function spawnDartTargetBurst(origin, owner) {
  const burstCount = 32;
  const burstSpd = 6.0;
  for (let bi = 0; bi < burstCount; bi++) {
    const ang = (Math.PI * 2 / burstCount) * bi;
    const bx = Math.cos(ang), by = Math.sin(ang);
    darts.push({
      x: origin.x + bx * (origin.r + 10),
      y: origin.y + by * (origin.r + 10),
      vx: bx * burstSpd, vy: by * burstSpd,
      stuck: false, stuckTimer: 0,
      owner: owner,
      isBurst: true
    });
  }
  spawnParticles(origin.x, origin.y, '#FF3300', 40);
}

function updateDartProjectiles() {
  // 的の放射ダーツ攻撃（3連）の残り発射を処理
  if (targetBurstPending > 0) {
    targetBurstTimer--;
    if (targetBurstTimer <= 0) {
      spawnDartTargetBurst(targetBurstOrigin, targetBurstOwner);
      targetBurstPending--;
      targetBurstTimer = TARGET_BURST_INTERVAL;
    }
  }
  for (let i = darts.length - 1; i >= 0; i--) {
    const d = darts[i];
    if (d.stuck) {
      if (--d.stuckTimer <= 0) darts.splice(i, 1);
      continue;
    }
    d.x += d.vx; d.y += d.vy;
    // 的に当たる
    if (target && Math.hypot(target.x - d.x, target.y - d.y) < target.r + 7) {
      // ダーツだけが的にダメージを与える（バーストダーツはダメージ固定50）
      const dmgPool = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,24,25,26,27,28,30,32,33,34,36,38,39,40,42,45,48,50];
      const remaining = target.hp;
      // 的の残りHPがちょうど1のときは「フィニッシュ」を決めやすいよう、
      // 攻撃力1のダーツを引く確率を通常よりかなり高くする
      const DART_FINISH_BOOST_CHANCE = 0.5;
      let dmg;
      if (d.isBurst) {
        dmg = 50;
      } else if (remaining === 1 && Math.random() < DART_FINISH_BOOST_CHANCE) {
        dmg = 1;
      } else {
        dmg = dmgPool[Math.floor(Math.random() * dmgPool.length)];
      }
      // 本物のダーツ501ルールと同様：残りHPを超過(バースト)する場合はそのダメージはなかったことにする
      if (dmg > remaining) {
        spawnParticles(target.x, target.y, '#999999', 5);
        dmgTexts.push({ x: target.x, y: target.y - 30, text: 'BUST!', life: 1.0, color: '#AAAAAA' });
        d.stuck = true; d.stuckTimer = 40;
        continue;
      }
      const prevHp = target.hp;
      target.hp = Math.max(0, target.hp - dmg);
      spawnParticles(target.x, target.y, '#FFD700', 6);
      spawnDmg(target.x, target.y, dmg, '#FFD700');
      // ぴったり0になったら的から32本のダーツが放射状に発射（3連、ダメージはすべて50）
      if (prevHp > 0 && target.hp === 0) {
        dmgTexts.push({ x: target.x, y: target.y - 40, text: '💥 BULLSEYE!! 3連射', life: 1.5, color: '#FF3300' });
        // 的をリセット
        const tv2 = randVel(rnd(2.5, 3.5));
        target.hp = target.maxHp;
        target.vx = tv2.vx; target.vy = tv2.vy;
        // 放射ダーツ攻撃を3連発に設定（1発目は即発射、残り2発は間隔を空けて発射）
        targetBurstOrigin = { x: target.x, y: target.y, r: target.r };
        targetBurstOwner = d.owner;
        spawnDartTargetBurst(targetBurstOrigin, targetBurstOwner);
        targetBurstPending = TARGET_BURST_TOTAL - 1;
        targetBurstTimer = TARGET_BURST_INTERVAL;
      }
      d.stuck = true; d.stuckTimer = 40;
      continue;
    }
    // 相手に命中
    const enemy = d.owner === p1char ? p2char : p1char;
    // TTG未来も命中対象に含める
    const dartTargets = [enemy];
    if (ttgFuture && ttgFuture.hp > 0 && d.owner !== ttgFuture) dartTargets.push(ttgFuture);
    if (ttgFuture2 && ttgFuture2.hp > 0 && d.owner !== ttgFuture2) dartTargets.push(ttgFuture2);
    let dartHit = false;
    for (const tgt of dartTargets) {
      if (tgt.hp > 0 && Math.hypot(tgt.x - d.x, tgt.y - d.y) < tgt.r + 7 && !isFootballInvulnerable(tgt)) {
        if (tryBoxerDodge(tgt, d.x, d.y)) {
          // 回避成功：ダーツはその場に落ちる（ダメージなし）
        } else {
          const dmgPool = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,24,25,26,27,28,30,32,33,34,36,38,39,40,42,45,48,50];
          const dmg = d.isBurst ? 50 : dmgPool[Math.floor(Math.random() * dmgPool.length)];
          tgt.hp = Math.max(0, tgt.hp - dmg);
          tgt.hitTimer = 10;
          spawnParticles(tgt.x, tgt.y, '#F0997B', 8);
          spawnDmg(tgt.x, tgt.y - tgt.r - 12, dmg, '#F09595');
        }
        d.stuck = true; d.stuckTimer = 40; dartHit = true; break;
      }
    }
    if (dartHit) continue;
    // ピンポン玉との衝突
    for (let j = pingBalls.length - 1; j >= 0; j--) {
      const b = pingBalls[j];
      const DR = 8; // ダーツの当たり判定半径
      const dist = Math.hypot(b.x - d.x, b.y - d.y);
      if (dist < b.r + DR) {
        const nx = (d.x - b.x) / (dist || 1);
        const ny = (d.y - b.y) / (dist || 1);
        // ダーツを跳ね返す
        const dot = d.vx * nx + d.vy * ny;
        d.vx -= 2 * dot * nx; d.vy -= 2 * dot * ny;
        // 押し出し：rに合わせた位置へ
        d.x = b.x + nx * (b.r + DR);
        d.y = b.y + ny * (b.r + DR);
        // ピンポン玉にも反力
        const bdot = b.vx * (-nx) + b.vy * (-ny);
        b.vx -= 2 * bdot * (-nx); b.vy -= 2 * bdot * (-ny);
        b.x = d.x - nx * (b.r + DR);
        b.y = d.y - ny * (b.r + DR);
        spawnParticles(d.x, d.y, '#CE93D8', 5);
        break;
      }
    }
    // 味方に反射
    if (d.owner.hp > 0 && Math.hypot(d.owner.x - d.x, d.owner.y - d.y) < d.owner.r + 7) {
      const nx2 = (d.x - d.owner.x) / (Math.hypot(d.x - d.owner.x, d.y - d.owner.y) || 1);
      const ny2 = (d.y - d.owner.y) / (Math.hypot(d.x - d.owner.x, d.y - d.owner.y) || 1);
      const dot2 = d.vx * nx2 + d.vy * ny2;
      d.vx -= 2 * dot2 * nx2; d.vy -= 2 * dot2 * ny2;
      d.x = d.owner.x + nx2 * (d.owner.r + 6);
      d.y = d.owner.y + ny2 * (d.owner.r + 6);
    }
  }
}

// ============================================================
// Tennis Guy攻撃
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
    if (tryBoxerDodge(defender, attacker.x, attacker.y)) {
      // 回避成功：ダメージなし
    } else {
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
}

// ============================================================
// Ping Pong Guy攻撃
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
    spawnParticles(h.x, h.y, '#FF7043', 35);
    spawnParticles(h.x, h.y, '#FFEB3B', 20);
    spawnParticles(h.x, h.y, '#212121', 18);
    spawnDmg(h.x, h.y - h.r - 12, 1000, '#FF5722');
    dmgTexts.push({ x: h.x, y: h.y - h.r - 40, text: '爆発！', life: 1.3, color: '#FF5722' });
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

// ============================================================
// Landmine Guy（地雷ガイ）
// ============================================================
// 壁に激突した瞬間に、その場（足元）へ地雷を1つ設置する
function plantLandmine(owner, wallSide) {
  const mineR = 20;
  let mx = owner.x, my = owner.y;
  // 壁際にぴったりくっつくように座標を補正する
  if (wallSide === 'left')   mx = mineR;
  if (wallSide === 'right')  mx = W - mineR;
  if (wallSide === 'top')    my = mineR;
  if (wallSide === 'bottom') my = H - mineR;
  // 設置者が「今」どちらの陣営か（p1/p2）をこの時点で確定して記録しておく。
  // owner参照だけに頼ると、召喚キャラが後で死んで別の新しい召喚キャラに
  // 置き換わった際にowner===p1summon等の一致判定が崩れ、味方誤爆の原因になるため。
  const side = getTeamSide(owner);
  landmines.push({ x: mx, y: my, r: mineR, owner, side, armTimer: 18, wallSide });
  // 1人が設置できる地雷の上限を超えたら、古いものから消す
  const ownerMines = landmines.filter(m => m.owner === owner);
  while (ownerMines.length > LANDMINE_MAX_PER_OWNER) {
    const oldest = ownerMines.shift();
    const idx = landmines.indexOf(oldest);
    if (idx !== -1) landmines.splice(idx, 1);
  }
  owner.mineSmileTimer = 150; // 設置後しばらく（約2.5秒）は笑顔画像を表示
  spawnParticles(mx, my, '#8D6E63', 12);
  spawnParticles(mx, my, '#5D4037', 8);
  dmgTexts.push({ x: mx, y: my - owner.r - 30, text: '地雷設置！', life: 1.0, color: '#FF8A65' });
}

// 毎フレーム、設置済みの地雷と全キャラの接触判定を行う（設置者自身には反応しない）
function updateLandmines() {
  if (landmines.length === 0) return;
  const allChars = [p1char, p2char, p1twinB, p2twinB, p1summon, p2summon, ttgFuture, ttgFuture2].filter(c => c && c.hp > 0);
  for (let i = landmines.length - 1; i >= 0; i--) {
    const m = landmines[i];
    if (m.armTimer > 0) { m.armTimer--; continue; } // 設置直後の誤爆防止
    let exploded = false;
    const ownerTeam = m.side || getTeamSide(m.owner);
    for (const c of allChars) {
      if (c === m.owner) continue; // 設置した本人には反応しない
      if (ownerTeam && getTeamSide(c) === ownerTeam) continue; // 味方（トレーナーガイ本体や他の召喚キャラなど）にも反応しない
      if (isFootballInvulnerable(c)) continue; // 突進中のフットボールガイは地雷を踏んでも起爆しない
      const d = Math.hypot(c.x - m.x, c.y - m.y);
      if (d < c.r + m.r) {
        explodeLandmine(m, c);
        exploded = true;
        break;
      }
    }
    if (exploded) landmines.splice(i, 1);
  }
}

function explodeLandmine(m, victim) {
  spawnParticles(m.x, m.y, '#FF7043', 32);
  spawnParticles(m.x, m.y, '#FFEB3B', 18);
  spawnParticles(m.x, m.y, '#3E2723', 16);
  dmgTexts.push({ x: m.x, y: m.y - 34, text: '💥爆発!', life: 1.3, color: '#FF7043' });
  if (tryBoxerDodge(victim, m.x, m.y)) {
    return; // 回避成功：地雷は爆発するがダメージなしで飛び退く
  }
  const dmg = 180;
  victim.hp = Math.max(0, victim.hp - dmg);
  victim.hitTimer = 22;
  const dx = victim.x - m.x, dy = victim.y - m.y;
  const d = Math.hypot(dx, dy) || 1;
  victim.vx = (dx / d) * 18;
  victim.vy = (dy / d) * 18 - 8; // 少し浮かせて吹き飛ばす
  victim.knockback = 35;
  spawnDmg(victim.x, victim.y - victim.r - 12, dmg, '#FF5722');
}

function drawLandmine(m) {
  ctx.save();
  ctx.translate(m.x, m.y);
  // 設置された壁ごとに向き（平べったい面と影の方向）を回転させる
  let mineAngle = 0;
  if (m.wallSide === 'bottom') mineAngle = Math.PI;
  else if (m.wallSide === 'left') mineAngle = -Math.PI / 2;
  else if (m.wallSide === 'right') mineAngle = Math.PI / 2;
  ctx.rotate(mineAngle);
  const armed = m.armTimer <= 0;
  // 影
  ctx.beginPath();
  ctx.ellipse(0, m.r * 0.15, m.r * 1.05, m.r * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();
  // 本体（ドーム状の地雷）
  ctx.beginPath();
  ctx.ellipse(0, 0, m.r, m.r * 0.62, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#4E342E';
  ctx.fill();
  ctx.strokeStyle = '#2b1a13';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 起爆スイッチ用のトゲ
  for (let a = 0; a < 6; a++) {
    const ang = (Math.PI * 2 / 6) * a;
    const sx = Math.cos(ang) * m.r * 0.55;
    const sy = Math.sin(ang) * m.r * 0.32;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(ang) * 8, sy + Math.sin(ang) * 5 - 4);
    ctx.strokeStyle = '#212121';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // 中央のランプ（起爆準備完了後は赤く点滅）
  const pulse = (Math.sin(Date.now() / 130) + 1) / 2;
  ctx.beginPath();
  ctx.arc(0, -2, m.r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = armed ? (pulse > 0.5 ? '#FF5252' : '#B71C1C') : '#757575';
  ctx.fill();
  ctx.restore();
}

// ============================================================
// Gunman Guy（ガンマンガイ）
// ============================================================
const GUNMAN_BURST_MAX = 4;        // 連続で撃てる弾数
const GUNMAN_OVERHEAT_TIME = 360;  // 連射後のクールダウン（延長：約4秒→約6秒）

// 真横に並んだ瞬間に発砲を開始したら、以降は整列が崩れてもクールダウンに入るまで撃ち続ける
function updateGunman(attacker, defender) {
  if (attacker.hp <= 0 || defender.hp <= 0 || attacker.transformStun > 0) return;
  if (attacker.overheatCooldown > 0) { attacker.overheatCooldown--; return; }
  if (attacker.gunCooldown > 0) { attacker.gunCooldown--; return; }

  if (attacker.burstCount > 0) {
    // 既に連射を開始している：整列チェックはせず、最初に狙った方向へ撃ち続ける
    fireBullet(attacker, attacker.aimDir || 1);
  } else {
    // まだ連射を始めていない：真横に並んでいる時だけ発砲を開始する
    const dx = defender.x - attacker.x;
    const dy = defender.y - attacker.y;
    if (dx === 0) return;
    // 高さの差が半径の合計の一定割合以内なら「真横」とみなす
    const alignThreshold = (attacker.r + defender.r) * 0.3;
    if (Math.abs(dy) > alignThreshold) return;
    fireBullet(attacker, dx > 0 ? 1 : -1);
  }

  attacker.burstCount = (attacker.burstCount || 0) + 1;
  if (attacker.burstCount >= GUNMAN_BURST_MAX) {
    // 連射しすぎたら弾切れ→クールダウンに入る
    attacker.burstCount = 0;
    attacker.overheatCooldown = GUNMAN_OVERHEAT_TIME;
    dmgTexts.push({ x: attacker.x, y: attacker.y - attacker.r - 30, text: 'リロード中…', life: 1.0, color: '#FFCC80' });
  } else {
    attacker.gunCooldown = 4;
  }
}

function fireBullet(owner, dir) {
  const spd = 14;
  bullets.push({
    x: owner.x + dir * (owner.r + 10), y: owner.y,
    vx: spd * dir, vy: 0, r: 6,
    owner, trail: []
  });
  owner.gunFireTimer = 10;
  owner.aimDir = dir;
  spawnParticles(owner.x + dir * (owner.r + 6), owner.y, '#FFD54F', 6);
}

// 毎フレーム、発射済みの銃弾の移動・命中判定を行う
function updateBullets() {
  if (bullets.length === 0) return;
  const allChars = [p1char, p2char, p1twinB, p2twinB, p1summon, p2summon, ttgFuture, ttgFuture2].filter(c => c && c.hp > 0);
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 6) b.trail.shift();
    b.x += b.vx; b.y += b.vy;
    if (b.x < -20 || b.x > W + 20) { bullets.splice(i, 1); continue; }
    let hit = false;
    for (const c of allChars) {
      // 発射者本人だけでなく、同じチームの味方にも銃弾は当たらないようにする
      if (getTeamSide(c) && getTeamSide(c) === getTeamSide(b.owner)) continue;
      if (isFootballInvulnerable(c)) continue; // 突進中のフットボールガイには当たらない
      if (Math.hypot(c.x - b.x, c.y - b.y) >= c.r + b.r) continue;
      if (!tryBoxerDodge(c, b.x, b.y)) {
        const dmg = 60;
        c.hp = Math.max(0, c.hp - dmg);
        c.hitTimer = 12;
        spawnParticles(c.x, c.y, '#FFD54F', 10);
        spawnParticles(c.x, c.y, '#795548', 6);
        spawnDmg(c.x, c.y - c.r - 12, dmg, '#FFD54F');
      }
      hit = true;
      break;
    }
    if (hit) bullets.splice(i, 1);
  }
}

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
  dmgTexts.push({ x, y: y - s.r - 24, text: `${s.emoji} 誕生！`, life: 1.0, color: '#FFF59D' });
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

function drawBullet(b) {
  // 丸い弾ではなく、進行方向に伸びる「光の筋」にすることでスピード感を出す
  const angle = Math.atan2(b.vy, b.vx);
  const speed = Math.hypot(b.vx, b.vy) || 14;
  const len = Math.max(34, speed * 2.6); // 弾速が速いほど筋を長くする
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(angle);
  // 後方にフェードアウトする光の筋（先端が最も明るい）
  const grad = ctx.createLinearGradient(-len, 0, 0, 0);
  grad.addColorStop(0, 'rgba(255,241,158,0)');
  grad.addColorStop(0.55, 'rgba(255,213,79,0.55)');
  grad.addColorStop(1, 'rgba(255,253,231,0.95)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(-len / 2, 0, len / 2, b.r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 先端の輝く核
  ctx.beginPath();
  ctx.arc(0, 0, b.r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFDE7';
  ctx.fill();
  ctx.restore();
}

// ============================================================
// 時間ループシミュレーション（実際の戦闘ロジックで計算）
// ============================================================
function runTimeLoopSimulation(id1, id2) {
  const SIM_W = 500, SIM_H = 500;
  const enemyId = (id1 === 'timetraveler') ? id2 : id1;

  // シミュレーション用キャラ生成（実際のロジックに準拠）
  function makeSimChar(type, side) {
    const spd = 2.7;
    const a = Math.random() * Math.PI * 2;
    return {
      x: side === 'ttg' ? 120 : 380,
      y: 250,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      baseSpd: spd,
      r: 55, hp: 1000, maxHp: 1000,
      hitTimer: 0, hitstop: 0, knockback: 0,
      trail: [],
      type,
      // Boxing
      punchCooldown: 0, upperCooldown: 0, punchAnimTimer: 0, upperAnimTimer: 0, dodgeAnimTimer: 0, dodgeCooldown: 0,
      // Darts
      dartCooldown: 0, burstCount: 0, burstInterval: 0,
      // Tennis
      smashCooldown: 0, racketAngle: 0, swingTimer: 0, swingBaseAngle: 0,
      // PingPong
      ballFired: false, ballCooldown: 0,
      // TTG
      airCooldown: Math.floor(Math.random() * 60),
      // Landmine
      wallStopTimer: 0,
      // Gunman
      gunCooldown: 0, overheatCooldown: 0, aimDir: 1,
      // Twins
      sausageCooldown: 0, throwTimer: 0,
    };
  }

  // シミュレーション用物理演算
  function simMove(c, simLandmines) {
    if (c.hitstop > 0) { c.hitstop--; return; }
    // 地雷ガイ：壁に激突した直後は数秒間その場から動けない
    if (c.type === 'landmine' && c.wallStopTimer > 0) {
      c.wallStopTimer--;
      if (c.hitTimer > 0) c.hitTimer--;
      return;
    }
    c.x += c.vx; c.y += c.vy;
    let hitWall = false, wallSide = null;
    if (c.x - c.r < 0)  { c.x = c.r;         c.vx =  Math.abs(c.vx); hitWall = true; wallSide = 'left'; }
    if (c.x + c.r > SIM_W) { c.x = SIM_W-c.r; c.vx = -Math.abs(c.vx); hitWall = true; wallSide = 'right'; }
    if (c.y - c.r < 0)  { c.y = c.r;         c.vy =  Math.abs(c.vy); hitWall = true; wallSide = 'top'; }
    if (c.y + c.r > SIM_H) { c.y = SIM_H-c.r; c.vy = -Math.abs(c.vy); hitWall = true; wallSide = 'bottom'; }
    // 地雷ガイ：壁に触れたらその場で停止し、壁際に地雷を設置
    if (c.type === 'landmine' && hitWall && c.hp > 0 && simLandmines) {
      c.wallStopTimer = LANDMINE_STOP_TIME;
      simPlantLandmine(c, wallSide, simLandmines);
    }
    if (c.hitTimer > 0) c.hitTimer--;
    if (c.knockback > 0) {
      c.knockback--;
      const spd = Math.hypot(c.vx, c.vy);
      const tgt = c.baseSpd + (spd - c.baseSpd) * 0.85;
      if (spd > 0) { c.vx = (c.vx/spd)*tgt; c.vy = (c.vy/spd)*tgt; }
    } else {
      const spd = Math.hypot(c.vx, c.vy);
      if (spd > 0) { c.vx = (c.vx/spd)*c.baseSpd; c.vy = (c.vy/spd)*c.baseSpd; }
    }
  }

  function simResolve(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const minD = a.r + b.r;
    if (dist >= minD) return;
    const nx = dx/dist, ny = dy/dist;
    const overlap = (minD-dist)/2;
    a.x -= nx*overlap; a.y -= ny*overlap;
    b.x += nx*overlap; b.y += ny*overlap;
    const dvx = b.vx-a.vx, dvy = b.vy-a.vy;
    const dot = dvx*nx + dvy*ny;
    if (dot < 0) { a.vx += dot*nx; a.vy += dot*ny; b.vx -= dot*nx; b.vy -= dot*ny; }
  }

  // Boxing攻撃シミュレーション
  function simBoxing(attacker, defender) {
    if (attacker.hp <= 0 || defender.hp <= 0) return;
    if (attacker.upperCooldown > 0) attacker.upperCooldown--;
    if (attacker.punchCooldown > 0) { attacker.punchCooldown--; return; }
    const dx = defender.x - attacker.x, dy = defender.y - attacker.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= attacker.r + defender.r + 5) return;
    const absDxS = Math.abs(dx), absDyS = Math.abs(dy);
    const isTooStraightDownS = absDyS > absDxS * 3;
    const isUpperAngle = attacker.y > defender.y && attacker.upperCooldown === 0 && !isTooStraightDownS;
    if (defender.dodgeCooldown === 0 && Math.random() < 0.18) {
      defender.dodgeAnimTimer = 18;
      defender.dodgeCooldown = 60;
      attacker.punchCooldown = isUpperAngle ? 10 : 6;
      const ndx = dx / (dist || 1), ndy = dy / (dist || 1);
      defender.vx = -ndx * 6;
      defender.vy = -ndy * 6;
      defender.knockback = 16;
      return;
    }
    if (isUpperAngle) {
      defender.hp = Math.max(0, defender.hp - 120);
      defender.hitTimer = 15; attacker.upperCooldown = 120; attacker.punchCooldown = 20;
      attacker.punchAnimTimer = 20; attacker.upperAnimTimer = 20;
      defender.vx = dx/(dist||1)*2; defender.vy = -10; defender.knockback = 45; defender.hitstop = 8;
    } else {
      defender.hp = Math.max(0, defender.hp - 50);
      defender.hitTimer = 10; attacker.punchCooldown = 10;
    }
  }

  // Tennis攻撃シミュレーション
  function simTennis(attacker, defender, simDarts, simPingBalls) {
    if (attacker.hp <= 0) return;
    if (attacker.smashCooldown > 0) { attacker.smashCooldown--; return; }
    // ダーツ打ち返し
    for (const d of simDarts) {
      if (d.stuck || d.owner === attacker) continue;
      if (Math.hypot(attacker.x - d.x, attacker.y - d.y) < attacker.r + 40) {
        const tx = defender.x-d.x, ty = defender.y-d.y;
        const td = Math.hypot(tx,ty)||1;
        d.vx = (tx/td)*7; d.vy = (ty/td)*7; d.owner = attacker;
        attacker.smashCooldown = 115; return;
      }
    }
    // ピンポン打ち返し
    for (const b of simPingBalls) {
      if (b.owner === attacker) continue;
      if (Math.hypot(attacker.x - b.x, attacker.y - b.y) < attacker.r + b.r + 40) {
        const tx = defender.x-b.x, ty = defender.y-b.y;
        const td = Math.hypot(tx,ty)||1;
        const spd = Math.max(Math.hypot(b.vx,b.vy),10)*1.5;
        b.vx = (tx/td)*spd; b.vy = (ty/td)*spd;
        b.x = attacker.x+(tx/td)*(attacker.r+b.r);
        b.y = attacker.y+(ty/td)*(attacker.r+b.r);
        b.owner = attacker; attacker.smashCooldown = 115; return;
      }
    }
    // 直接打撃
    const dist = Math.hypot(defender.x-attacker.x, defender.y-attacker.y);
    if (defender.hp > 0 && dist < attacker.r + defender.r + 40) {
      const dmg = 50;
      defender.hp = Math.max(0, defender.hp - dmg);
      defender.hitTimer = 10; attacker.smashCooldown = 115;
      const ax = defender.x-attacker.x, ay = defender.y-attacker.y;
      const dAB = Math.hypot(ax,ay)||1;
      defender.vx = (ax/dAB)*defender.baseSpd*4;
      defender.vy = (ay/dAB)*defender.baseSpd*4;
      defender.knockback = 30;
    }
  }

  // Darts攻撃シミュレーション
  function simDartsShoot(attacker, simDarts, simTarget) {
    if (attacker.hp <= 0) return;
    if (attacker.dartCooldown > 0) { attacker.dartCooldown--; return; }
    attacker.burstCount = 3; attacker.burstInterval = 0; attacker.dartCooldown = 75;
  }
  function simDartsBurst(attacker, simDarts, simTarget) {
    if (!attacker.burstCount || attacker.burstCount <= 0) return;
    if (attacker.burstInterval > 0) { attacker.burstInterval--; return; }
    if (!simTarget) return;
    const spd = 5.0;
    const dx = simTarget.x - attacker.x, dy = simTarget.y - attacker.y;
    const d = Math.hypot(dx,dy)||1;
    simDarts.push({ x: attacker.x, y: attacker.y, vx: dx/d*spd, vy: dy/d*spd, stuck: false, stuckTimer: 0, owner: attacker });
    attacker.burstCount--; attacker.burstInterval = 3;
  }
  function simUpdateDarts(simDarts, simTarget, ttg, enemy) {
    for (let i = simDarts.length-1; i >= 0; i--) {
      const d = simDarts[i];
      if (d.stuck) { if (--d.stuckTimer <= 0) simDarts.splice(i,1); continue; }
      d.x += d.vx; d.y += d.vy;
      if (simTarget && Math.hypot(simTarget.x-d.x, simTarget.y-d.y) < simTarget.r+5) { simDarts.splice(i,1); continue; }
      // 壁反射なし→画面外は消滅
      if (d.x < 0 || d.x > SIM_W || d.y < 0 || d.y > SIM_H) { simDarts.splice(i,1); continue; }
      const tgt = d.owner === ttg ? enemy : ttg;
      if (tgt.hp > 0 && Math.hypot(tgt.x-d.x, tgt.y-d.y) < tgt.r+5) {
        const dmgPool = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,24,25,26,27,28,30,32,33,34,36,38,39,40,42,45,48,
                        50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,51,54,57,60];
        const dmg = dmgPool[Math.floor(Math.random()*dmgPool.length)];
        tgt.hp = Math.max(0, tgt.hp - dmg);
        tgt.hitTimer = 10;
        d.stuck = true; d.stuckTimer = 40;
      }
    }
  }

  // PingPong攻撃シミュレーション
  function simFirePingBall(owner, simPingBalls, enemy) {
    const dx = enemy.x-owner.x, dy = enemy.y-owner.y;
    const d = Math.hypot(dx,dy)||1;
    const spd = 12.0;
    simPingBalls.push({ x: owner.x, y: owner.y, vx: dx/d*spd, vy: dy/d*spd, r: 10, owner, trail: [], hitCooldown: 0, lastHit: null });
  }
  function simUpdatePingBalls(simPingBalls, ttg, enemy, simTarget) {
    for (let i = simPingBalls.length-1; i >= 0; i--) {
      const b = simPingBalls[i];
      if (b.hitCooldown > 0) b.hitCooldown--;
      const spd = Math.hypot(b.vx, b.vy);
      const steps = Math.ceil(spd/6);
      for (let s = 0; s < steps; s++) {
        b.x += b.vx/steps; b.y += b.vy/steps;
        if (b.x-b.r < 0)     { b.x = b.r;       b.vx =  Math.abs(b.vx); }
        if (b.x+b.r > SIM_W) { b.x = SIM_W-b.r; b.vx = -Math.abs(b.vx); }
        if (b.y-b.r < 0)     { b.y = b.r;       b.vy =  Math.abs(b.vy); }
        if (b.y+b.r > SIM_H) { b.y = SIM_H-b.r; b.vy = -Math.abs(b.vy); }
        if (simTarget && Math.hypot(simTarget.x-b.x, simTarget.y-b.y) < simTarget.r+b.r) {
          const nx = (b.x-simTarget.x)/(Math.hypot(b.x-simTarget.x,b.y-simTarget.y)||1);
          const ny = (b.y-simTarget.y)/(Math.hypot(b.x-simTarget.x,b.y-simTarget.y)||1);
          const dot = b.vx*nx+b.vy*ny;
          b.vx -= 2*dot*nx; b.vy -= 2*dot*ny;
          b.x = simTarget.x+nx*(simTarget.r+b.r); b.y = simTarget.y+ny*(simTarget.r+b.r);
          break;
        }
        for (const c of [ttg, enemy]) {
          if (c.hp <= 0) continue;
          if (Math.hypot(c.x-b.x, c.y-b.y) >= c.r+b.r) continue;
          if (b.hitCooldown > 0 && b.lastHit === c) continue;
          const nx = (b.x-c.x)/(Math.hypot(b.x-c.x,b.y-c.y)||1);
          const ny = (b.y-c.y)/(Math.hypot(b.x-c.x,b.y-c.y)||1);
          const dot = b.vx*nx+b.vy*ny;
          b.vx -= 2*dot*nx; b.vy -= 2*dot*ny;
          b.x = c.x+nx*(c.r+b.r); b.y = c.y+ny*(c.r+b.r);
          c.hp = Math.max(0, c.hp-50); c.hitTimer = 10;
          b.lastHit = c; b.hitCooldown = 15; break;
        }
      }
    }
  }

  // Landmineシミュレーション（壁激突→設置→接触で爆発）
  function simPlantLandmine(owner, wallSide, simLandmines) {
    const mineR = 20;
    let mx = owner.x, my = owner.y;
    if (wallSide === 'left')   mx = mineR;
    if (wallSide === 'right')  mx = SIM_W - mineR;
    if (wallSide === 'top')    my = mineR;
    if (wallSide === 'bottom') my = SIM_H - mineR;
    simLandmines.push({ x: mx, y: my, r: mineR, owner, armTimer: 18 });
  }
  function simUpdateLandmines(simLandmines, ttg, enemy) {
    if (simLandmines.length === 0) return;
    const chars = [ttg, enemy];
    for (let i = simLandmines.length - 1; i >= 0; i--) {
      const m = simLandmines[i];
      if (m.armTimer > 0) { m.armTimer--; continue; }
      let exploded = false;
      for (const c of chars) {
        if (c === m.owner || c.hp <= 0) continue;
        const d = Math.hypot(c.x - m.x, c.y - m.y);
        if (d < c.r + m.r) {
          const dmg = 180;
          c.hp = Math.max(0, c.hp - dmg);
          c.hitTimer = 22;
          const dx = c.x - m.x, dy = c.y - m.y;
          const dd = Math.hypot(dx, dy) || 1;
          c.vx = (dx/dd)*18; c.vy = (dy/dd)*18 - 8;
          c.knockback = 35;
          exploded = true;
          break;
        }
      }
      if (exploded) simLandmines.splice(i, 1);
    }
  }

  // Gunmanシミュレーション（横並びで発砲→弾が命中でダメージ）
  const SIM_GUNMAN_BURST_MAX = 4;
  const SIM_GUNMAN_OVERHEAT_TIME = 360;
  function simGunman(attacker, defender, simBullets) {
    if (attacker.hp <= 0 || defender.hp <= 0) return;
    if (attacker.overheatCooldown > 0) { attacker.overheatCooldown--; return; }
    if (attacker.gunCooldown > 0) { attacker.gunCooldown--; return; }
    if (attacker.burstCount > 0) {
      simFireBullet(attacker, attacker.aimDir || 1, simBullets);
    } else {
      const dx = defender.x - attacker.x, dy = defender.y - attacker.y;
      if (dx === 0) return;
      const alignThreshold = (attacker.r + defender.r) * 0.3;
      if (Math.abs(dy) > alignThreshold) return;
      simFireBullet(attacker, dx > 0 ? 1 : -1, simBullets);
    }
    attacker.burstCount = (attacker.burstCount || 0) + 1;
    if (attacker.burstCount >= SIM_GUNMAN_BURST_MAX) {
      attacker.burstCount = 0;
      attacker.overheatCooldown = SIM_GUNMAN_OVERHEAT_TIME;
    } else {
      attacker.gunCooldown = 4;
    }
  }
  function simFireBullet(owner, dir, simBullets) {
    const spd = 14;
    simBullets.push({ x: owner.x + dir*(owner.r+10), y: owner.y, vx: spd*dir, vy: 0, r: 6, owner });
    owner.aimDir = dir;
  }
  function simUpdateBullets(simBullets, ttg, enemy) {
    if (simBullets.length === 0) return;
    const chars = [ttg, enemy];
    for (let i = simBullets.length - 1; i >= 0; i--) {
      const b = simBullets[i];
      b.x += b.vx; b.y += b.vy;
      if (b.x < -20 || b.x > SIM_W + 20) { simBullets.splice(i, 1); continue; }
      let hit = false;
      for (const c of chars) {
        if (c === b.owner || c.hp <= 0) continue;
        if (Math.hypot(c.x - b.x, c.y - b.y) >= c.r + b.r) continue;
        c.hp = Math.max(0, c.hp - 60);
        c.hitTimer = 12;
        hit = true;
        break;
      }
      if (hit) simBullets.splice(i, 1);
    }
  }

  // Bombシミュレーション（接触で受け渡し、タイマー0で保持者に大ダメージ）
  const SIM_BOMB_TIME_LIMIT = 30 * 60;
  const SIM_BOMB_PASS_COOLDOWN = 20;
  function simUpdateBomb(bomb, ttg, enemy) {
    if (!bomb || bomb.exploded) return;
    if (bomb.passCooldown > 0) bomb.passCooldown--;
    const holder = bomb.holder;
    if (!holder || holder.hp <= 0) { bomb.exploded = true; return; }
    if (bomb.passCooldown <= 0) {
      const other = (holder === ttg) ? enemy : ttg;
      if (other.hp > 0) {
        const d = Math.hypot(other.x - holder.x, other.y - holder.y);
        if (d < holder.r + other.r + 6) {
          if (!bomb.started) bomb.started = true;
          bomb.holder = other;
          bomb.passCooldown = SIM_BOMB_PASS_COOLDOWN;
        }
      }
    }
    if (!bomb.started) return;
    bomb.timer--;
    if (bomb.timer <= 0) {
      const h = bomb.holder;
      bomb.exploded = true;
      h.hp = Math.max(0, h.hp - 1000);
      h.hitTimer = 24;
    }
  }

  // Twinsシミュレーション（ソーセージで攻撃/回復、HPはA・Bでリンク）
  function simTwinsLinkHp(twinA, twinB) {
    const minHp = Math.min(twinA.hp, twinB.hp);
    twinA.hp = minHp; twinB.hp = minHp;
  }
  function simTwinsThrow(twin, enemyTargets, simSausages) {
    if (twin.hp <= 0) return;
    if (twin.throwTimer > 0) twin.throwTimer--;
    if (twin.sausageCooldown > 0) { twin.sausageCooldown--; return; }
    let target = null, minDist = Infinity;
    for (const e of enemyTargets) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - twin.x, e.y - twin.y);
      if (d < minDist) { minDist = d; target = e; }
    }
    if (!target) return;
    const dx = target.x - twin.x, dy = target.y - twin.y;
    const d = Math.hypot(dx, dy) || 1;
    const spd = 7;
    simSausages.push({ x: twin.x, y: twin.y, vx: dx/d*spd, vy: dy/d*spd, r: 12, owner: twin, age: 0, maxAge: 120 });
    twin.throwTimer = 20;
    twin.sausageCooldown = 170;
  }
  function simUpdateSausages(simSausages, twinA, twinB, enemyTargets) {
    for (let i = simSausages.length - 1; i >= 0; i--) {
      const s = simSausages[i];
      s.x += s.vx; s.y += s.vy; s.age++;
      if (s.x < 0 || s.x > SIM_W || s.y > SIM_H + 20 || s.age >= s.maxAge) { simSausages.splice(i,1); continue; }
      let hit = false;
      // 敵に命中→ダメージ
      for (const e of enemyTargets) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x-s.x, e.y-s.y) >= e.r+s.r) continue;
        e.hp = Math.max(0, e.hp - 60);
        e.hitTimer = 12;
        simSausages.splice(i,1); hit = true; break;
      }
      if (hit) continue;
      // 味方（もう一方の双子）に命中→回復（リンクなので両方に反映）
      const friend = (s.owner === twinA) ? twinB : twinA;
      if (friend && friend.hp > 0 && friend !== s.owner && Math.hypot(friend.x-s.x, friend.y-s.y) < friend.r+s.r) {
        const heal = 70;
        const healed = Math.min(twinA.maxHp, twinA.hp + heal);
        twinA.hp = healed; twinB.hp = healed;
        simSausages.splice(i,1);
      }
    }
  }

  // 空気砲シミュレーション
  function simFireAir(shooter, enemy, simAirBullets) {
    if (enemy.hp <= 0) return;
    const lead = 15;
    const tx = enemy.x + enemy.vx*lead, ty = enemy.y + enemy.vy*lead;
    const dx = tx-shooter.x, dy = ty-shooter.y;
    const d = Math.hypot(dx,dy)||1;
    simAirBullets.push({ x: shooter.x, y: shooter.y, vx: (dx/d)*AIR_CANNON_SPEED, vy: (dy/d)*AIR_CANNON_SPEED, r: 13, owner: shooter, age: 0, maxAge: 85 });
  }
  function simUpdateAirBullets(simAirBullets, enemy) {
    for (let i = simAirBullets.length-1; i >= 0; i--) {
      const b = simAirBullets[i];
      b.x += b.vx; b.y += b.vy; b.age++;
      if (b.x-b.r < 0 || b.x+b.r > SIM_W || b.y-b.r < 0 || b.y+b.r > SIM_H || b.age >= b.maxAge) {
        simAirBullets.splice(i,1); continue;
      }
      if (enemy.hp > 0 && Math.hypot(enemy.x-b.x, enemy.y-b.y) < enemy.r+b.r) {
        enemy.hp = Math.max(0, enemy.hp-AIR_CANNON_DAMAGE);
        enemy.hitTimer = 10;
        const nx = (enemy.x-b.x)/(Math.hypot(enemy.x-b.x,enemy.y-b.y)||1);
        const ny = (enemy.y-b.y)/(Math.hypot(enemy.x-b.x,enemy.y-b.y)||1);
        enemy.vx = nx*4; enemy.vy = ny*4; enemy.knockback = 15;
        simAirBullets.splice(i,1); continue;
      }
    }
  }

  // 的（ダーツ用ターゲット）のシミュレーション
  function makeSimTarget() {
    const tv = { vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6 };
    return { x: SIM_W/2, y: SIM_H/2, vx: tv.vx, vy: tv.vy, r: 25 };
  }
  function simMoveTarget(t) {
    t.x += t.vx; t.y += t.vy;
    if (t.x-t.r < 0) { t.x = t.r; t.vx = Math.abs(t.vx); }
    if (t.x+t.r > SIM_W) { t.x = SIM_W-t.r; t.vx = -Math.abs(t.vx); }
    if (t.y-t.r < 0) { t.y = t.r; t.vy = Math.abs(t.vy); }
    if (t.y+t.r > SIM_H) { t.y = SIM_H-t.r; t.vy = -Math.abs(t.vy); }
  }

  // ─── 複数回シミュレーションして収束値を求める ───
  const RUNS = 8;
  const FRAMES = 6000;
  const TTG_MAX = 1000;
  let samples = [];

  for (let run = 0; run < RUNS; run++) {
    const ttg = makeSimChar('timetraveler', 'ttg');
    const enemy = makeSimChar(enemyId, 'enemy');
    const simDarts = [];
    const simPingBalls = [];
    const simAirBullets = [];
    const simLandmines = [];
    const simBullets = [];
    const simSausages = [];
    const simTarget = (enemyId === 'darts') ? makeSimTarget() : null;
    // Bomb Guy戦：最初はBomb Guyが保持。誰かに触れた瞬間からタイマー始動
    const simBomb = (enemyId === 'bomb') ? { holder: enemy, timer: SIM_BOMB_TIME_LIMIT, started: false, exploded: false, passCooldown: 0 } : null;
    // Twins Guy戦：もう一方の双子（HPリンク）を追加生成
    let twinB = null;
    if (enemyId === 'twins') {
      twinB = makeSimChar('twins', 'enemyB');
      twinB.x = 380; twinB.y = 380;
      const a = Math.random() * Math.PI * 2;
      twinB.vx = Math.cos(a) * twinB.baseSpd; twinB.vy = Math.sin(a) * twinB.baseSpd;
      enemy.sausageCooldown = 90; twinB.sausageCooldown = 45;
    }
    let foundX = null;

    for (let f = 0; f < FRAMES && ttg.hp > 0 && enemy.hp > 0; f++) {
      simMove(ttg, null);
      simMove(enemy, enemyId === 'landmine' ? simLandmines : null);
      simResolve(ttg, enemy);
      if (twinB) { simMove(twinB, null); simResolve(ttg, twinB); simResolve(enemy, twinB); }
      if (simTarget) simMoveTarget(simTarget);

      // 敵の攻撃
      if (enemyId === 'boxing') simBoxing(enemy, ttg);
      if (enemyId === 'darts') { simDartsShoot(enemy, simDarts, simTarget); simDartsBurst(enemy, simDarts, simTarget); }
      if (enemyId === 'tennis') simTennis(enemy, ttg, simDarts, simPingBalls);
      if (enemyId === 'pingpong') {
        if (!enemy.ballFired) { enemy.ballFired = true; simFirePingBall(enemy, simPingBalls, ttg); }
      }
      if (enemyId === 'timetraveler') {
        if (enemy.airCooldown > 0) enemy.airCooldown--;
        else { simFireAir(enemy, ttg, simAirBullets); enemy.airCooldown = AIR_CANNON_COOLDOWN; }
      }
      if (enemyId === 'gunman') simGunman(enemy, ttg, simBullets);
      if (enemyId === 'landmine') simUpdateLandmines(simLandmines, ttg, enemy);
      if (enemyId === 'gunman') simUpdateBullets(simBullets, ttg, enemy);
      if (enemyId === 'bomb') simUpdateBomb(simBomb, ttg, enemy);
      if (enemyId === 'twins' && twinB) {
        simTwinsLinkHp(enemy, twinB);
        simTwinsThrow(enemy, [ttg], simSausages);
        simTwinsThrow(twinB, [ttg], simSausages);
        simUpdateSausages(simSausages, enemy, twinB, [ttg]);
      }

      // TTGの攻撃（空気砲。ツインズ戦は生きている方をランダムに狙う）
      if (ttg.airCooldown > 0) ttg.airCooldown--;
      else {
        const airTarget = (twinB && twinB.hp > 0 && Math.random() < 0.5) ? twinB : enemy;
        simFireAir(ttg, airTarget, simAirBullets);
        ttg.airCooldown = AIR_CANNON_COOLDOWN;
      }

      if (enemyId === 'darts') simUpdateDarts(simDarts, simTarget, ttg, enemy);
      if (enemyId === 'pingpong') simUpdatePingBalls(simPingBalls, ttg, enemy, simTarget);
      simUpdateAirBullets(simAirBullets, enemy);  // TTGの空気砲は敵に当てる
      if (twinB && twinB.hp > 0) simUpdateAirBullets(simAirBullets, twinB);
      if (twinB) simTwinsLinkHp(enemy, twinB);

      // TTGが500HP以下になった瞬間を記録
      if (ttg.hp < 500 && foundX === null) {
        foundX = ttg.hp;
        break;
      }
    }
    if (foundX === null) foundX = Math.max(0, Math.min(499, ttg.hp));
    samples.push(foundX);
  }

  // 外れ値を除いた中央値を収束値とする
  samples.sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  const median = samples.length % 2 !== 0 ? samples[mid] : Math.round((samples[mid-1]+samples[mid])/2);
  return Math.max(0, median);
}

// ============================================================
// Time Traveler Guy ロジック
// ============================================================
function spawnTimeTravelEffect(x, y) {
  timeTravelEffects.push({ x, y, life: 1.0, maxLife: 1.0 });
}

function spawnTTGFuture(ttg, enemy, x) {
  ttgFuture = spawnTTGFutureObj(ttg, enemy, x);
}

function spawnTTGFutureObj(ttg, enemy, x) {
  // 未来のTTGが出現（フィールドのランダムな位置）
  const side = ttg.x < W/2 ? 'right' : 'left';
  const fx = side === 'right' ? rnd(W-180, W-80) : rnd(80, 180);
  const fy = rnd(80, H-80);
  const sv = randVel(rnd(2.5, 3.5));
  const futureObj = {
    x: fx, y: fy,
    vx: sv.vx, vy: sv.vy, baseSpd: Math.hypot(sv.vx, sv.vy),
    r: 55, hp: x, maxHp: 1000,  // maxHpは通常TTGと同じ1000
    hitTimer: 0, hitstop: 0, knockback: 0,
    trail: [],
    name: 'Time Traveler Guy (未来)', emoji: '⌛',
    color: '#00838F', lightColor: '#4DD0E1',
    type: 'timetraveler_future',
    airCooldown: 60,
    owner: ttg,
    spawnImageTimer: 60  // 約3秒間 timetravel.png を表示（60fps想定）
  };
  spawnParticles(fx, fy, '#00BCD4', 30);
  return futureObj;
}

function fireAirCannon(shooter, enemy) {
  if (enemy.hp <= 0) return;
  // 予測射撃（少し先を狙う）
  const lead = 15;
  const tx = enemy.x + enemy.vx * lead;
  const ty = enemy.y + enemy.vy * lead;
  const dx = tx - shooter.x, dy = ty - shooter.y;
  const d = Math.hypot(dx, dy) || 1;
  const spd = AIR_CANNON_SPEED;
  airBullets.push({
    x: shooter.x, y: shooter.y,
    vx: (dx/d)*spd, vy: (dy/d)*spd,
    r: 13, owner: shooter,
    trail: [], age: 0, maxAge: 85
  });
  spawnParticles(shooter.x, shooter.y, '#00E5FF', 5);
}

function updateTTGFuture(ttgPresent, enemy) {
  if (!ttgFuture || ttgFuture.hp <= 0) return;

  // 移動
  if (ttgFuture.hitstop > 0) { ttgFuture.hitstop--; }
  else {
    ttgFuture.trail.push({ x: ttgFuture.x, y: ttgFuture.y });
    if (ttgFuture.trail.length > 10) ttgFuture.trail.shift();
    ttgFuture.x += ttgFuture.vx; ttgFuture.y += ttgFuture.vy;
    if (ttgFuture.x - ttgFuture.r < 0)  { ttgFuture.x = ttgFuture.r;     ttgFuture.vx =  Math.abs(ttgFuture.vx); }
    if (ttgFuture.x + ttgFuture.r > W)  { ttgFuture.x = W - ttgFuture.r; ttgFuture.vx = -Math.abs(ttgFuture.vx); }
    if (ttgFuture.y - ttgFuture.r < 0)  { ttgFuture.y = ttgFuture.r;     ttgFuture.vy =  Math.abs(ttgFuture.vy); }
    if (ttgFuture.y + ttgFuture.r > H)  { ttgFuture.y = H - ttgFuture.r; ttgFuture.vy = -Math.abs(ttgFuture.vy); }
    if (ttgFuture.hitTimer > 0) ttgFuture.hitTimer--;
    if (ttgFuture.knockback > 0) {
      ttgFuture.knockback--;
      const spd = Math.hypot(ttgFuture.vx, ttgFuture.vy);
      const tgt = ttgFuture.baseSpd + (spd - ttgFuture.baseSpd) * 0.85;
      if (spd > 0) { ttgFuture.vx = (ttgFuture.vx/spd)*tgt; ttgFuture.vy = (ttgFuture.vy/spd)*tgt; }
    } else {
      const spd = Math.hypot(ttgFuture.vx, ttgFuture.vy);
      if (spd > 0) { ttgFuture.vx = (ttgFuture.vx/spd)*ttgFuture.baseSpd; ttgFuture.vy = (ttgFuture.vy/spd)*ttgFuture.baseSpd; }
    }
  }

  // TTGPresent と TTGFuture の衝突
  if (ttgPresent && ttgPresent.hp > 0) {
    resolveCollision(ttgPresent, ttgFuture);
  }

  // 敵ツインズBとの衝突（重なり防止）
  const ownerIsP1f = ttgFuture.owner === p1char;
  const futEnemyTwinB = ownerIsP1f ? p2twinB : p1twinB;
  if (futEnemyTwinB && futEnemyTwinB.hp > 0) {
    resolveCollision(futEnemyTwinB, ttgFuture);
  }

  // 空気砲発射（CDカウントダウンは常に進める、return しない）
  if (ttgFuture.airCooldown > 0) {
    ttgFuture.airCooldown--;
  } else if (enemy && enemy.hp > 0) {
    // 敵の双子B・召喚キャラが生きていればランダムで狙い分ける
    const enemyTwinBf = ownerIsP1f ? p2twinB : p1twinB;
    const enemySummonF = ownerIsP1f ? p2summon : p1summon;
    const altTargetsF = [enemyTwinBf, enemySummonF].filter(t => t && t.hp > 0);
    const airTarget = (altTargetsF.length > 0 && Math.random() < 0.5)
      ? altTargetsF[Math.floor(Math.random() * altTargetsF.length)]
      : enemy;
    fireAirCannon(ttgFuture, airTarget);
    ttgFuture.airCooldown = AIR_CANNON_COOLDOWN;
  }
}

function updateTTGFuture2(ttgPresent, enemy) {
  if (!ttgFuture2 || ttgFuture2.hp <= 0) return;
  const c = ttgFuture2;

  // 移動
  if (c.hitstop > 0) { c.hitstop--; }
  else {
    c.trail.push({ x: c.x, y: c.y });
    if (c.trail.length > 10) c.trail.shift();
    c.x += c.vx; c.y += c.vy;
    if (c.x - c.r < 0)  { c.x = c.r;     c.vx =  Math.abs(c.vx); }
    if (c.x + c.r > W)  { c.x = W - c.r; c.vx = -Math.abs(c.vx); }
    if (c.y - c.r < 0)  { c.y = c.r;     c.vy =  Math.abs(c.vy); }
    if (c.y + c.r > H)  { c.y = H - c.r; c.vy = -Math.abs(c.vy); }
    if (c.hitTimer > 0) c.hitTimer--;
    if (c.knockback > 0) {
      c.knockback--;
      const spd = Math.hypot(c.vx, c.vy);
      const tgt = c.baseSpd + (spd - c.baseSpd) * 0.85;
      if (spd > 0) { c.vx = (c.vx/spd)*tgt; c.vy = (c.vy/spd)*tgt; }
    } else {
      const spd = Math.hypot(c.vx, c.vy);
      if (spd > 0) { c.vx = (c.vx/spd)*c.baseSpd; c.vy = (c.vy/spd)*c.baseSpd; }
    }
  }

  // 現在のTTGとの衝突
  if (ttgPresent && ttgPresent.hp > 0) {
    resolveCollision(ttgPresent, c);
  }
  // ttgFuture と ttgFuture2 の衝突
  if (ttgFuture && ttgFuture.hp > 0) {
    resolveCollision(ttgFuture, c);
  }

  // 空気砲発射（CDカウントダウンは常に進める、return しない）
  if (c.airCooldown > 0) {
    c.airCooldown--;
  } else if (enemy && enemy.hp > 0) {
    fireAirCannon(c, enemy);
    c.airCooldown = AIR_CANNON_COOLDOWN;
  }
}

// TTG vs TTG のとき p2 の空気砲（p1に当てる）を処理する
function updateAirBulletsSide(targetChar) {
  for (let i = airBullets.length - 1; i >= 0; i--) {
    const b = airBullets[i];
    // owner が p2char か ttgFuture2 の弾のみ
    if (b.owner !== p2char && b.owner !== ttgFuture2) continue;
    // この弾は既に updateAirBullets(p2char) で処理済みのためスキップ
    // ここでは p1char を標的にする
    if (targetChar.hp > 0 && !isFootballInvulnerable(targetChar) && Math.hypot(targetChar.x - b.x, targetChar.y - b.y) < targetChar.r + b.r) {
      if (!tryBoxerDodge(targetChar, b.x, b.y)) {
        const dmg = AIR_CANNON_DAMAGE;
        targetChar.hp = Math.max(0, targetChar.hp - dmg);
        targetChar.hitTimer = 10;
        const nx = (targetChar.x - b.x) / (Math.hypot(targetChar.x - b.x, targetChar.y - b.y) || 1);
        const ny = (targetChar.y - b.y) / (Math.hypot(targetChar.x - b.x, targetChar.y - b.y) || 1);
        targetChar.vx = nx * 4; targetChar.vy = ny * 4;
        targetChar.knockback = 15;
        spawnParticles(targetChar.x, targetChar.y, '#00E5FF', 10);
        spawnParticles(targetChar.x, targetChar.y, '#80DEEA', 6);
        spawnDmg(targetChar.x, targetChar.y - targetChar.r - 12, dmg, '#00E5FF');
      }
      airBullets.splice(i, 1); continue;
    }
  }
}

function updateAirBullets(defaultEnemy) {
  // TTG vs TTG のとき、弾の owner に応じて標的を決める
  const isTTGvsTTG = (p1char.type === 'timetraveler' && p2char.type === 'timetraveler');

  for (let i = airBullets.length - 1; i >= 0; i--) {
    const b = airBullets[i];
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 6) b.trail.shift();
    b.x += b.vx; b.y += b.vy;
    b.age++;

    // 壁や寿命で消滅
    if (b.x - b.r < 0 || b.x + b.r > W || b.y - b.r < 0 || b.y + b.r > H || b.age >= b.maxAge) {
      airBullets.splice(i, 1); continue;
    }

    // 標的リストを決定（ownerの反対陣営のキャラ全員）
    let targets;
    if (isTTGvsTTG) {
      const ownerIsP1 = (b.owner === p1char || b.owner === ttgFuture);
      if (ownerIsP1) {
        // p1側の弾 → p2char と ttgFuture2 に当たる
        targets = [p2char];
        if (ttgFuture2 && ttgFuture2.hp > 0) targets.push(ttgFuture2);
      } else {
        // p2側の弾 → p1char と ttgFuture に当たる
        targets = [p1char];
        if (ttgFuture && ttgFuture.hp > 0) targets.push(ttgFuture);
      }
    } else {
      // 通常（TTG vs 非TTG）: defaultEnemy と、存在すれば ttgFuture も対象
      targets = [defaultEnemy];
      // ツインズの双子Bも標的に含める
      const defTwinB = (defaultEnemy === p1char) ? p1twinB : (defaultEnemy === p2char ? p2twinB : null);
      if (defTwinB && defTwinB.hp > 0) targets.push(defTwinB);
      // トレーナーガイの召喚キャラも標的に含める
      const defSummon = (defaultEnemy === p1char) ? p1summon : (defaultEnemy === p2char ? p2summon : null);
      if (defSummon && defSummon.hp > 0) targets.push(defSummon);
      // 非TTG側が撃った弾はttgFutureにも当たる
      if (b.owner !== p1char && b.owner !== ttgFuture && ttgFuture && ttgFuture.hp > 0) targets.push(ttgFuture);
    }

    let hit = false;
    for (const enemy of targets) {
      if (!enemy || enemy.hp <= 0) continue;
      if (isFootballInvulnerable(enemy)) continue; // 突進中のフットボールガイには当たらない
      if (Math.hypot(enemy.x - b.x, enemy.y - b.y) >= enemy.r + b.r) continue;
      if (!tryBoxerDodge(enemy, b.x, b.y)) {
        const dmg = AIR_CANNON_DAMAGE;
        enemy.hp = Math.max(0, enemy.hp - dmg);
        enemy.hitTimer = 10;
        const nx = (enemy.x - b.x) / (Math.hypot(enemy.x - b.x, enemy.y - b.y) || 1);
        const ny = (enemy.y - b.y) / (Math.hypot(enemy.x - b.x, enemy.y - b.y) || 1);
        enemy.vx = nx * 4; enemy.vy = ny * 4;
        enemy.knockback = 15;
        spawnParticles(enemy.x, enemy.y, '#00E5FF', 10);
        spawnParticles(enemy.x, enemy.y, '#80DEEA', 6);
        spawnDmg(enemy.x, enemy.y - enemy.r - 12, dmg, '#00E5FF');
      }
      hit = true;
      break;
    }
    if (hit) { airBullets.splice(i, 1); continue; }
  }
}

function drawAirBullet(b) {
  // トレイル
  for (let i = 0; i < b.trail.length; i++) {
    const a = (i / b.trail.length) * 0.2;
    ctx.beginPath();
    ctx.arc(b.trail[i].x, b.trail[i].y, b.r * (i / b.trail.length), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,229,255,${a})`;
    ctx.fill();
  }
  // 空気弾本体（半透明の衝撃波）
  const fade = 1 - b.age / b.maxAge;
  // 外輪
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(0,229,255,${fade * 0.5})`;
  ctx.lineWidth = 3; ctx.stroke();
  // 中心
  const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
  grad.addColorStop(0, `rgba(255,255,255,${fade * 0.9})`);
  grad.addColorStop(0.4, `rgba(0,229,255,${fade * 0.7})`);
  grad.addColorStop(1, `rgba(0,188,212,${fade * 0.1})`);
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fillStyle = grad; ctx.fill();
  // 圧縮波紋
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(224,247,250,${fade * 0.7})`; ctx.lineWidth = 2; ctx.stroke();
}

function drawTimeTravelEffect(e) {
  if (!timetravel_IMG.complete || timetravel_IMG.naturalWidth === 0) return;
  const imgW = timetravel_IMG.naturalWidth;
  const imgH = timetravel_IMG.naturalHeight;
  const size = 140;
  const scale = size / Math.max(imgW, imgH);
  const dw = imgW * scale;
  const dh = imgH * scale;
  ctx.save();
  ctx.globalAlpha = Math.min(1, e.life / e.maxLife * 1.5);
  ctx.drawImage(timetravel_IMG, e.x - dw / 2, e.y - dh / 2, dw, dh);
  ctx.restore();
}

function drawTTGFuture() {
  if (!ttgFuture) return;
  drawTTGFutureObj(ttgFuture);
}

function drawTTGFutureObj(c) {
  if (!c) return;
  if (c.hp <= 0) return;
  // 本体（出現直後はtimetravel.png、その後はtimetravelarGuy.png）
  if (c.spawnImageTimer > 0) {
    c.spawnImageTimer--;
    if (timetravel_IMG.complete && timetravel_IMG.naturalWidth > 0) {
      const imgW = timetravel_IMG.naturalWidth;
      const imgH = timetravel_IMG.naturalHeight;
      const scale = (c.r * 2.5) / Math.max(imgW, imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.drawImage(timetravel_IMG, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  } else if (timetravelarGuy_IMG.complete && timetravelarGuy_IMG.naturalWidth > 0) {
    const imgW = timetravelarGuy_IMG.naturalWidth;
    const imgH = timetravelarGuy_IMG.naturalHeight;
    const scale = (c.r * 2.2) / Math.max(imgW, imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.drawImage(timetravelarGuy_IMG, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }
}


function drawTarget() {
  for (let i = 0; i < target.trail.length; i++) {
    const a = (i / target.trail.length) * 0.25;
    ctx.beginPath();
    ctx.arc(target.trail[i].x, target.trail[i].y, target.r * 0.5 * (i / target.trail.length), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,220,50,${a})`;
    ctx.fill();
  }
  const { x, y, r } = target;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r*0.75, 0, Math.PI*2); ctx.fillStyle = '#e22'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r*0.48, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r*0.24, 0, Math.PI*2); ctx.fillStyle = '#e22'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,50,0.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r+4, 0, Math.PI*2); ctx.stroke();

  // HPバー
  if (target.hp !== undefined && target.maxHp) {
    const barW = r * 2.4;
    const barH = 7;
    const barX = x - barW / 2;
    const barY = y + r + 6;
    const pct = Math.max(0, target.hp / target.maxHp);
    ctx.fillStyle = '#222';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = pct > 0.5 ? '#4caf50' : pct > 0.25 ? '#ff9800' : '#e22';
    ctx.fillRect(barX, barY, barW * pct, barH);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    // HP数値
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.max(0, Math.round(target.hp))}/${target.maxHp}`, x, barY + 9);
  }
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

function drawChar(c, enemy) {
  const dead = c.hp <= 0;
  if (dead && c.type === 'timetraveler') return; // TTGは死んだら消す
  if (dead) ctx.globalAlpha = 0.25;
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
  ctx.globalAlpha = dead ? 0.25 : 1;
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
        const sizeBoost = 1.15;
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
    // 突進中（タックル中）はタックル画像、それ以外は通常画像
    const isTackling = c.footballState === 'charging';
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
      ctx.save();
      ctx.translate(c.x, c.y);
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
          sizeBoost = 1.15;
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
        img = (c.footballState === 'charging' && AmefotGuy_Tackle_IMG.complete && AmefotGuy_Tackle_IMG.naturalWidth > 0) ? AmefotGuy_Tackle_IMG : AmefotGuy_IMG;
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
}

// ============================================================
// Twins Guy（ツインズガイ）
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
        dmgTexts.push({ x: f.x, y: f.y - f.r - 38, text: '🌭 HEAL!', life: 1.0, color: '#69F0AE' });
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

function drawDart(d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(Math.atan2(d.vy, d.vx));
  ctx.scale(1.4, 1.4);
  if (d.stuck) ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#aaa8a0';
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(-9, -4.5); ctx.lineTo(-6, 0); ctx.lineTo(-9, 4.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#D85A30';
  ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(15, -4.0); ctx.lineTo(12, 3.75); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function draw() {
  // 物理キャンバス全体をクリア（カメラがズームしていてもフィールド外に隙間ができないように）
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1FA5CB'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!p1char || !p2char) return;

  // キャンバスは物理的に大きいが、ゲームロジックはW×H(500×500)の論理座標のまま。
  // GAME_SCALEで画面全体を拡大しつつ、追尾カメラ(camX, camY, camZoom)で
  // 被写体を中心に捉えるようさらにズーム・パンする
  ctx.setTransform(
    GAME_SCALE * camZoom, 0, 0, GAME_SCALE * camZoom,
    canvas.width / 2 - camX * GAME_SCALE * camZoom,
    canvas.height / 2 - camY * GAME_SCALE * camZoom
  );
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
  drawChar(p1char, p2char);
  drawChar(p2char, p1char);
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
// 勝敗判定
// ============================================================
function checkWin() {
  const p1isTTG = p1char.type === 'timetraveler';
  const p2isTTG = p2char.type === 'timetraveler';

  let p1alive, p2alive;
  if (p1isTTG) {
    p1alive = p1char.hp > 0 || (ttgFuture && ttgFuture.owner === p1char && ttgFuture.hp > 0);
  } else {
    // ツインズはHPリンクなので p1char.hp > 0 だけ見ればよい
    p1alive = p1char.hp > 0;
  }
  if (p2isTTG) {
    p2alive = p2char.hp > 0 || (ttgFuture && ttgFuture.owner === p2char && ttgFuture.hp > 0)
                              || (ttgFuture2 && ttgFuture2.owner === p2char && ttgFuture2.hp > 0);
  } else {
    p2alive = p2char.hp > 0;
  }

  if (p1alive && p2alive) return;
  if (over) return;
  over = true;

  const p1wins = p1alive && !p2alive;

  // 勝者を決定
  let winner;
  if (p1wins) {
    // p1側で生きているキャラを探す
    if (p1isTTG && ttgFuture && ttgFuture.owner === p1char && ttgFuture.hp > 0) winner = ttgFuture;
    else winner = p1char;
  } else {
    // p2側で生きているキャラを探す
    if (p2isTTG) {
      if (ttgFuture2 && ttgFuture2.owner === p2char && ttgFuture2.hp > 0) winner = ttgFuture2;
      else if (ttgFuture && ttgFuture.owner === p2char && ttgFuture.hp > 0) winner = ttgFuture;
      else winner = p2char;
    } else {
      winner = p2char;
    }
  }

  if (p1wins) sc1++; else sc2++;
  document.getElementById('sc1').textContent = sc1;
  document.getElementById('sc2').textContent = sc2;
  const winText = `${winner.emoji} ${winner.name} の勝ち！`;
  document.getElementById('msg').textContent = winText;
  document.getElementById('btn-toggle').textContent = '↺ もう一度';
  spawnParticles(winner.x, winner.y, '#FAC775', 30);
  sfxWin();

  // 勝者キャラをグローバルに保持してリザルトループで使う
  resultWinner = winner;

  // running は止めず、リザルト専用ループに切り替える
  running = false;
  animId = requestAnimationFrame(resultLoop);
}

// ============================================================
// リザルトループ（勝者だけ動き続ける）
// ============================================================
function resultLoop() {
  if (!over) return;

  // 勝者キャラだけ移動させる
  if (resultWinner) {
    moveChar(resultWinner);
    // パーティクル更新
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= 0.035;
      if (p.life <= 0) particles.splice(i, 1);
    }
    // ダメージテキスト更新
    for (let i = dmgTexts.length - 1; i >= 0; i--) {
      dmgTexts[i].y -= 0.8; dmgTexts[i].life -= 0.025;
      if (dmgTexts[i].life <= 0) dmgTexts.splice(i, 1);
    }
  }

  // 追尾カメラは一旦無効化（常に固定表示）
  // updateCamera();

  // 通常描画（キャラ・エフェクト含む）
  draw();

  // 結果オーバーレイは追尾カメラの影響を受けない固定座標系で重ねて描く
  ctx.setTransform(GAME_SCALE, 0, 0, GAME_SCALE, 0, 0);
  const winText = `${resultWinner.emoji} ${resultWinner.name} の勝ち！`;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#FAC775'; ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(winText, W / 2, H / 2 - 16);
  ctx.fillStyle = '#ddd'; ctx.font = '15px sans-serif';
  ctx.fillText('もう一度 を押してリマッチ', W / 2, H / 2 + 18);

  animId = requestAnimationFrame(resultLoop);
}

// ============================================================
// メインループ
// ============================================================
function loop() {
  if (!running) return;
  moveChar(p1char);
  moveChar(p2char);
  // 両者ともヒットストップ中のときのみ押し戻しをスキップ（片方だけなら通す）
  if (!(p1char.hitstop > 0 && p2char.hitstop > 0)) resolveCollision(p1char, p2char);
  if (target) moveTarget();

  // 各キャラの攻撃
  if (p1char.type === 'boxing') updateBoxing(p1char, p2char);
  if (p2char.type === 'boxing') updateBoxing(p2char, p1char);
  if (p1char.type === 'darts') { updateDarts_shoot(p1char); updateDarts_burst(p1char); }
  if (p2char.type === 'darts') { updateDarts_shoot(p2char); updateDarts_burst(p2char); }
  updateDartProjectiles();
  if (p1char.type === 'tennis') updateTennis(p1char, p2char);
  if (p2char.type === 'tennis') updateTennis(p2char, p1char);
  if (p1char.type === 'pingpong') updatePingpong(p1char, p2char);
  if (p2char.type === 'pingpong') updatePingpong(p2char, p1char);
  updatePingBalls();
  updateLandmines();
  if (p1char.type === 'gunman') updateGunman(p1char, p2char);
  if (p2char.type === 'gunman') updateGunman(p2char, p1char);
  updateBullets();
  if (p1char.type === 'football') updateFootball(p1char, p2char);
  if (p2char.type === 'football') updateFootball(p2char, p1char);
  if (p1char.type === 'ghost') updateGhost(p1char, p2char);
  if (p2char.type === 'ghost') updateGhost(p2char, p1char);

  // トレーナーガイ処理（卵を投げる／卵の飛翔・命中判定）
  if (p1char.type === 'trainer') updateTrainer(p1char, p2char, p1summon);
  if (p2char.type === 'trainer') updateTrainer(p2char, p1char, p2summon);
  updateEggs();

  // 召喚キャラ（p1側）の移動・衝突・攻撃処理
  if (p1summon && p1summon.hp > 0) {
    moveChar(p1summon);
    resolveCollision(p1char, p1summon);
    resolveCollision(p2char, p1summon);
    if (p1twinB) resolveCollision(p1twinB, p1summon);
    if (p2twinB) resolveCollision(p2twinB, p1summon);
    if (p2summon && p2summon.hp > 0) resolveCollision(p2summon, p1summon);
    // 召喚キャラ自身の攻撃：相手本体・敵の召喚キャラのうち、近い方を狙う
    // （常に敵の召喚キャラを優先していると、敵トレーナー本体を一切攻撃しなくなるバグがあったため、
    //   距離が近い方を狙うようにして、状況に応じてどちらとも戦えるようにする）
    const p1SummonTarget = nearestAliveTarget(p1summon, [p2char, p2summon]) || p2char;
    if (p1summon.type === 'boxing') updateBoxing(p1summon, p1SummonTarget);
    if (p1summon.type === 'tennis') updateTennis(p1summon, p1SummonTarget);
    if (p1summon.type === 'gunman') updateGunman(p1summon, p1SummonTarget);
    if (p1summon.type === 'pingpong') updatePingpong(p1summon, p1SummonTarget);
    // 相手本体からの攻撃も召喚キャラを狙えるようにする
    if (p2char.type === 'boxing') updateBoxing(p2char, p1summon);
    if (p2char.type === 'tennis') updateTennis(p2char, p1summon);
    if (p2char.type === 'gunman') updateGunman(p2char, p1summon);
  } else if (p1summon) {
    // 召喚キャラが力尽きた：スロットを空け、トレーナーガイが再び卵を投げられるようにする
    spawnParticles(p1summon.x, p1summon.y, '#BDBDBD', 14);
    // 召喚キャラが卓球ガイだった場合、自分が発射した卓球ボールが場に残り続けてしまうバグの修正
    // （打ち返されてlastHitが変わっていてもorigin基準で判定し、確実に消す）
    if (p1summon.type === 'pingpong') {
      for (let i = pingBalls.length - 1; i >= 0; i--) {
        if (pingBalls[i].origin === p1summon) pingBalls.splice(i, 1);
      }
    }
    p1summon = null;
  }
  // 召喚キャラ（p2側）の移動・衝突・攻撃処理
  if (p2summon && p2summon.hp > 0) {
    moveChar(p2summon);
    resolveCollision(p2char, p2summon);
    resolveCollision(p1char, p2summon);
    if (p1twinB) resolveCollision(p1twinB, p2summon);
    if (p2twinB) resolveCollision(p2twinB, p2summon);
    // 召喚キャラ自身の攻撃：相手本体・敵の召喚キャラのうち、近い方を狙う
    const p2SummonTarget = nearestAliveTarget(p2summon, [p1char, p1summon]) || p1char;
    if (p2summon.type === 'boxing') updateBoxing(p2summon, p2SummonTarget);
    if (p2summon.type === 'tennis') updateTennis(p2summon, p2SummonTarget);
    if (p2summon.type === 'gunman') updateGunman(p2summon, p2SummonTarget);
    if (p2summon.type === 'pingpong') updatePingpong(p2summon, p2SummonTarget);
    if (p1char.type === 'boxing') updateBoxing(p1char, p2summon);
    if (p1char.type === 'tennis') updateTennis(p1char, p2summon);
    if (p1char.type === 'gunman') updateGunman(p1char, p2summon);
  } else if (p2summon) {
    spawnParticles(p2summon.x, p2summon.y, '#BDBDBD', 14);
    // 召喚キャラが卓球ガイだった場合、自分が発射した卓球ボールが場に残り続けてしまうバグの修正
    if (p2summon.type === 'pingpong') {
      for (let i = pingBalls.length - 1; i >= 0; i--) {
        if (pingBalls[i].origin === p2summon) pingBalls.splice(i, 1);
      }
    }
    p2summon = null;
  }

  // ツインズガイ処理
  if (p1char.type === 'twins' && p1twinB) {
    moveChar(p1twinB);
    resolveCollision(p1char, p1twinB);
    // トレーナーガイの召喚キャラ（p2summon）・TTGの未来クローンも攻撃対象に含める
    const p2future = [ttgFuture, ttgFuture2].filter(f => f && f.hp > 0 && f.owner === p2char);
    const enemies = [p2char, p2twinB, p2summon, ...p2future].filter(e => e && e.hp > 0);
    updateTwins(p1char, p1twinB, enemies);
    // ボクサー/テニス/ガンマンが双子Bも狙えるように
    if (p2char.type === 'boxing') updateBoxing(p2char, p1twinB);
    if (p2char.type === 'tennis') updateTennis(p2char, p1twinB);
    if (p2char.type === 'gunman') updateGunman(p2char, p1twinB);
    resolveCollision(p2char, p1twinB);
    // p2twinB も p1twinB を攻撃できるように
    if (p2twinB && p2twinB.hp > 0) resolveCollision(p2twinB, p1twinB);
  }
  if (p2char.type === 'twins' && p2twinB) {
    moveChar(p2twinB);
    resolveCollision(p2char, p2twinB);
    // トレーナーガイの召喚キャラ（p1summon）・TTGの未来クローンも攻撃対象に含める
    const p1future = [ttgFuture, ttgFuture2].filter(f => f && f.hp > 0 && f.owner === p1char);
    const enemies = [p1char, p1twinB, p1summon, ...p1future].filter(e => e && e.hp > 0);
    updateTwins(p2char, p2twinB, enemies);
    if (p1char.type === 'boxing') updateBoxing(p1char, p2twinB);
    if (p1char.type === 'tennis') updateTennis(p1char, p2twinB);
    if (p1char.type === 'gunman') updateGunman(p1char, p2twinB);
    resolveCollision(p1char, p2twinB);
    // p1twinB と p2twinB の衝突（双子同士）
    if (p1twinB) resolveCollision(p1twinB, p2twinB);
  }
  // ソーセージ更新
  if (sausages.length > 0) {
    const p1friendA = p1char.type === 'twins' ? p1char : null;
    const p1friendB = p1char.type === 'twins' ? p1twinB : null;
    const p2friendA = p2char.type === 'twins' ? p2char : null;
    const p2friendB = p2char.type === 'twins' ? p2twinB : null;
    // トレーナーガイの召喚キャラ・TTGの未来クローンもソーセージの命中対象に含める
    const p1enemies = [p2char, p2twinB, p2summon, ...([ttgFuture, ttgFuture2].filter(f => f && f.hp > 0 && f.owner === p2char))].filter(e => e && e.hp > 0);
    const p2enemies = [p1char, p1twinB, p1summon, ...([ttgFuture, ttgFuture2].filter(f => f && f.hp > 0 && f.owner === p1char))].filter(e => e && e.hp > 0);
    updateSausages(p1friendA, p1friendB, p1enemies, p2enemies, p2friendA, p2friendB);
  }

  // ============================================================
  // タイムトラベラーガイ処理（TTG vs TTG 対応）
  // ============================================================
  // TTGキャラを配列で管理（0人・1人・2人に対応）
  const ttgChars = [p1char, p2char].filter(c => c.type === 'timetraveler');
  const nonTtgChars = [p1char, p2char].filter(c => c.type !== 'timetraveler');

  // TTG vs TTG の場合、それぞれが相手を敵とする
  // そうでない場合は従来どおり
  function getTtgEnemy(ttg) {
    if (ttgChars.length === 2) {
      return ttg === p1char ? p2char : p1char;
    }
    return ttg === p1char ? p2char : p1char;
  }

  // TTG vs TTGのとき、p1 の未来は ttgFuture、p2 の未来は ttgFuture2 に入れる
  // （TTGが1人のときは従来どおり ttgFuture のみ使用）
  // ※ 両TTGの未来がそれぞれ相手を攻撃する

  for (const ttg of ttgChars) {
    if (ttg.hp <= 0) continue;
    const ttgEnemy = getTtgEnemy(ttg);
    // 自分の未来変数を決定（p1→ttgFuture、p2→ttgFuture2）
    const futureKey = (ttg === p1char) ? 'ttgFuture' : 'ttgFuture2';

    // 未来の自分がまだ出現していない場合、60フレーム後に出現（一度きり）
    const myFuture = (futureKey === 'ttgFuture') ? ttgFuture : ttgFuture2;
    if (!myFuture && ttg.timeLoopX !== null && !ttg.futureSpawned) {
      if (!ttg.futureSpawnTimer) ttg.futureSpawnTimer = 60;
      ttg.futureSpawnTimer--;
      if (ttg.futureSpawnTimer <= 0) {
        const newFuture = spawnTTGFutureObj(ttg, ttgEnemy, ttg.timeLoopX);
        if (futureKey === 'ttgFuture') ttgFuture = newFuture;
        else ttgFuture2 = newFuture;
        ttg.futureSpawned = true;
      }
    }
    // 現在のTTGも空気砲で攻撃
    if (!ttg.airCooldown) ttg.airCooldown = 0;
    if (ttg.airCooldown > 0) ttg.airCooldown--;
    else {
      // 敵の双子B・召喚キャラが生きていればランダムでどれかを狙う
      const enemyTwinB = (ttgEnemy === p2char) ? p2twinB : (ttgEnemy === p1char ? p1twinB : null);
      const enemySummon = (ttgEnemy === p2char) ? p2summon : (ttgEnemy === p1char ? p1summon : null);
      const altTargets = [enemyTwinB, enemySummon].filter(t => t && t.hp > 0);
      const airTarget = (altTargets.length > 0 && Math.random() < 0.5)
        ? altTargets[Math.floor(Math.random() * altTargets.length)]
        : ttgEnemy;
      if (airTarget && airTarget.hp > 0) {
        fireAirCannon(ttg, airTarget);
        ttg.airCooldown = AIR_CANNON_COOLDOWN;
      }
    }
    // タイムトラベルチェック：HPが閾値以下になったら過去へ消える
    if (ttg.timeLoopX !== null && ttg.hp <= ttg.timeLoopX) {
      spawnParticles(ttg.x, ttg.y, '#00E5FF', 40);
      spawnParticles(ttg.x, ttg.y, '#ffffff', 20);
      spawnTimeTravelEffect(ttg.x, ttg.y);
      ttg.hp = 0;
      ttg.timeLoopX = null;
    }
  }

  // 敵がttgFutureにも攻撃できる
  // ttgFuture の owner は p1char → 敵は p2char
  // ttgFuture2 の owner は p2char → 敵は p1char（TTG vs TTG のときのみ存在）
  const futurePairs = [];
  if (ttgFuture && ttgFuture.hp > 0) {
    const futEnemy = ttgFuture.owner === p1char ? p2char : p1char;
    futurePairs.push([ttgFuture, futEnemy]);
  }
  if (ttgFuture2 && ttgFuture2.hp > 0) {
    const futEnemy2 = ttgFuture2.owner === p1char ? p2char : p1char;
    futurePairs.push([ttgFuture2, futEnemy2]);
  }
  for (const [futureObj, futEnemy] of futurePairs) {
    if (futEnemy.type === 'boxing') updateBoxing(futEnemy, futureObj);
    if (futEnemy.type === 'tennis') updateTennis(futEnemy, futureObj);
    if (futEnemy.type === 'football') updateFootball(futEnemy, futureObj);
    if (futEnemy.type === 'ghost') updateGhost(futEnemy, futureObj);
    if (futEnemy.type === 'gunman') updateGunman(futEnemy, futureObj);
    if (futEnemy.type === 'trainer') updateTrainer(futEnemy, futureObj, futEnemy === p1char ? p1summon : p2summon);
    if (futEnemy.hitstop <= 0 && futureObj.hitstop <= 0) resolveCollision(futEnemy, futureObj);
    // ツインズの双子Bとも衝突処理（重なり防止）
    const futEnemyTwinB = (futEnemy === p1char) ? p1twinB : (futEnemy === p2char ? p2twinB : null);
    if (futEnemyTwinB && futEnemyTwinB.hp > 0 && futureObj.hitstop <= 0) {
      resolveCollision(futEnemyTwinB, futureObj);
    }
  }

  // TTG本体 ↔ 敵ツインズBの衝突（重なり防止）
  for (const ttg of ttgChars) {
    if (ttg.hp <= 0) continue;
    const oppTwinB = (ttg === p1char) ? p2twinB : p1twinB;
    if (oppTwinB && oppTwinB.hp > 0) resolveCollision(ttg, oppTwinB);
  }

  // 未来のTTG処理（ttgFuture）
  if (ttgFuture && ttgFuture.hp > 0) {
    const ttgOwner = ttgFuture.owner;
    // TTG vs TTG のとき、相手チームの未来が生きていればそちらを優先して狙う
    const baseEnemy = ttgOwner === p1char ? p2char : p1char;
    const futureEnemy = ttgOwner === p1char ? ttgFuture2 : null; // p1の未来 → p2の未来を狙う
    const ttgEnemyOfFuture = (futureEnemy && futureEnemy.hp > 0) ? futureEnemy : baseEnemy;
    updateTTGFuture(ttgOwner && ttgOwner.hp > 0 ? ttgOwner : null, ttgEnemyOfFuture);
  } else if (ttgFuture && ttgFuture.hp <= 0) {
    ttgFuture = null;
  }
  // 未来のTTG処理（ttgFuture2：TTG vs TTGのとき）
  if (ttgFuture2 && ttgFuture2.hp > 0) {
    const ttgOwner2 = ttgFuture2.owner;
    const baseEnemy2 = ttgOwner2 === p1char ? p2char : p1char;
    const futureEnemy2 = ttgOwner2 === p2char ? ttgFuture : null; // p2の未来 → p1の未来を狙う
    const ttgEnemyOfFuture2 = (futureEnemy2 && futureEnemy2.hp > 0) ? futureEnemy2 : baseEnemy2;
    updateTTGFuture2(ttgOwner2 && ttgOwner2.hp > 0 ? ttgOwner2 : null, ttgEnemyOfFuture2);
  } else if (ttgFuture2 && ttgFuture2.hp <= 0) {
    ttgFuture2 = null;
  }

  // 空気砲処理（owner ベースで標的を決定）
  if (ttgChars.length > 0) {
    const ttgEnemy1 = ttgChars[0] === p1char ? p2char : p1char;
    updateAirBullets(ttgEnemy1);
  }

  // 爆弾ガイ処理（保持者の受け渡し・タイマー・爆発判定）
  updateBomb();

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= 0.035;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = dmgTexts.length - 1; i >= 0; i--) {
    dmgTexts[i].y -= 0.8; dmgTexts[i].life -= 0.025;
    if (dmgTexts[i].life <= 0) dmgTexts.splice(i, 1);
  }
  for (let i = timeTravelEffects.length - 1; i >= 0; i--) {
    timeTravelEffects[i].life -= 0.0055; // 約3秒で消える
    if (timeTravelEffects[i].life <= 0) timeTravelEffects.splice(i, 1);
  }

  // 追尾カメラは一旦無効化（常に固定表示）
  // updateCamera();
  draw();
  checkWin();
  if (running) animId = requestAnimationFrame(loop);
}

// ============================================================
// 初期化
// ============================================================

// Boxing Guy 画像
const BOXER_IMG = new Image();
BOXER_IMG.src = "boxer.png"
const BOXER_PUNCH_IMG = new Image();
BOXER_PUNCH_IMG.src = "boxer_punchi.png"
const BOXER_UPPER_IMG = new Image();
BOXER_UPPER_IMG.src = "boxer_upper.png"
const BOXER_DODGE_IMG = new Image();
BOXER_DODGE_IMG.src = "boxer_dodge.png"
const dartsGuy_IMG = new Image();
dartsGuy_IMG.src = "dartsGuy.png"
const dartsGuy_throw_IMG = new Image();
dartsGuy_throw_IMG.src = "Darts_throw.png"
const timetravelarGuy_IMG = new Image();
timetravelarGuy_IMG.src = "timetravelarGuy.png"
const timetravel_IMG = new Image();
timetravel_IMG.src = "timetravel.png"
const pingpongGuy_IMG = new Image();
pingpongGuy_IMG.src = "pingpongGuy.png"
const pingpongGuy_shot_IMG = new Image();
pingpongGuy_shot_IMG.src = "pingpongGuy_shot.png"
const TennisGuy_IMG = new Image();
TennisGuy_IMG.src = "TennisGuy.png"
// TennisGuy.png はラケットを持つ腕を大きく伸ばしたポーズのため、画像全体（腕・ラケット込み）を
// 基準にスケールすると体が小さく見えてしまう。頭〜腰までの実際の胴体部分の
// サイズ・中心座標（元画像ピクセル座標）をあらかじめ計測しておき、そこを基準に表示する。
const TENNIS_BODY_CX = 325;   // 胴体の中心X（画像ピクセル座標）
const TENNIS_BODY_CY = 436;   // 胴体の中心Y（画像ピクセル座標）
const TENNIS_BODY_H = 428;    // 胴体（頭上〜裾）の高さ（画像ピクセル）
const TennisGuy_shot_IMG = new Image();
TennisGuy_shot_IMG.src = "TennisGuy_shot.png"
const LandmineGuy_IMG = new Image();
LandmineGuy_IMG.src = "LandmineGuy.png"
const LandmineGuy_smile_IMG = new Image();
LandmineGuy_smile_IMG.src = "LandmineGuy_smile.png"
const GunmanGuy_IMG = new Image();
GunmanGuy_IMG.src = "GunmanGuy.png"
const GunmanGuy_shot_IMG = new Image();
GunmanGuy_shot_IMG.src = "GunmanGuy_shot.png"
const AmefotGuy_IMG = new Image();
AmefotGuy_IMG.src = "AmefotGuy.png"
const AmefotGuy_Tackle_IMG = new Image();
AmefotGuy_Tackle_IMG.src = "AmefotGuy_Tackle.png"
const GhostGuy_IMG = new Image();
GhostGuy_IMG.src = "GhostGuy.png"
const Sausage_IMG = new Image();
Sausage_IMG.src = "Sausage.png"
const TimeBomb_IMG = new Image();
TimeBomb_IMG.src = "TimeBomb.png"
const BombGuy_IMG = new Image();
BombGuy_IMG.src = "BombGuy.png"
const TrainerGuy_IMG = new Image();
TrainerGuy_IMG.src = "TrainerGuy.png"
buildCharSelect();
