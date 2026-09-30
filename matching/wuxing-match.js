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

  var BOT_NAMES = ['青梧', '望舒', '知许', '鹿鸣', '既白', '南乔', '温叙', '栖迟', '云岫', '竹西', '疏影', '兰舟', '扶苏', '清和', '拾星', '照野', '之遥', '晚棠', '屿安', '斯年', '听澜', '沐白', '之夏', '其琛', '亦安', '阮白', '叙白', '枝枝'];

  // 用户属性标签库（偏好弹窗自选，最多 4 个；共同标签参与匹配加分）
  var TAGS = ['爬山', '健身', '电影', '追剧', '摄影', '做饭', '桌游', 'K歌', '旅行', '读书', '游戏', '撸猫', '遛狗', '爵士乐', '二次元', '咖啡续命', '夜猫子', '早睡星人', 'i人', 'e人', '甜品控', '球类运动'];

  // 机器人人设素材（真人化）
  var BOT_JOBS = ['平面设计师', '在读研究生', '后端程序员', '小学老师', '咖啡师', '产品经理', '自由插画师', '麻醉护士', '视频剪辑师', '健身教练', '建筑设计师', '宠物医生', '书店店员', '地质勘探员'];
  var BOT_STATUS = ['刚下班', '周末瘫', '在图书馆', '上班摸鱼', '刚健完身', '追剧中', '旅行途中', '深夜emo'];
  var BOT_TAGLINES = [
    '在成为更好的自己之前，先成为更快乐的自己',
    '白天搬砖，晚上做梦',
    '人生是旷野，不是轨道',
    '按时吃饭，按月旅行',
    '喝酒六分醉，吃饭七分饱',
    '和世界交手多年，依然光彩依旧',
    '主打一个随遇而安',
    '兴趣广泛，样样稀松',
    '不想上班，想上山',
    '咖啡因驱动型人类',
    '快乐最大，其他随缘',
    '收集日落和好听的歌'
  ];
  var BOT_LINES = {
    open: [
      '你好呀，天机把我们安排到了一起 ✨',
      '缘来是你！我的五行和你很合拍呢',
      '刚进匹配池就遇到了你，运气不错～',
      '嗨嗨，看了一眼资料，感觉我们会聊得来',
      '叮咚～你的有缘人上线了 🧋'
    ],
    chat: [
      '你的本命饮品是{name}呀，我平时也挺喜欢这一口的',
      '五行里{rel}，难怪和你聊天这么顺畅',
      '你平时喜欢做什么？说不定我们还有共同爱好',
      '哈哈，被你发现了，我确实是典型的{nayin}性格',
      '说起来，这个测试还挺准的，你觉得呢？',
      '下次可以一起喝一杯，我请客 🧋',
      '你的名字好好听，有什么寓意吗？',
      '难得遇到这么合拍的{pref}，要珍惜呀',
      '对了我平时{status}，闲下来就喜欢{tag}',
      '看到你也是「{shared}」同好，瞬间有话题了！',
      '我是做{job}的，你呢？',
      '我的签名是「{tagline}」，你品味应该差不多 😏',
      '今天有点累，但和你聊天还挺解压的',
      '你周末一般怎么过呀？我可能又在{status}'
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

  // 在线模式：读云端缓存；本地模式：读 localStorage
  function getPool() { return cloudOn() ? cloudCache.pool : readJSON(localStorage, KEYS.pool, []); }

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

  function getMatches() { return cloudOn() ? cloudCache.matches : readJSON(localStorage, KEYS.matches, []); }
  function saveMatches(list) { if (!cloudOn()) writeJSON(localStorage, KEYS.matches, list); }

  function getChat(matchId) { return cloudOn() ? (cloudCache.chats[matchId] || []) : readJSON(localStorage, KEYS.chatPrefix + matchId, []); }
  function saveChat(matchId, msgs) { if (!cloudOn()) writeJSON(localStorage, KEYS.chatPrefix + matchId, msgs); }

  function getCommunity() { return cloudOn() ? cloudCache.community : readJSON(localStorage, COMM.key, { posts: [] }); }
  function saveCommunity(c) { if (!cloudOn()) writeJSON(localStorage, COMM.key, c); }
  function appendChat(matchId, msg) {
    if (cloudOn()) {
      // 在线模式：写入数据库，Realtime 回推后统一渲染
      cloudSendChat(matchId, msg).catch(function (e) { toast('发送失败：' + (e && e.message || '网络错误')); });
      return;
    }
    var msgs = getChat(matchId);
    msgs.push(msg);
    saveChat(matchId, msgs);
    bus.post({ type: 'chat', matchId: matchId, msg: msg });
    renderChat();
    // 收到对方（或机器人）新消息时，刷新接话建议
    var me = getMe();
    if (msg.from !== 'system' && (!me || msg.from !== me.uid)) renderAiChips();
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
      if (!bc && e.newValue && (e.key === KEYS.ver || e.key === COMM.ver)) {
        listeners.forEach(function (fn) { fn({ type: e.key === COMM.ver ? 'community' : 'pool-changed' }); });
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
   * 四·四、云端（Supabase，可选）：真实用户 / 数据库 / 实时同步
   * 配置后进入「在线模式」：不同设备的真实用户可互相匹配聊天；
   * 未配置时保持「本地模式」，所有功能不受影响。
   * ================================================================ */

  var CLOUD_KEY = 'wuxing_supabase_v1';
  var cloudCache = { pool: [], matches: [], chats: {}, community: { posts: [] }, user: null, sub: null, seen: {} };

  function cloudCfg() { return readJSON(localStorage, CLOUD_KEY, null); }
  function cloudSaveCfg(cfg) { writeJSON(localStorage, CLOUD_KEY, cfg); }
  function cloudConfigured() {
    var c = cloudCfg();
    return !!(c && c.url && c.anonKey);
  }
  // 在线模式判定：已配置且已登录
  function cloudOn() {
    return !!(cloudConfigured() && cloudCache.user);
  }

  var sb = null; // supabase client
  function cloudLoadSdk() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var tryLoad = function (src, fallback) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = function () { resolve(); };
        s.onerror = function () { if (fallback) tryLoad(fallback, null); else reject(new Error('SDK 加载失败，请检查网络')); };
        document.head.appendChild(s);
      };
      tryLoad('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
              'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js');
    });
  }

  function cloudInit() {
    if (!cloudConfigured()) return Promise.resolve(false);
    return cloudLoadSdk().then(function () {
      var c = cloudCfg();
      sb = window.supabase.createClient(c.url, c.anonKey);
      return sb.auth.getSession().then(function (res) {
        cloudCache.user = res.data && res.data.session ? res.data.session.user : null;
        sb.auth.onAuthStateChange(function (_evt, session) {
          var u = session && session.user ? session.user : null;
          var changed = (!!u) !== (!!cloudCache.user) || (u && cloudCache.user && u.id !== cloudCache.user.id);
          cloudCache.user = u;
          if (changed) onCloudAuthChanged(u);
        });
        if (cloudCache.user) return cloudBootstrap();
        return true;
      });
    }).then(function () { return true; }).catch(function (e) {
      trace('cloud:init ERR ' + (e && e.message));
      return false;
    });
  }

  // 登录 / 退出后：拉取云端数据并订阅实时变化
  function onCloudAuthChanged(u) {
    if (u) {
      cloudBootstrap().then(function () {
        toast('☁️ 已登录 · 在线模式（' + u.email + '）');
        if (state.panel === 'auth' || state.panel === 'pool') renderPanel();
      });
    } else {
      toast('已退出登录 · 本地模式');
      if (state.panel === 'auth' || state.panel === 'pool') renderPanel();
    }
  }

  // 把云端行映射为本地成员结构
  function mapMember(row) {
    return {
      uid: row.uid, name: row.name || '用户',
      gender: row.gender || 'secret', age: row.age || null,
      seekGender: row.seek_gender || 'any',
      tags: row.tags || [], tagline: row.tagline || '',
      pref: row.pref || 'friend',
      drink: row.drink || '', drinkId: row.drink_id || '', nayin: row.nayin || '',
      dominant: row.dominant || 'wood', scores: row.scores || {},
      temp: row.temp || '', bubble: row.bubble || '',
      state: row.state || 'waiting', matchId: row.match_id || null,
      bot: false, joinedAt: row.joined_at ? new Date(row.joined_at).getTime() : now()
    };
  }
  function mapMatch(row) {
    return {
      id: row.id, aUid: row.a_uid, bUid: row.b_uid,
      score: row.score, relation: row.relation || {}, reasons: row.reasons || [],
      createdAt: row.created_at ? new Date(row.created_at).getTime() : now(),
      endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
      endedBy: row.ended_by || null, seen: row.seen || {}
    };
  }

  function cloudBootstrap() {
    return Promise.all([
      cloudFetchProfile(),
      cloudFetchPool(),
      cloudFetchMatches(),
      cloudFetchCommunity()
    ]).then(function () {
      cloudSubscribe();
      bus.post({ type: 'pool-changed' });
      refreshEntryUI();
      return true;
    });
  }

  function cloudFetchProfile() {
    return sb.from('profiles').select('*').eq('id', cloudCache.user.id).maybeSingle()
      .then(function (res) {
        if (!res.data) return;
        var row = res.data;
        var prev = getMe() || {};
        setMe({
          uid: cloudCache.user.id,
          name: row.name || prev.name || '用户',
          gender: row.gender || 'secret', age: row.age || null,
          seekGender: row.seek_gender || 'any', tags: row.tags || [],
          tagline: row.tagline || '', pref: row.pref || 'friend',
          drink: row.drink || prev.drink || '', drinkId: row.drink_id || '',
          nayin: row.nayin || prev.nayin || '', dominant: row.dominant || prev.dominant || 'wood',
          scores: row.scores || prev.scores || {}, temp: row.temp || prev.temp || '',
          bubble: row.bubble || prev.bubble || '',
          bot: false, state: 'idle', matchId: null
        });
      });
  }
  function cloudUpsertProfile(profile) {
    return sb.from('profiles').upsert({
      id: profile.uid, name: profile.name, gender: profile.gender, age: profile.age,
      seek_gender: profile.seekGender, tags: profile.tags || [], tagline: profile.tagline || '',
      pref: profile.pref, drink: profile.drink, drink_id: profile.drinkId,
      nayin: profile.nayin, dominant: profile.dominant, scores: profile.scores,
      temp: profile.temp, bubble: profile.bubble, updated_at: new Date().toISOString()
    });
  }

  function cloudFetchPool() {
    return sb.from('pool').select('*').then(function (res) {
      if (res.error) throw res.error;
      cloudCache.pool = (res.data || []).map(mapMember);
    });
  }
  function cloudJoinPool(profile) {
    return sb.from('pool').upsert({
      uid: profile.uid, state: 'waiting', match_id: null,
      name: profile.name, gender: profile.gender, age: profile.age,
      seek_gender: profile.seekGender, tags: profile.tags || [], tagline: profile.tagline || '',
      pref: profile.pref, drink: profile.drink, nayin: profile.nayin,
      dominant: profile.dominant, scores: profile.scores,
      temp: profile.temp, bubble: profile.bubble, joined_at: new Date().toISOString()
    }).then(function () { return cloudFetchPool(); });
  }
  function cloudLeavePool() {
    return sb.from('pool').delete().eq('uid', cloudCache.user.id).then(function () { return cloudFetchPool(); });
  }

  function cloudFetchMatches() {
    return sb.from('matches').select('*').order('created_at', { ascending: false }).limit(50)
      .then(function (res) {
        if (res.error) throw res.error;
        cloudCache.matches = (res.data || []).map(mapMatch).reverse();
      });
  }
  // 新匹配命中当前用户时弹通知（每段匹配每次会话只提示一次）
  function handleCloudMatchUpdates() {
    var me = getMe();
    if (!me) return;
    cloudCache.matches.forEach(function (m) {
      if (m.endedAt) return;
      if (m.aUid !== me.uid && m.bUid !== me.uid) return;
      if (cloudCache.seen[m.id]) return;
      cloudCache.seen[m.id] = true;
      if (me.matchId !== m.id || me.state !== 'matched') {
        setMe(Object.assign({}, me, { state: 'matched', matchId: m.id }));
      }
      notifyMatchToMe(m, false);
    });
  }

  function cloudFetchChat(matchId) {
    return sb.from('messages').select('*').eq('match_id', matchId).order('at', { ascending: true })
      .then(function (res) {
        if (res.error) throw res.error;
        cloudCache.chats[matchId] = (res.data || []).map(function (m) {
          return { from: m.sender, name: m.sender_name || '', text: m.text, at: m.at ? new Date(m.at).getTime() : now() };
        });
      });
  }
  function cloudSendChat(matchId, msg) {
    // 乐观上屏：先本地缓存渲染，Realtime 回推由 onCloudMessage 去重
    var list = cloudCache.chats[matchId] || (cloudCache.chats[matchId] = []);
    list.push(msg);
    renderChat();
    return sb.from('messages').insert({
      match_id: matchId, sender: msg.from, sender_name: msg.name, text: msg.text
    }).catch(function (e) {
      var i = list.indexOf(msg);
      if (i > -1) list.splice(i, 1);
      renderChat();
      throw e;
    });
  }
  function onCloudMessage(row) {
    var msg = { from: row.sender, name: row.sender_name || '', text: row.text, at: row.at ? new Date(row.at).getTime() : now() };
    var list = cloudCache.chats[row.match_id] || (cloudCache.chats[row.match_id] = []);
    var dup = list.length && list[list.length - 1].from === msg.from && list[list.length - 1].text === msg.text && Math.abs(list[list.length - 1].at - msg.at) < 3000;
    if (dup) return;
    list.push(msg);
    var me = getMe();
    if (state.panel === 'chat' && state.matchId === row.match_id) {
      renderChat();
      if (me && msg.from !== me.uid) toast('💬 ' + msg.name + '：' + msg.text.slice(0, 18));
    } else if (me && msg.from !== me.uid) {
      toast('💬 ' + msg.name + '：' + msg.text.slice(0, 18));
    }
  }

  function cloudFetchCommunity() {
    return Promise.all([
      sb.from('posts').select('*').order('at', { ascending: false }).limit(100),
      sb.from('comments').select('*').order('at', { ascending: true }).limit(300)
    ]).then(function (resArr) {
      var posts = resArr[0].data || [], cmts = resArr[1].data || [];
      var byPost = {};
      cmts.forEach(function (c) { (byPost[c.post_id] = byPost[c.post_id] || []).push({
        id: c.id, uid: c.uid, name: c.name || '', dominant: c.dominant || 'wood',
        text: c.text, at: c.at ? new Date(c.at).getTime() : now()
      }); });
      cloudCache.community = { posts: posts.map(function (p) {
        return {
          id: p.id, element: p.channel, uid: p.uid, name: p.name || '',
          gender: p.gender || 'secret', age: p.age || null,
          drink: p.drink || '', dominant: p.dominant || 'wood', tags: p.tags || [],
          text: p.text, at: p.at ? new Date(p.at).getTime() : now(),
          likes: p.likes || [], comments: byPost[p.id] || []
        };
      }) };
    });
  }
  function cloudAddPost(post) {
    return sb.from('posts').insert({
      id: post.id, channel: post.element, uid: post.uid, name: post.name,
      gender: post.gender, age: post.age, drink: post.drink, dominant: post.dominant,
      tags: post.tags || [], text: post.text
    }).then(cloudFetchCommunity);
  }
  function cloudAddComment(postId, cmt) {
    return sb.from('comments').insert({
      id: cmt.id, post_id: postId, uid: cmt.uid, name: cmt.name, dominant: cmt.dominant, text: cmt.text
    }).then(cloudFetchCommunity);
  }
  function cloudToggleLike(postId, uid) {
    var c = cloudCache.community;
    var p = c.posts.filter(function (x) { return x.id === postId; })[0];
    if (!p) return Promise.resolve();
    var i = p.likes.indexOf(uid);
    if (i > -1) p.likes.splice(i, 1); else p.likes.push(uid);
    return sb.from('posts').update({ likes: p.likes }).eq('id', postId);
  }

  function cloudSubscribe() {
    if (cloudCache.sub || !sb) return;
    var refetch = function (fn, evt) { return function () { fn().then(function () { bus.post({ type: evt }); }).catch(function (e) { trace('cloud:rt ERR ' + (e && e.message)); }); }; };
    cloudCache.sub = sb.channel('wxm-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool' },
          refetch(cloudFetchPool, 'pool-changed'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' },
          function () { cloudFetchMatches().then(function () { handleCloudMatchUpdates(); bus.post({ type: 'pool-changed' }); }).catch(function () {}); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
          function (payload) { if (payload.new) onCloudMessage(payload.new); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' },
          refetch(cloudFetchCommunity, 'community'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' },
          refetch(cloudFetchCommunity, 'community'))
      .subscribe();
  }

  // 在线撮合：调用服务端 try_match（与前端同一套五行生克算法，数据库事务内原子执行）
  function cloudScan() {
    if (!cloudOn()) return Promise.resolve(0);
    return sb.rpc('try_match').then(function () {
      return cloudFetchMatches();
    }).then(function () {
      handleCloudMatchUpdates();
      return cloudFetchPool();
    }).then(function () {
      // 聊天面板打开时轮询新消息（Realtime 之外的双保险）
      if (state.panel === 'chat' && state.matchId) {
        cloudFetchChat(state.matchId).then(function () { if (state.panel === 'chat') renderChat(); }).catch(function () {});
      }
      bus.post({ type: 'pool-changed' });
    }).catch(function (e) { trace('cloud:scan ERR ' + (e && e.message)); });
  }
  function cloudEndMatch(matchId) {
    return sb.rpc('end_match', { p_match_id: matchId }).then(function () {
      return Promise.all([cloudFetchMatches(), cloudFetchPool()]);
    });
  }

  /* ================================================================
   * 四·五、大模型接入（可选，OpenAI 兼容接口）
   * ================================================================ */

  var LLM_KEY = 'wuxing_llm_v1';

  function llmCfg() { return readJSON(localStorage, LLM_KEY, null); }
  function llmSave(cfg) { writeJSON(localStorage, LLM_KEY, cfg); }
  function llmEnabled() {
    var c = llmCfg();
    return !!(c && c.baseUrl && c.apiKey && c.model);
  }
  // 调用 OpenAI 兼容 /chat/completions
  function llmChat(messages, maxTokens) {
    var c = llmCfg();
    var url = (c.baseUrl || '').replace(/\/+$/, '') + '/chat/completions';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.apiKey },
      body: JSON.stringify({ model: c.model, messages: messages, temperature: 0.9, max_tokens: maxTokens || 150 })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      var txt = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      if (!txt) throw new Error('empty');
      return String(txt).trim();
    });
  }
  // 聊天人设 system prompt
  function personaSystem(match, me, partner) {
    var rel = match.relation.label.split(' ·')[0];
    var g = partner.gender === 'male' ? '男' : partner.gender === 'female' ? '女' : '性别保密';
    var mg = me.gender === 'male' ? '男' : me.gender === 'female' ? '女' : '性别保密';
    var pTags = (partner.tags || []).join('、') || '暂无';
    var mTags = (me.tags || []).join('、') || '暂无';
    var shared = (me.tags || []).filter(function (t) { return (partner.tags || []).indexOf(t) > -1; });
    return '你在一个名为「五行纳音 · 本命饮品」的社交应用里，扮演与对方匹配成功的有缘人，进行轻松自然的中文闲聊。'
      + '你的人设：' + partner.name + '，' + g + (partner.age ? partner.age + '岁' : '') + '，' + (partner.job || '') + '，当前状态：' + (partner.status || '在线') + '，标签：' + pTags + '，个性签名「' + (partner.tagline || '暂无') + '」，五行属' + elChar(partner.dominant) + '，纳音' + partner.nayin + '，本命饮品「' + partner.drink + '」，正在找' + (PREF_LABEL[partner.pref] || '朋友') + '。'
      + '对方：' + me.name + '，' + mg + (me.age ? me.age + '岁' : '') + '，标签：' + mTags + '，五行属' + elChar(me.dominant) + '，本命饮品「' + me.drink + '」，想找' + (PREF_LABEL[me.pref] || '朋友') + (me.tagline ? '，签名是「' + me.tagline + '」' : '') + '。'
      + (shared.length ? '你们的共同标签：' + shared.join('、') + '，聊天时可以自然地聊到。' : '')
      + '你们的关系：' + rel + '，合拍度' + match.score + '%。'
      + '聊天要求：像真人一样口语化、自然友好；每次只回1-2句话，总共不超过40字；可以适当用emoji；不要连续反问；结合自己的人设和标签聊具体的生活细节；绝不要暴露自己是AI或程序；不要出现敏感内容。';
  }
  // 把本地聊天记录转成 LLM 对话
  function chatToMessages(match, me, partner, msgs) {
    var recent = msgs.filter(function (m) { return m.from !== 'system'; }).slice(-8);
    var out = [];
    recent.forEach(function (m) {
      out.push({ role: m.from === partner.uid ? 'assistant' : 'user', content: m.text });
    });
    if (!out.length) out.push({ role: 'user', content: '（对方刚打开聊天，还没说话）' });
    return out;
  }

  /* ================================================================
   * 四·六、五行社区数据层
   * ================================================================ */

  var COMM = { key: 'wuxing_community_v1', ver: 'wuxing_community_ver_v1' };

  function updateCommunity(mutator) {
    if (cloudOn()) return false; // 在线模式由 cloudAddPost / cloudAddComment / cloudToggleLike 处理
    var c = getCommunity();
    var result = mutator(c);
    if (result === false) return false;
    saveCommunity(c);
    try { localStorage.setItem(COMM.ver, String(now())); } catch (e) {}
    bus.post({ type: 'community' });
    return true;
  }
  // 首次访问注入演示内容，让社区不冷场
  function seedCommunity() {
    if (localStorage.getItem(COMM.key)) return;
    var hoursAgo = function (h) { return now() - h * 3600 * 1000; };
    var demo = [
      { element: 'wood', uid: 'seed-w1', name: '青梧', gender: 'female', age: 24, drink: '青柚乌龙', nayin: '杨柳木', dominant: 'wood', tags: ['读书', 'i人', '咖啡续命'], job: '书店店员', status: '在图书馆', tagline: '不想上班，想上山', text: '木行人集合 🌿 找学习搭子：目标每天图书馆打卡 2 小时，坚持 21 天，来组队！', at: hoursAgo(3), likes: ['seed-w2', 'seed-e1'], comments: [
        { id: 'c1', uid: 'seed-w2', name: '竹西', dominant: 'wood', gender: 'male', age: 22, text: '+1，我在备考，一起互相监督！', at: hoursAgo(2) }
      ] },
      { element: 'fire', uid: 'seed-f1', name: '赤霞', gender: 'male', age: 27, drink: '赤霞血橙', nayin: '天上火', dominant: 'fire', tags: ['球类运动', '健身', 'e人'], job: '健身教练', status: '刚健完身', tagline: '人生是旷野，不是轨道', text: '火行兄弟看过来 🔥 周六城市越野跑，哪里野去哪里，评论区报名接龙', at: hoursAgo(6), likes: ['seed-w1', 'seed-m1', 'seed-e1', 'seed-w2', 'seed-a1'], comments: [] },
      { element: 'earth', uid: 'seed-e1', name: '厚土', gender: 'secret', age: 31, drink: '燕麦可可', nayin: '城头土', dominant: 'earth', tags: ['做饭', '早睡星人', '读书'], job: '建筑设计师', status: '周末瘫', tagline: '慢慢来，比较快', text: '土行人日常：不卷不躺，安稳踏实。分享一句最近很治愈的话——慢慢来，比较快。', at: hoursAgo(10), likes: ['seed-w1', 'seed-f1', 'seed-m1', 'seed-a1', 'seed-w2', 'seed-f2', 'seed-m2', 'seed-e2'], comments: [
        { id: 'c2', uid: 'seed-e2', name: '小满', dominant: 'earth', gender: 'female', age: 28, text: '戳中我了，最近正焦虑，谢谢 🙏', at: hoursAgo(8) }
      ] },
      { element: 'metal', uid: 'seed-m1', name: '白露', gender: 'female', age: 23, drink: '茉莉汤力', nayin: '钗钏金', dominant: 'metal', tags: ['摄影', '甜品控', '爵士乐'], job: '咖啡师', status: '上班摸鱼', tagline: '收集日落和好听的歌', text: '金行精致下午茶报告 ☕ 试遍全城的茉莉汤力，有一家最像「本命」，想知道的评论区见', at: hoursAgo(14), likes: ['seed-f1', 'seed-w1'], comments: [
        { id: 'c3', uid: 'seed-m2', name: '阿银', dominant: 'metal', gender: 'male', age: 25, text: '求地址！', at: hoursAgo(12) },
        { id: 'c4', uid: 'seed-m1', name: '白露', dominant: 'metal', gender: 'female', age: 23, text: '私信发你～记得带上你的本命饮品截图，有折扣', at: hoursAgo(11) }
      ] },
      { element: 'water', uid: 'seed-a1', name: '沉璧', gender: 'male', age: 29, drink: '海盐白桃', nayin: '大海水', dominant: 'water', tags: ['读书', '夜猫子', '追剧'], job: '后端程序员', status: '深夜emo', tagline: '和世界交手多年，依然光彩依旧', text: '水行人深夜电台 🌊 最近单曲循环一首古琴曲，越听越静，推荐给同频的你', at: hoursAgo(20), likes: ['seed-e1', 'seed-w1', 'seed-f2', 'seed-m2'], comments: [] },
      { element: 'wood', uid: 'seed-w2', name: '望舒', gender: 'female', age: 26, drink: '松针青梅', nayin: '松柏木', dominant: 'wood', tags: ['旅行', 'i人', '追剧'], job: '自由插画师', status: '旅行途中', tagline: '兴趣广泛，样样稀松', text: '有没有也是「松柏木」的？都说我们坚韧，但谁懂坚持背后的累啊 😂', at: hoursAgo(26), likes: ['seed-w1'], comments: [] }
    ];
    saveCommunity({ posts: demo });
    try { localStorage.setItem(COMM.ver, String(now())); } catch (e) {}
  }

  /* ================================================================
   * 五、五行生克匹配引擎
   * ================================================================ */

  // 性别期望硬性校验：任一方期望与对方性别不符则不撮合（保密=不设限）
  function genderCompatible(a, b) {
    function ok(seeker, target) {
      if (seeker === 'any' || target === 'secret') return true;
      return seeker === target;
    }
    return ok(a.seekGender || 'any', b.gender) && ok(b.seekGender || 'any', a.gender);
  }

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

    // 共同标签（兴趣 / 人格）：每个 +4，最多 +12
    var aTags = a.tags || [], bTags = b.tags || [];
    var shared = aTags.filter(function (t) { return bTags.indexOf(t) > -1; });
    if (shared.length) {
      score += Math.min(12, shared.length * 4);
      reasons.push('共同爱好：' + shared.slice(0, 3).join(' · ') + '，话题不愁');
    }

    // 性别期望契合
    var gdBonus = 0;
    [[a.seekGender, b.gender], [b.seekGender, a.gender]].forEach(function (pair) {
      if (pair[0] !== 'any' && pair[1] !== 'secret') gdBonus += pair[0] === pair[1] ? 6 : 0;
    });
    if (gdBonus > 0) { score += gdBonus; reasons.push('性别期待相符，第一眼就对味'); }

    // 年龄相近度
    if (a.age && b.age) {
      var gap = Math.abs(a.age - b.age);
      if (gap <= 3) { score += 4; reasons.push('年龄相仿（' + a.age + ' 岁 & ' + b.age + ' 岁），有共同话题'); }
      else if (gap <= 8) { score += 2; }
      else if (gap > 15) { score -= 4; reasons.push('年龄有些差距，恰好互补'); }
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
        if (!genderCompatible(waiting[i], waiting[j])) continue; // 性别期望不符，不予撮合
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
    if (cloudOn()) { cloudScan(); return; } // 在线模式：服务端 RPC 原子撮合
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
    + '.wxm-chip-row{display:flex;gap:8px}'
    + '.wxm-chip{flex:1;text-align:center;border:2px solid #2C2C2C;background:#fff;padding:9px 4px;font-size:13px;font-weight:700;color:#2C2C2C;cursor:pointer;transition:all .15s}'
    + '.wxm-chip:hover{background:#F0F5F3}'
    + '.wxm-chip.sel{background:#2C2C2C;color:#fff}'
    + '.wxm-age{flex:none;width:92px;display:flex;align-items:center;justify-content:center;gap:2px;border:2px solid #2C2C2C;background:#fff}'
    + '.wxm-age input{width:38px;border:none;outline:none;font-size:15px;font-weight:700;text-align:center;background:transparent;color:#2C2C2C;font-family:inherit}'
    + '.wxm-age span{font-size:11px;color:#A8A29E}'
    + '.wxm-gd{display:inline-block;font-size:10px;font-weight:700;border:1.5px solid #2C2C2C;padding:1px 6px;background:#fff;color:#2C2C2C;margin-left:4px}'
    + '.wxm-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}'
    + '.wxm-tags .t{font-size:9px;border:1px solid #D6D3CE;color:#6b6560;padding:1px 6px;background:#FAF9F6;letter-spacing:.02em}'
    + '.wxm-tags .t.hit{border-color:#5E8B7E;color:#5E8B7E;background:#F0F5F3}'
    + '.wxm-tags.sm .t{font-size:8px;padding:0 5px}'
    + '.wxm-tag-grid{display:flex;flex-wrap:wrap;gap:6px}'
    + '.wxm-tagchip{border:1.5px solid #2C2C2C;background:#fff;color:#2C2C2C;font-size:11px;font-weight:700;padding:6px 9px;cursor:pointer;font-family:inherit}'
    + '.wxm-tagchip:hover{background:#F0F5F3}'
    + '.wxm-tagchip.sel{background:#2C2C2C;color:#fff}'
    + '.wxm-ai{border-top:2px solid #2C2C2C;background:#F0F5F3;padding:8px 10px 10px}'
    + '.wxm-ai .hd{display:flex;justify-content:space-between;align-items:center;font-size:10px;letter-spacing:.1em;color:#5E8B7E;font-weight:700}'
    + '.wxm-ai .hd button{border:1.5px solid #5E8B7E;background:#fff;color:#5E8B7E;font-size:10px;font-weight:700;padding:3px 8px;cursor:pointer}'
    + '.wxm-ai .hd button:hover{background:#5E8B7E;color:#fff}'
    + '.wxm-ai-chips{display:flex;flex-direction:column;gap:6px;margin-top:8px}'
    + '.wxm-ai-chip{text-align:left;border:1.5px solid #2C2C2C;background:#fff;padding:7px 10px;font-size:12px;color:#2C2C2C;cursor:pointer;line-height:1.5;font-family:inherit}'
    + '.wxm-ai-chip:hover{background:#2C2C2C;color:#fff}'
    + '.wxm-ai-tag{font-size:10px;color:#5E8B7E;margin-bottom:2px}'
    + '#wxm-fab-comm{position:fixed;right:16px;bottom:72px;z-index:9997;display:none;align-items:center;gap:8px;border:2px solid #2C2C2C;background:#fff;color:#2C2C2C;padding:9px 15px;font-size:13px;font-weight:700;letter-spacing:.08em;cursor:pointer;box-shadow:4px 4px 0 rgba(44,44,44,.22);font-family:inherit}'
    + '#wxm-fab-comm:hover{background:#2C2C2C;color:#fff}'
    + '#wxm-fab-comm.show{display:flex}'
    + '.wxm-chan-row{display:flex;gap:6px;margin:14px 0 4px}'
    + '.wxm-chan{flex:1;border:2px solid #2C2C2C;background:#fff;padding:7px 0;text-align:center;font-size:15px;font-weight:700;color:#2C2C2C;cursor:pointer;font-family:"Noto Serif SC",serif}'
    + '.wxm-chan .c{display:block;font-size:9px;font-weight:400;color:#A8A29E;font-family:"Noto Sans SC",sans-serif;margin-top:1px}'
    + '.wxm-chan.sel{color:#fff}'
    + '.wxm-chan.sel .c{color:rgba(255,255,255,.7)}'
    + '.wxm-composer{background:#fff;border:2px solid #2C2C2C;padding:10px;margin-top:10px}'
    + '.wxm-composer textarea{width:100%;box-sizing:border-box;border:none;outline:none;resize:none;font-size:13px;color:#2C2C2C;font-family:inherit;min-height:52px;background:transparent}'
    + '.wxm-composer .row{display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:8px}'
    + '.wxm-composer .hint{font-size:10px;color:#A8A29E}'
    + '.wxm-composer .row .btns{display:flex;gap:6px}'
    + '.wxm-mini-btn{border:1.5px solid #2C2C2C;background:#fff;color:#2C2C2C;font-size:11px;font-weight:700;padding:6px 10px;cursor:pointer;font-family:inherit}'
    + '.wxm-mini-btn:hover{background:#2C2C2C;color:#fff}'
    + '.wxm-mini-btn.pri{background:#2C2C2C;color:#fff}'
    + '.wxm-mini-btn.pri:hover{background:#4a4a4a}'
    + '.wxm-post{background:#fff;border:2px solid #2C2C2C;padding:12px;margin-top:10px}'
    + '.wxm-post .head{display:flex;align-items:center;gap:8px}'
    + '.wxm-post .head .n{font-size:13px;font-weight:700;color:#2C2C2C}'
    + '.wxm-post .head .m{font-size:10px;color:#A8A29E;margin-top:1px}'
    + '.wxm-post .head .t{margin-left:auto;font-size:9px;color:#C6C1BA;flex:none}'
    + '.wxm-post .body{font-size:13px;color:#2C2C2C;line-height:1.7;margin-top:8px;word-break:break-word;white-space:pre-wrap}'
    + '.wxm-post .acts{display:flex;gap:14px;margin-top:10px;padding-top:8px;border-top:1.5px dashed #E5E1DA}'
    + '.wxm-post .acts button{border:none;background:none;font-size:11px;color:#A8A29E;cursor:pointer;font-family:inherit;padding:0;font-weight:700}'
    + '.wxm-post .acts button:hover{color:#2C2C2C}'
    + '.wxm-post .acts button.on{color:#C75B39}'
    + '.wxm-comments{margin-top:8px;background:#F7F5F0;border:1.5px solid #EFEDE8;padding:8px 10px}'
    + '.wxm-comments .cmt{font-size:11px;color:#2C2C2C;line-height:1.6;padding:3px 0}'
    + '.wxm-comments .cmt b{font-weight:700}'
    + '.wxm-comments .cmt .el{font-size:9px;border:1px solid #D6D3CE;color:#A8A29E;padding:0 4px;margin:0 4px}'
    + '.wxm-cmt-row{display:flex;gap:6px;margin-top:8px}'
    + '.wxm-cmt-row input{flex:1;border:1.5px solid #2C2C2C;padding:6px 8px;font-size:11px;outline:none;background:#fff;font-family:inherit;color:#2C2C2C}'
    + '.wxm-cmt-row button{border:1.5px solid #2C2C2C;background:#2C2C2C;color:#fff;font-size:11px;padding:6px 10px;cursor:pointer;flex:none;font-family:inherit}'
    + '.wxm-empty{text-align:center;font-size:11px;color:#A8A29E;padding:18px 0;line-height:1.8}'
    + '.wxm-llm-state{font-size:11px;color:#6b6560;margin-top:8px;line-height:1.7}'
    + '.wxm-llm-state b.on{color:#5E8B7E}'
    + '.wxm-llm-state b.off{color:#C75B39}'
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

  var state = { panel: null, matchId: null, pendingProfile: null, confettiTimer: null, usedLines: {}, aiOffset: 0, channel: null };

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

    var fabComm = document.createElement('button');
    fabComm.id = 'wxm-fab-comm';
    fabComm.innerHTML = '🏯 五行社区';
    fabComm.addEventListener('click', function () { openPanel('community'); });
    document.body.appendChild(fabComm);

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
    else if (state.panel === 'community') renderCommunityPanel(sheet);
    else if (state.panel === 'llm') renderLlmPanel(sheet);
    else if (state.panel === 'auth') renderAuthPanel(sheet);
    else sheet.innerHTML = '';
  }

  function orbHtml(member, size) {
    var c = elColor(member.dominant);
    return '<span class="' + (size ? 'wxm-mini-orb' : 'wxm-orb') + '" style="background:' + c + '">' + esc(elChar(member.dominant)) + '</span>';
  }

  // 标签迷你 chips（highlight：与我的共同标签）
  function tagsRow(m, opts) {
    var me = getMe() || {};
    var tags = (m && m.tags) || [];
    if (!tags.length) return '';
    var cls = 'wxm-tags' + (opts && opts.sm ? ' sm' : '');
    return '<div class="' + cls + '">' + tags.map(function (t) {
      var hit = (me.tags || []).indexOf(t) > -1;
      return '<span class="t' + (hit ? ' hit' : '') + '">#' + esc(t) + '</span>';
    }).join('') + '</div>';
  }

  // 性别·年龄展示文本
  function gdText(m) {
    if (!m) return '';
    var g = m.gender === 'male' ? '♂' : m.gender === 'female' ? '♀' : '🔒';
    return g + (m.age ? ' ' + m.age + '岁' : '');
  }

  /* ---------- 面板 1：填写匹配偏好 ---------- */

  var GENDERS = [
    { id: 'male', label: '男', emoji: '♂' },
    { id: 'female', label: '女', emoji: '♀' },
    { id: 'secret', label: '保密', emoji: '🔒' }
  ];
  var SEEK = [
    { id: 'any', label: '不限' },
    { id: 'male', label: '男生' },
    { id: 'female', label: '女生' }
  ];

  function renderPrefPanel(sheet) {
    var p = state.pendingProfile;
    var sel = p.pref || 'friend';
    var gd = p.gender || 'secret';
    var seek = p.seekGender || 'any';
    var myTags = (p.tags || []).slice();
    var toggleTag = function (t) {
      var i = myTags.indexOf(t);
      if (i > -1) myTags.splice(i, 1);
      else if (myTags.length < 4) myTags.push(t);
    };
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
      + '  <div class="wxm-field"><label>你的性别与年龄</label>'
      + '    <div class="wxm-chip-row" id="wxm-gd-row">'
      + GENDERS.map(function (g) {
        return '<button type="button" class="wxm-chip' + (g.id === gd ? ' sel' : '') + '" data-gd="' + g.id + '">' + g.emoji + ' ' + g.label + '</button>';
      }).join('')
      + '      <span class="wxm-age"><input id="wxm-age" type="number" min="14" max="99" placeholder="年龄" value="' + (p.age || '') + '" /><span>岁</span></span>'
      + '    </div>'
      + '  </div>'
      + '  <div class="wxm-field"><label>你的标签（选 2-4 个，共同标签会加分）<span id="wxm-tag-n" style="color:#2C2C2C">' + myTags.length + '/4</span></label>'
      + '    <div class="wxm-tag-grid" id="wxm-tag-grid">' + TAGS.map(function (t) {
        return '<button type="button" class="wxm-tagchip' + (myTags.indexOf(t) > -1 ? ' sel' : '') + '" data-tag="' + t + '">#' + t + '</button>';
      }).join('') + '    </div>'
      + '  </div>'
      + '  <div class="wxm-field"><label>你想找什么样的有缘人？</label>'
      + '    <div class="wxm-prefs">' + PREFS.map(function (pf) {
        return '<div class="wxm-pref' + (pf.id === sel ? ' sel' : '') + '" data-pref="' + pf.id + '">'
          + '<div class="e">' + pf.emoji + '</div><div class="t">' + pf.label + '</div><div class="d">' + pf.desc + '</div></div>';
      }).join('') + '    </div>'
      + '  </div>'
      + '  <div class="wxm-field"><label>希望对方是（性别期望，会参与匹配）</label>'
      + '    <div class="wxm-chip-row" id="wxm-seek-row">'
      + SEEK.map(function (g) {
        return '<button type="button" class="wxm-chip' + (g.id === seek ? ' sel' : '') + '" data-seek="' + g.id + '">' + g.label + '</button>';
      }).join('')
      + '    </div>'
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
    $$('#wxm-gd-row .wxm-chip', sheet).forEach(function (el) {
      el.addEventListener('click', function () {
        gd = el.getAttribute('data-gd');
        $$('#wxm-gd-row .wxm-chip', sheet).forEach(function (x) { x.classList.toggle('sel', x === el); });
      });
    });
    $$('#wxm-seek-row .wxm-chip', sheet).forEach(function (el) {
      el.addEventListener('click', function () {
        seek = el.getAttribute('data-seek');
        $$('#wxm-seek-row .wxm-chip', sheet).forEach(function (x) { x.classList.toggle('sel', x === el); });
      });
    });
    $$('#wxm-tag-grid .wxm-tagchip', sheet).forEach(function (el) {
      el.addEventListener('click', function () {
        toggleTag(el.getAttribute('data-tag'));
        el.classList.toggle('sel', myTags.indexOf(el.getAttribute('data-tag')) > -1);
        var n = $('#wxm-tag-n', sheet);
        if (n) n.textContent = myTags.length + '/4';
      });
    });
    $('#wxm-join', sheet).addEventListener('click', function () {
      p.pref = sel;
      p.gender = gd;
      p.seekGender = seek;
      p.tags = myTags.slice();
      var age = parseInt($('#wxm-age', sheet).value, 10);
      p.age = (age >= 14 && age <= 99) ? age : null;
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
      + '<div class="wxm-sub">系统每 ' + (SCAN_INTERVAL_MS / 1000) + ' 秒扫描一次，依据五行生克自动撮合 · '
      + (cloudOn() ? '<span style="color:#5E8B7E;font-weight:700">☁️ 在线模式</span>' : '本地模式 <button type="button" id="wxm-cloud-entry" style="border:1px solid #2C2C2C;background:#fff;font-size:10px;padding:1px 6px;cursor:pointer;font-family:inherit">☁️ 接入云端，匹配真实用户</button>') + '</div>'
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
          + '      <div style="font-size:15px;font-weight:700;color:#2C2C2C">🎉 有缘人已出现：' + esc(partner.name)
          + '        <span class="wxm-gd">' + esc(gdText(partner)) + '</span></div>'
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
          + '<div class="m">' + elChar(m.dominant) + '行 · ' + esc(m.nayin) + ' · 找' + PREF_LABEL[m.pref] + ' · ' + esc(gdText(m)) + '</div>'
          + tagsRow(m, { sm: true }) + '</div>'
          + '<span class="wxm-tag" style="font-size:9px">' + (m.state === 'matched' ? '已匹配' : '等待中') + '</span></div>';
      });
    }
    html += '</div>';

    html += '<div class="wxm-foot" style="flex-direction:column">';
    html += '<button class="wxm-btn ghost slim" id="wxm-llm-entry">' + (llmEnabled() ? '🤖 大模型已接入：' + esc(llmCfg().model) : '🤖 接入真实大模型（聊天更聪明）') + '</button>';
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
    $('#wxm-llm-entry', sheet).addEventListener('click', function () { openPanel('llm'); });
    var cloudEntry = $('#wxm-cloud-entry', sheet);
    if (cloudEntry) cloudEntry.addEventListener('click', function () { openPanel('auth'); });
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
      + '      <div style="font-size:10px;color:#A8A29E;margin-top:2px">' + elChar(me.dominant) + '行 · ' + esc(me.drink) + '<br/>' + esc(gdText(me)) + '</div>'
      + tagsRow(me, { sm: true })
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
      + '      <div style="font-size:10px;color:#A8A29E;margin-top:2px">' + elChar(partner.dominant) + '行 · ' + esc(partner.drink) + '<br/>' + esc(gdText(partner)) + '</div>'
      + tagsRow(partner, { sm: true })
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

  /* ---------- AI 话题助手 ---------- */

  // 依据五行关系、双方档案与聊天上下文生成话题建议（纯前端规则引擎，不依赖外部服务）
  function aiSuggest(match, me, partner, msgs, offset) {
    var bag = [];
    var rel = match.relation.label.split(' ·')[0];
    var type = match.relation.type;
    var mineCount = msgs.filter(function (m) { return m.from === me.uid; }).length;
    var last = null;
    for (var i = msgs.length - 1; i >= 0; i--) {
      var m = msgs[i];
      if (m.from !== me.uid && m.from !== 'system') { last = m; break; }
    }

    if (mineCount === 0) {
      // —— 破冰开场 ——
      bag.push(
        '你好呀！天机说我们' + rel + '，合拍 ' + match.score + '%，冒个泡认识一下 👋',
        'Hi～看到你的本命饮品是' + partner.drink + '，我的是' + me.drink + '，一看就很搭',
        (partner.tagline ? '签名写「' + partner.tagline + '」的人感觉很有意思！' : '你好呀，初次见面！') +
          (partner.pref === 'meal' ? '有什么私藏美食推荐吗？🍜' : partner.pref === 'study' ? '最近在忙什么？一起打卡呀 📚' : '平时都喜欢做些什么？'),
        type === 'sheng' ? '听说' + rel + '的人特别聊得来，来验证一下？😄' : '同为' + elChar(me.dominant) + '行人，感觉我们会是同类人',
        '我先开个头：用三个词形容自己，你会选哪三个？'
      );
    } else if (last) {
      // —— 接对方的话 ——
      var t = last.text || '';
      if (/？|\?|吗[。！～!?？]?$|呢[。！～]?/.test(t)) {
        bag.push('问到点了！我的答案是……不过我想先听听你的版本 😄', '哈哈让我想想～我觉得挺好的，你呢？');
      }
      if (/喝|茶|奶茶|咖啡|饮品|饮料|可乐/.test(t)) {
        bag.push('提到喝的我可就来劲了，下次约一杯？我知道' + me.drink + '很好喝的店 🧋', '看来我们对喝的品味很一致，改天一起探店呀');
      }
      if (/吃|饭|美食|好吃|店|饿/.test(t)) {
        bag.push('说到吃的我最有发言权，周末一起干饭？🍜', '我收藏了好几家店，就差一个饭搭子了（疯狂暗示）');
      }
      if (/学|忙|累|工作|加班|考试|作业/.test(t)) {
        bag.push('辛苦啦～累了就歇会儿，我陪你聊聊天 ☕', '忙归忙，也要记得按时喝水休息呀');
      }
      if (/哈哈|嘻嘻|笑|😂|🤣|乐死/.test(t)) {
        bag.push('哈哈哈哈跟你聊天太轻松了', '你还挺有意思的 😆 这波我接住了');
      }
      if (/再见|回聊|晚安|拜拜|先走/.test(t)) {
        bag.push('嗯嗯回见～五行有缘，后会有期 🌙', '拜拜，今天聊得很开心！');
      }
      if (bag.length === 0) {
        bag.push(
          '嗯嗯有同感！对了，你平时有什么爱好？',
          '这个话题有意思，你是怎么想到的？',
          '感觉和你聊天特别顺，难怪五行' + rel,
          '哈哈哈同意！那你周末一般怎么过？',
          '说起来，你觉得这个测试准不准？我觉得' + elChar(me.dominant) + '行还挺像我的'
        );
      }
      // 邀约收尾（按我的偏好）
      bag.push(
        me.pref === 'meal' ? '对了，周末有空吗？找家店一起干饭呀 🍜'
          : me.pref === 'study' ? '要不要约个自习，互相监督打卡？📚'
          : me.pref === 'friend' ? '聊得这么投缘，找个时间线下见一面？☕'
          : '有缘的话，找个时间一起喝杯' + me.drink + '？🌌'
      );
    }

    // 去重后按批次轮换，每次取 3 条
    var seen = {}, list = [];
    bag.forEach(function (x) {
      if (!seen[x]) { seen[x] = 1; list.push(x); }
    });
    var out = [];
    for (var k = 0; k < list.length && out.length < 3; k++) {
      out.push(list[(offset * 3 + k) % list.length]);
    }
    return out;
  }

  function renderAiChips() {
    var box = $('#wxm-ai-chips');
    var me = getMe(), match = getMyMatch();
    if (!box || !me || !match) return;
    var partner = partnerOf(match);
    if (!partner) return;
    var msgs = getChat(match.id);

    var render = function (tips, tag) {
      box.innerHTML = (tag ? '<div class="wxm-ai-tag">' + esc(tag) + '</div>' : '') + tips.map(function (t) {
        return '<button type="button" class="wxm-ai-chip">' + esc(t) + '</button>';
      }).join('');
      $$('.wxm-ai-chip', box).forEach(function (el) {
        el.addEventListener('click', function () {
          var input = $('#wxm-chat-input');
          if (!input) return;
          input.value = el.textContent;
          input.focus();
        });
      });
    };

    if (llmEnabled()) {
      box.innerHTML = '<div class="wxm-ai-tag">✦ 大模型正在为你斟酌话题…</div>';
      var convo = msgs.filter(function (m) { return m.from !== 'system'; }).slice(-8)
        .map(function (m) { return (m.from === me.uid ? '我：' : '对方：') + m.text; }).join('\n') || '（还没有对话）';
      llmChat([
        { role: 'system', content: personaSystem(match, me, partner) + '\n现在请你切换角色：不替对方回复，而是作为「话题助手」帮 ' + me.name + ' 想出3条发给对方的回复建议。要求：每条不超过30字，口语化，可带emoji，风格自然不尴尬。只输出一个JSON数组，格式如 ["建议一","建议二","建议三"]，不要输出其他内容。' },
        { role: 'user', content: '最近的聊天记录：\n' + convo + '\n请给出3条回复建议。' }
      ], 220).then(function (txt) {
        var marr = txt.match(/\[[\s\S]*?\]/);
        var arr = marr ? JSON.parse(marr[0]) : null;
        var tips = Array.isArray(arr) ? arr.filter(function (x) { return typeof x === 'string' && x.length; }).slice(0, 3) : null;
        if (tips && tips.length) render(tips, '✦ 由 ' + llmCfg().model + ' 生成');
        else render(aiSuggest(match, me, partner, msgs, state.aiOffset || 0));
      }).catch(function () {
        render(aiSuggest(match, me, partner, msgs, state.aiOffset || 0));
      });
    } else {
      render(aiSuggest(match, me, partner, msgs, state.aiOffset || 0));
    }
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
      + '      <div class="s">' + esc(match.relation.label.split(' ·')[0]) + ' · 合拍 ' + match.score + '% ｜ ' + esc(gdText(partner || {})) + ' ｜ ' + esc(partner ? partner.nayin : '') + '</div>'
      + '    </div>'
      + (ended ? '' : '<button class="wxm-send" id="wxm-chat-end" style="background:transparent;border-color:#fff;font-size:11px;padding:7px 10px">结束聊天</button>')
      + '  </div>'
      + (partner && (partner.tags || []).length ? '<div style="padding:6px 10px;border-bottom:1.5px solid #EFEDE8;background:#fff">' + tagsRow(partner, { sm: true }) + '</div>' : '')
      + '  <div class="wxm-chat-body" id="wxm-chat-body"></div>'
      + (ended
        ? '<div class="wxm-ended">🌿 ' + (iEnded ? '你已结束这段聊天' : '对方已结束这段聊天') + '<br/><span style="font-size:10px;color:#A8A29E">五行流转，缘分不散 · 有缘再会</span></div>'
        : '<div class="wxm-ai" id="wxm-ai-bar">'
        + '  <div class="hd"><span>✨ AI 话题助手 · 依五行与上下文点拨</span><button id="wxm-ai-more">换一批</button></div>'
        + '  <div class="wxm-ai-chips" id="wxm-ai-chips"></div>'
        + '</div>'
        + '<div class="wxm-endbar"><span class="hint">点击建议可填入输入框 · 随时可结束</span></div>'
        + '<div class="wxm-chat-foot">'
        + '  <input id="wxm-chat-input" maxlength="120" placeholder="说点什么…" />'
        + '  <button class="wxm-send" id="wxm-chat-send">发送</button>'
        + '</div>')
      + '</div>';

    var body = $('#wxm-chat-body', sheet);
    renderChatMessages(body, msgs, me, match, partner, ended);
    // 在线模式：历史消息按需加载（加载后重渲染一次）
    if (cloudOn() && !cloudCache.chats[match.id] && !cloudCache.chatLoaded[match.id]) {
      cloudCache.chatLoaded[match.id] = true;
      cloudFetchChat(match.id).then(function () {
        if (state.panel === 'chat' && state.matchId === match.id) {
          renderChatMessages($('#wxm-chat-body', sheet) || body, getChat(match.id), me, match, partner, !!getMyMatch()?.endedAt);
        }
      }).catch(function () {});
    }

    $('#wxm-chat-back', sheet).addEventListener('click', function () { openPanel('pool'); });

    if (!ended) {
      // AI 话题助手
      state.aiOffset = 0;
      renderAiChips();
      $('#wxm-ai-more', sheet).addEventListener('click', function () {
        state.aiOffset = (state.aiOffset || 0) + 1;
        renderAiChips();
      });
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

  // 本地模拟回复（未接入大模型或调用失败时兜底）
  // 上下文感知：结合人设、共同标签、对方最后一条消息的关键词；同一会话内不重复
  function localBotReply(match, partner, msgs) {
    var me = getMe() || {};
    var relTxt = match.relation.label.split(' ·')[0];
    var shared = (me.tags || []).filter(function (t) { return (partner.tags || []).indexOf(t) > -1; });
    var sharedTag = shared.length ? pick(shared) : pick(partner.tags || TAGS);
    var fill = function (s) {
      return s.replace('{name}', partner.drink)
        .replace('{rel}', relTxt)
        .replace('{nayin}', partner.nayin)
        .replace('{pref}', PREF_LABEL[partner.pref] || '缘分')
        .replace('{status}', partner.status || '闲着')
        .replace('{tag}', sharedTag || '听歌')
        .replace('{shared}', sharedTag || partner.tags[0] || '拍照')
        .replace('{job}', partner.job || '上班')
        .replace('{tagline}', partner.tagline || '随遇而安');
    };
    var used = state.usedLines[match.id] || (state.usedLines[match.id] = {});
    var bag = BOT_LINES.chat.map(fill);
    var last = null, i;
    for (i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].from !== partner.uid && msgs[i].from !== 'system') { last = msgs[i].text || ''; break; }
    }
    if (last) {
      var t = last;
      if (/？|\?|吗[。！～!?？]?$|呢[。！～]?/.test(t)) {
        bag.push('嗯…让我想想，应该是' + pick(['爬山和看展', '宅家和撸猫', '探店和拍照', '打游戏和打球']) + '，你呢？',
          '我选前者哈哈，你为什么会这么问～');
      }
      if (/吃|饭|美食|好吃|饿/.test(t)) bag.push('一聊到吃的我就精神了，我最近馋火锅馋得不行 🍲');
      if (/喝|茶|奶茶|咖啡/.test(t)) bag.push('作为' + (partner.job || '打工人') + '，全靠咖啡续命 ☕ 下次一起喝一杯呀');
      if (/累|忙|加班|学|工作/.test(t)) bag.push('抱抱，我{status}的时候也想找人说话'.replace('{status}', partner.status || '忙完'), '辛苦啦，注意休息，别硬撑 💪');
      if (/哈哈|嘻嘻|😂|🤣/.test(t)) bag.push('哈哈哈哈你真的好好笑', '笑死，跟你聊天太轻松了');
      if (/再见|拜拜|晚安|回聊/.test(t)) bag.push('回见回见，有缘再聊 🌙', '拜拜～今天聊得挺开心的');
      if (/爱好|喜欢做|平时做|周末/.test(t)) bag.push('我周末一般' + (partner.status || '瞎逛') + '，偶尔' + sharedTag + '，你呢？');
    }
    // 过滤已用过的句子，全用过则重置
    var fresh = bag.filter(function (x) { return !used[x]; });
    if (!fresh.length) { state.usedLines[match.id] = used = {}; fresh = bag; }
    var line = pick(fresh);
    used[line] = 1;
    return line;
  }

  function trace(msg) {
    try { (window.__wxmTrace = window.__wxmTrace || []).push(msg); } catch (e) {}
  }

  function scheduleBotReply(match, partner) {
    trace('sbr:called partner.bot=' + !!(partner && partner.bot));
    if (!partner || !partner.bot) return;
    var me = getMe();
    var replyDelay = randInt(700, 1500);
    setTimeout(function () {
      var live = getMatches().filter(function (m) { return m.id === match.id; })[0];
      if (!live || live.endedAt) { trace('sbr:bail live=' + !!live + ' ended=' + (live && !!live.endedAt)); return; }
      trace('sbr:proceed match=' + match.id);
      var body = $('#wxm-chat-body');
      var typing = document.createElement('div');
      typing.className = 'wxm-typing';
      typing.innerHTML = '<i></i><i></i><i></i>';
      if (body && state.panel === 'chat' && state.matchId === match.id) { body.appendChild(typing); body.scrollTop = body.scrollHeight; }
      var done = false;
      var finish = function (text) {
        if (done) return;
        done = true;
        if (typing.isConnected) typing.remove();
        var live2 = getMatches().filter(function (m) { return m.id === match.id; })[0];
        if (!live2 || live2.endedAt) return;
        appendChat(match.id, { from: partner.uid, name: partner.name, text: text, at: now() });
      };
      if (llmEnabled()) {
        // 真实大模型：以有缘人人设续写对话
        var messages = [{ role: 'system', content: personaSystem(live, me, partner) }]
          .concat(chatToMessages(live, me, partner, getChat(match.id)));
        llmChat(messages, 80).then(finish).catch(function () {
          finish(localBotReply(live, partner, getChat(match.id)));
        });
        // 15 秒超时兜底
        setTimeout(function () { finish(localBotReply(live, partner, getChat(match.id))); }, 15000);
      } else {
        // 本地模拟：先"打字"，打字时长与回复长度相关，更像真人
        try {
          var text = localBotReply(live, partner, getChat(match.id));
          trace('sbr:text=' + text);
          var typingMs = Math.min(2600, 700 + text.length * 55 + randInt(0, 500));
          setTimeout(function () { finish(text); }, typingMs);
        } catch (e) {
          trace('sbr:ERR ' + (e && e.message));
          finish(localBotLine(live, partner));
        }
      }
    }, replyDelay);
  }

  /* ---------- 面板 5：五行社区 ---------- */

  function fmtPostTime(ts) {
    var d = now() - ts;
    if (d < 60 * 1000) return '刚刚';
    if (d < 3600 * 1000) return Math.floor(d / 60000) + ' 分钟前';
    if (d < 24 * 3600 * 1000) return Math.floor(d / 3600000) + ' 小时前';
    return Math.floor(d / 86400000) + ' 天前';
  }

  function renderCommunityPanel(sheet) {
    var me = getMe();
    var channel = state.channel || (me && me.dominant) || 'wood';
    state.channel = channel;
    var c = getCommunity();
    var posts = c.posts.filter(function (p) { return p.element === channel; })
      .slice().sort(function (a, b) { return b.at - a.at; });

    var tabsHtml = ELS.map(function (el) {
      var n = c.posts.filter(function (p) { return p.element === el; }).length;
      return '<button type="button" class="wxm-chan' + (el === channel ? ' sel' : '') + '" data-el="' + el + '" style="' + (el === channel ? 'background:' + elColor(el) + ';border-color:' + elColor(el) : '') + '">'
        + elChar(el) + '<span class="c">' + n + ' 帖</span></button>';
    }).join('');

    var composer = '';
    if (me) {
      composer = '<div class="wxm-composer">'
        + '<textarea id="wxm-post-text" maxlength="200" placeholder="在「' + elChar(channel) + '行社区」说点什么… 发布后同频的人都能看到"></textarea>'
        + '<div class="row"><span class="hint">以 ' + esc(me.name) + '（' + elChar(me.dominant) + '行）的身份发帖</span>'
        + '<span class="btns">'
        + '<button type="button" class="wxm-mini-btn" id="wxm-post-ai">✨AI 代写</button>'
        + '<button type="button" class="wxm-mini-btn pri" id="wxm-post-send">发帖</button>'
        + '</span></div></div>';
    } else {
      composer = '<div class="wxm-empty">完成五行测试后即可发帖互动<br/>当前可自由浏览各社区</div>';
    }

    var feed = posts.map(function (p) {
      var liked = me && p.likes.indexOf(me.uid) > -1;
      var cmts = (p.comments || []).map(function (cm) {
        return '<div class="cmt"><b>' + esc(cm.name) + '</b><span class="el">' + elChar(cm.dominant) + '</span>' + esc(cm.text) + '</div>';
      }).join('');
      return '<div class="wxm-post" data-id="' + p.id + '">'
        + '<div class="head">' + orbHtml(p, 1)
        + '<div style="min-width:0;flex:1"><div class="n">' + esc(p.name) + ' <span class="wxm-gd">' + esc(gdText(p)) + '</span></div>'
        + '<div class="m">' + elChar(p.dominant) + '行 · ' + esc(p.drink) + '</div>'
        + tagsRow(p, { sm: true }) + '</div>'
        + '<span class="t">' + fmtPostTime(p.at) + '</span></div>'
        + '<div class="body">' + esc(p.text) + '</div>'
        + '<div class="acts">'
        + '<button type="button" class="wxm-like' + (liked ? ' on' : '') + '" data-act="like">' + (liked ? '❤️' : '🤍') + ' ' + p.likes.length + '</button>'
        + '<button type="button" data-act="cmt-toggle">💬 ' + (p.comments || []).length + '</button>'
        + '</div>'
        + ((p.comments || []).length ? '<div class="wxm-comments">' + cmts + '</div>' : '')
        + (me ? '<div class="wxm-cmt-row" style="display:none"><input maxlength="80" placeholder="友善评论…" /><button type="button" data-act="cmt-send">评论</button></div>' : '')
        + '</div>';
    }).join('');

    sheet.innerHTML = ''
      + '<button class="wxm-x" data-close="1">✕</button>'
      + '<div class="wxm-pad">'
      + '<div class="wxm-title">五行社区</div>'
      + '<div class="wxm-sub">按本命五行分社区 · 同频的人都在这里发帖互动</div>'
      + '<div class="wxm-chan-row">' + tabsHtml + '</div>'
      + composer
      + '<div id="wxm-feed">' + (feed || '<div class="wxm-empty">这个社区还没有帖子<br/>来抢占第一层楼吧 ✦</div>') + '</div>'
      + '<div class="wxm-wait-quote">—— 同气相求 · 同声相应 ——</div>'
      + '</div>';

    $$('.wxm-chan', sheet).forEach(function (el) {
      el.addEventListener('click', function () {
        state.channel = el.getAttribute('data-el');
        renderPanel();
      });
    });

    if (me) {
      $('#wxm-post-send', sheet).addEventListener('click', function () {
        var ta = $('#wxm-post-text', sheet);
        var text = (ta.value || '').trim();
        if (!text) { toast('先写点什么吧 ✍️'); return; }
        var post = {
          id: 'p' + now().toString(36) + Math.random().toString(36).slice(2, 6),
          element: channel,
          uid: me.uid, name: me.name, gender: me.gender, age: me.age,
          drink: me.drink, nayin: me.nayin, dominant: me.dominant, tags: me.tags || [],
          text: text.slice(0, 200), at: now(), likes: [], comments: []
        };
        if (cloudOn()) {
          cloudAddPost(post).then(function () { toast('✦ 已发布到云端社区'); renderPanel(); })
            .catch(function (e) { toast('发布失败：' + (e && e.message || '网络错误')); });
        } else {
          updateCommunity(function (c) { c.posts.push(post); });
          toast('✦ 已发布到 ' + elChar(channel) + '行社区');
          renderPanel();
        }
      });
      $('#wxm-post-ai', sheet).addEventListener('click', function () {
        var ta = $('#wxm-post-text', sheet);
        ta.value = '✦ AI 正在构思…';
        ta.setAttribute('readonly', 'readonly');
        var topic = elChar(channel) + '行';
        var fallback = function () {
          ta.removeAttribute('readonly');
          ta.value = pick([
            '【' + topic + '搭子招募】本人五行属' + elChar(channel) + '，本命饮品' + me.drink + '，想找' + PREF_LABEL[me.pref] + '。不设套路，先聊为敬，评论区集合！',
            '同为' + topic + '的朋友举手 🙋 我是想找' + PREF_LABEL[me.pref] + '的' + me.name + '，最近在琢磨周末去哪玩，评论区出出主意？',
            '发布一条寻人启事：寻找' + topic + '同频灵魂。我的优势：本命饮品口味在线，聊天不冷场。有意者评论区扣 1'
          ]);
        };
        if (llmEnabled()) {
          var me2 = me;
          llmChat([
            { role: 'system', content: '你是「五行纳音」社交应用的话题助手。请帮用户写一条社区帖子：用户' + me2.name + '，五行属' + elChar(me2.dominant) + '，纳音' + me2.nayin + '，本命饮品「' + me2.drink + '」，想找' + (PREF_LABEL[me2.pref] || '朋友') + (me2.tagline ? '，签名「' + me2.tagline + '」' : '') + '。帖子要求：40-80字，活泼真诚，可以带emoji，结尾引导互动。只输出帖子正文。' },
            { role: 'user', content: '请帮我在' + elChar(channel) + '行社区写一条帖子。' }
          ], 160).then(function (txt) {
            ta.removeAttribute('readonly');
            ta.value = txt;
          }).catch(fallback);
          setTimeout(function () { if (ta.getAttribute('readonly')) fallback(); }, 12000);
        } else {
          setTimeout(fallback, 400);
        }
      });
      // 点赞 / 评论
      $$('#wxm-feed .wxm-post', sheet).forEach(function (postEl) {
        var pid = postEl.getAttribute('data-id');
        var likeBtn = postEl.querySelector('[data-act="like"]');
        if (likeBtn) likeBtn.addEventListener('click', function () {
          if (cloudOn()) {
            cloudToggleLike(pid, me.uid).then(renderPanel);
            return;
          }
          updateCommunity(function (c) {
            var p = c.posts.filter(function (x) { return x.id === pid; })[0];
            if (!p) return false;
            var i = p.likes.indexOf(me.uid);
            if (i > -1) p.likes.splice(i, 1); else p.likes.push(me.uid);
          });
          renderPanel();
        });
        var toggleBtn = postEl.querySelector('[data-act="cmt-toggle"]');
        var row = postEl.querySelector('.wxm-cmt-row');
        if (toggleBtn && row) toggleBtn.addEventListener('click', function () {
          row.style.display = row.style.display === 'none' ? 'flex' : 'none';
          if (row.style.display === 'flex') row.querySelector('input').focus();
        });
        var sendBtn = postEl.querySelector('[data-act="cmt-send"]');
        if (sendBtn) sendBtn.addEventListener('click', function () {
          var input = row.querySelector('input');
          var text = (input.value || '').trim();
          if (!text) return;
          var cmt = { id: 'c' + now().toString(36) + Math.random().toString(36).slice(2, 5), uid: me.uid, name: me.name, dominant: me.dominant, gender: me.gender, age: me.age, text: text.slice(0, 80), at: now() };
          if (cloudOn()) {
            cloudAddComment(pid, cmt).then(function () { toast('✦ 评论已发布'); renderPanel(); })
              .catch(function (e) { toast('评论失败：' + (e && e.message || '网络错误')); });
          } else {
            updateCommunity(function (c) {
              var p = c.posts.filter(function (x) { return x.id === pid; })[0];
              if (!p) return false;
              if (!p.comments) p.comments = [];
              p.comments.push(cmt);
            });
            toast('✦ 评论已发布');
            renderPanel();
          }
        });
      });
    }
  }

  /* ---------- 面板 7：登录 / 云端配置 ---------- */

  function renderAuthPanel(sheet) {
    var cfg = cloudCfg() || { url: '', anonKey: '' };
    var user = cloudCache.user;

    if (!cloudConfigured()) {
      // 未配置：填 Supabase 项目地址与 anon key
      sheet.innerHTML = ''
        + '<button class="wxm-x" data-close="1">✕</button>'
        + '<div class="wxm-pad">'
        + '<div class="wxm-title">☁️ 接入云端</div>'
        + '<div class="wxm-sub">接入 Supabase 后：真实用户注册登录、数据存云端数据库、跨设备互相匹配</div>'
        + '<div class="wxm-field"><label>Project URL</label>'
        + '  <input class="wxm-input" id="wxm-cloud-url" placeholder="https://xxxx.supabase.co" value="' + esc(cfg.url || '') + '" /></div>'
        + '<div class="wxm-field"><label>anon public key</label>'
        + '  <input class="wxm-input" id="wxm-cloud-key" placeholder="eyJhbGciOi…" value="' + esc(cfg.anonKey || '') + '" /></div>'
        + '<div class="wxm-foot"><button class="wxm-btn ghost" data-close="1">暂不</button>'
        + '<button class="wxm-btn" id="wxm-cloud-save">保存并连接</button></div>'
        + '<div class="wxm-llm-state" id="wxm-cloud-status"></div>'
        + '<div class="wxm-llm-state" style="color:#A8A29E">没有项目？supabase.com 免费创建（约 3 分钟），'
        + '在 SQL Editor 运行仓库里的 matching/supabase-setup.sql，'
        + '再到 Authentication 设置关闭「Confirm email」即可。详细步骤见仓库 SETUP-CLOUD.md。'
        + '不接入也完全可以玩——本地模式支持双标签页模拟双人。</div>'
        + '</div>';
      $('#wxm-cloud-save', sheet).addEventListener('click', function () {
        var url = ($('#wxm-cloud-url', sheet).value || '').trim();
        var key = ($('#wxm-cloud-key', sheet).value || '').trim();
        if (!url || !key) { toast('两项都要填写'); return; }
        cloudSaveCfg({ url: url, anonKey: key });
        statusMsg(sheet, '连接中…', true);
        cloudInit().then(function (ok) {
          if (ok) { statusMsg(sheet, '✓ 连接成功！在下方登录或注册账号', true); renderPanel(); }
          else statusMsg(sheet, '✗ 连接失败：请检查 URL / Key，以及是否已运行 supabase-setup.sql', false);
        });
      });
      return;
    }

    if (user) {
      // 已登录
      sheet.innerHTML = ''
        + '<button class="wxm-x" data-close="1">✕</button>'
        + '<div class="wxm-pad" style="text-align:center">'
        + '<div style="font-size:34px;margin-top:8px">☁️</div>'
        + '<div class="wxm-title" style="margin-top:6px">在线模式</div>'
        + '<div class="wxm-sub">当前账号：' + esc(user.email) + '</div>'
        + '<div class="wxm-card" style="margin-top:16px;text-align:left;font-size:12px;color:#2C2C2C;line-height:2">'
        + '✓ 注册 / 登录真实账号<br/>✓ 测试结果保存到云端数据库，换设备登录即可恢复<br/>✓ 与全球真实用户互相匹配、聊天、逛社区</div>'
        + '<div class="wxm-foot"><button class="wxm-btn ghost" id="wxm-logout">退出登录</button>'
        + '<button class="wxm-btn" data-close="1">完成</button></div>'
        + '</div>';
      $('#wxm-logout', sheet).addEventListener('click', function () {
        if (sb) sb.auth.signOut();
      });
      return;
    }

    // 已配置未登录：登录 / 注册表单
    sheet.innerHTML = ''
      + '<button class="wxm-x" data-close="1">✕</button>'
      + '<div class="wxm-pad">'
      + '<div class="wxm-title">登录 · 在线模式</div>'
      + '<div class="wxm-sub">注册 / 登录后，你的五行档案与匹配都保存在云端数据库</div>'
      + '<div class="wxm-field"><label>邮箱</label>'
      + '  <input class="wxm-input" id="wxm-auth-email" type="email" placeholder="you@example.com" /></div>'
      + '<div class="wxm-field"><label>密码（至少 6 位）</label>'
      + '  <input class="wxm-input" id="wxm-auth-pass" type="password" placeholder="••••••" /></div>'
      + '<div class="wxm-foot">'
      + '  <button class="wxm-btn ghost" id="wxm-signup">注册</button>'
      + '  <button class="wxm-btn" id="wxm-signin">登录</button>'
      + '</div>'
      + '<div class="wxm-llm-state" id="wxm-auth-status"></div>'
      + '<div class="wxm-foot"><button class="wxm-btn ghost slim" id="wxm-cloud-reset">断开云端连接（回到本地模式）</button></div>'
      + '</div>';
    var authStatus = function (msg, ok) {
      $('#wxm-auth-status', sheet).innerHTML = ok ? '<b class="on">✓ ' + esc(msg) + '</b>' : '<b class="off">✗ ' + esc(msg) + '</b>';
    };
    var readAuth = function () {
      return { email: ($('#wxm-auth-email', sheet).value || '').trim(), pass: $('#wxm-auth-pass', sheet).value || '' };
    };
    $('#wxm-signin', sheet).addEventListener('click', function () {
      var a = readAuth();
      if (!a.email || a.pass.length < 6) { authStatus('请填写邮箱和至少 6 位密码', false); return; }
      authStatus('登录中…', true);
      sb.auth.signInWithPassword({ email: a.email, password: a.pass })
        .then(function (res) {
          if (res.error) throw res.error;
        })
        .catch(function (e) { authStatus(e.message || '登录失败', false); });
    });
    $('#wxm-signup', sheet).addEventListener('click', function () {
      var a = readAuth();
      if (!a.email || a.pass.length < 6) { authStatus('请填写邮箱和至少 6 位密码', false); return; }
      authStatus('注册中…', true);
      sb.auth.signUp({ email: a.email, password: a.pass })
        .then(function (res) {
          if (res.error) throw res.error;
          if (!res.data.session) throw new Error('注册成功，但该项目要求邮箱验证：请到 Supabase 控制台 Authentication 关闭 Confirm email 后重试');
        })
        .catch(function (e) { authStatus(e.message || '注册失败', false); });
    });
    $('#wxm-cloud-reset', sheet).addEventListener('click', function () {
      cloudSaveCfg(null);
      if (cloudCache.sub && sb) { try { sb.removeChannel(cloudCache.sub); } catch (e) {} }
      cloudCache.sub = null; cloudCache.user = null;
      toast('已断开云端 · 本地模式');
      renderPanel();
    });
  }

  function statusMsg(sheet, msg, ok) {
    var el = $('#wxm-cloud-status', sheet);
    if (el) el.innerHTML = ok ? '<b class="on">✓ ' + esc(msg) + '</b>' : '<b class="off">✗ ' + esc(msg) + '</b>';
  }

  /* ---------- 面板 6：大模型接入设置 ---------- */

  function renderLlmPanel(sheet) {
    var cfg = llmCfg() || { baseUrl: '', apiKey: '', model: '' };
    sheet.innerHTML = ''
      + '<button class="wxm-x" data-close="1">✕</button>'
      + '<div class="wxm-pad">'
      + '<div class="wxm-title">接入真实大模型</div>'
      + '<div class="wxm-sub">聊天回复与 AI 话题助手将由大模型生成</div>'
      + '<div class="wxm-llm-state" style="margin-top:12px">当前状态：<b class="' + (llmEnabled() ? 'on">已接入 ✓（' + esc(cfg.model) + '）' : 'off">未接入 · 使用本地模拟回复') + '</b></div>'
      + '<div class="wxm-field"><label>接口地址（OpenAI 兼容，含 /v1）</label>'
      + '  <input class="wxm-input" id="wxm-llm-url" placeholder="如 https://api.deepseek.com/v1 或 https://api.openai.com/v1" value="' + esc(cfg.baseUrl || '') + '" /></div>'
      + '<div class="wxm-field"><label>API Key（仅保存在你自己的浏览器）</label>'
      + '  <input class="wxm-input" id="wxm-llm-key" type="password" placeholder="sk-…" value="' + esc(cfg.apiKey || '') + '" /></div>'
      + '<div class="wxm-field"><label>模型名称</label>'
      + '  <input class="wxm-input" id="wxm-llm-model" placeholder="如 deepseek-chat / gpt-4o-mini / glm-4-flash" value="' + esc(cfg.model || '') + '" /></div>'
      + '<div class="wxm-foot">'
      + '  <button class="wxm-btn ghost" id="wxm-llm-test">测试连接</button>'
      + '  <button class="wxm-btn" id="wxm-llm-save">保存</button>'
      + '</div>'
      + '<div class="wxm-llm-state" id="wxm-llm-status"></div>'
      + '<div class="wxm-llm-state" style="color:#A8A29E">兼容所有 OpenAI 格式接口（OpenAI / DeepSeek / Kimi / 智谱 GLM / 通义 / 本地 Ollama 等）。Key 只存本机浏览器，请求由浏览器直连你填的服务商。未接入时，机器人使用本地模拟回复。</div>'
      + '</div>';

    var readForm = function () {
      return {
        baseUrl: ($('#wxm-llm-url', sheet).value || '').trim(),
        apiKey: ($('#wxm-llm-key', sheet).value || '').trim(),
        model: ($('#wxm-llm-model', sheet).value || '').trim()
      };
    };
    var status = function (msg, ok) {
      $('#wxm-llm-status', sheet).innerHTML = ok ? '<b class="on">✓ ' + esc(msg) + '</b>' : '<b class="off">✗ ' + esc(msg) + '</b>';
    };
    $('#wxm-llm-save', sheet).addEventListener('click', function () {
      var c = readForm();
      if (!c.baseUrl || !c.apiKey || !c.model) { status('三项都要填写（或清空后保存即视为不接入）', false); return; }
      llmSave(c);
      status('已保存 ✓ 聊天将使用真实大模型', true);
      toast('✦ 大模型已接入');
    });
    $('#wxm-llm-test', sheet).addEventListener('click', function () {
      var c = readForm();
      if (!c.baseUrl || !c.apiKey || !c.model) { status('请先填写完整', false); return; }
      status('连接中…', true);
      fetch(c.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.apiKey },
        body: JSON.stringify({ model: c.model, messages: [{ role: 'user', content: '回复"连接成功"四个字' }], max_tokens: 10 })
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (d) {
        var txt = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        status('连接成功 ✓ 模型回复：' + String(txt || '').trim().slice(0, 30), true);
      }).catch(function (e) {
        status('连接失败：' + (e && e.message ? e.message : '网络错误') + '（请检查地址/Key/模型名，或接口是否允许浏览器跨域）', false);
      });
    });
  }

  /* ================================================================
   * 八、入池 / 离池 / 结束聊天 / 模拟有缘人
   * ================================================================ */

  function joinPool(profile) {
    profile.state = 'waiting';
    profile.matchId = null;
    profile.joinedAt = now();
    setMe(profile);
    if (cloudOn()) {
      // 在线模式：档案与池写入数据库，全球真实用户互相匹配
      cloudUpsertProfile(profile).then(function () { return cloudJoinPool(profile); })
        .then(function () { bus.post({ type: 'pool-changed' }); closePanel(); toast('✦ 已进入匹配池 · 在线匹配中'); })
        .catch(function (e) { toast('入池失败：' + (e && e.message || '网络错误')); });
    } else {
      updatePool(function (pool) {
        var i = pool.findIndex(function (m) { return m.uid === profile.uid; });
        if (i > -1) pool[i] = profile; else pool.push(profile);
        return true;
      });
      bus.post({ type: 'pool-changed' });
      closePanel();
      toast('✦ 已进入匹配池，天机推演中…');
    }
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
    if (cloudOn()) {
      cloudLeavePool().then(function () { bus.post({ type: 'pool-changed' }); });
    } else {
      updatePool(function (pool) {
        var i = pool.findIndex(function (m) { return m.uid === me.uid; });
        if (i > -1) pool.splice(i, 1);
        return true;
      });
    }
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
    if (cloudOn()) {
      // 在线模式：数据库 RPC 同步结束双方状态
      cloudEndMatch(matchId).then(function () { bus.post({ type: 'pool-changed' }); })
        .catch(function (e) { toast('操作失败：' + (e && e.message || '网络错误')); });
    } else updatePool(function (pool) {
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
    // 性别尽量贴合我的期望，年龄贴近我，保证演示撮合顺利
    var gender = pick(['male', 'female']);
    var age = randInt(19, 35);
    if (guaranteed && me) {
      if (me.seekGender === 'male' || me.seekGender === 'female') gender = me.seekGender;
      if (me.age) age = Math.max(16, Math.min(60, me.age + randInt(-4, 4)));
    }
    // 真人化人设：职业 / 当前状态 / 标签 / 签名；标签有几率与我重合，制造共同话题
    var job = pick(BOT_JOBS);
    var status = pick(BOT_STATUS);
    var tagline = pick(BOT_TAGLINES);
    var tags = [];
    if (me && me.tags && me.tags.length) tags.push(pick(me.tags));
    while (tags.length < 3) {
      var t = pick(TAGS);
      if (tags.indexOf(t) === -1) tags.push(t);
    }
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
      gender: gender,
      age: age,
      seekGender: 'any',
      job: job,
      status: status,
      tags: tags,
      tagline: tagline,
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
    if (cloudOn()) return false; // 在线模式匹配真实用户，不召唤机器人
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
      gender: (prev && prev.gender) || 'secret',
      age: (prev && prev.age) || null,
      seekGender: (prev && prev.seekGender) || 'any',
      tags: (prev && prev.tags) || [],
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
    var fabComm = $('#wxm-fab-comm');
    if (fabComm) fabComm.classList.add('show');
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
    } else if (evt.type === 'community') {
      if (state.panel === 'community') renderPanel();
    }
  });

  /* ================================================================
   * 十一、启动
   * ================================================================ */

  function boot() {
    buildShell();
    seedCommunity();
    cloudInit(); // 配置了 Supabase 则进入在线模式（异步初始化）
    mo.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
    scheduleScan();
    // 心跳兜底：即使模块加载晚于 React 渲染（页面已静态、再无 DOM 变动），
    // 也能在 3 秒内补齐报告页 CTA 与入口状态
    setInterval(function () {
      try {
        if (parseResultProfile()) ensureResultCTA();
      } catch (e) { /* 单次心跳异常不影响后续 */ }
      refreshEntryUI();
    }, 3000);
    // 初始扫描：当前页面可能已经是报告页
    try {
      if (parseResultProfile()) ensureResultCTA();
    } catch (e) { /* DOM 未就绪时由 observer / 心跳接管 */ }
    refreshEntryUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
