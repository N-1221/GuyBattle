// ============================================================
// UI/ゲーム進行フロー：キャラ選択画面・対戦開始/リセット・3vs3チーム交代
// ============================================================

// ============================================================
// キャラ選択UI（1vs1 / 3vs3 対応）
// ============================================================
// 「？」＝ランダム選択カード。実キャラではなくプレースホルダーのIDとして
// selectedP1/selectedP2に入り、対戦開始時に実際のキャラへ解決される。
if (typeof ROSTER !== 'undefined' && !ROSTER.some(r => r.id === 'random')) {
  ROSTER.push({ id: 'random', emoji: '❓', name: 'ランダム' });
}
// ROSTERの中から実キャラ（'random'以外）を1体ランダムに選ぶ。
// excludeIdsに含まれるIDはなるべく避ける（同じチーム内でのランダム被りを防ぐため）。
function pickRandomRosterId(excludeIds) {
  const real = ROSTER.filter(r => r.id !== 'random');
  const pool = real.filter(r => !excludeIds.includes(r.id));
  const finalPool = pool.length > 0 ? pool : real; // 候補が尽きたら重複も許容
  return finalPool[Math.floor(Math.random() * finalPool.length)].id;
}
// 選択済み配列（'random'を含みうる）を、実際に対戦で使うキャラID配列へ変換する
function resolveTeamLineup(ids) {
  const resolved = [];
  for (const id of ids) {
    resolved.push(id === 'random' ? pickRandomRosterId(resolved) : id);
  }
  return resolved;
}
let TEAM_SIZE = 1; // 1 or 3。チームの人数（1vs1なら1、3vs3なら3）
let selectedP1 = [], selectedP2 = []; // 選択順＝出撃順（配列の中身はROSTERのid）
// 現在進行中のバトルのチーム編成（開始ボタンを押した時点でselectedP1/2からコピー）
let team1 = [], team2 = [];
let team1Idx = 0, team2Idx = 0; // 各チームで現在出撃中のメンバーのインデックス

function updateCsStartReady() {
  document.getElementById('cs-start').classList.toggle(
    'ready', selectedP1.length === TEAM_SIZE && selectedP2.length === TEAM_SIZE
  );
}

function buildCharSelect() {
  ['p1', 'p2'].forEach(player => {
    const container = document.getElementById('cs-' + player);
    container.innerHTML = '';
    const selectedArr = player === 'p1' ? selectedP1 : selectedP2;
    ROSTER.forEach(def => {
      const card = document.createElement('div');
      card.className = 'cs-card';
      // 3vs3では同じキャラが複数枠に入りうるので、該当する全ての選択順（1始まり）を集める
      const orderIdxs = [];
      selectedArr.forEach((id, i) => { if (id === def.id) orderIdxs.push(i + 1); });
      if (orderIdxs.length > 0) card.classList.add('selected');
      card.innerHTML = `<span class="cs-emoji">${def.emoji}</span><div class="cs-name">${def.name}</div>` +
        (TEAM_SIZE > 1 && orderIdxs.length > 0 ? `<span class="cs-order-badge">${orderIdxs.join(',')}</span>` : '');
      card.addEventListener('click', () => {
        const arr = player === 'p1' ? selectedP1 : selectedP2;
        if (TEAM_SIZE > 1) {
          // 3vs3：重複選択OK。クリックのたびに1枠追加し、上限に達していたら一番古い選択を外す
          if (arr.length >= TEAM_SIZE) arr.shift();
          arr.push(def.id);
        } else {
          // 1vs1：従来通りトグル式（同じキャラをもう一度クリックすると解除）
          const idx = arr.indexOf(def.id);
          if (idx !== -1) {
            arr.splice(idx, 1);
          } else {
            if (arr.length >= TEAM_SIZE) arr.shift();
            arr.push(def.id);
          }
        }
        buildCharSelect(); // 番号バッジ等を再描画するため全体を作り直す
        updateCsStartReady();
      });
      // 右クリック：3vs3のとき、このキャラの選択を1枠分だけ解除する（重複選択の取り消し用）
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (TEAM_SIZE <= 1) return;
        const arr = player === 'p1' ? selectedP1 : selectedP2;
        // 一番新しく選ばれた枠（配列の後ろ側）から1つだけ取り消す
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i] === def.id) { arr.splice(i, 1); break; }
        }
        buildCharSelect();
        updateCsStartReady();
      });
      container.appendChild(card);
    });
  });
}

