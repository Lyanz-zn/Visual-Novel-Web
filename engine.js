const CONFIG = {
  typewriterSpeed: 20,

  scriptPath: "content/main.json",

  startScene: "intro",
};

const state = {
  script: null,
  currentSceneId: null,
  history: [],
  isTyping: false,
  typingTimer: null,
  inQuiz: false,
  dialogIndex: 0,
};

const DOM = {
  bg: () => document.getElementById("vn-bg"),
  grain: () => document.getElementById("vn-grain"),
  speakerWrap: () => document.getElementById("speaker-name-wrap"),
  speakerName: () => document.getElementById("speaker-name"),
  textBox: () => document.getElementById("text-box"),
  dialogText: () => document.getElementById("dialog-text"),
  textCursor: () => document.getElementById("text-cursor"),
  optionsWrap: () => document.getElementById("options-wrap"),
  backBtn: () => document.getElementById("back-btn"),
};

async function init() {
  try {
    const response = await fetch(CONFIG.scriptPath);

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} — Gagal mengambil "${CONFIG.scriptPath}"`,
      );
    }

    state.script = await response.json();

    DOM.backBtn().addEventListener("click", goBack);

    DOM.textBox().addEventListener("click", handleTextBoxClick);

    const startScene = state.script.config?.startScene ?? CONFIG.startScene;
    renderScene(startScene);
  } catch (err) {
    console.error("[Engine] Gagal inisialisasi:", err);
    DOM.dialogText().textContent = `⚠️  Gagal memuat script.\n\nError: ${err.message}\n\nPastikan:\n• File "${CONFIG.scriptPath}" ada\n• Format JSON valid (cek dengan JSONLint)\n• Server lokal berjalan (bukan file:// langsung)`;
  }
}

function renderScene(sceneId) {
  const scene = state.script.scenes?.[sceneId];

  if (!scene) {
    console.error(`[Engine] Scene "${sceneId}" tidak ditemukan di JSON!`);
    DOM.dialogText().textContent = `⚠️ Scene "${sceneId}" tidak ditemukan.`;
    return;
  }

  if (state.currentSceneId !== null) {
    state.history.push(state.currentSceneId);
  }
  state.currentSceneId = sceneId;

  _applyScene(scene);
}

function renderSceneDirect(sceneId) {
  const scene = state.script.scenes?.[sceneId];
  if (!scene) return;

  state.currentSceneId = sceneId;
  _applyScene(scene);
}

function _applyScene(scene) {
  cancelTyping();

  clearOptions();

  if (scene.hideUI) {
    document.body.classList.add("no-ui");
  } else {
    document.body.classList.remove("no-ui");
  }

  const cards = document.querySelectorAll(".card");

  state.dialogIndex = 0;

  cards.forEach((c) => c.classList.add("hidden"));

  if (scene.layout === "card") {
    document.body.classList.add("no-ui");

    const card1 = document.getElementById("about-card-1");
    const card2 = document.getElementById("about-card-2");

    if (card1) card1.classList.remove("hidden");
    if (card2) card2.classList.remove("hidden");

    showOptions(scene.options ?? []);
    return;

    showOptions(scene.options ?? []);
    return; // ❗ PENTING: stop di sini
  }
  state.inQuiz = false;
  updateRewindBtn();

  if (scene.background) {
    setBackground(scene.background);
  }

  setSpeaker(scene.speaker ?? "");

  if (scene.type === "quiz") {
    const lines = getDialogLines(scene);
    renderDialogLine(lines, 0, () => {
      showOptions([{ label: "✏️   Mulai Test!", _isQuizStart: true }], scene);
    });
    return;
  }

  const lines = getDialogLines(scene);

  if (scene.hideUI) {
    showOptions(scene.options ?? []);
  } else {
    renderDialogLine(lines, 0, () => {
      showOptions(scene.options ?? []);
    });
  }
}

function getDialogLines(scene) {
  const raw = scene.dialog;
  if (!raw) return [""];
  return Array.isArray(raw) ? raw : [raw];
}

function renderDialogLine(lines, index, onFinished) {
  state.dialogIndex = index;

  const text = lines[index] ?? "";
  const isLast = index === lines.length - 1;

  typewriter(text, () => {
    if (isLast) {
      state._pendingFinish = onFinished;
    }
  });

  state._dialogLines = lines;
  state._onDialogFinish = onFinished;
}

function tokenize(text) {
  const tokens = [];
  const pattern = /\*\*\*([\s\S]+?)\*\*\*|\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*/gs;

  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: text.slice(lastIndex, match.index),
        bold: false,
        italic: false,
      });
    }

    if (match[1] !== undefined)
      tokens.push({ text: match[1], bold: true, italic: true });
    else if (match[2] !== undefined)
      tokens.push({ text: match[2], bold: true, italic: false });
    else if (match[3] !== undefined)
      tokens.push({ text: match[3], bold: false, italic: true });

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex), bold: false, italic: false });
  }

  return tokens;
}

