// ============================================================
// キャラクター定義
// ============================================================
const ROSTER = [
  {
    id: 'boxing',
    name: 'Boxing Guy', emoji: '🥊',
    desc: 'パンチ＆アッパーカットで殴り続ける格闘家',
    color: '#378ADD', lightColor: '#B5D4F4',
    makeChar(side) {
      const s = rnd(2.2, 3.2); const v = randVel(s);
      return {
        x: side === 'p1' ? rnd(60, 180) : rnd(W-180, W-60),
        y: rnd(80, H-80),
        vx: v.vx, vy: v.vy, baseSpd: s,
        r: 55, hp: 1000, maxHp: 1000,
        punchCooldown: 0, upperCooldown: 0, upperCharge: 0, hitTimer: 0, hitstop: 0, knockback: 0, punchAnimTimer: 0, upperAnimTimer: 0, dodgeAnimTimer: 0, dodgeCooldown: 0, comboCount: 0, comboTimer: 0,
        trail: [],
        name: 'Boxing Guy', emoji: '🥊',
        color: '#378ADD', lightColor: '#B5D4F4',
        type: 'boxing'
      };
    }
  },
  {
    id: 'darts',
    name: 'Darts Guy', emoji: '🎯',
    desc: '的を狙ってダーツを連射！的が破壊されると爆発',
    color: '#D85A30', lightColor: '#F5C4B3',
    makeChar(side) {
      const s = rnd(2.2, 3.2); const v = randVel(s);
      return {
        x: side === 'p1' ? rnd(60, 180) : rnd(W-180, W-60),
        y: rnd(80, H-80),
        vx: v.vx, vy: v.vy, baseSpd: s,
        r: 55, hp: 1000, maxHp: 1000,
        dartCooldown: 0, hitTimer: 0, hitstop: 0, burstCount: 0, burstInterval: 0, knockback: 0,
        trail: [],
        name: 'Darts Guy', emoji: '🎯',
        color: '#D85A30', lightColor: '#F5C4B3',
        type: 'darts'
      };
    }
  },
  {
    id: 'tennis',
    name: 'Tennis Guy', emoji: '🎾',
    desc: 'テニスボールを高速スマッシュ！打ち返すことも可能',
    color: '#4CAF50', lightColor: '#A5D6A7',
    makeChar(side) {
      const s = rnd(2.2, 3.2); const v = randVel(s);
      return {
        x: side === 'p1' ? rnd(60, 180) : rnd(W-180, W-60),
        y: rnd(80, H-80),
        vx: v.vx, vy: v.vy, baseSpd: s,
        r: 55, hp: 1000, maxHp: 1000,
        smashCooldown: 0, hitTimer: 0, hitstop: 0, knockback: 0, racketAngle: 0, swingTimer: 0, swingBaseAngle: 0,
        trail: [],
        name: 'Tennis Guy', emoji: '🎾',
        color: '#4CAF50', lightColor: '#A5D6A7',
        type: 'tennis'
      };
    }
  },
  {
    id: 'pingpong',
    name: 'Ping Pong Guy', emoji: '🏓',
    desc: '貫通するピンポン玉を連打！壁を跳ねて翻弄する',
    color: '#9C27B0', lightColor: '#CE93D8',
    makeChar(side) {
      const s = rnd(2.2, 3.2); const v = randVel(s);
      return {
        x: side === 'p1' ? rnd(60, 180) : rnd(W-180, W-60),
        y: rnd(80, H-80),
        vx: v.vx, vy: v.vy, baseSpd: s,
        r: 55, hp: 1000, maxHp: 1000,
        hitTimer: 0, hitstop: 0,
        ballFired: false, ballCooldown: 0, knockback: 0,
        trail: [],
        name: 'Ping Pong Guy', emoji: '🏓',
        color: '#9C27B0', lightColor: '#CE93D8',
        type: 'pingpong'
      };
    }
  },
  {
    id: 'bomb',
    name: 'Bomb Guy', emoji: '💣',
    desc: '30秒の時限爆弾を持ち運ぶ！触れた相手に押し付けて爆発に巻き込め',
    color: '#424242', lightColor: '#FF8A65',
    makeChar(side) {
      const s = rnd(2.2, 3.2); const v = randVel(s);
      return {
        x: side === 'p1' ? rnd(60, 180) : rnd(W-180, W-60),
        y: rnd(80, H-80),
        vx: v.vx, vy: v.vy, baseSpd: s,
        r: 55, hp: 1000, maxHp: 1000,
        hitTimer: 0, hitstop: 0, knockback: 0,
        trail: [],
        name: 'Bomb Guy', emoji: '💣',
        color: '#424242', lightColor: '#FF8A65',
        type: 'bomb'
      };
    }
  },
  {
    id: 'twins',
    name: 'Twins Guy', emoji: '👬',
    desc: '双子でHP共有！ソーセージで攻撃＆回復',
    color: '#E91E63', lightColor: '#F48FB1',
    makeChar(side) {
      const s = rnd(2.0, 3.0);
      const va = randVel(s), vb = randVel(s);
      // 双子A・Bを作り、互いを参照させる
      const a = {
        x: side === 'p1' ? rnd(60, 140) : rnd(W-140, W-60),
        y: rnd(80, H/2 - 20),
        vx: va.vx, vy: va.vy, baseSpd: s,
        r: 48, hp: 1000, maxHp: 1000,
        hitTimer: 0, hitstop: 0, knockback: 0,
        trail: [],
        name: 'Twins Guy A', emoji: '👬',
        color: '#E91E63', lightColor: '#F48FB1',
        type: 'twins', twinId: 'A',
        sausageCooldown: 90, throwTimer: 0, twin: null
      };
      const b = {
        x: side === 'p1' ? rnd(60, 140) : rnd(W-140, W-60),
        y: rnd(H/2 + 20, H - 80),
        vx: vb.vx, vy: vb.vy, baseSpd: s,
        r: 48, hp: 1000, maxHp: 1000,
        hitTimer: 0, hitstop: 0, knockback: 0,
        trail: [],
        name: 'Twins Guy B', emoji: '👬',
        color: '#E91E63', lightColor: '#F48FB1',
        type: 'twins', twinId: 'B',
        sausageCooldown: 45, throwTimer: 0, twin: null
      };
      a.twin = b; b.twin = a;
      // makeChar は1体しか返せないので a を返し、b は a.twinB として保持
      a.twinB = b;
      return a;
    }
  },
  {
    id: 'timetraveler',
    name: 'Time Traveler Guy', emoji: '⏳',
    desc: 'HP低下で過去に逃げ、未来の自分を呼び寄せて戦う',
    color: '#00BCD4', lightColor: '#80DEEA',
    makeChar(side) {
      const s = rnd(2.2, 3.2); const v = randVel(s);
      return {
        x: side === 'p1' ? rnd(60, 180) : rnd(W-180, W-60),
        y: rnd(80, H-80),
        vx: v.vx, vy: v.vy, baseSpd: s,
        r: 55, hp: 1000, maxHp: 1000,
        hitTimer: 0, hitstop: 0, knockback: 0,
        trail: [],
        name: 'Time Traveler Guy', emoji: '⏳',
        color: '#00BCD4', lightColor: '#80DEEA',
        type: 'timetraveler',
        timeLoopX: null  // 収束後のHP閾値
      };
    }
  },
  {
    id: 'landmine',
    name: 'Landmine Guy', emoji: '🧨',
    desc: '壁に激突すると数秒間動けなくなり、その場に地雷を設置する',
    color: '#6D4C28', lightColor: '#C8A165',
    makeChar(side) {
      const s = rnd(2.2, 3.2); const v = randVel(s);
      return {
        x: side === 'p1' ? rnd(60, 180) : rnd(W-180, W-60),
        y: rnd(80, H-80),
        vx: v.vx, vy: v.vy, baseSpd: s,
        r: 55, hp: 1000, maxHp: 1000,
        hitTimer: 0, hitstop: 0, knockback: 0,
        trail: [],
        name: 'Landmine Guy', emoji: '🧨',
        color: '#6D4C28', lightColor: '#C8A165',
        type: 'landmine',
        wallStopTimer: 0, // 壁に激突した後、動けなくなる残りフレーム数
        mineSmileTimer: 0, // 地雷設置直後の数秒間、笑顔画像を表示する残りフレーム数
        mineCooldown: 0 // 地雷を設置してから次の地雷を設置できるようになるまでのクールダウン
      };
    }
  },
  {
    id: 'gunman',
    name: 'Gunman Guy', emoji: '🔫',
    desc: '敵が真横に並んだ瞬間だけ、狙いすまして銃を撃つ',
    color: '#5D4037', lightColor: '#D7B98E',
    makeChar(side) {
      const s = rnd(2.2, 3.2); const v = randVel(s);
      return {
        x: side === 'p1' ? rnd(60, 180) : rnd(W-180, W-60),
        y: rnd(80, H-80),
        vx: v.vx, vy: v.vy, baseSpd: s,
        r: 55, hp: 1000, maxHp: 1000,
        hitTimer: 0, hitstop: 0, knockback: 0,
        trail: [],
        name: 'Gunman Guy', emoji: '🔫',
        color: '#5D4037', lightColor: '#D7B98E',
        type: 'gunman',
        gunCooldown: 0, gunFireTimer: 0, aimDir: 1, burstCount: 0, overheatCooldown: 0
      };
    }
  },
  {
    id: 'trainer',
    name: 'Trainer Guy', emoji: '🧢',
    desc: '敵に卵を投げつける召喚術師！卵が割れるとランダムな仲間が飛び出し、倒されても何度でも卵を投げ続ける',
    color: '#FFB300', lightColor: '#FFE082',
    makeChar(side) {
      const s = rnd(2.2, 3.2); const v = randVel(s);
      return {
        x: side === 'p1' ? rnd(60, 180) : rnd(W-180, W-60),
        y: rnd(80, H-80),
        vx: v.vx, vy: v.vy, baseSpd: s,
        r: 55, hp: 1000, maxHp: 1000,
        hitTimer: 0, hitstop: 0, knockback: 0,
        trail: [],
        name: 'Trainer Guy', emoji: '🧢',
        color: '#FFB300', lightColor: '#FFE082',
        type: 'trainer',
        eggCooldown: 40 // 開始直後にすぐ卵を投げ始める（上方修正で短縮）
      };
    }
  },
  {
    id: 'changeguy',
    name: 'Changing Guy', emoji: '🔄',
    desc: 'HPが200減るごとに、ランダムに別のガイへ変身する！',
    color: '#FFC107', lightColor: '#FFE082',
    makeChar(side) {
      const s = rnd(2.2, 3.2); const v = randVel(s);
      const c = {
        x: side === 'p1' ? rnd(60, 180) : rnd(W-180, W-60),
        y: rnd(80, H-80),
        vx: v.vx, vy: v.vy, baseSpd: s,
        r: 55, hp: 1000, maxHp: 1000,
        hitTimer: 0, hitstop: 0, knockback: 0,
        trail: [],
        name: 'Changing Guy', emoji: '🔄',
        color: '#FFC107', lightColor: '#FFE082',
        type: 'changeguy',
        isChangeGuy: true, form: null, hpCheckpoint: 1000
      };
      transformChangeGuy(c, true); // 開始時にランダムな初期フォームを決める（隙は発生させない）
      return c;
    }
  },
  {
    id: 'football',
    name: 'Amefot Guy', emoji: '🏈',
    desc: 'その場に数秒立ち止まった後、相手めがけて猛チャージ！',
    color: '#8D6E63', lightColor: '#D7CCC8',
    makeChar(side) {
      const s = rnd(2.2, 3.2); const v = randVel(s);
      return {
        x: side === 'p1' ? rnd(60, 180) : rnd(W-180, W-60),
        y: rnd(80, H-80),
        vx: v.vx, vy: v.vy, baseSpd: s,
        r: 55, hp: 1000, maxHp: 1000,
        hitTimer: 0, hitstop: 0, knockback: 0,
        trail: [],
        name: 'Amefot Guy', emoji: '🏈',
        color: '#8D6E63', lightColor: '#D7CCC8',
        type: 'football',
        footballState: 'wander',   // 'wander'（通常移動）→ 'windup'（立ち止まり）→ 'charging'（突進）
        footballTimer: 0,          // 現在の状態が終わるまでの残りフレーム数
        footballCooldown: Math.floor(rnd(90, 150)), // 次のwindupが始まるまでの残りフレーム数
        footballHitDone: false     // 今回の突進で既にヒットしたか
      };
    }
  },
  {
    id: 'ghost',
    name: 'Ghost Guy', emoji: '👻',
    desc: '敵とぶつかっても弾かれず、そのまま貫通！重なっている間ダメージを与え続ける',
    color: '#B39DDB', lightColor: '#D1C4E9',
    makeChar(side) {
      const s = rnd(2.2, 3.2); const v = randVel(s);
      return {
        x: side === 'p1' ? rnd(60, 180) : rnd(W-180, W-60),
        y: rnd(80, H-80),
        vx: v.vx, vy: v.vy, baseSpd: s,
        r: 55, hp: 1000, maxHp: 1000,
        hitTimer: 0, hitstop: 0, knockback: 0,
        trail: [],
        name: 'Ghost Guy', emoji: '👻',
        color: '#B39DDB', lightColor: '#D1C4E9',
        type: 'ghost',
        ghostDamageCooldown: 0 // 重なっている間のダメージtick間隔管理
      };
    }
  }
];
