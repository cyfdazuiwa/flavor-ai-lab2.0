/*!
 * 五行纳音 · 有缘人匹配池  v1.0
 * ------------------------------------------------------------------
 * 在不改动主应用打包产物的前提下，通过外部模块为「报告页」扩展：
 *   1. 报告页展示「进入匹配池」入口
 *   2. 填写匹配偏好（朋友 / 学习搭子 / 饭搭子 / 随缘）
 *   3. 系统后台定时扫描匹配池，依据五行生克关系自动匹配
 *   4. 匹配成功 → 双方收到通知 → 可选择「开始聊天」或「继续等待」
 *   5. 聊天中可随时「结束聊天」
 *
 * 存储设计（无后端，纯前端模拟多用户）：
 *   sessionStorage.wuxing_me_v1   —— 当前标签页用户的档案（每个标签页 = 一位用户）
 *   localStorage.wuxing_pool_v1   —— 匹配池（所有标签页共享）
 *   localStorage.wuxing_matches_v1—— 匹配记录
 *   localStorage.wuxing_chat_v1_* —— 每段聊天的消息记录
 *   BroadcastChannel + storage 事件 —— 跨标签页实时通知
 */
(function () {
  'use strict';

  if (window.__WUXING_MATCH__) return;
  window.__WUXING_MATCH__ = true;

  /* ================================================================
   * 一、常量与数据
   * ================================================================ */

  var KEYS = {
    me: 'wuxing_me_v1',
    pool: 'wuxing_pool_v1',
    ver: 'wuxing_pool_ver_v1',
    matches: 'wuxing_matches_v1',
    chatPrefix: 'wuxing_chat_v1_',
    scanLock: 'wuxing_scan_lock_v1'
  };

  var ELS = ['wood', 'fire', 'earth', 'metal', 'water'];

  var EL_META = {
    wood:  { char: '木', color: '#5E8B7E', bgLight: '#F0F5F3' },
    fire:  { char: '火', color: '#C75B39', bgLight: '#FDF2EE' },
    earth: { char: '土', color: '#B89F78', bgLight: '#F9F5EE' },
    metal: { char: '金', color: '#7D8C9B', bgLight: '#F0F2F4' },
    water: { char: '水', color: '#4A7C9B', bgLight: '#EDF3F7' }
  };

  // 相生：木→火→土→金→水→木
  var SHENG = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
  // 相克：木克土、土克水、水克火、火克金、金克木
  var KE = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };

  var PREFS = [
    { id: 'friend',  label: '朋友',     desc: '结识气味相投的朋友',  emoji: '🤝' },
    { id: 'study',   label: '学习搭子', desc: '一起自习打卡监督',    emoji: '📚' },
    { id: 'meal',    label: '饭搭子',   desc: '干饭路上不孤单',      emoji: '🍜' },
    { id: 'suiyuan', label: '随缘',     desc: '一切交给天意安排',    emoji: '🌌' }
  ];

  var PREF_LABEL = { friend: '朋友', study: '学习搭子', meal: '饭搭子', suiyuan: '随缘' };

  // 12 种本命饮品档案（与主应用数据一致，用于模拟有缘人）
  var DRINKS = [
    { id: 'qingyou-wulong',    name: '青柚乌龙', nayin: '杨柳木', wuxing: { wood: 3, fire: 0, earth: 0, metal: 0, water: 0 }, temp: '清冷', bubble: '无汽' },
    { id: 'songzhen-qingmei',  name: '松针青梅', nayin: '松柏木', wuxing: { wood: 3, fire: 0, earth: 0, metal: 0, water: 0 }, temp: '清冷', bubble: '中汽' },
    { id: 'chixia-xuecheng',   name: '赤霞血橙', nayin: '天上火', wuxing: { wood: 0, fire: 3, earth: 0, metal: 0, water: 0 }, temp: '温热', bubble: '强汽' },
    { id: 'nuanjiang-hongcha', name: '暖姜红茶', nayin: '山下火', wuxing: { wood: 0, fire: 3, earth: 0, metal: 0, water: 0 }, temp: '温热', bubble: '中汽' },
    { id: 'xuanmi-ningmeng',   name: '玄米柠檬', nayin: '大驿土', wuxing: { wood: 0, fire: 0, earth: 3, metal: 0, water: 0 }, temp: '中性', bubble: '中汽' },
    { id: 'yanmai-kekou',      name: '燕麦可可', nayin: '城头土', wuxing: { wood: 0, fire: 0, earth: 3, metal: 0, water: 0 }, temp: '温热', bubble: '微汽' },
    { id: 'moli-tangli',       name: '茉莉汤力', nayin: '钗钏金', wuxing: { wood: 0, fire: 0, earth: 0, metal: 3, water: 0 }, temp: '清冷', bubble: '中汽' },
    { id: 'qingka-tangli',     name: '轻咖汤力', nayin: '海中金', wuxing: { wood: 0, fire: 0, earth: 0, metal: 3, water: 0 }, temp: '清冷', bubble: '强汽' },
    { id: 'haiyan-baitao',     name: '海盐白桃', nayin: '大海水', wuxing: { wood: 0, fire: 0, earth: 0, metal: 0, water: 3 }, temp: '清冷', bubble: '中汽' },
    { id: 'yeqing-lizhi',      name: '椰青荔枝', nayin: '大溪水', wuxing: { wood: 0, fire: 0, earth: 0, metal: 0, water: 3 }, temp: '清冷', bubble: '无汽' },
    { id: 'qingju-rusuan',     name: '青桔乳酸', nayin: '泉中水 + 石榴木', wuxing: { wood: 1, fire: 0, earth: 0, metal: 0, water: 2 }, temp: '清冷', bubble: '微汽' },
    { id: 'zisu-huamei',       name: '紫苏话梅', nayin: '涧下水 + 路旁土', wuxing: { wood: 0, fire: 0, earth: 1, metal: 0, water: 2 }, temp: '清冷', bubble: '中汽' }
  ];

  var BOT_NAMES = ['青梧', '望舒', '知许', '鹿鸣', '既白', '南乔', '温叙', '栖迟', '云岫', '竹西', '疏影', '兰舟', '扶苏', '清和', '拾星', '照野'];
  var BOT_LINES = {
    open: [
      '你好呀，天机把我们安排到了一起 ✨',
      '缘来是你！我的五行和你很合拍呢',
      '刚进匹配池就遇到了你，运气不错～'
    ],
    chat: [
      '你的本命饮品是{name}呀，我平时也挺喜欢这一口的',
      '五行里{rel}，难怪和你聊天这么顺畅',
      '你平时喜欢做什么？说不定我们还有共同爱好',
      '哈哈，被你发现了，我确实是典型的{nayin}性格',
      '说起来，这个测试还挺准的，你觉得呢？',
      '下次可以一起喝一杯，我请客 🧋',
      '你的名字好好听，有什么寓意吗？',
      '难得遇到这么合拍的{pref}，要珍惜呀'
    ],
    bye: [
      '和你聊天很开心，期待下次再聊～',
      '今天先聊到这里，有缘再见 🌙',
      '我去续杯茶了，回聊！'
    ]
  };

  var SCAN_INTERVAL_MS = 4000;     // 后台定时扫描频率
  var MATCH_THRESHOLD = 76;        // 匹配分数线
  var SUMMON_DELAY = [7000, 15000];// 演示模式：有缘人入池时间区间

  /* ================================================================
   * 二、工具函数
   * ================================================================ */

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function uid() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function now() { return Date.now(); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function elChar(key) { return (EL_META[key] || {}).char || '?'; }
  function elColor(key) { return (EL_META[key] || {}).color || '#2C2C2C'; }
  function fmtTime(ts) {
    var d = new Date(ts);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function readJSON(storage, key, fallback) {
    try {
      var raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(storage, key, val) {
    try { storage.setItem(key, JSON.stringify(val)); } catch (e) { /* 忽略配额错误 */ }
  }

  /* ================================================================
   * 三、数据层：我的档案 / 匹配池 / 匹配记录（版本化 CAS 写入）
   * ================================================================ */

  function getMe() { return readJSON(sessionStorage, KEYS.me, null); }
  function setMe(me) { writeJSON(sessionStorage, KEYS.me, me); refreshEntryUI(); }

  function getPool() { return readJSON(localStorage, KEYS.pool, []); }

  // 带版本号的事务写入：版本号对不上说明其它标签页已修改，写入失败
  function updatePool(mutator) {
    for (var attempt = 0; attempt < 8; attempt++) {
      var ver = parseInt(localStorage.getItem(KEYS.ver) || '0', 10);
      var pool = getPool();
      var result = mutator(pool);
      if (result === false) return false;
      var nextVer = ver + 1;
      try {
        localStorage.setItem(KEYS.ver, String(nextVer));
        localStorage.setItem(KEYS.pool, JSON.stringify(pool));
        return true;
      } catch (e) {
        if (parseInt(localStorage.getItem(KEYS.ver) || '0', 10) !== ver) return false;
      }
    }
    return false;
  }

  function getMatches() { return readJSON(localStorage, KEYS.matches, []); }
  function saveMatches(list) { writeJSON(localStorage, KEYS.matches, list); }

  function getChat(matchId) { return readJSON(localStorage, KEYS.chatPrefix + matchId, []); }
  function saveChat(matchId, msgs) { writeJSON(localStorage, KEYS.chatPrefix + matchId, msgs); }
  function appendChat(matchId, msg) {
    var msgs = getChat(matchId);
    msgs.push(msg);
    saveChat(matchId, msgs);
    bus.post({ type: 'chat', matchId: matchId, msg: msg });
    renderChat();
  }

  // 刷新当前打开的聊天消息区
  function renderChat() {
    if (state.panel !== 'chat') return;
    var body = $('#wxm-chat-body');
    if (!body) return;
    var match = getMyMatch();
    var me = getMe();
    if (!match || !me || match.id !== state.matchId) return;
    renderChatMessages(body, getChat(match.id), me, match, partnerOf(match), !!match.endedAt);
  }

  /* ================================================================
   * 四、跨标签页实时总线
   * ================================================================ */

  var bus = (function () {
    var bc = null;
    try { bc = new BroadcastChannel('wuxing-match-bus'); } catch (e) { /* 老浏览器降级 */ }
    var listeners = [];
    if (bc) bc.onmessage = function (e) { listeners.forEach(function (fn) { fn(e.data); }); };
    // storage 事件兜底（BroadcastChannel 不可用时）
    window.addEventListener('storage', function (e) {
      if (!bc && e.key === KEYS.ver && e.newValue) {
        listeners.forEach(function (fn) { fn({ type: 'pool-changed' }); });
      }
    });
    return {
      on: function (fn) { listeners.push(fn); },
      post: function (data) {
        if (bc) { try { bc.postMessage(data); } catch (e) {} }
      }
    };
  })();

  /* ================================================================
   * 五、五行生克匹配引擎
   * ================================================================ */

  // 计算两人之间的关系与合拍度
  function pairScore(a, b) {
    var da = a.dominant, db = b.dominant;
    var rel, delta, reasons = [];
    if (da === db) {
      rel = { type: 'tong', label: elChar(da) + elChar(db) + '同气 · 同气相求' };
      delta = 20; reasons.push('同为' + elChar(da) + '行，气质相投（同气相求）');
    } else if (SHENG[da] === db) {
      rel = { type: 'sheng', label: elChar(da) + '生' + elChar(db) + ' · 五行相生' };
      delta = 28; reasons.push(elChar(da) + '生' + elChar(db) + '，能量滋养、越处越旺（相生）');
    } else if (SHENG[db] === da) {
      rel = { type: 'sheng', label: elChar(db) + '生' + elChar(da) + ' · 五行相生' };
      delta = 26; reasons.push(elChar(db) + '生' + elChar(da) + '，对方旺你、彼此成就（相生）');
    } else if (KE[da] === db) {
      rel = { type: 'ke', label: elChar(da) + '克' + elChar(db) + ' · 相克制衡' };
      delta = 8; reasons.push(elChar(da) + '克' + elChar(db) + '，互补制衡、需要磨合（相克）');
    } else {
      rel = { type: 'ke', label: elChar(db) + '克' + elChar(da) + ' · 相克制衡' };
      delta = 10; reasons.push(elChar(db) + '克' + elChar(da) + '，互补制衡、需要磨合（相克）');
    }

    var score = 55 + delta;

    // 匹配偏好契合度
    if (a.pref === 'suiyuan' && b.pref === 'suiyuan') {
      score += 9; reasons.push('双方都随缘，一切刚刚好');
    } else if (a.pref === b.pref) {
      score += 10; reasons.push('都在找「' + PREF_LABEL[a.pref] + '」，心意一致');
    } else if (a.pref === 'suiyuan' || b.pref === 'suiyuan') {
      score += 6; reasons.push('一方随缘，来者皆是缘');
    } else {
      score += 2; reasons.push('偏好不同，靠五行缘分补足');
    }

    // 温度互补 / 气泡投缘
    var temps = [a.temp, b.temp];
    if (temps.indexOf('温热') > -1 && temps.indexOf('清冷') > -1) {
      score += 5; reasons.push('一温一凉，寒温互补');
    } else if (a.temp === b.temp) {
      score += 2;
    }
    if (a.bubble && a.bubble === b.bubble) { score += 2; reasons.push('气泡口感相同，喝到一块儿'); }

    score = Math.max(0, Math.min(99, Math.round(score)));
    return { score: score, relation: rel, reasons: reasons };
  }

  // 扫描匹配池：贪心配对（合拍度最高的优先）
  function findBestPairs(members) {
    var waiting = members.filter(function (m) { return m && m.uid && m.state === 'waiting'; });
    var pairs = [];
    for (var i = 0; i < waiting.length; i++) {
      for (var j = i + 1; j < waiting.length; j++) {
        var r = pairScore(waiting[i], waiting[j]);
        if (r.score >= MATCH_THRESHOLD) pairs.push({ a: waiting[i], b: waiting[j], r: r });
      }
    }
    pairs.sort(function (x, y) { return y.r.score - x.r.score; });
    var used = {}, chosen = [];
    pairs.forEach(function (p) {
      if (used[p.a.uid] || used[p.b.uid]) return;
      used[p.a.uid] = used[p.b.uid] = true;
      chosen.push(p);
    });
    return chosen;
  }

  // 定时扫描（带跨标签页心跳锁：同一时刻只有一个标签页执行撮合）
  function scanPool() {
    var lock = readJSON(localStorage, KEYS.scanLock, null);
    if (lock && now() - lock.at < SCAN_INTERVAL_MS - 500) return; // 其它标签页正在扫描
    writeJSON(localStorage, KEYS.scanLock, { at: now(), r: Math.random() }); // 心跳，独占扫描权

    var created = [];
    updatePool(function (pool) {
      var chosen = findBestPairs(pool);
      if (!chosen.length) return false;
      var matches = getMatches();
      chosen.forEach(function (p) {
        p.a.state = 'matched'; p.b.state = 'matched';
        var m = {
          id: 'm' + now().toString(36) + Math.random().toString(36).slice(2, 6),
          aUid: p.a.uid, bUid: p.b.uid,
          score: p.r.score,
          relation: p.r.relation,
          reasons: p.r.reasons,
          createdAt: now(),
          endedAt: null,
          seen: {}
        };
        p.a.matchId = m.id; p.b.matchId = m.id;
        matches.push(m); created.push(m);
      });
      saveMatches(matches);
      return true;
    });
    if (created.length) {
      created.forEach(function (m) {
        // BroadcastChannel 不会派发给发送者自身：本页命中的匹配直接应用副作用
        notifyMatchToMe(m, true);
        bus.post({ type: 'match-found', matchId: m.id });
      });
      refreshEntryUI();
    }
  }

  // 匹配命中当前用户时：更新档案、提示音、弹通知（markSeen=是否本页直接消费）
  function notifyMatchToMe(m, markSeen) {
    var me = getMe();
    if (!me || (m.aUid !== me.uid && m.bUid !== me.uid)) return false;
    if (m.seen[me.uid]) return false;
    var matches = getMatches();
    var mm = matches.filter(function (x) { return x.id === m.id; })[0];
    if (mm) {
      if (markSeen) mm.seen[me.uid] = true;
      saveMatches(matches);
    }
    setMe(Object.assign({}, me, { state: 'matched', matchId: m.id }));
    chime();
    var pid = m.aUid === me.uid ? m.bUid : m.aUid;
    var partner = getPool().filter(function (x) { return x.uid === pid; })[0];
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('五行有缘人出现了 ✦', {
          body: (partner ? partner.name : '有缘人') + ' · ' + m.relation.label + ' · 合拍 ' + m.score + '%'
        });
      } catch (e) { /* 通知失败不影响页内提示 */ }
    }
    toast('🎊 匹配成功：' + (partner ? partner.name : '有缘人') + ' · ' + m.relation.label.split(' ·')[0]);
    openPanel('match', m.id);
    refreshEntryUI();
    return true;
  }

  function getMyMatch() {
    var me = getMe();
    if (!me || !me.matchId) return null;
    return getMatches().filter(function (m) { return m.id === me.matchId; })[0] || null;
  }
  function partnerOf(match) {
    var me = getMe();
    if (!match || !me) return null;
    var pid = match.aUid === me.uid ? match.bUid : match.aUid;
    return getPool().filter(function (m) { return m.uid === pid; })[0] || null;
  }

  /* ================================================================
   * 六、样式（与主应用视觉语言一致：2px 描边、纸感底色、衬线标题）
   * ================================================================ */

  var CSS = ''
    + '#wxm-root{font-family:"Noto Sans SC","PingFang SC",sans-serif;position:fixed;inset:0;z-index:9998;pointer-events:none;display:none}'
    + '#wxm-root.on{display:block}'
    + '.wxm-mask{position:absolute;inset:0;background:rgba(44,44,44,.45);pointer-events:auto;opacity:0;transition:opacity .25s}'
    + '#wxm-root.show .wxm-mask{opacity:1}'
    + '.wxm-layer{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;pointer-events:none}'
    + '.wxm-sheet{pointer-events:auto;width:100%;max-width:394px;max-height:86vh;overflow:auto;background:#F7F5F0;border:2px solid #2C2C2C;box-shadow:6px 6px 0 rgba(44,44,44,.9);transform:translateY(16px);opacity:0;transition:all .28s cubic-bezier(.34,1.4,.64,1)}'
    + '#wxm-root.show .wxm-sheet{transform:translateY(0);opacity:1}'
    + '.wxm-sheet::-webkit-scrollbar{width:0}'
    + '.wxm-pad{padding:20px}'
    + '.wxm-title{font-family:"Noto Serif SC","Songti SC","Source Han Serif SC",serif;font-size:20px;font-weight:700;color:#2C2C2C;letter-spacing:.06em}'
    + '.wxm-sub{font-size:12px;color:#A8A29E;margin-top:4px;letter-spacing:.05em}'
    + '.wxm-x{position:absolute;top:10px;right:10px;width:32px;height:32px;border:2px solid #2C2C2C;background:#fff;color:#2C2C2C;font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}'
    + '.wxm-x:hover{background:#2C2C2C;color:#fff}'
    + '.wxm-card{background:#fff;border:2px solid #2C2C2C;padding:14px}'
    + '.wxm-btn{display:block;width:100%;padding:14px;border:2px solid #2C2C2C;background:#2C2C2C;color:#fff;font-size:15px;font-weight:700;letter-spacing:.14em;cursor:pointer;text-align:center;transition:all .15s;font-family:inherit}'
    + '.wxm-btn:hover{background:#4a4a4a}'
    + '.wxm-btn:active{transform:scale(.98)}'
    + '.wxm-btn.ghost{background:#fff;color:#2C2C2C}'
    + '.wxm-btn.ghost:hover{background:#2C2C2C;color:#fff}'
    + '.wxm-btn.slim{padding:10px;font-size:13px;letter-spacing:.08em}'
    + '.wxm-btn[disabled]{opacity:.45;cursor:not-allowed}'
    + '.wxm-prefs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}'
    + '.wxm-pref{border:2px solid #2C2C2C;background:#fff;padding:12px 10px;cursor:pointer;text-align:center;transition:all .15s}'
    + '.wxm-pref:hover{background:#F0F5F3}'
    + '.wxm-pref .e{font-size:22px}'
    + '.wxm-pref .t{font-size:14px;font-weight:700;color:#2C2C2C;margin-top:4px}'
    + '.wxm-pref .d{font-size:10px;color:#A8A29E;margin-top:2px}'
    + '.wxm-pref.sel{background:#2C2C2C}'
    + '.wxm-pref.sel .t{color:#fff}'
    + '.wxm-pref.sel .d{color:#bbb}'
    + '.wxm-tag{display:inline-flex;align-items:center;gap:4px;border:1.5px solid #2C2C2C;padding:3px 8px;font-size:11px;font-weight:700;background:#fff;color:#2C2C2C}'
    + '.wxm-profile-row{display:flex;align-items:center;gap:12px}'
    + '.wxm-orb{width:52px;height:52px;border:2px solid #2C2C2C;display:flex;align-items:center;justify-content:center;font-family:"Noto Serif SC","Songti SC",serif;font-size:24px;font-weight:700;color:#fff;flex:none}'
    + '.wxm-field{margin-top:14px}'
    + '.wxm-field label{font-size:11px;color:#A8A29E;letter-spacing:.1em;display:block;margin-bottom:6px}'
    + '.wxm-input{width:100%;box-sizing:border-box;border:2px solid #2C2C2C;background:#fff;padding:10px 12px;font-size:13px;color:#2C2C2C;font-family:inherit;outline:none}'
    + '.wxm-input:focus{box-shadow:3px 3px 0 rgba(44,44,44,.25)}'
    + '.wxm-foot{display:flex;gap:10px;margin-top:18px}'
    + '.wxm-scan{display:flex;align-items:center;gap:10px;margin-top:14px;border:2px dashed #2C2C2C;background:#fff;padding:12px 14px;font-size:12px;color:#2C2C2C}'
    + '.wxm-scan .dot{width:8px;height:8px;background:#5E8B7E;border-radius:50%;animation:wxmPulse 1.2s ease-in-out infinite;flex:none}'
    + '@keyframes wxmPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.7);opacity:.35}}'
    + '.wxm-pool-list{margin-top:12px;max-height:180px;overflow:auto}'
    + '.wxm-pool-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1.5px solid #E5E5E5;background:#fff;margin-bottom:8px}'
    + '.wxm-mini-orb{width:30px;height:30px;border:1.5px solid #2C2C2C;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex:none;font-family:"Noto Serif SC",serif}'
    + '.wxm-pool-item .n{font-size:13px;font-weight:700;color:#2C2C2C}'
    + '.wxm-pool-item .m{font-size:10px;color:#A8A29E;margin-top:1px}'
    + '.wxm-ring{position:relative;width:92px;height:92px;flex:none}'
    + '.wxm-ring svg{transform:rotate(-90deg)}'
    + '.wxm-ring .v{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}'
    + '.wxm-ring .v b{font-size:22px;font-family:"Noto Serif SC",serif;color:#2C2C2C}'
    + '.wxm-ring .v span{font-size:9px;color:#A8A29E;letter-spacing:.15em}'
    + '.wxm-rel{display:inline-block;border:2px solid #2C2C2C;padding:5px 12px;font-size:13px;font-weight:700;letter-spacing:.06em;background:#fff}'
    + '.wxm-reasons{margin-top:10px;font-size:11px;color:#6b6560;line-height:1.8}'
    + '.wxm-reasons li{list-style:none;padding-left:14px;position:relative}'
    + '.wxm-reasons li:before{content:"✦";position:absolute;left:0;font-size:9px;top:1px}'
    + '.wxm-confetti{position:absolute;top:-10px;font-size:16px;animation:wxmFall linear forwards;pointer-events:none}'
    + '@keyframes wxmFall{to{transform:translateY(340px) rotate(260deg);opacity:0}}'
    + '.wxm-chat{display:flex;flex-direction:column;height:62vh;max-height:480px;background:#F7F5F0}'
    + '.wxm-chat-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#2C2C2C;color:#fff}'
    + '.wxm-chat-head .t{font-size:14px;font-weight:700}'
    + '.wxm-chat-head .s{font-size:10px;opacity:.65;margin-top:2px}'
    + '.wxm-chat-body{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}'
    + '.wxm-msg{max-width:76%;display:flex;gap:8px;align-items:flex-end}'
    + '.wxm-msg .b{border:2px solid #2C2C2C;background:#fff;padding:8px 12px;font-size:13px;color:#2C2C2C;line-height:1.55;word-break:break-word}'
    + '.wxm-msg .t{font-size:9px;color:#A8A29E;flex:none}'
    + '.wxm-msg.mine{align-self:flex-end;flex-direction:row-reverse}'
    + '.wxm-msg.mine .b{background:#2C2C2C;color:#fff}'
    + '.wxm-msg .who{font-size:9px;color:#A8A29E;margin-bottom:3px}'
    + '.wxm-typing{display:inline-flex;gap:3px;padding:10px 12px;border:2px solid #2C2C2C;background:#fff;align-self:flex-start}'
    + '.wxm-typing i{width:5px;height:5px;background:#2C2C2C;border-radius:50%;animation:wxmBlink 1s infinite}'
    + '.wxm-typing i:nth-child(2){animation-delay:.18s}.wxm-typing i:nth-child(3){animation-delay:.36s}'
    + '@keyframes wxmBlink{0%,100%{opacity:.2;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}'
    + '.wxm-chat-foot{border-top:2px solid #2C2C2C;background:#fff;padding:10px;display:flex;gap:8px;align-items:center}'
    + '.wxm-chat-foot input{flex:1;border:2px solid #2C2C2C;padding:9px 10px;font-size:13px;outline:none;font-family:inherit;background:#F7F5F0}'
    + '.wxm-send{border:2px solid #2C2C2C;background:#2C2C2C;color:#fff;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;flex:none;letter-spacing:.1em}'
    + '.wxm-send:hover{background:#4a4a4a}'
    + '.wxm-endbar{padding:8px 10px;background:#fff;border-top:2px solid #2C2C2C;display:flex;justify-content:space-between;align-items:center;gap:8px}'
    + '.wxm-endbar .hint{font-size:10px;color:#A8A29E}'
    + '.wxm-ended{margin:6px 0;padding:10px 12px;background:#fff;border:2px dashed #2C2C2C;font-size:12px;color:#2C2C2C;text-align:center}'
    + '#wxm-fab{position:fixed;right:16px;bottom:22px;z-index:9997;display:none;align-items:center;gap:8px;border:2px solid #2C2C2C;background:#2C2C2C;color:#fff;padding:10px 16px;font-size:13px;font-weight:700;letter-spacing:.08em;cursor:pointer;box-shadow:4px 4px 0 rgba(44,44,44,.35);font-family:inherit}'
    + '#wxm-fab:hover{background:#4a4a4a}'
    + '#wxm-fab .badge{background:#C75B39;color:#fff;font-size:10px;padding:1px 7px;border:1.5px solid #fff;letter-spacing:0}'
    + '#wxm-fab.show{display:flex}'
    + '#wxm-cta{margin:0 24px 26px;display:block;width:calc(100% - 48px);box-sizing:border-box;padding:16px;border:2px solid #2C2C2C;background:linear-gradient(120deg,#2C2C2C,#4a4440);color:#fff;font-size:16px;font-weight:700;letter-spacing:.2em;cursor:pointer;font-family:inherit;box-shadow:5px 5px 0 rgba(44,44,44,.28);transition:all .15s;position:relative;overflow:hidden}'
    + '#wxm-cta:hover{transform:translateY(-2px);box-shadow:5px 8px 0 rgba(44,44,44,.28)}'
    + '#wxm-cta:active{transform:scale(.985)}'
    + '#wxm-cta .s{display:block;font-size:10px;font-weight:400;letter-spacing:.28em;margin-top:4px;opacity:.72}'
    + '.wxm-toast{position:fixed;left:50%;bottom:88px;transform:translateX(-50%) translateY(8px);background:#2C2C2C;color:#fff;font-size:13px;padding:10px 18px;z-index:10000;opacity:0;transition:all .3s;pointer-events:none;letter-spacing:.05em;max-width:86vw;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1.5px solid #fff}'
    + '.wxm-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}'
    + '.wxm-wait-quote{margin-top:16px;text-align:center;font-family:"Noto Serif SC","Songti SC",serif;font-size:12px;color:#A8A29E;letter-spacing:.2em}'
    + '.wxm-hist{margin-top:14px;border-top:1.5px dashed #D6D3CE;padding-top:10px}'
    + '.wxm-hist .h{font-size:10px;color:#A8A29E;letter-spacing:.12em;margin-bottom:6px}'
    + '.wxm-hist-item{font-size:11px;color:#6b6560;padding:4px 0;border-bottom:1px solid #EFEDE8;display:flex;justify-content:space-between;gap:8px}'
    + '.wxm-count-row{display:flex;gap:8px;margin-top:12px}'
    + '.wxm-stat{flex:1;background:#fff;border:2px solid #2C2C2C;padding:8px;text-align:center}'
    + '.wxm-stat b{display:block;font-size:18px;font-family:"Noto Serif SC",serif;color:#2C2C2C}'
    + '.wxm-stat span{font-size:9px;color:#A8A29E;letter-spacing:.12em}';

  /* ================================================================
   * 七、界面层
   * ================================================================ */

  var state = { panel: null, matchId: null, pendingProfile: null, confettiTimer: null };

  function buildShell() {
    if ($('#wxm-root')) return;
    var root = document.createElement('div');
    root.id = 'wxm-root';
    root.innerHTML = '<div class="wxm-mask" data-close="1"></div><div class="wxm-layer"><div class="wxm-sheet" id="wxm-sheet"></div></div>';
    document.body.appendChild(root);
    root.addEventListener('click', function (e) {
      if (e.target.getAttribute && e.target.getAttribute('data-close')) closePanel();
    });
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var fab = document.createElement('button');
    fab.id = 'wxm-fab';
    fab.innerHTML = '🔮 <span id="wxm-fab-label">匹配池</span>';
    fab.addEventListener('click', function () { openPanel('pool'); });
    document.body.appendChild(fab);

    var toast = document.createElement('div');
    toast.className = 'wxm-toast';
    toast.id = 'wxm-toast';
    document.body.appendChild(toast);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#wxm-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function chime() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      [660, 880].forEach(function (f, i) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.18);
        g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.18 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.5);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.55);
      });
    } catch (e) { /* 自动播放策略限制时静默 */ }
  }

  // 仅在内容变化时写 DOM：避免 innerHTML 重写触发 MutationObserver → refreshEntryUI 的无限循环
  function setHTMLIfChanged(el, html) {
    if (el.__wxm_html !== html) {
      el.__wxm_html = html;
      el.innerHTML = html;
    }
  }

  function confetti(container) {
    var chars = ['✦', '✧', '✵', '❋', '木', '火', '土', '金', '水'];
    var colors = ['#5E8B7E', '#C75B39', '#B89F78', '#7D8C9B', '#4A7C9B'];
    clearInterval(state.confettiTimer);
    var n = 0;
    state.confettiTimer = setInterval(function () {
      if (++n > 24 || !container.isConnected) { clearInterval(state.confettiTimer); return; }
      var s = document.createElement('span');
      s.className = 'wxm-confetti';
      s.textContent = pick(chars);
      s.style.left = randInt(4, 92) + '%';
      s.style.color = pick(colors);
      s.style.animationDuration = randInt(14, 24) / 10 + 's';
      container.appendChild(s);
      setTimeout(function () { s.remove(); }, 2600);
    }, 90);
  }

  function openPanel(name, arg) {
    buildShell();
    state.panel = name;
    if (name === 'chat') state.matchId = arg;
    var root = $('#wxm-root');
    root.classList.add('on');
    requestAnimationFrame(function () { root.classList.add('show'); });
    renderPanel();
  }
  function closePanel() {
    var root = $('#wxm-root');
    if (!root) return;
    root.classList.remove('show');
    state.panel = null;
    setTimeout(function () { root.classList.remove('on'); }, 260);
    refreshEntryUI();
  }

  function renderPanel() {
    var sheet = $('#wxm-sheet');
    if (!sheet) return;
    if (state.panel === 'pref') renderPrefPanel(sheet);
    else if (state.panel === 'pool') renderPoolPanel(sheet);
    else if (state.panel === 'match') renderMatchPanel(sheet);
    else if (state.panel === 'chat') renderChatPanel(sheet);
    else sheet.innerHTML = '';
  }

  function orbHtml(member, size) {
    var c = elColor(member.dominant);
    return '<span class="' + (size ? 'wxm-mini-orb' : 'wxm-orb') + '" style="background:' + c + '">' + esc(elChar(member.dominant)) + '</span>';
  }

  /* ---------- 面板 1：填写匹配偏好 ---------- */

  function renderPrefPanel(sheet) {
    var p = state.pendingProfile;
    var sel = p.pref || 'friend';
    sheet.innerHTML = ''
      + '<button class="wxm-x" data-close="1">✕</button>'
      + '<div class="wxm-pad">'
      + '  <div class="wxm-title">匹配偏好</div>'
      + '  <div class="wxm-sub">系统将依据五行生克为你寻找有缘人</div>'
      + '  <div class="wxm-card" style="margin-top:16px">'
      + '    <div class="wxm-profile-row">'
      + orbHtml(p)
      + '      <div style="min-width:0">'
      + '        <div style="font-size:16px;font-weight:700;color:#2C2C2C">' + esc(p.name) + '</div>'
      + '        <div style="font-size:11px;color:#A8A29E;margin-top:3px">纳音 · ' + esc(p.nayin) + '</div>'
      + '        <div style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap">'
      + '          <span class="wxm-tag" style="color:' + elColor(p.dominant) + ';border-color:' + elColor(p.dominant) + '">本命 ' + esc(p.drink) + '</span>'
      + '          <span class="wxm-tag">' + esc(p.temp) + ' · ' + esc(p.bubble) + '</span>'
      + '        </div>'
      + '      </div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="wxm-field"><label>你想找什么样的有缘人？</label>'
      + '    <div class="wxm-prefs">' + PREFS.map(function (pf) {
        return '<div class="wxm-pref' + (pf.id === sel ? ' sel' : '') + '" data-pref="' + pf.id + '">'
          + '<div class="e">' + pf.emoji + '</div><div class="t">' + pf.label + '</div><div class="d">' + pf.desc + '</div></div>';
      }).join('') + '    </div>'
      + '  </div>'
      + '  <div class="wxm-field"><label>一句话签名（可选，展示给有缘人）</label>'
      + '    <input class="wxm-input" id="wxm-tagline" maxlength="24" placeholder="例：想找一位木行人一起看展 ☕" />'
      + '  </div>'
      + '  <div class="wxm-foot">'
      + '    <button class="wxm-btn ghost" data-close="1">暂不</button>'
      + '    <button class="wxm-btn" id="wxm-join">进入匹配池</button>'
      + '  </div>'
      + '</div>';

    $$('.wxm-pref', sheet).forEach(function (el) {
      el.addEventListener('click', function () {
        sel = el.getAttribute('data-pref');
        $$('.wxm-pref', sheet).forEach(function (x) { x.classList.toggle('sel', x === el); });
      });
    });
    $('#wxm-join', sheet).addEventListener('click', function () {
      p.pref = sel;
      p.tagline = ($('#wxm-tagline', sheet).value || '').trim().slice(0, 24);
      joinPool(p);
    });
  }

  /* ---------- 面板 2：匹配池状态 ---------- */

  function renderPoolPanel(sheet) {
    var me = getMe();
    var pool = getPool();
    var match = getMyMatch();

    if (!me) {
      sheet.innerHTML = ''
        + '<button class="wxm-x" data-close="1">✕</button>'
        + '<div class="wxm-pad" style="text-align:center">'
        + '  <div class="wxm-title" style="margin-top:20px">尚未入池</div>'
        + '  <div class="wxm-sub" style="margin:10px 0 22px">完成测试后，在报告页点击「进入匹配池」<br/>填写偏好即可开始缘分匹配</div>'
        + '  <button class="wxm-btn ghost" data-close="1">我知道了</button>'
        + '</div>';
      return;
    }

    var others = pool.filter(function (m) { return m.uid !== me.uid; });
    var html = '<button class="wxm-x" data-close="1">✕</button>'
      + '<div class="wxm-pad">'
      + '<div class="wxm-title">五行匹配池</div>'
      + '<div class="wxm-sub">系统每 ' + (SCAN_INTERVAL_MS / 1000) + ' 秒扫描一次，依据五行生克自动撮合</div>'
      + '<div class="wxm-count-row">'
      + '  <div class="wxm-stat"><b>' + pool.length + '</b><span>池中人数</span></div>'
      + '  <div class="wxm-stat"><b>' + pool.filter(function (m) { return m.state === 'waiting'; }).length + '</b><span>等待缘分</span></div>'
      + '  <div class="wxm-stat"><b>' + getMatches().filter(function (m) { return !m.endedAt; }).length + '</b><span>进行中的缘分</span></div>'
      + '</div>'
      + '<div class="wxm-card" style="margin-top:14px">'
      + '  <div class="wxm-profile-row">' + orbHtml(me)
      + '    <div style="min-width:0;flex:1">'
      + '      <div style="font-size:15px;font-weight:700;color:#2C2C2C">' + esc(me.name) + ' <span style="font-size:10px;color:#A8A29E;font-weight:400">（我）</span></div>'
      + '      <div style="font-size:11px;color:#A8A29E;margin-top:2px">纳音 · ' + esc(me.nayin) + ' ｜ 期望：' + PREF_LABEL[me.pref] + (me.tagline ? ' ｜ "' + esc(me.tagline) + '"' : '') + '</div>'
      + '    </div>'
      + '    <span class="wxm-tag" style="' + (me.state === 'matched' ? 'background:#2C2C2C;color:#fff' : '') + '">' + (me.state === 'matched' ? '已匹配' : '等待中') + '</span>'
      + '  </div>'
      + '</div>';

    if (match && me.state === 'matched') {
      var partner = partnerOf(match);
      if (partner) {
        html += ''
          + '<div class="wxm-card" style="margin-top:12px;background:' + EL_META[partner.dominant].bgLight + '">'
          + '  <div class="wxm-profile-row">' + orbHtml(partner)
          + '    <div style="min-width:0;flex:1">'
          + '      <div style="font-size:15px;font-weight:700;color:#2C2C2C">🎉 有缘人已出现：' + esc(partner.name) + '</div>'
          + '      <div style="font-size:11px;color:#6b6560;margin-top:2px">纳音 · ' + esc(partner.nayin) + ' ｜ ' + esc(partner.drink) + '</div>'
          + '      <div style="font-size:11px;margin-top:4px;color:' + elColor(partner.dominant) + ';font-weight:700">' + esc(match.relation.label) + ' · 合拍 ' + match.score + '%</div>'
          + '    </div>'
          + '  </div>'
          + '  <div style="display:flex;gap:8px;margin-top:12px">'
          + '    <button class="wxm-btn slim" id="wxm-gochat">开始聊天</button>'
          + '    <button class="wxm-btn slim ghost" id="wxm-endmatch">结束这段缘分</button>'
          + '  </div>'
          + '</div>';
      }
    } else {
      html += '<div class="wxm-scan"><span class="dot"></span><span>天机推演中… 有缘人入池后即刻为你撮合</span></div>';
    }

    // 池中其它人
    html += '<div class="wxm-pool-list">';
    if (others.length === 0) {
      html += '<div style="text-align:center;font-size:11px;color:#A8A29E;padding:14px 0">池中暂时只有你一个人<br/>点击下方「邀请有缘人」体验匹配</div>';
    } else {
      others.forEach(function (m) {
        html += '<div class="wxm-pool-item">' + orbHtml(m, 1)
          + '<div style="flex:1;min-width:0"><div class="n">' + esc(m.name) + (m.bot ? ' <span style="font-size:9px;color:#A8A29E">·演示</span>' : '') + '</div>'
          + '<div class="m">' + elChar(m.dominant) + '行 · ' + esc(m.nayin) + ' · 找' + PREF_LABEL[m.pref] + '</div></div>'
          + '<span class="wxm-tag" style="font-size:9px">' + (m.state === 'matched' ? '已匹配' : '等待中') + '</span></div>';
      });
    }
    html += '</div>';

    html += '<div class="wxm-foot" style="flex-direction:column">';
    html += '<button class="wxm-btn ghost slim" id="wxm-summon">✦ 邀请一位有缘人入池（演示）</button>';
    html += '<button class="wxm-btn ghost slim" id="wxm-leave">离开匹配池</button>';
    html += '</div>';

    // 历史缘分
    var me2 = getMe();
    var hist = getMatches().filter(function (m) { return m.endedAt && (m.aUid === me2.uid || m.bUid === me2.uid); }).slice(-4).reverse();
    if (hist.length) {
      html += '<div class="wxm-hist"><div class="h">过往缘分</div>';
      hist.forEach(function (m) {
        var pid = m.aUid === me2.uid ? m.bUid : m.aUid;
        var pm = getPool().filter(function (x) { return x.uid === pid; })[0];
        html += '<div class="wxm-hist-item"><span>' + esc(pm ? pm.name : '有缘人') + ' · ' + esc(m.relation.label.split(' ·')[0]) + '</span><span>' + m.score + '%</span></div>';
      });
      html += '</div>';
    }
    html += '<div class="wxm-wait-quote">—— 五行流转 · 缘分天定 ——</div></div>';

    sheet.innerHTML = html;

    var go = $('#wxm-gochat', sheet);
    if (go) go.addEventListener('click', function () { openPanel('chat', match.id); });
    var endm = $('#wxm-endmatch', sheet);
    if (endm) endm.addEventListener('click', function () { endMatch(match.id, true); });
    $('#wxm-summon', sheet).addEventListener('click', function () {
      summonBot(true);
      toast('✦ 一位有缘人正在入池…');
    });
    $('#wxm-leave', sheet).addEventListener('click', function () { leavePool(true); });
  }

  /* ---------- 面板 3：匹配成功通知 ---------- */

  function renderMatchPanel(sheet) {
    var match = getMyMatch();
    var me = getMe();
    if (!match || !me) { openPanel('pool'); return; }
    var partner = partnerOf(match);
    if (!partner) { openPanel('pool'); return; }
    var c = elColor(partner.dominant);

    sheet.innerHTML = ''
      + '<div class="wxm-pad" style="text-align:center;position:relative">'
      + '  <div id="wxm-confetti-box" style="position:absolute;inset:0;overflow:hidden;pointer-events:none"></div>'
      + '  <div style="font-size:30px;margin-top:6px">🎊</div>'
      + '  <div class="wxm-title" style="margin-top:6px">匹配成功</div>'
      + '  <div class="wxm-sub">天机已为你们牵线 · ' + esc(match.relation.label) + '</div>'
      + '  <div style="display:flex;align-items:center;justify-content:center;gap:18px;margin-top:20px">'
      + '    <div style="text-align:center">'
      + orbHtml(me)
      + '      <div style="font-size:13px;font-weight:700;margin-top:8px;color:#2C2C2C">' + esc(me.name) + '</div>'
      + '      <div style="font-size:10px;color:#A8A29E;margin-top:2px">' + elChar(me.dominant) + '行 · ' + esc(me.drink) + '</div>'
      + '    </div>'
      + '    <div class="wxm-ring">'
      + '      <svg width="92" height="92">'
      + '        <circle cx="46" cy="46" r="40" fill="#fff" stroke="#E5E5E5" stroke-width="6"/>'
      + '        <circle cx="46" cy="46" r="40" fill="none" stroke="' + c + '" stroke-width="6" stroke-dasharray="' + (251.2 * match.score / 100).toFixed(1) + ' 251.3" stroke-linecap="butt"/>'
      + '      </svg>'
      + '      <div class="v"><b>' + match.score + '%</b><span>合拍度</span></div>'
      + '    </div>'
      + '    <div style="text-align:center">'
      + orbHtml(partner)
      + '      <div style="font-size:13px;font-weight:700;margin-top:8px;color:#2C2C2C">' + esc(partner.name) + '</div>'
      + '      <div style="font-size:10px;color:#A8A29E;margin-top:2px">' + elChar(partner.dominant) + '行 · ' + esc(partner.drink) + '</div>'
      + '    </div>'
      + '  </div>'
      + '  <div style="margin-top:18px"><span class="wxm-rel" style="color:' + c + ';border-color:' + c + '">' + esc(match.relation.label) + '</span></div>'
      + '  <ul class="wxm-reasons" style="text-align:left;max-width:300px;margin:10px auto 0">'
      + match.reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('')
      + '  </ul>'
      + '  <div class="wxm-foot" style="margin-top:22px">'
      + '    <button class="wxm-btn ghost" id="wxm-wait">继续等待</button>'
      + '    <button class="wxm-btn" id="wxm-chat-now">开始聊天</button>'
      + '  </div>'
      + '</div>';

    confetti($('#wxm-confetti-box', sheet));
    $('#wxm-chat-now', sheet).addEventListener('click', function () { openPanel('chat', match.id); });
    $('#wxm-wait', sheet).addEventListener('click', closePanel);
  }

  /* ---------- 面板 4：聊天 ---------- */

  function renderChatPanel(sheet) {
    var match = getMyMatch();
    var me = getMe();
    if (!match || !me) { openPanel('pool'); return; }
    var partner = partnerOf(match);
    var msgs = getChat(match.id);
    var ended = !!match.endedAt;
    var iEnded = match.endedBy === me.uid;

    sheet.innerHTML = '<div class="wxm-chat">'
      + '  <div class="wxm-chat-head">'
      + '    <button class="wxm-x" id="wxm-chat-back" style="position:static;border-color:#fff;background:transparent;color:#fff">←</button>'
      + orbHtml(partner || { dominant: me.dominant }, 1)
      + '    <div style="flex:1;min-width:0">'
      + '      <div class="t">' + esc(partner ? partner.name : '有缘人') + '</div>'
      + '      <div class="s">' + esc(match.relation.label.split(' ·')[0]) + ' · 合拍 ' + match.score + '% ｜ ' + esc(partner ? partner.nayin : '') + '</div>'
      + '    </div>'
      + (ended ? '' : '<button class="wxm-send" id="wxm-chat-end" style="background:transparent;border-color:#fff;font-size:11px;padding:7px 10px">结束聊天</button>')
      + '  </div>'
      + '  <div class="wxm-chat-body" id="wxm-chat-body"></div>'
      + (ended
        ? '<div class="wxm-ended">🌿 ' + (iEnded ? '你已结束这段聊天' : '对方已结束这段聊天') + '<br/><span style="font-size:10px;color:#A8A29E">五行流转，缘分不散 · 有缘再会</span></div>'
        : '<div class="wxm-endbar"><span class="hint">善意交流 · 随时可结束</span></div>'
        + '<div class="wxm-chat-foot">'
        + '  <input id="wxm-chat-input" maxlength="120" placeholder="说点什么…" />'
        + '  <button class="wxm-send" id="wxm-chat-send">发送</button>'
        + '</div>')
      + '</div>';

    var body = $('#wxm-chat-body', sheet);
    renderChatMessages(body, msgs, me, match, partner, ended);

    $('#wxm-chat-back', sheet).addEventListener('click', function () { openPanel('pool'); });

    if (!ended) {
      var input = $('#wxm-chat-input', sheet);
      var send = function () {
        var text = (input.value || '').trim();
        if (!text) return;
        input.value = '';
        appendChat(match.id, { from: me.uid, name: me.name, text: text.slice(0, 120), at: now() });
        scheduleBotReply(match, partner);
      };
      $('#wxm-chat-send', sheet).addEventListener('click', send);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
      $('#wxm-chat-end', sheet).addEventListener('click', function () {
        var btn = this;
        if (btn.getAttribute('data-armed')) { endMatch(match.id, true); return; }
        btn.setAttribute('data-armed', '1');
        btn.textContent = '确认结束？';
        btn.style.background = '#C75B39';
        setTimeout(function () {
          if (btn.isConnected) { btn.removeAttribute('data-armed'); btn.textContent = '结束聊天'; btn.style.background = 'transparent'; }
        }, 3000);
      });
      // 有缘人是机器人时：首次打开补一句开场白
      if (partner && partner.bot && msgs.length === 0) {
        setTimeout(function () {
          if (state.panel !== 'chat' || state.matchId !== match.id) return;
          var still = getMyMatch();
          if (still && !still.endedAt && getChat(match.id).length === 0) {
            appendChat(match.id, { from: partner.uid, name: partner.name, text: pick(BOT_LINES.open), at: now() });
          }
        }, 1200);
      }
      setTimeout(function () { body.scrollTop = body.scrollHeight; }, 30);
    }
  }

  function renderChatMessages(body, msgs, me, match, partner, ended) {
    body.innerHTML = msgs.map(function (m) {
      var mine = m.from === me.uid;
      return '<div class="wxm-msg' + (mine ? ' mine' : '') + '">'
        + '<div><div class="who">' + esc(mine ? '我' : (m.name || '对方')) + '</div>'
        + '<div class="b">' + esc(m.text) + '</div></div>'
        + '<span class="t">' + fmtTime(m.at) + '</span></div>';
    }).join('') + (ended ? '' : '');
    body.scrollTop = body.scrollHeight;
  }

  function scheduleBotReply(match, partner) {
    if (!partner || !partner.bot) return;
    var me = getMe();
    var replyDelay = randInt(1400, 3000);
    setTimeout(function () {
      var live = getMatches().filter(function (m) { return m.id === match.id; })[0];
      if (!live || live.endedAt) return;
      var body = $('#wxm-chat-body');
      var typing = document.createElement('div');
      typing.className = 'wxm-typing';
      typing.innerHTML = '<i></i><i></i><i></i>';
      if (body && state.panel === 'chat' && state.matchId === match.id) { body.appendChild(typing); body.scrollTop = body.scrollHeight; }
      setTimeout(function () {
        var live2 = getMatches().filter(function (m) { return m.id === match.id; })[0];
        if (!live2 || live2.endedAt) return;
        typing.remove();
        var relTxt = live2.relation.label.split(' ·')[0];
        var line = pick(BOT_LINES.chat)
          .replace('{name}', partner.drink)
          .replace('{rel}', relTxt)
          .replace('{nayin}', partner.nayin)
          .replace('{pref}', PREF_LABEL[partner.pref] || '缘分');
        appendChat(match.id, { from: partner.uid, name: partner.name, text: line, at: now() });
      }, randInt(900, 1600));
    }, replyDelay);
  }

  /* ================================================================
   * 八、入池 / 离池 / 结束聊天 / 模拟有缘人
   * ================================================================ */

  function joinPool(profile) {
    profile.state = 'waiting';
    profile.matchId = null;
    profile.joinedAt = now();
    setMe(profile);
    updatePool(function (pool) {
      var i = pool.findIndex(function (m) { return m.uid === profile.uid; });
      if (i > -1) pool[i] = profile; else pool.push(profile);
      return true;
    });
    bus.post({ type: 'pool-changed' });
    closePanel();
    toast('✦ 已进入匹配池，天机推演中…');
    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (e) {}
    }
    scheduleScan();
    scheduleSummon();
  }

  function leavePool(byUser) {
    var me = getMe();
    if (!me) return;
    var match = getMyMatch();
    if (match && !match.endedAt) { endMatch(match.id, byUser); return; }
    updatePool(function (pool) {
      var i = pool.findIndex(function (m) { return m.uid === me.uid; });
      if (i > -1) pool.splice(i, 1);
      return true;
    });
    setMe(null);
    bus.post({ type: 'pool-changed' });
    if (byUser) { toast('已离开匹配池'); closePanel(); }
    refreshEntryUI();
  }

  function endMatch(matchId, byMe) {
    var me = getMe();
    var matches = getMatches();
    var match = matches.filter(function (m) { return m.id === matchId; })[0];
    if (!match || match.endedAt) return;
    match.endedAt = now();
    if (byMe && me) match.endedBy = me.uid;
    saveMatches(matches);

    var pid = match.aUid === (me && me.uid) ? match.bUid : match.aUid;
    updatePool(function (pool) {
      [match.aUid, match.bUid].forEach(function (id) {
        var m = pool.filter(function (x) { return x.uid === id; })[0];
        // 双方都离开匹配池；人类档案保留等待重新入池，机器人直接移除
        if (!m) return;
        if (m.bot) {
          var i = pool.indexOf(m);
          pool.splice(i, 1);
        } else {
          m.state = 'idle';
          m.matchId = null;
        }
      });
      return true;
    });
    // 同步本页档案，让 CTA / 悬浮球立即复位
    if (me && (me.uid === match.aUid || me.uid === match.bUid)) {
      setMe(Object.assign({}, me, { state: 'idle', matchId: null }));
    }

    appendChat(matchId, { from: 'system', name: '系统', text: '—— 聊天已结束，五行流转，缘分不散 ——', at: now() });
    bus.post({ type: 'match-ended', matchId: matchId, by: byMe ? (me && me.uid) : pid });
    toast('聊天已结束 · 有缘再会 🌿');
    if (state.panel === 'chat' || state.panel === 'match') renderPanel();
    refreshEntryUI();
  }

  // 演示：生成一位模拟有缘人
  var summonTimer = null;
  function summonBot(guaranteed) {
    var me = getMe();
    var drink = pick(DRINKS);
    if (guaranteed && me) {
      // 优先挑一位与我五行相生 / 同气的有缘人，保证演示效果
      var good = DRINKS.filter(function (d) {
        var dom = dominantOf(d.wuxing);
        return SHENG[me.dominant] === dom || SHENG[dom] === me.dominant || dom === me.dominant;
      });
      if (good.length) drink = pick(good);
    }
    var namePool = BOT_NAMES.slice();
    getPool().forEach(function (m) {
      var i = namePool.indexOf(m.name);
      if (i > -1) namePool.splice(i, 1);
    });
    var bot = {
      uid: uid(),
      name: namePool.length ? pick(namePool) : '有缘人' + randInt(10, 99),
      drink: drink.name,
      drinkId: drink.id,
      nayin: drink.nayin,
      dominant: dominantOf(drink.wuxing),
      scores: drink.wuxing,
      temp: drink.temp,
      bubble: drink.bubble,
      pref: pick(['friend', 'study', 'meal', 'suiyuan']),
      tagline: '',
      bot: true,
      state: 'waiting',
      matchId: null,
      joinedAt: now()
    };
    updatePool(function (pool) { pool.push(bot); return true; });
    bus.post({ type: 'pool-changed' });
    scheduleScan();
  }
  function dominantOf(wuxing) {
    var best = 'wood', v = -1;
    ELS.forEach(function (k) { if ((wuxing[k] || 0) > v) { v = wuxing[k] || 0; best = k; } });
    return best;
  }

  var summonTimers = [];
  // 双人同浏览器演示时可设 sessionStorage['wxm_solo_off']='1' 关闭自动召唤，
  // 让两个真实用户互相匹配
  function autoSummonEnabled() {
    try { return sessionStorage.getItem('wxm_solo_off') !== '1'; } catch (e) { return true; }
  }
  function scheduleSummon() {
    summonTimers.forEach(clearTimeout);
    summonTimers = [];
    // 演示模式：入池 7~15 秒后自动来一位高合拍有缘人，让「后台扫描」尽快开花结果
    summonTimers.push(setTimeout(function () {
      if (!autoSummonEnabled()) return;
      var me = getMe();
      if (!me || me.state !== 'waiting') return;
      var waiting = getPool().filter(function (m) { return m.state === 'waiting'; });
      if (waiting.length > 1) return;
      summonBot(true);
      toast('✦ 一位有缘人悄悄进入了匹配池');
      if (state.panel === 'pool') renderPanel();
    }, randInt(SUMMON_DELAY[0], SUMMON_DELAY[1])));
  }

  var scanTimer = null;
  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setInterval(function () {
      var pool = getPool();
      if (pool.filter(function (m) { return m.state === 'waiting'; }).length >= 2) {
        scanPool();
      } else {
        writeJSON(localStorage, KEYS.scanLock, null);
      }
    }, SCAN_INTERVAL_MS);
  }

  /* ================================================================
   * 九、报告页探测与入口注入
   * ================================================================ */

  // 从报告页 DOM 解析当前用户的五行档案
  function parseResultProfile() {
    var root = document.getElementById('root');
    if (!root) return null;
    var text = root.innerText || '';
    if (text.indexOf('纳音：') === -1) return null;
    var h1 = root.querySelector('h1');
    var drinkName = h1 ? h1.textContent.trim() : '';
    var drink = DRINKS.filter(function (d) { return d.name === drinkName; })[0];
    if (!drink) return null;
    var nayin = (text.match(/纳音：\s*([^\n]+)/) || [])[1];
    nayin = nayin ? nayin.trim() : drink.nayin;

    // 五行分布：纳音段落后的彩色行，形如「木3 火1」
    var scores = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
    var ps = $$('p', root);
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].textContent.indexOf('纳音：') > -1) {
        var tagline = ps[i].nextElementSibling;
        if (tagline) {
          var re = /[木火土金水](\d+)/g, m;
          while ((m = re.exec(tagline.textContent))) {
            var ch = m[0][0];
            var key = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' }[ch];
            scores[key] = parseInt(m[1], 10) || 0;
          }
        }
        break;
      }
    }
    if (!scores.wood && !scores.fire && !scores.earth && !scores.metal && !scores.water) {
      scores = drink.wuxing; // 兜底：直接采用本命饮品的五行
    }

    // 温度 / 气泡：卡片上的 label + 值
    var temp = drink.temp, bubble = drink.bubble;
    ps.forEach(function (p) {
      var t = p.textContent.trim();
      if (t === '温度' && p.nextElementSibling) temp = p.nextElementSibling.textContent.trim();
      if (t === '气泡' && p.nextElementSibling) bubble = p.nextElementSibling.textContent.trim();
    });

    var name = localStorage.getItem('wuxing_username') || '无名之辈';
    var prev = getMe();
    return {
      uid: (prev && prev.uid) || uid(),
      name: name,
      drink: drink.name,
      drinkId: drink.id,
      nayin: nayin,
      dominant: dominantOf(scores),
      scores: scores,
      temp: temp,
      bubble: bubble,
      pref: (prev && prev.pref) || 'friend',
      tagline: (prev && prev.tagline) || '',
      bot: false,
      state: 'idle',
      matchId: null
    };
  }

  // 报告页 CTA：插入到「重新测试」按钮所在行之后
  function ensureResultCTA() {
    if ($('#wxm-cta')) return;
    var btns = $$('button');
    var restart = null;
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.trim() === '重新测试') { restart = btns[i]; break; }
    }
    if (!restart) return;
    var cta = document.createElement('button');
    cta.id = 'wxm-cta';
    cta.addEventListener('click', onCTAClick);
    restart.closest('div.flex') ? restart.closest('div.flex').parentNode.insertBefore(cta, restart.closest('div.flex').nextSibling) : restart.parentNode.appendChild(cta);
    refreshEntryUI();
  }

  function removeResultCTA() {
    var cta = $('#wxm-cta');
    if (cta) cta.remove();
  }

  function onCTAClick() {
    var me = getMe();
    if (me && me.state === 'matched' && me.matchId) {
      var m = getMatches().filter(function (x) { return x.id === me.matchId; })[0];
      if (m && !m.endedAt) { openPanel(m._notified ? 'pool' : 'match', m.id); return; }
    }
    if (me && me.state === 'waiting') { openPanel('pool'); return; }
    var profile = parseResultProfile();
    if (!profile) { toast('请先完成测试获取五行报告'); return; }
    state.pendingProfile = profile;
    openPanel('pref');
  }

  // 根据状态刷新报告页 CTA 与悬浮球
  function refreshEntryUI() {
    var me = getMe();
    var cta = $('#wxm-cta');
    var fab = $('#wxm-fab');
    if (!cta && !fab) return;

    var onResult = !!parseResultProfile();
    var active = me && (me.state === 'waiting' || (me.state === 'matched' && me.matchId));
    var match = active && me.matchId ? getMatches().filter(function (m) { return m.id === me.matchId; })[0] : null;
    var liveMatch = match && !match.endedAt;

    if (cta) {
      if (!onResult) {
        cta.style.display = 'none';
      } else {
        cta.style.display = 'block';
        if (liveMatch) {
          setHTMLIfChanged(cta, '💬 与有缘人聊天<span class="s">' + esc(match.relation.label.split(' ·')[0]) + ' · 合拍 ' + match.score + '%</span>');
        } else if (me && me.state === 'waiting') {
          setHTMLIfChanged(cta, '⏳ 匹配池 · 缘分推演中<span class="s">点击查看匹配池状态</span>');
        } else {
          setHTMLIfChanged(cta, '进入匹配池<span class="s">依五行生克 · 寻找你的有缘人</span>');
        }
      }
    }
    if (fab) {
      if (active) {
        fab.classList.add('show');
        var label = $('#wxm-fab-label');
        if (label) {
          if (liveMatch) setHTMLIfChanged(label, '有缘人 <span class="badge">聊天</span>');
          else setHTMLIfChanged(label, '等待缘分');
        }
      } else {
        fab.classList.remove('show');
      }
    }
  }

  // 监听主应用渲染（React SPA，整树替换）
  var mo = new MutationObserver(function () {
    var onResult = !!parseResultProfile();
    if (onResult) ensureResultCTA(); else removeResultCTA();
    refreshEntryUI();
  });

  /* ================================================================
   * 十、总线事件 → 双方收到通知
   * ================================================================ */

  bus.on(function (evt) {
    if (!evt) return;
    var me = getMe();
    if (evt.type === 'match-found') {
      var m = getMatches().filter(function (x) { return x.id === evt.matchId; })[0];
      if (!m) return;
      notifyMatchToMe(m, true); // 命中当前用户才生效
    } else if (evt.type === 'chat') {
      if (!me || evt.msg.from === me.uid) return;
      if (state.panel === 'chat' && state.matchId === evt.matchId) {
        var body = $('#wxm-chat-body');
        if (body) renderChatMessages(body, getChat(evt.matchId), me, getMyMatch(), partnerOf(getMyMatch()), false);
      } else if (me.matchId === evt.matchId) {
        toast('💬 ' + evt.msg.name + '：' + evt.msg.text.slice(0, 18));
      }
    } else if (evt.type === 'match-ended') {
      if (!me) return;
      var em = getMatches().filter(function (x) { return x.id === evt.matchId; })[0];
      // 对方结束聊天：复位我的档案，CTA / 悬浮球回到可重新入池状态
      if (em && (em.aUid === me.uid || em.bUid === me.uid)) {
        setMe(Object.assign({}, me, { state: 'idle', matchId: null }));
        if (state.panel === 'chat' || state.panel === 'match') renderPanel();
        toast('💬 对方结束了这段聊天 · 有缘再会');
      }
      refreshEntryUI();
    } else if (evt.type === 'pool-changed') {
      if (state.panel === 'pool') renderPanel();
      refreshEntryUI();
    }
  });

  /* ================================================================
   * 十一、启动
   * ================================================================ */

  function boot() {
    buildShell();
    mo.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
    scheduleScan();
    // 唤醒时核对状态（匹配方结束聊天等）
    setInterval(refreshEntryUI, 3000);
    refreshEntryUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