function createTokenNode(token) {
  if (!token.bold && !token.italic) {
    return document.createTextNode(token.text);
  }
  if (token.bold && token.italic) {
    const strong = document.createElement("strong");
    const em = document.createElement("em");
    em.textContent = token.text;
    strong.appendChild(em);
    return strong;
  }
  const el = document.createElement(token.bold ? "strong" : "em");
  el.textContent = token.text;
  return el;
}

function renderFull(text) {
  const el = DOM.dialogText();
  el.innerHTML = "";
  tokenize(text).forEach((token) => el.appendChild(createTokenNode(token)));
}

function typewriter(text, onComplete) {
  const el = DOM.dialogText();
  el.innerHTML = "";
  DOM.textCursor().style.display = "none";

  const tokens = tokenize(text);
  state.isTyping = true;

  let tokenIndex = 0;
  let charIndex = 0;
  let currentNode = null;

  function tick() {
    while (tokenIndex < tokens.length && tokens[tokenIndex].text.length === 0) {
      tokenIndex++;
    }

    if (tokenIndex >= tokens.length) {
      state.isTyping = false;
      DOM.textCursor().style.display = "inline";
      if (typeof onComplete === "function") onComplete();
      return;
    }

    const token = tokens[tokenIndex];

    if (charIndex === 0) {
      currentNode = createTokenNode({ ...token, text: "" });
      el.appendChild(currentNode);
    }

    if (currentNode.nodeType === Node.TEXT_NODE) {
      currentNode.nodeValue += token.text[charIndex];
    } else if (token.bold && token.italic) {
      currentNode.firstChild.textContent += token.text[charIndex];
    } else {
      currentNode.textContent += token.text[charIndex];
    }

    charIndex++;

    if (charIndex >= token.text.length) {
      tokenIndex++;
      charIndex = 0;
    }

    state.typingTimer = setTimeout(tick, CONFIG.typewriterSpeed);
  }

  tick();
}
function cancelTyping() {
  if (state.typingTimer) {
    clearTimeout(state.typingTimer); // Batalkan setTimeout yang terjadwal
    state.typingTimer = null;
  }
  state.isTyping = false;
}

function handleTextBoxClick() {
  if (state.inQuiz) {
    if (state.isTyping) skipQuizTypewriter();
    return;
  }

  const lines = state._dialogLines;
  if (!lines) return;

  if (state.isTyping) {
    cancelTyping();
    renderFull(lines[state.dialogIndex] ?? "");
    DOM.textCursor().style.display = "inline";
    return; // Klik berikutnya tangani di Langkah 2
  }

  const nextIndex = state.dialogIndex + 1;

  if (nextIndex < lines.length) {
    renderDialogLine(lines, nextIndex, state._onDialogFinish);
  } else {
    if (typeof state._onDialogFinish === "function") {
      DOM.textCursor().style.display = "none";
      state._onDialogFinish();
      state._onDialogFinish = null; // Bersihkan agar tidak dipanggil dua kali
    }
  }
}

function showOptions(options, sceneCtx = null) {
  const wrap = DOM.optionsWrap();
  wrap.innerHTML = ""; // Hapus tombol lama

  if (!options || options.length === 0) return;

  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt.label;

    btn.addEventListener("click", () => {
      if (opt.next === "EXIT") {
        handleExit();
        return;
      }

      if (opt._isQuizStart && sceneCtx) {
        clearOptions();
        state.inQuiz = true;
        updateRewindBtn(); // Disable Rewind selama quiz
        startQuiz(sceneCtx.quizId, sceneCtx.onComplete);
        return;
      }

      if (opt.next) {
        renderScene(opt.next);
      }
    });

    wrap.appendChild(btn);
  });
}

function clearOptions() {
  DOM.optionsWrap().innerHTML = "";
}

function goBack() {
  if (state.history.length === 0 || state.inQuiz) return;

  const previousSceneId = state.history.pop();

  renderSceneDirect(previousSceneId);
  updateRewindBtn();
}

function updateRewindBtn() {
  const shouldDisable = state.history.length === 0 || state.inQuiz;
  DOM.backBtn().disabled = shouldDisable;
}

function setBackground(path) {
  DOM.bg().style.backgroundImage = `url('${path}')`;
}

function setSpeaker(name) {
  DOM.speakerName().textContent = name;
  DOM.speakerWrap().style.visibility = name ? "visible" : "hidden";

  if (name) {
    DOM.textBox().classList.remove("no-speaker");
  } else {
    DOM.textBox().classList.add("no-speaker");
  }
}

function setCharacter(src) {
  const area = document.getElementById("char-area");
  const placeholder = document.getElementById("char-placeholder");

  if (!src) {
    area.style.visibility = "hidden";
    return;
  }

  area.style.visibility = "visible";
  placeholder.innerHTML = `<img src="${src}" alt="Character">`;
}

function handleExit() {
  if (confirm("Yakin ingin keluar dari English Journey?")) {
    location.reload();
  }
}

document.addEventListener("DOMContentLoaded", init);
