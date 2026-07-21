// ============================================================
// エンジン共通コア：ユーティリティ・canvas設定・サウンド・ゲーム全体の状態変数
// ============================================================

// ============================================================
// ユーティリティ
// ============================================================
function rnd(a, b) { return a + Math.random() * (b - a); }
// 新キャラ登場時などの「ポンと弾むように出現する」演出で使うイージング関数
function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
const SPAWN_ANIM_FRAMES = 18; // 新キャラ登場時のスケールインアニメーション時間（約0.3秒）
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
canvas.width = W;
canvas.height = H;

// ワールド座標(論理px) -> canvasのCSS表示座標（HPバッジ等のDOMオーバーレイ用）
function worldToScreen(wx, wy) {
  const rectScale = (canvas.clientWidth || canvas.width) / canvas.width;
  return { x: wx * rectScale, y: wy * rectScale, scale: rectScale };
}

// ============================================================
// サウンドエンジン（mp3再生のみ）
// ============================================================

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
// 3v3で片方のキャラが力尽きた後、次のキャラが登場するまでの間隔（フレーム数、約60fps基準）
const RESPAWN_DELAY_FRAMES = 180; // 約3秒
let pendingRespawn = null; // { side: 'p1'|'p2', timer: number } 待機中はnullでない
let resultWinner = null; // リザルト画面で動き続ける勝者
let resultLoserSide = null; // リザルト画面で排除する敗者側('p1' or 'p2')
let darts = [], pingBalls = [], particles = [], dmgTexts = [], airBullets = [], timeTravelEffects = [], shockwaves = [];
// 画面シェイク（爆発など強い衝撃の演出用）
let screenShake = { time: 0, power: 0 };
function triggerShake(power, time) {
  // 既存のシェイクより強い場合のみ上書き（複数エフェクトが重なっても弱まらないように）
  if (power >= screenShake.power || screenShake.time <= 0) {
    screenShake.power = power;
    screenShake.time = time;
  }
}
// 拡大しながら消えるリング状の衝撃波エフェクトを生成
function spawnShockwave(x, y, color, maxR, life) {
  shockwaves.push({ x, y, r: 0, maxR, life, maxLife: life, color });
}
// ダーツの的が0になった時の放射ダーツ攻撃（3連）の状態管理
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


