/*!
 * app.js — 界面与交互：选等级/场景 → 填空或整句默写 → 回车判分 → 显示答案。
 * 依赖 engine.js（判分逻辑），数据来自 data/sentences.js（window.APP_DATA）。
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'eng-study/v1';
  const Engine = window.Engine;

  /* ================================================================== *
   * 全局状态
   * ================================================================== */

  const DEFAULT_LEVELS = [
    { id: 'A1', name: 'A1 · 入门', desc: '最基础的日常表达、短句' },
    { id: 'A2', name: 'A2 · 初级', desc: '常见场景的简单交流' },
    { id: 'B1', name: 'B1 · 中级', desc: '能描述经历与观点' },
    { id: 'B2', name: 'B2 · 中高级', desc: '抽象话题、地道搭配' },
    { id: 'C1', name: 'C1 · 高级', desc: '学术与职场进阶词汇' },
    { id: 'C2', name: 'C2 · 精通', desc: '低频词、修辞与书面语' }
  ];
  const DEFAULT_CATEGORIES = [
    { id: 'daily', name: '日常生活', icon: '🏠' },
    { id: 'travel', name: '出行旅行', icon: '✈️' },
    { id: 'food', name: '餐饮美食', icon: '🍽️' },
    { id: 'shopping', name: '购物消费', icon: '🛍️' },
    { id: 'study', name: '校园学习', icon: '📚' },
    { id: 'work', name: '职场办公', icon: '💼' },
    { id: 'health', name: '健康医疗', icon: '🩺' },
    { id: 'social', name: '社交寒暄', icon: '💬' }
  ];

  const state = {
    datasets: [],
    data: null,
    prefs: {
      mode: 'fill',
      level: 'all',
      category: 'all',
      requeue: true,
      autoNext: true,
      showZh: false,
      dataset: 0
    },
    stats: { answered: 0, firstTry: 0, best: 0 },
    session: { answered: 0, firstTry: 0, streak: 0, bestStreak: 0 },
    queue: [],
    qIndex: 0,
    sentence: null,
    exercise: null,
    typed: [],
    cursor: { b: 0, c: 0 },
    phase: 'typing', // typing | checked | revealed
    result: null,
    checkedOnce: false,
    hintLetters: false,
    wrongIds: [],
    autoTimer: null
  };

  /* ================================================================== *
   * DOM 引用
   * ================================================================== */

  const $ = (sel) => document.querySelector(sel);
  const dom = {};

  /* ================================================================== *
   * 小工具
   * ================================================================== */

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach((c) => {
        if (c == null) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && saved.prefs) Object.assign(state.prefs, saved.prefs);
      if (saved && saved.stats) Object.assign(state.stats, saved.stats);
    } catch (err) {
      /* 忽略损坏的本地数据 */
    }
  }

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ prefs: state.prefs, stats: state.stats }));
    } catch (err) {
      /* 隐私模式等场景下静默失败 */
    }
  }

  function pct(a, b) {
    return b === 0 ? 0 : Math.round((a / b) * 100);
  }

  function levelName(id) {
    const lv = state.data.levels.find((l) => l.id === id);
    return lv ? lv.name.split(' · ')[0] : id;
  }

  function categoryObj(id) {
    return state.data.categories.find((c) => c.id === id) || { id: id, name: id, icon: '•' };
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      toast('这个浏览器不支持朗读，抱歉');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  }

  let toastTimer = null;
  function toast(message, kind) {
    dom.toast.textContent = message;
    dom.toast.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.className = 'toast';
    }, 2200);
  }

  /* ================================================================== *
   * 题组
   * ================================================================== */

  function filteredPool() {
    return state.data.sentences.filter((s) => {
      if (state.prefs.level !== 'all' && s.level !== state.prefs.level) return false;
      if (state.prefs.category !== 'all' && s.category !== state.prefs.category) return false;
      return true;
    });
  }

  function buildQueue(onlyWrong) {
    let pool = onlyWrong
      ? state.data.sentences.filter((s) => state.wrongIds.indexOf(s.id) !== -1)
      : filteredPool();
    state.queue = Engine.shuffle(pool);
    state.qIndex = 0;
    state.session = { answered: 0, firstTry: 0, streak: 0, bestStreak: 0 };
  }

  function loadQuestion() {
    clearTimeout(state.autoTimer);
    if (state.qIndex >= state.queue.length) {
      showSummary();
      return;
    }
    dom.summary.hidden = true;
    dom.stage.hidden = false;

    state.sentence = state.queue[state.qIndex];
    state.exercise = Engine.buildExercise(state.sentence, { mode: state.prefs.mode });
    state.typed = state.exercise.blanks.map(() => '');
    state.cursor = { b: 0, c: 0 };
    state.phase = 'typing';
    state.result = null;
    state.checkedOnce = false;

    dom.answerBox.hidden = true;
    dom.answerBox.replaceChildren();
    dom.feedback.textContent = '';
    dom.feedback.className = 'feedback';

    renderMeta();
    renderSentence();
    renderProgress();
  }

  function next() {
    if (state.qIndex >= state.queue.length) return;
    state.qIndex += 1;
    loadQuestion();
  }

  /* ================================================================== *
   * 渲染
   * ================================================================== */

  function chip(label, active, onClick, extraClass) {
    return el('button', {
      type: 'button',
      class: 'chip' + (active ? ' active' : '') + (extraClass ? ' ' + extraClass : ''),
      onclick: onClick,
      'aria-pressed': active ? 'true' : 'false'
    }, label);
  }

  function renderFilters() {
    // 语料库
    const dsWrap = dom.datasetField;
    dsWrap.hidden = state.datasets.length < 2;
    dom.datasetSelect.replaceChildren();
    state.datasets.forEach((d, i) => {
      dom.datasetSelect.appendChild(el('option', { value: String(i), selected: state.prefs.dataset === i ? 'selected' : null }, d.name || '语料库 ' + (i + 1)));
    });

    // 模式
    const modes = [
      { id: 'fill', name: '填空' },
      { id: 'dictation', name: '整句默写' }
    ];
    dom.modeChips.replaceChildren(
      modes.map((m) =>
        chip(m.name, state.prefs.mode === m.id, () => {
          state.prefs.mode = m.id;
          saveStore();
          renderFilters();
          buildQueue(false);
          loadQuestion();
        })
      )
    );

    // 等级
    dom.levelChips.replaceChildren(
      [chip('全部', state.prefs.level === 'all', () => setLevel('all'))].concat(
        state.data.levels.map((lv) =>
          chip(lv.id, state.prefs.level === lv.id, () => setLevel(lv.id), lv.id)
        )
      )
    );

    // 场景
    dom.catChips.replaceChildren(
      [chip('全部', state.prefs.category === 'all', () => setCategory('all'))].concat(
        state.data.categories.map((c) =>
          chip(c.icon + ' ' + c.name, state.prefs.category === c.id, () => setCategory(c.id))
        )
      )
    );

    // 选项
    dom.optRequeue.checked = state.prefs.requeue;
    dom.optAuto.checked = state.prefs.autoNext;
  }

  function setLevel(id) {
    state.prefs.level = id;
    saveStore();
    renderFilters();
    buildQueue(false);
    loadQuestion();
  }

  function setCategory(id) {
    state.prefs.category = id;
    saveStore();
    renderFilters();
    buildQueue(false);
    loadQuestion();
  }

  function renderMeta() {
    const s = state.sentence;
    const cat = categoryObj(s.category);
    dom.meta.replaceChildren(
      el('span', { class: 'badge level' }, levelName(s.level)),
      el('span', { class: 'badge cat' }, cat.icon + ' ' + cat.name),
      el('span', { class: 'badge mode' }, state.prefs.mode === 'dictation' ? '整句默写' : '填空 ' + state.exercise.blanks.length + ' 处')
    );
    dom.zhHint.hidden = !state.prefs.showZh;
    dom.zhHint.textContent = state.prefs.showZh ? s.zh || '' : '';
    dom.showZhBtn.textContent = state.prefs.showZh ? '隐藏中文' : '中文提示';
  }

  function renderProgress() {
    const total = state.queue.length;
    const done = Math.min(state.qIndex + (state.phase === 'typing' ? 0 : 1), total);
    dom.progressText.textContent = '第 ' + Math.min(state.qIndex + 1, total) + ' / ' + total + ' 题';
    dom.progressBar.style.width = pct(done, total) + '%';
    const st = state.stats;
    dom.statsText.textContent =
      '已答 ' + st.answered + ' · 一次答对 ' + st.firstTry + ' · 正确率 ' + pct(st.firstTry, st.answered) + '%' +
      (state.session.streak > 0 ? ' · 连对 ' + state.session.streak : '');
  }

  function renderSentence() {
    const ex = state.exercise;
    const frag = document.createDocumentFragment();
    ex.items.forEach((item, i) => {
      if (item.kind === 'text') {
        frag.appendChild(el('span', { class: 'lit' }, item.text));
        return;
      }
      const blank = ex.blankAt(i);
      if (!blank) {
        frag.appendChild(el('span', { class: 'lit word' }, item.text));
        return;
      }
      frag.appendChild(renderBlank(blank));
    });
    dom.sentence.replaceChildren(frag);
  }

  function renderBlank(blank) {
    const expected = blank.text;
    const typed = state.typed[blank.order] || '';
    const checked = state.phase === 'checked' || state.phase === 'revealed';
    const wrap = el('span', { class: 'blank', 'data-b': String(blank.order) });

    if (checked) {
      const res = state.result.results[blank.order];
      wrap.classList.add('judged', res.status === 'ok' ? 'ok' : 'bad');
      res.marks.forEach((mark) => {
        let cls = 'cell';
        let text = mark.ch;
        if (mark.ok) {
          cls += ' ok';
        } else if (state.phase === 'revealed') {
          cls += ' reveal';
        } else if (mark.typed == null) {
          cls += ' missing';
        } else {
          cls += ' wrong';
          text = mark.typed;
        }
        wrap.appendChild(el('span', { class: cls, title: '应为：' + mark.ch }, text));
      });
      res.extra.forEach((ch) => {
        wrap.appendChild(el('span', { class: 'cell extra', title: '多写了' }, ch));
      });
    } else {
      for (let c = 0; c < expected.length; c++) {
        const ch = typed[c] || '';
        const cls = ['cell'];
        if (ch) cls.push('filled');
        if (state.cursor.b === blank.order && state.cursor.c === c) cls.push('active');
        // 首字母提示：只在开启提示时，给每个空的第一个字母留个淡淡的水印
        const ghost = !ch && state.hintLetters && c === 0 ? expected[c] : '';
        const cell = el('span', {
          class: cls.join(' '),
          'data-b': String(blank.order),
          'data-c': String(c),
          onclick: () => {
            state.cursor = { b: blank.order, c: Math.min(c, (state.typed[blank.order] || '').length) };
            renderSentence();
            focusProxy();
          }
        }, ch);
        if (ghost && ghost !== ch) cell.appendChild(el('i', { class: 'ghost' }, ghost));
        wrap.appendChild(cell);
      }
      // 多打出来的字母
      for (let c = expected.length; c < typed.length; c++) {
        const cls = ['cell', 'filled', 'extra'];
        if (state.cursor.b === blank.order && state.cursor.c === c) cls.push('active');
        wrap.appendChild(el('span', { class: cls.join(' ') }, typed[c]));
      }
      // 空词的高亮（当前正在写的词）
      if (state.cursor.b === blank.order) wrap.classList.add('focus');
    }
    return wrap;
  }

  function renderAll() {
    renderSentence();
    renderProgress();
  }

  /* ================================================================== *
   * 输入处理
   * ================================================================== */

  function applyTypingGuard() {
    // 判分后再次输入 → 回到可编辑状态
    if (state.phase === 'checked') {
      state.phase = 'typing';
      state.result = null;
      dom.feedback.textContent = '';
      dom.feedback.className = 'feedback';
    }
  }

  function currentBlankLength(b) {
    return state.exercise.blanks[b] ? state.exercise.blanks[b].text.length : 0;
  }

  function insertChar(ch) {
    if (state.phase === 'revealed') return;
    applyTypingGuard();
    const b = state.cursor.b;
    if (b >= state.exercise.blanks.length) return;
    const value = state.typed[b] || '';
    const at = Math.min(state.cursor.c, value.length);
    state.typed[b] = value.slice(0, at) + ch + value.slice(at);
    let c = at + 1;
    // 写满一个词就自动跳到下一个空
    if (c >= currentBlankLength(b) && state.cursor.c >= currentBlankLength(b) - 1) {
      if (b + 1 < state.exercise.blanks.length) {
        state.cursor = { b: b + 1, c: 0 };
      } else {
        state.cursor = { b: b, c: value.length + 1 };
      }
    } else {
      state.cursor = { b: b, c: c };
    }
    renderAll();
  }

  function backspace() {
    if (state.phase === 'revealed') return;
    applyTypingGuard();
    const b = state.cursor.b;
    const value = state.typed[b] || '';
    if (state.cursor.c > 0) {
      const at = Math.min(state.cursor.c, value.length);
      state.typed[b] = value.slice(0, at - 1) + value.slice(at);
      state.cursor = { b: b, c: at - 1 };
    } else if (b > 0) {
      const prev = b - 1;
      const pv = state.typed[prev] || '';
      state.cursor = { b: prev, c: pv.length };
    }
    renderAll();
  }

  function moveCursor(delta) {
    if (state.phase === 'revealed') return;
    let { b, c } = state.cursor;
    c += delta;
    if (c < 0) {
      if (b > 0) {
        b -= 1;
        c = (state.typed[b] || '').length;
      } else {
        c = 0;
      }
    }
    if (c > (state.typed[b] || '').length) {
      if (b + 1 < state.exercise.blanks.length) {
        b += 1;
        c = 0;
      } else {
        c = (state.typed[b] || '').length;
      }
    }
    state.cursor = { b: b, c: c };
    renderAll();
  }

  function jumpBlank(delta) {
    if (state.phase === 'revealed') return;
    const n = state.exercise.blanks.length;
    let b = state.cursor.b + delta;
    if (b < 0) b = 0;
    if (b >= n) b = n - 1;
    state.cursor = { b: b, c: 0 };
    renderAll();
  }

  function clearCurrentBlank() {
    if (state.phase === 'revealed') return;
    applyTypingGuard();
    state.typed[state.cursor.b] = '';
    state.cursor = { b: state.cursor.b, c: 0 };
    renderAll();
  }

  function onKeyDown(e) {
    if (e.key === 'Shift' || e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta') return;

    // 焦点在原生控件上时不要抢键盘（但自己的输入法代理要接管）
    const target = e.target;
    const tag = target && target.tagName;
    const isProxy = target === dom.proxy;
    const inControl = tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA';
    if (inControl && !isProxy) return;

    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'Enter') {
        e.preventDefault();
        revealAnswer();
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        toggleHintLetters();
      }
      return;
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        primaryAction();
        return;
      case 'Backspace':
        e.preventDefault();
        backspace();
        return;
      case 'Tab':
        e.preventDefault();
        jumpBlank(e.shiftKey ? -1 : 1);
        return;
      case 'ArrowLeft':
        e.preventDefault();
        moveCursor(-1);
        return;
      case 'ArrowRight':
        e.preventDefault();
        moveCursor(1);
        return;
      case 'Escape':
        e.preventDefault();
        if (state.phase === 'checked' || state.phase === 'revealed') restate();
        else clearCurrentBlank();
        return;
      case ' ':
        e.preventDefault();
        jumpBlank(1);
        return;
      case 'Dead':
      case 'Unidentified':
        return;
      default:
        break;
    }

    if (!e.altKey && e.key.length === 1 && /[A-Za-z0-9'\u2019\u2018\-]/.test(e.key)) {
      e.preventDefault();
      insertChar(e.key);
    }
  }

  // 移动端：用一个隐藏输入法代理来唤起键盘；无法从 keydown 拿到字符时用它的 input 事件兜底。
  function onProxyInput(e) {
    const value = e.target.value;
    if (!value) return;
    e.target.value = '';
    for (const ch of value) {
      if (ch === ' ') jumpBlank(1);
      else if (/[A-Za-z0-9'\u2019\u2018\-]/.test(ch)) insertChar(ch);
    }
  }

  function focusProxy() {
    if (dom.proxy && document.activeElement !== dom.proxy) {
      try {
        dom.proxy.focus({ preventScroll: true });
      } catch (err) {
        dom.proxy.focus();
      }
    }
  }

  /* ================================================================== *
   * 判分 / 答案 / 提示
   * ================================================================== */

  function primaryAction() {
    if (state.phase === 'typing') {
      checkAnswer();
    } else if (state.phase === 'checked') {
      if (state.result.correct) next();
      else checkAnswer();
    } else {
      next();
    }
  }

  function checkAnswer() {
    const result = Engine.check(state.exercise, state.typed);
    if (!result.answered) {
      toast('先写点内容，再回车检查～', 'warn');
      return;
    }
    state.result = result;
    state.phase = 'checked';

    if (!state.checkedOnce) {
      state.checkedOnce = true;
      state.session.answered += 1;
      state.stats.answered += 1;
      if (result.correct) {
        state.session.firstTry += 1;
        state.stats.firstTry += 1;
        state.session.streak += 1;
        if (state.session.streak > state.session.bestStreak) state.session.bestStreak = state.session.streak;
        state.stats.best = Math.max(state.stats.best, state.session.streak);
      } else {
        state.session.streak = 0;
        if (state.wrongIds.indexOf(state.sentence.id) === -1) state.wrongIds.push(state.sentence.id);
      }
      saveStore();
    }

    renderAll();

    if (result.correct) {
      dom.feedback.textContent = '✅ 完全正确！';
      dom.feedback.className = 'feedback good';
      toast('漂亮，全对！');
      if (state.prefs.autoNext) {
        clearTimeout(state.autoTimer);
        state.autoTimer = setTimeout(next, 1100);
      }
    } else {
      const wrongWords = result.results
        .filter((r) => r.status !== 'ok')
        .map((r) => '“' + r.expected + '”')
        .slice(0, 3)
        .join('、');
      dom.feedback.textContent = '❌ 还有 ' + result.mistakes + ' 处不对：' + wrongWords + '（红色为写错，虚线为漏写，回车可再检查）';
      dom.feedback.className = 'feedback bad';
      toast('有 ' + result.mistakes + ' 处错误，再试试', 'warn');
      if (state.prefs.requeue && state.session.answered > 0) {
        // 错题本轮结束后再练一次
        const dup = state.queue.some((q, i) => q.id === state.sentence.id && i > state.qIndex);
        if (!dup) state.queue.push(state.sentence);
      }
    }
    renderProgress();
  }

  function revealAnswer() {
    if (!state.exercise) return;
    clearTimeout(state.autoTimer);
    if (state.phase !== 'revealed') {
      state.result = Engine.check(state.exercise, state.typed);
      state.phase = 'revealed';
      if (!state.checkedOnce) {
        state.checkedOnce = true;
        state.session.answered += 1;
        state.session.streak = 0;
        state.stats.answered += 1;
        if (state.wrongIds.indexOf(state.sentence.id) === -1) state.wrongIds.push(state.sentence.id);
        saveStore();
      }
      renderAll();
      dom.feedback.textContent = '已显示答案，回车进入下一题。';
      dom.feedback.className = 'feedback';
    }
    renderAnswerBox();
    renderProgress();
  }

  function renderAnswerBox() {
    const s = state.sentence;
    if (dom.answerBox.hidden === false && dom.answerBox.dataset.id === s.id) return;
    dom.answerBox.dataset.id = s.id;
    dom.answerBox.hidden = false;
    dom.answerBox.replaceChildren(
      el('div', { class: 'answer-label' }, '正确答案'),
      el('p', { class: 'answer-en' }, s.text),
      s.zh ? el('p', { class: 'answer-zh' }, s.zh) : null,
      el('div', { class: 'answer-actions' }, [
        el('button', { type: 'button', class: 'btn ghost small', onclick: () => speak(s.text) }, '🔊 听一遍'),
        el('button', { type: 'button', class: 'btn ghost small', onclick: () => restate() }, '重做本题')
      ])
    );
  }

  function restate() {
    dom.answerBox.hidden = true;
    dom.answerBox.replaceChildren();
    state.typed = state.exercise.blanks.map(() => '');
    state.cursor = { b: 0, c: 0 };
    state.phase = 'typing';
    state.result = null;
    state.checkedOnce = false;
    dom.feedback.textContent = '';
    dom.feedback.className = 'feedback';
    renderAll();
  }

  function toggleHintLetters() {
    state.hintLetters = !state.hintLetters;
    dom.hintBtn.classList.toggle('active', state.hintLetters);
    renderSentence();
    toast(state.hintLetters ? '已显示首字母提示' : '已关闭提示');
  }

  /* ================================================================== *
   * 结算
   * ================================================================== */

  function showSummary() {
    dom.stage.hidden = true;
    dom.summary.hidden = false;
    const s = state.session;
    const wrongCount = state.wrongIds.length;
    dom.summary.replaceChildren(
      el('h2', {}, '这一轮结束啦 🎉'),
      el('div', { class: 'summary-grid' }, [
        statBlock(s.answered, '本轮题数'),
        statBlock(s.firstTry, '一次答对'),
        statBlock(pct(s.firstTry, s.answered) + '%', '正确率'),
        statBlock(s.bestStreak, '最长连对')
      ]),
      el('p', { class: 'summary-note' }, '累计已练 ' + state.stats.answered + ' 题，一次答对率 ' + pct(state.stats.firstTry, state.stats.answered) + '%。错题本里现在有 ' + wrongCount + ' 条。'),
      el('div', { class: 'actions center' }, [
        el('button', { type: 'button', class: 'btn primary', onclick: () => { buildQueue(false); loadQuestion(); } }, '再来一轮'),
        el('button', { type: 'button', class: 'btn', onclick: () => { buildQueue(true); loadQuestion(); } }, '只练错题'),
        el('button', { type: 'button', class: 'btn ghost', onclick: () => { state.wrongIds = []; toast('错题本已清空'); showSummary(); } }, '清空错题本')
      ])
    );
  }

  function statBlock(value, label) {
    return el('div', { class: 'stat' }, [el('b', {}, String(value)), el('span', {}, label)]);
  }

  /* ================================================================== *
   * 初始化
   * ================================================================== */

  function cacheDom() {
    dom.modeChips = $('#modeChips');
    dom.levelChips = $('#levelChips');
    dom.catChips = $('#catChips');
    dom.datasetField = $('#datasetField');
    dom.datasetSelect = $('#datasetSelect');
    dom.optRequeue = $('#optRequeue');
    dom.optAuto = $('#optAuto');
    dom.progressText = $('#progressText');
    dom.progressBar = $('#progressBar');
    dom.statsText = $('#statsText');
    dom.meta = $('#meta');
    dom.zhHint = $('#zhHint');
    dom.showZhBtn = $('#showZhBtn');
    dom.sentence = $('#sentence');
    dom.feedback = $('#feedback');
    dom.answerBox = $('#answerBox');
    dom.summary = $('#summary');
    dom.stage = $('#stage');
    dom.toast = $('#toast');
    dom.hintBtn = $('#hintBtn');
    dom.proxy = $('#keyboardProxy');
    dom.checkBtn = $('#checkBtn');
    dom.nextBtn = $('#nextBtn');
    dom.revealBtn = $('#revealBtn');
    dom.resetBtn = $('#resetBtn');
    dom.speakBtn = $('#speakBtn');
  }

  function bindEvents() {
    document.addEventListener('keydown', onKeyDown);
    dom.proxy.addEventListener('input', onProxyInput);
    dom.sentence.addEventListener('click', focusProxy);

    dom.checkBtn.addEventListener('click', () => { primaryAction(); focusProxy(); });
    dom.nextBtn.addEventListener('click', () => { next(); focusProxy(); });
    dom.revealBtn.addEventListener('click', () => { revealAnswer(); focusProxy(); });
    dom.resetBtn.addEventListener('click', () => {
      if (state.phase === 'revealed') restate();
      else { applyTypingGuard(); state.typed = state.exercise.blanks.map(() => ''); state.cursor = { b: 0, c: 0 }; renderAll(); }
      focusProxy();
    });
    dom.speakBtn.addEventListener('click', () => speak(state.sentence ? state.sentence.text : ''));
    dom.showZhBtn.addEventListener('click', () => {
      state.prefs.showZh = !state.prefs.showZh;
      saveStore();
      renderMeta();
      focusProxy();
    });
    dom.hintBtn.addEventListener('click', () => { toggleHintLetters(); focusProxy(); });

    dom.optRequeue.addEventListener('change', () => {
      state.prefs.requeue = dom.optRequeue.checked;
      saveStore();
      focusProxy();
    });
    dom.optAuto.addEventListener('change', () => {
      state.prefs.autoNext = dom.optAuto.checked;
      saveStore();
      focusProxy();
    });
    dom.datasetSelect.addEventListener('change', () => {
      state.prefs.dataset = Number(dom.datasetSelect.value) || 0;
      saveStore();
      state.data = state.datasets[state.prefs.dataset] || state.datasets[0];
      renderFilters();
      buildQueue(false);
      loadQuestion();
      focusProxy();
    });
  }

  function loadExtraDatasets() {
    if (window.TATOEBA_DATA) {
      state.datasets.push(window.TATOEBA_DATA);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let settled = false;
      const script = document.createElement('script');
      script.src = 'data/sentences.tatoeba.js';
      script.onload = () => { settled = true; resolve(); };
      script.onerror = () => { settled = true; resolve(); };
      // 兜底：即使脚本不存在或加载事件不触发（如 JSDOM），也不阻塞 boot
      setTimeout(() => { if (!settled) { settled = true; resolve(); } }, 3000);
      document.head.appendChild(script);
    });
  }

  async function boot() {
    cacheDom();
    state.datasets = [window.APP_DATA].filter(Boolean);
    if (!state.datasets.length) {
      document.body.innerHTML = '<main class="panel"><h2>找不到语料</h2><p>请确认 data/sentences.js 已正确引入。</p></main>';
      return;
    }
    loadStore();
    await loadExtraDatasets();
    if (state.prefs.dataset >= state.datasets.length) state.prefs.dataset = 0;
    state.data = state.datasets[state.prefs.dataset];
    if (!state.data.levels) {
      state.data.levels = DEFAULT_LEVELS;
      state.data.categories = DEFAULT_CATEGORIES;
    }

    bindEvents();
    renderFilters();
    buildQueue(false);
    loadQuestion();
    focusProxy();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
