// ============================================================
// ゲーム進行：勝敗判定・メインループ・初期化（画像プリロード・起動）
// ============================================================

function checkWin() {
  if (pendingRespawn) return; // 次のキャラ登場を待機中は判定しない

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

  // どちらかの側が力尽きた場合、チームにまだ控えがいれば少し間を置いてから交代して試合を続行する
  if (!p1alive) {
    if ((team1Idx + 1) < team1.length) { startRespawnCountdown('p1'); return; }
  } else if (!p2alive) {
    if ((team2Idx + 1) < team2.length) { startRespawnCountdown('p2'); return; }
  }

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
  document.getElementById('msg').textContent = '';
  document.getElementById('btn-toggle').textContent = '↺ もう一度';
  spawnParticles(winner.x, winner.y, '#FAC775', 30);
  sfxWin();

  // 勝者キャラをグローバルに保持してリザルトループで使う
  resultWinner = winner;
  resultLoserSide = p1wins ? 'p2' : 'p1';

  // 負けたキャラクター・その双子/召喚キャラ/未来のTTG・関連する飛翔物を
  // すべてリザルト画面から排除する
  clearLoserSideArtifacts(resultLoserSide);

  // タイムトラベラーガイの「過去へ消える」演出エフェクトは、resultLoopでは
  // 寿命(life)が減少しない（=一度発生すると消えず残り続けてしまう）ため、
  // リザルト画面へ移行するタイミングで明示的に消しておく
  timeTravelEffects = [];

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
    // タイムトラベル演出エフェクト更新（万一残っていても自然に消えるように）
    for (let i = timeTravelEffects.length - 1; i >= 0; i--) {
      timeTravelEffects[i].life -= 0.0055;
      if (timeTravelEffects[i].life <= 0) timeTravelEffects.splice(i, 1);
    }
  }

  // 通常描画（キャラ・エフェクト含む）
  draw();

  animId = requestAnimationFrame(resultLoop);
}

// ============================================================
// メインループ
// ============================================================
// 待機中・通常時どちらからも呼べる、エフェクト類（パーティクル・ダメージテキスト・
// 爆風・画面シェイク）だけの更新処理。キャラの移動や攻撃判定は含まない。
function updateEffects() {
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
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.life -= 1 / (s.maxLife * 60); // maxLife秒でちょうど消えるように減衰
    s.r = s.maxR * (1 - Math.max(0, s.life) / s.maxLife); // 進行度に応じて拡大
    if (s.life <= 0) shockwaves.splice(i, 1);
  }
  if (screenShake.time > 0) {
    screenShake.time--;
    if (screenShake.time <= 0) screenShake.power = 0;
  }
}

function loop() {
  if (!running) return;

  moveChar(p1char);
  moveChar(p2char);
  // 両者ともヒットストップ中のときのみ押し戻しをスキップ（片方だけなら通す）。
  // どちらかが力尽きている場合は、見えない亡骸に弾かれて見えないよう衝突判定自体を行わない
  if (p1char.hp > 0 && p2char.hp > 0 && !(p1char.hitstop > 0 && p2char.hitstop > 0)) resolveCollision(p1char, p2char);
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
  // トレーナー本体(p1char)が力尽きた瞬間、召喚キャラも道連れで消す
  if (p1summon && p1char.hp > 0 && p1summon.hp > 0) {
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
    if (p1summon.type === 'football') updateFootball(p1summon, p1SummonTarget);
    if (p1summon.type === 'ghost') updateGhost(p1summon, p1SummonTarget);
    // 相手本体からの攻撃も召喚キャラを狙えるようにする
    if (p2char.type === 'boxing') updateBoxing(p2char, p1summon);
    if (p2char.type === 'tennis') updateTennis(p2char, p1summon);
    if (p2char.type === 'gunman') updateGunman(p2char, p1summon);
    if (p2char.type === 'football') updateFootball(p2char, p1summon);
    if (p2char.type === 'ghost') updateGhost(p2char, p1summon);
  } else if (p1summon) {
    // 召喚キャラが力尽きた、またはトレーナー本体が力尽きた：召喚キャラを消す
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
  // トレーナー本体(p2char)が力尽きた瞬間、召喚キャラも道連れで消す
  if (p2summon && p2char.hp > 0 && p2summon.hp > 0) {
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
    if (p2summon.type === 'football') updateFootball(p2summon, p2SummonTarget);
    if (p2summon.type === 'ghost') updateGhost(p2summon, p2SummonTarget);
    if (p1char.type === 'boxing') updateBoxing(p1char, p2summon);
    if (p1char.type === 'tennis') updateTennis(p1char, p2summon);
    if (p1char.type === 'gunman') updateGunman(p1char, p2summon);
    if (p1char.type === 'football') updateFootball(p1char, p2summon);
    if (p1char.type === 'ghost') updateGhost(p1char, p2summon);
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

  updateEffects();

  resolveAllOverlaps();
  draw();

  // 次のキャラ登場を待機中：カウントダウンだけ進める（キャラの動き・エフェクトは
  // 上の通常処理内ですでに進行済み。checkWin側もpendingRespawn中は判定をスキップする）
  if (pendingRespawn) {
    pendingRespawn.timer--;
    if (pendingRespawn.timer <= 0) {
      const side = pendingRespawn.side;
      pendingRespawn = null;
      spawnNextTeammate(side);
    }
  }
  checkWin();
  if (running) animId = requestAnimationFrame(loop);
}

// ============================================================
// めり込み防止（フレーム最終パス）
// ============================================================
// 上のループ内では、キャラ同士の衝突（resolveCollision）が組み合わせごとに
// バラバラのタイミングで一度ずつしか実行されない。3体以上が同時に絡む場面
// （召喚キャラ・双子・未来のTTGなど）では1回の押し戻しだけでは全ての重なりが
// 解消しきらず、結果的にキャラ同士がめり込んで見えることがあった。
// また、壁際でキャラ同士が押し合うと resolveCollision の押し出しによって
// 壁の外（境界の外側）まで押し出されてしまい、次のフレームの moveChar で
// 補正されるまでの間だけ壁にめり込んで見えることがあった。
// → フレームの最後に、生存中の全キャラを対象として重なり解消を数回繰り返し
//    収束させ、最後に壁の内側へ強制的にクランプする。
function getAllLiveBodies() {
  return [p1char, p2char, p1twinB, p2twinB, p1summon, p2summon, ttgFuture, ttgFuture2]
    .filter(c => c && c.hp > 0);
}

function resolveAllOverlaps() {
  const bodies = getAllLiveBodies();
  const ITER = 3; // 3体以上絡んだ重なりも収束するよう複数回繰り返す
  for (let iter = 0; iter < ITER; iter++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        if (a.hitstop > 0 && b.hitstop > 0) continue; // 両者ヒットストップ中は既存仕様どおり押し戻しをスキップ
        resolveCollision(a, b); // ゴースト・突進中フットボールの特殊扱いは関数内で考慮済み
      }
    }
  }
  // 位置だけを壁の内側へ強制的にクランプ（速度はmoveChar側の処理に任せて変更しない）
  for (const c of bodies) {
    if (c.x - c.r < 0) c.x = c.r;
    if (c.x + c.r > W) c.x = W - c.r;
    if (c.y - c.r < 0) c.y = c.r;
    if (c.y + c.r > H) c.y = H - c.r;
  }
}

// ============================================================
// 初期化
// ============================================================


buildCharSelect();
