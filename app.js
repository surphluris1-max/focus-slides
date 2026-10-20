(() => {
  const $ = (id) => document.getElementById(id);
  const DEF = {
    focusMin: 25,
    slideSec: 12,
    transition: "drift",
    alarmSound: true,
    volume: 0.6,
    alarmMsg: "Stand up, stretch and drink some water.",
    theme: "dark",
    dim: 0,
    blur: 0,
    shuffle: false,
    preset: "default",
    slideSource: "combined"
  };
  let cfg = { ...DEF, ...JSON.parse(localStorage.getItem("fs.cfg") || "{}") };
  const saveCfg = () => localStorage.setItem("fs.cfg", JSON.stringify(cfg));

  // In a plain browser (no Electron) fall back to the bundled files.
  const api = window.api || {
    assets: async () => ({ defaultSlides: ["assets/slides/slide-1.jpg", "assets/slides/slide-2.jpg"], customSlides: [], alarm: "assets/alarm.jpg" }),
    addImages: async () => ({ added: 0 }),
    openFolder: async () => {}, minimize() {}, front() {},
    toggleFull() { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); },
  };

  const stage = $("stage"), breakEl = $("break"), alarmEl = $("alarm"), panel = $("panel"),
    namerBox = $("namerBox"), namer = $("namer"), tagSelector = $("tagSelector"),
    completeEl = $("complete"), statsPanel = $("statsPanel"), shortcutsModal = $("shortcutsModal");

  /* ---------- theme & atmosphere ---------- */
  const C = {};
  function applyTheme() {
    document.documentElement.dataset.theme = cfg.theme;
    document.body.dataset.preset = cfg.preset;
    $("theme").textContent = cfg.theme === "dark" ? "Light mode" : "Dark mode";
    const s = getComputedStyle(document.documentElement);
    for (const k of ["accent", "accent2", "ink", "mute"]) C[k] = s.getPropertyValue("--" + k).trim();

    // Atmosphere & Background properties
    document.documentElement.style.setProperty("--slide-dim", cfg.dim);
    document.documentElement.style.setProperty("--slide-blur", cfg.blur + "px");
  }

  /* ---------- local statistics ---------- */
  function getStats() {
    const raw = localStorage.getItem("fs.stats");
    return raw ? JSON.parse(raw) : { sessions: [] };
  }
  function saveStats(stats) {
    localStorage.setItem("fs.stats", JSON.stringify(stats));
  }
  function recordSession(minutes) {
    const stats = getStats();
    stats.sessions.unshift({
      timestamp: Date.now(),
      duration: minutes
    });
    // Keep last 100 sessions
    if (stats.sessions.length > 100) stats.sessions = stats.sessions.slice(0, 100);
    saveStats(stats);
    updateStatsUI();
  }
  function formatMinutes(min) {
    if (min >= 60) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${min}m`;
  }
  function updateStatsUI() {
    const stats = getStats();
    const sessions = stats.sessions || [];
    const count = sessions.length;
    const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();

    const todayMinutes = sessions
      .filter((s) => s.timestamp >= startOfToday)
      .reduce((acc, s) => acc + (s.duration || 0), 0);
    const weekMinutes = sessions
      .filter((s) => s.timestamp >= startOfWeek)
      .reduce((acc, s) => acc + (s.duration || 0), 0);

    $("stCompleted").textContent = count;
    $("stTotalMin").textContent = formatMinutes(totalMinutes);
    $("stTodayMin").textContent = formatMinutes(todayMinutes);
    $("stWeekMin").textContent = formatMinutes(weekMinutes);

    const list = $("stHistoryList");
    list.innerHTML = "";
    if (sessions.length === 0) {
      list.innerHTML = '<li class="history-empty">No sessions recorded yet</li>';
      return;
    }
    sessions.slice(0, 15).forEach((s) => {
      const li = document.createElement("li");
      li.className = "stats-history-item";
      const d = new Date(s.timestamp);
      const timeStr = d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " +
                      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      li.innerHTML = `<span><strong>${s.duration} min</strong> session</span><span class="history-time">${timeStr}</span>`;
      list.appendChild(li);
    });
  }

  /* ---------- slideshow ---------- */
  let defaultSlidesList = [], customSlidesList = [], slides = [], idx = -1, slideTimer;
  async function loadAssets() {
    const a = await api.assets();
    defaultSlidesList = a.defaultSlides || [];
    customSlidesList = a.customSlides || [];
    $("alarmImg").src = a.alarm; $("alarmBg").src = a.alarm;
    prepSlides();
    idx = -1;
    nextSlide(); restartSlides();
  }
  function prepSlides() {
    let source = [];
    if (cfg.slideSource === "default") {
      source = [...defaultSlidesList];
    } else if (cfg.slideSource === "custom") {
      source = customSlidesList.length ? [...customSlidesList] : [...defaultSlidesList];
    } else {
      // combined
      source = [...defaultSlidesList, ...customSlidesList];
    }

    const note = $("slideStatusNote");
    if (note) {
      note.textContent = `Using ${defaultSlidesList.length} default & ${customSlidesList.length} custom image(s). (${cfg.slideSource} mode)`;
    }

    slides = source;
    if (cfg.shuffle && slides.length > 1) {
      for (let i = slides.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slides[i], slides[j]] = [slides[j], slides[i]];
      }
    }
  }
  function nextSlide() {
    if (!slides.length || cfg.preset === "minimal") return;
    idx = (idx + 1) % slides.length;
    const el = new Image();
    el.className = "slide " + cfg.transition; el.alt = "";
    el.onload = () => {
      const old = [...stage.children];
      stage.appendChild(el);
      void el.offsetWidth;
      el.classList.add("on");
      setTimeout(() => old.forEach((o) => o.remove()), 1800);
    };
    el.src = slides[idx];
  }
  function restartSlides() {
    clearInterval(slideTimer);
    if (slides.length > 1 && cfg.preset !== "minimal") {
      slideTimer = setInterval(nextSlide, cfg.slideSec * 1000);
    }
  }

  /* ---------- timer & reliability ---------- */
  const LEN = 226.2;
  let remaining = cfg.focusMin * 60, running = false, endAt = 0, ticker;
  let sessionFinishedHandled = false;
  const total = () => cfg.focusMin * 60;

  function render() {
    const t = String(Math.floor(remaining / 60)).padStart(2, "0") + ":" + String(remaining % 60).padStart(2, "0");
    $("clock").textContent = t;
    $("arc").style.strokeDashoffset = LEN * (1 - remaining / total());
    $("play").textContent = running ? "Pause" : "Start";
    document.title = (running ? t + " - " : "") + "Focus Slides";
  }

  function tick() {
    if (!running) return;
    const now = Date.now();
    remaining = Math.max(0, Math.ceil((endAt - now) / 1000));
    render();
    if (remaining === 0 && !sessionFinishedHandled) {
      sessionFinishedHandled = true;
      finish();
    }
  }

  function start() {
    if (remaining <= 0) remaining = total();
    endAt = Date.now() + remaining * 1000;
    running = true;
    sessionFinishedHandled = false;
    clearInterval(ticker);
    ticker = setInterval(tick, 250);
    render();
  }

  function pause() {
    if (!running) return;
    running = false;
    clearInterval(ticker);
    // Recalculate remaining precisely from endAt so paused time is not counted
    remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    render();
  }

  function reset() {
    running = false;
    sessionFinishedHandled = false;
    clearInterval(ticker);
    remaining = total();
    render();
  }

  // Handle system wake/visibility & focus change
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && running) {
      tick();
    }
  });
  window.addEventListener("focus", () => {
    if (running) tick();
  });

  /* ---------- alarm & completion experience ---------- */
  let audioCtx, loopT, stopT;
  function chime() {
    if (!cfg.alarmSound) return;
    audioCtx = audioCtx || new AudioContext();
    [784, 988, 1319].forEach((f, i) => {
      const t = audioCtx.currentTime + i * 0.38, o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(cfg.volume * 0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 1.7);
    });
  }

  function showAlarm() {
    $("alarmMsg").textContent = cfg.alarmMsg;
    alarmEl.hidden = false;
    alarmEl.classList.remove("show"); void alarmEl.offsetWidth; alarmEl.classList.add("show");
    api.front();
    chime(); clearInterval(loopT); loopT = setInterval(chime, 3200);
    clearTimeout(stopT); stopT = setTimeout(() => clearInterval(loopT), 90000);
  }

  function dismiss() {
    clearInterval(loopT);
    clearTimeout(stopT);
    alarmEl.hidden = true;
  }

  function showCompletionOverlay() {
    $("completeDuration").textContent = `${cfg.focusMin} minutes of focus`;
    completeEl.hidden = false;
  }

  function hideCompletionOverlay() {
    completeEl.hidden = true;
  }

  function finish() {
    pause();
    remaining = 0;
    render();
    recordSession(cfg.focusMin);
    showAlarm();
  }

  /* ---------- break mode: bubble map with categories ---------- */
  const cv = $("graph"), ctx = cv.getContext("2d");
  let W, H;
  function size() {
    const d = devicePixelRatio || 1; W = innerWidth; H = innerHeight;
    cv.width = W * d; cv.height = H * d; cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  addEventListener("resize", size);

  const CATEGORY_COLORS = {
    idea: { border: null, fillStart: "#fff", fillMid: null, fillEnd: null },
    distraction: { border: "#f59e0b", fillStart: "#fffbeb", fillMid: "#f59e0b", fillEnd: "#b45309" },
    task: { border: "#10b981", fillStart: "#ecfdf5", fillMid: "#10b981", fillEnd: "#047857" }
  };

  const SEED = { nextId: 6, links: [[1, 2], [1, 3], [2, 4], [1, 5]], nodes: [
    { id: 1, label: "Focus", category: "idea", x: 0, y: 0 },
    { id: 2, label: "Today", category: "task", x: -140, y: -60 },
    { id: 3, label: "Ideas", category: "idea", x: 150, y: -80 },
    { id: 4, label: "Water", category: "distraction", x: -120, y: 110 },
    { id: 5, label: "Stretch", category: "task", x: 130, y: 120 }
  ]};

  let G = JSON.parse(localStorage.getItem("fs.graph") || "null") || SEED;
  // Ensure existing nodes have a category
  G.nodes.forEach((n) => { n.vx = 0; n.vy = 0; if (!n.category) n.category = "idea"; });
  const saveG = () => localStorage.setItem("fs.graph", JSON.stringify({
    nextId: G.nextId,
    links: G.links,
    nodes: G.nodes.map(({ id, label, category, x, y }) => ({ id, label, category: category || "idea", x, y }))
  }));

  const byId = (id) => G.nodes.find((n) => n.id === id);
  const rad = (n) => 16 + Math.min(G.links.filter((l) => l.includes(n.id)).length, 6) * 3;

  let drag = null, linkFrom = null, hover = null, mouse = { x: 0, y: 0 }, editing = null;
  const world = (e) => ({ x: e.clientX - W / 2, y: e.clientY - H / 2 });
  const hit = (p) => [...G.nodes].reverse().find((n) => Math.hypot(n.x - p.x, n.y - p.y) <= rad(n) + 6);

  function step() {
    for (const a of G.nodes) for (const b of G.nodes) {
      if (a === b) continue;
      const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 80, d = Math.sqrt(d2), f = 5200 / d2;
      a.vx += dx / d * f; a.vy += dy / d * f;
    }
    for (const [i, j] of G.links) {
      const a = byId(i), b = byId(j); if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - 140) * 0.012;
      a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
    }
    for (const n of G.nodes) {
      n.vx -= n.x * 0.0025; n.vy -= n.y * 0.0025;
      if (n === drag || n.fixed) { n.vx = n.vy = 0; continue; }
      n.vx *= 0.86; n.vy *= 0.86; n.x += n.vx; n.y += n.vy;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H); ctx.save(); ctx.translate(W / 2, H / 2);
    ctx.lineWidth = 1.4; ctx.strokeStyle = C.accent; ctx.globalAlpha = 0.4;
    for (const [i, j] of G.links) {
      const a = byId(i), b = byId(j); if (!a || !b) continue;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    if (linkFrom) {
      ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(linkFrom.x, linkFrom.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    for (const n of G.nodes) {
      const r = rad(n) * (n === hover ? 1.12 : 1);
      const cat = n.category || "idea";
      const catCfg = CATEGORY_COLORS[cat] || CATEGORY_COLORS.idea;
      const midCol = catCfg.fillMid || C.accent;
      const endCol = catCfg.fillEnd || C.accent2;

      const g = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.35, r * 0.1, n.x, n.y, r);
      g.addColorStop(0, catCfg.fillStart); g.addColorStop(0.35, midCol); g.addColorStop(1, endCol);

      ctx.shadowColor = midCol; ctx.shadowBlur = 18; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;

      ctx.fillStyle = C.ink; ctx.font = "500 13px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(n.label, n.x, n.y + r + 16);
    }
    ctx.restore();
  }

  (function loop() {
    if (!breakEl.hidden) { step(); draw(); }
    requestAnimationFrame(loop);
  })();

  cv.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const n = hit(world(e)); if (!n) return;
    cv.setPointerCapture(e.pointerId);
    if (e.shiftKey) linkFrom = n; else drag = n;
  });
  cv.addEventListener("pointermove", (e) => {
    mouse = world(e); hover = hit(mouse);
    if (drag) { drag.x = mouse.x; drag.y = mouse.y; }
    cv.style.cursor = linkFrom ? "crosshair" : hover ? "grab" : "default";
  });
  cv.addEventListener("pointerup", () => {
    if (linkFrom) {
      const t = hit(mouse);
      if (t && t !== linkFrom && !G.links.some((l) => l.includes(t.id) && l.includes(linkFrom.id))) {
        G.links.push([linkFrom.id, t.id]);
      }
      linkFrom = null; saveG();
    }
    if (drag) { drag = null; saveG(); }
  });
  cv.addEventListener("dblclick", (e) => {
    const p = world(e), n = hit(p);
    if (n) return rename(n, false);
    const m = { id: G.nextId++, label: "", category: "idea", x: p.x, y: p.y, vx: 0, vy: 0 };
    G.nodes.push(m); rename(m, true);
  });
  cv.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const n = hit(world(e)); if (!n) return;
    G.nodes = G.nodes.filter((x) => x !== n); G.links = G.links.filter((l) => !l.includes(n.id)); saveG();
  });

  let currentCategory = "idea";
  function updateTagSelectorUI(cat) {
    currentCategory = cat || "idea";
    tagSelector.querySelectorAll(".tag-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cat === currentCategory);
    });
  }

  tagSelector.addEventListener("click", (e) => {
    const btn = e.target.closest(".tag-btn");
    if (!btn) return;
    updateTagSelectorUI(btn.dataset.cat);
    if (editing && editing.n) {
      editing.n.category = currentCategory;
      saveG();
    }
  });

  function rename(n, isNew) {
    editing = { n, isNew }; n.fixed = true;
    updateTagSelectorUI(n.category || "idea");
    namerBox.style.left = n.x + W / 2 + "px";
    namerBox.style.top = n.y + H / 2 + rad(n) + 6 + "px";
    namer.value = n.label;
    namerBox.hidden = false;
    namer.focus(); namer.select();
  }

  function endEdit(commit) {
    if (!editing) return;
    const { n, isNew } = editing, v = namer.value.trim();
    n.category = currentCategory;
    editing = null; namerBox.hidden = true; n.fixed = false;
    if (commit && v) {
      n.label = v;
    } else if (isNew) {
      if (commit) n.label = currentCategory === "task" ? "Task" : currentCategory === "distraction" ? "Distraction" : "Idea";
      else G.nodes = G.nodes.filter((x) => x !== n);
    }
    saveG();
  }

  namer.addEventListener("keydown", (e) => {
    if (e.key === "Enter") endEdit(true);
    if (e.key === "Escape") { e.stopPropagation(); endEdit(false); }
  });
  namerBox.addEventListener("focusout", (e) => {
    if (!namerBox.contains(e.relatedTarget)) {
      endEdit(true);
    }
  });

  function toggleBreak(force) {
    const on = force === undefined ? breakEl.hidden : force;
    if (!on) endEdit(true);
    breakEl.hidden = !on; $("cap").hidden = !on;
    document.body.classList.toggle("breaking", on);
  }

  /* ---------- wiring ---------- */
  $("ring").onclick = () => toggleBreak();
  $("play").onclick = () => (running ? pause() : start());
  $("reset").onclick = reset;
  $("theme").onclick = () => { cfg.theme = cfg.theme === "dark" ? "light" : "dark"; saveCfg(); applyTheme(); };
  $("full").onclick = () => api.toggleFull();
  $("min").onclick = () => api.minimize();
  $("gear").onclick = () => panel.classList.toggle("open");
  $("bClose").onclick = () => panel.classList.remove("open");
  $("bCloseTop").onclick = () => panel.classList.remove("open");

  // Break mode actions
  $("breakBack").onclick = () => toggleBreak(false);

  // Alarm actions -> Show complete card
  $("again").onclick = () => {
    dismiss();
    reset();
    start();
  };
  $("stop").onclick = () => {
    dismiss();
    showCompletionOverlay();
  };

  // Session complete overlay actions
  $("btnBreak").onclick = () => {
    hideCompletionOverlay();
    reset();
    toggleBreak(true);
  };
  $("btnAgain").onclick = () => {
    hideCompletionOverlay();
    reset();
    start();
  };
  $("btnFinish").onclick = () => {
    hideCompletionOverlay();
    reset();
  };

  // Stats drawer
  $("bOpenStats").onclick = () => {
    panel.classList.remove("open");
    updateStatsUI();
    statsPanel.classList.add("open");
  };
  $("sCloseStats").onclick = () => statsPanel.classList.remove("open");

  // Shortcuts modal
  $("bOpenShortcuts").onclick = () => {
    panel.classList.remove("open");
    shortcutsModal.hidden = false;
  };
  $("closeShortcuts").onclick = () => shortcutsModal.hidden = true;
  shortcutsModal.onclick = (e) => {
    if (e.target === shortcutsModal) shortcutsModal.hidden = true;
  };

  $("bTest").onclick = showAlarm;
  $("bFolder").onclick = () => api.openFolder();
  $("bReload").onclick = loadAssets;
  $("bAddImages").onclick = async () => {
    const res = await api.addImages();
    if (res && res.added > 0) {
      await loadAssets();
    }
  };

  const bind = (id, key, read) => {
    const el = $(id);
    el.addEventListener("change", () => {
      cfg[key] = read(el); saveCfg();
      if (key === "focusMin" && !running) reset();
      if (key === "slideSec") restartSlides();
      if (key === "dim" || key === "blur" || key === "preset") applyTheme();
      if (key === "shuffle" || key === "slideSource") { prepSlides(); restartSlides(); }
    });
  };
  bind("sFocus", "focusMin", (e) => Math.min(180, Math.max(1, +e.value || 25)));
  bind("sSlide", "slideSec", (e) => Math.min(120, Math.max(3, +e.value || 12)));
  bind("sSlideSource", "slideSource", (e) => e.value);
  bind("sTrans", "transition", (e) => e.value);
  bind("sPreset", "preset", (e) => e.value);
  bind("sDim", "dim", (e) => +e.value);
  bind("sBlur", "blur", (e) => +e.value);
  bind("sShuffle", "shuffle", (e) => e.checked);
  bind("sSound", "alarmSound", (e) => e.checked);
  bind("sVol", "volume", (e) => +e.value);
  bind("sMsg", "alarmMsg", (e) => e.value);

  function fillSettings() {
    $("sFocus").value = cfg.focusMin; $("sSlide").value = cfg.slideSec; $("sTrans").value = cfg.transition;
    $("sSlideSource").value = cfg.slideSource || "combined";
    $("sPreset").value = cfg.preset;
    $("sDim").value = cfg.dim;
    $("sBlur").value = cfg.blur;
    $("sShuffle").checked = cfg.shuffle;
    $("sSound").checked = cfg.alarmSound; $("sVol").value = cfg.volume; $("sMsg").value = cfg.alarmMsg;
  }

  document.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) b.blur(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!alarmEl.hidden) dismiss();
      else if (!completeEl.hidden) hideCompletionOverlay();
      else if (!shortcutsModal.hidden) shortcutsModal.hidden = true;
      else if (statsPanel.classList.contains("open")) statsPanel.classList.remove("open");
      else if (panel.classList.contains("open")) panel.classList.remove("open");
      else if (!breakEl.hidden) toggleBreak(false);
      return;
    }
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === " ") { e.preventDefault(); running ? pause() : start(); }
    else if (k === "b") toggleBreak();
    else if (k === "f") api.toggleFull();
    else if (k === "t") $("theme").click();
    else if (k === "s") panel.classList.toggle("open");
    else if (k === "?" || (e.shiftKey && k === "/")) { shortcutsModal.hidden = !shortcutsModal.hidden; }
  });

  let idleT;
  function wake() {
    document.body.classList.remove("idle"); clearTimeout(idleT);
    idleT = setTimeout(() => {
      if (!panel.classList.contains("open") && !statsPanel.classList.contains("open") && shortcutsModal.hidden && completeEl.hidden) {
        document.body.classList.add("idle");
      }
    }, 3000);
  }
  addEventListener("mousemove", wake); wake();

  applyTheme(); fillSettings(); size(); render(); loadAssets(); updateStatsUI();
})();