// モード切替（1vs1 / 3vs3）
document.querySelectorAll('.cs-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const m = parseInt(btn.dataset.mode, 10);
    if (m === TEAM_SIZE) return;
    TEAM_SIZE = m;
    selectedP1 = []; selectedP2 = []; // 人数が変わるので選択はリセット
    document.querySelectorAll('.cs-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
    buildCharSelect();
    updateCsStartReady();
  });
});

document.getElementById('cs-start').addEventListener('click', () => {
  if (selectedP1.length !== TEAM_SIZE || selectedP2.length !== TEAM_SIZE) return;
  document.getElementById('char-select').style.display = 'none';
  document.getElementById('battle').style.display = 'flex';
  team1 = resolveTeamLineup(selectedP1); // '？'（ランダム）はここで実キャラIDに解決される
  team2 = resolveTeamLineup(selectedP2);
  team1Idx = 0; team2Idx = 0;
  startBattle(team1[0], team2[0]);
  renderTeamHud();
});

// ============================================================
// バトル開始
// ============================================================
// タイムトラベラー・ダーツの的・ツインズ双子B・爆弾ガイの爆弾など、
// 「両者の組み合わせ」に応じて決まる共有ギミックをまとめて初期化する。
// 3vs3の途中交代（1体倒れて次のメンバーが出てくる時）にも使い回すため関数化してある。
// id1/id2 にはROSTERのid、またはp1char.type/p2char.type（生存キャラの現在のタイプ）を渡す。
function setupSharedMechanics(id1, id2) {
  // タイムトラベラーが含まれる場合、時間ループシミュレーションを実行
  const hasTTG = (id1 === 'timetraveler' || id2 === 'timetraveler');
  if (hasTTG) {
    if (id1 === 'timetraveler' && id2 === 'timetraveler') {
      // 両方TTG：それぞれ相手キャラとしてシミュレーション
      p1char.timeLoopX = runTimeLoopSimulation('timetraveler', 'timetraveler');
      p2char.timeLoopX = runTimeLoopSimulation('timetraveler', 'timetraveler');
    } else {
      const loopX = runTimeLoopSimulation(id1, id2);
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
}

// フィールド上の飛翔物・演出・一時状態を一掃する（新しいラウンド開始時に呼ぶ）
// keepLandmines=true の場合、既に設置されている地雷はそのまま残す（3vs3の途中交代時用）
function clearRoundState(keepLandmines) {
  darts = []; pingBalls = []; particles = []; dmgTexts = []; airBullets = []; timeTravelEffects = []; sausages = [];
  bullets = []; eggs = []; p1summon = null; p2summon = null;
  targetBurstPending = 0; targetBurstTimer = 0; targetBurstOrigin = null; targetBurstOwner = null;
  ttgFuture = null;
  ttgFuture2 = null;
  if (!keepLandmines) landmines = [];
}

// スコアボードの名前表示・見出しを更新
function updateFighterNames() {
  const d1 = ROSTER.find(r => r.id === p1char.type) || { emoji: p1char.emoji, name: p1char.name };
  const d2 = ROSTER.find(r => r.id === p2char.type) || { emoji: p2char.emoji, name: p2char.name };
  document.getElementById('name1').textContent = (p1char.emoji || d1.emoji) + ' ' + (p1char.name || d1.name);
  document.getElementById('name2').textContent = (p2char.emoji || d2.emoji) + ' ' + (p2char.name || d2.name);
}

function startBattle(id1, id2) {
  const def1 = ROSTER.find(r => r.id === id1);
  const def2 = ROSTER.find(r => r.id === id2);

  p1char = def1.makeChar('p1');
  p2char = def2.makeChar('p2');

  setupSharedMechanics(id1, id2);
  clearRoundState();

  over = false; running = true;
  resultLoserSide = null;
  updateFighterNames();
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
  resultLoserSide = null;
  cancelAnimationFrame(animId);
  clearMsgResetTimer();
  darts = []; pingBalls = []; particles = []; dmgTexts = []; airBullets = []; timeTravelEffects = []; sausages = [];
  landmines = []; bullets = []; eggs = []; p1summon = null; p2summon = null;
  targetBurstPending = 0; targetBurstTimer = 0; targetBurstOrigin = null; targetBurstOwner = null;
  ttgFuture = null;
  ttgFuture2 = null;
  p1twinB = null; p2twinB = null;
  bomb = null;
  team1 = []; team2 = []; team1Idx = 0; team2Idx = 0;
  document.getElementById('battle').style.display = 'none';
  document.getElementById('char-select').style.display = 'flex';
  // 前回の選択を保持したままUIを再構築
  buildCharSelect();
  updateCsStartReady();
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
// 3vs3：チーム交代・チームHUD表示
// ============================================================
let msgResetTimer = null;
function clearMsgResetTimer() {
  if (msgResetTimer) { clearTimeout(msgResetTimer); msgResetTimer = null; }
}
// メッセージを一時的に表示し、一定時間後に「戦闘中...」へ戻す
function flashMsg(text, ms) {
  clearMsgResetTimer();
  document.getElementById('msg').textContent = text;
  msgResetTimer = setTimeout(() => {
    msgResetTimer = null;
    if (running && !over) document.getElementById('msg').textContent = '戦闘中...';
  }, ms);
}

// 敗北した側（loserSide）にまだ控えメンバーがいるとき、即座に交代させず、
// RESPAWN_DELAY_FRAMES（約3秒）待ってから次のメンバーを登場させる
function startRespawnCountdown(loserSide) {
  pendingRespawn = { side: loserSide, timer: RESPAWN_DELAY_FRAMES };
  // moveChar()が呼ばれなくなるため、hitTimer(白フラッシュ)やhitstop/knockbackが
  // 止まった値のまま残り続けてしまう。ここで即座にクリアし、半透明の通常色で
  // 静止表示されるようにする（白く固まって見えるのを防ぐ）
  const loser = loserSide === 'p1' ? p1char : p2char;
  if (loser) { loser.hitTimer = 0; loser.hitstop = 0; loser.knockback = 0; }
  flashMsg((loserSide === 'p1' ? 'P1' : 'P2') + ' KO！ 次のキャラが登場します...', RESPAWN_DELAY_FRAMES * (1000 / 60));
}

// 敗北した側（loserSide: 'p1' or 'p2'）のチームにまだ控えメンバーがいれば、
// 次のメンバーを出撃させて試合を続行する。控えがいなければ何もせずfalseを返す
// （＝呼び出し側でそのままチーム全滅として試合終了処理を行う）。
function spawnNextTeammate(loserSide) {
  const isP1 = loserSide === 'p1';
  const lineup = isP1 ? team1 : team2;
  const nextIdx = (isP1 ? team1Idx : team2Idx) + 1;
  if (nextIdx >= lineup.length) return false; // 控えなし＝チーム全滅

  if (isP1) team1Idx = nextIdx; else team2Idx = nextIdx;

  const newId = lineup[nextIdx];
  const def = ROSTER.find(r => r.id === newId);
  const newChar = def.makeChar(loserSide);

  const survivor = isP1 ? p2char : p1char;

  if (isP1) p1char = newChar; else p2char = newChar;
  // ポンと弾むように登場するアニメーション＋出現パーティクル（画面が急に切り替わった感を出さないため）
  newChar.spawnAnimTimer = SPAWN_ANIM_FRAMES;
  spawnParticles(newChar.x, newChar.y, newChar.color, 22);
  spawnParticles(newChar.x, newChar.y, '#ffffff', 10);

  // 生存キャラは位置・速度・HPを含め完全にそのまま続行させる（リスポーンさせない）

  // 新しい組み合わせで共有ギミック（TTG/ダーツの的/ツインズ/爆弾）を再セットアップ
  setupSharedMechanics(isP1 ? newId : survivor.type, isP1 ? survivor.type : newId);
  clearRoundState(true); // 地雷はそのまま残す

  over = false;
  updateFighterNames();
  flashMsg((isP1 ? 'P1' : 'P2') + ' KO！ 次のキャラが登場！', 1400);
  renderTeamHud();
  return true;
}

// チームの残りメンバー・出撃状況をスコアボードにアイコンで表示
function renderTeamHud() {
  const wrap1 = document.getElementById('team1-icons');
  const wrap2 = document.getElementById('team2-icons');
  if (!wrap1 || !wrap2) return;
  if (TEAM_SIZE <= 1 || team1.length <= 1) {
    wrap1.style.display = 'none'; wrap2.style.display = 'none';
    return;
  }
  wrap1.style.display = 'flex'; wrap2.style.display = 'flex';
  const render = (wrap, lineup, idx) => {
    wrap.innerHTML = '';
    lineup.forEach((id, i) => {
      const def = ROSTER.find(r => r.id === id);
      const span = document.createElement('span');
      span.className = 'team-icon' + (i < idx ? ' ko' : '') + (i === idx ? ' active' : '');
      span.textContent = def.emoji;
      wrap.appendChild(span);
    });
  };
  render(wrap1, team1, team1Idx);
  render(wrap2, team2, team2Idx);
}


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

