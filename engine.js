// ============================================================
// engine.js — Inti dari Visual Novel Engine
// ============================================================
// File ini bertanggung jawab atas:
//   • Memuat file script (main.json) dari server
//   • Merender setiap scene: background, speaker, dialog
//   • Animasi typewriter pada teks dialog
//   • Navigasi maju (klik opsi) dan mundur (tombol Rewind)
//   • Menampilkan dan menghapus tombol opsi
//   • Memanggil quiz.js saat ada scene bertipe "quiz"
// ============================================================


// ─────────────────────────────────────────────────────────────
// KONFIGURASI
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  // Kecepatan typewriter dalam milidetik per karakter.
  // 10  = sangat cepat
  // 30  = normal (default)
  // 60  = pelan, dramatis
  typewriterSpeed: 30,

  // Path ke file JSON yang berisi semua scene dan quiz.
  // Ganti jika nama atau lokasi file berbeda.
  scriptPath: 'content/main.json',

  // ID scene pertama yang ditampilkan saat halaman dibuka.
  // Bisa di-override lewat field "startScene" di config JSON.
  startScene: 'intro',
};


// ─────────────────────────────────────────────────────────────
// STATE ENGINE
// Variabel yang merekam kondisi engine saat runtime.
// Jangan ubah langsung dari luar, gunakan fungsi yang tersedia.
// ─────────────────────────────────────────────────────────────
const state = {
  script        : null,   // Data JSON yang sudah di-parse menjadi objek JS
  currentSceneId: null,   // ID scene yang sedang ditampilkan
  history       : [],     // Stack (tumpukan) ID scene sebelumnya → untuk Rewind
  isTyping      : false,  // True jika animasi typewriter sedang berjalan
  typingTimer   : null,   // Referensi ID dari setTimeout (agar bisa di-cancel)
  inQuiz        : false,  // True jika engine sedang dalam mode quiz
  dialogIndex   : 0,      // Index dialog yang sedang aktif di dalam array dialog scene
};


// ─────────────────────────────────────────────────────────────
// REFERENSI DOM
// Getter function agar elemen selalu diambil fresh dari DOM.
// Alasan: lebih aman daripada menyimpan referensi di awal,
// karena elemen bisa diganti/dihapus secara dinamis.
// ─────────────────────────────────────────────────────────────
const DOM = {
  bg          : () => document.getElementById('vn-bg'),
  grain       : () => document.getElementById('vn-grain'),
  speakerWrap : () => document.getElementById('speaker-name-wrap'),
  speakerName : () => document.getElementById('speaker-name'),
  textBox     : () => document.getElementById('text-box'),
  dialogText  : () => document.getElementById('dialog-text'),
  textCursor  : () => document.getElementById('text-cursor'),
  optionsWrap : () => document.getElementById('options-wrap'),
  backBtn     : () => document.getElementById('back-btn'),
};


// ═════════════════════════════════════════════════════════════
// INISIALISASI
// Dipanggil sekali saat halaman selesai dimuat (DOMContentLoaded).
// ═════════════════════════════════════════════════════════════
async function init() {
  try {
    // fetch() mengambil file dari server secara asynchronous.
    // 'await' artinya: tunggu hingga file selesai diunduh sebelum lanjut.
    const response = await fetch(CONFIG.scriptPath);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} — Gagal mengambil "${CONFIG.scriptPath}"`);
    }

    // Ubah teks JSON menjadi objek JavaScript
    state.script = await response.json();

    // Pasang event listener pada tombol Rewind
    DOM.backBtn().addEventListener('click', goBack);

    // Klik pada text box → skip animasi typewriter
    DOM.textBox().addEventListener('click', handleTextBoxClick);

    // Tentukan scene awal:
    // Pakai "startScene" dari JSON jika ada, fallback ke CONFIG.startScene
    const startScene = state.script.config?.startScene ?? CONFIG.startScene;
    renderScene(startScene);

  } catch (err) {
    // Tampilkan pesan error yang informatif di dialog text
    console.error('[Engine] Gagal inisialisasi:', err);
    DOM.dialogText().textContent =
      `⚠️  Gagal memuat script.\n\nError: ${err.message}\n\nPastikan:\n• File "${CONFIG.scriptPath}" ada\n• Format JSON valid (cek dengan JSONLint)\n• Server lokal berjalan (bukan file:// langsung)`;
  }
}


// ═════════════════════════════════════════════════════════════
// RENDER SCENE
// Fungsi utama: mengambil data satu scene dari JSON,
// lalu menerapkannya ke UI (background, speaker, dialog, opsi).
// ═════════════════════════════════════════════════════════════

// Render scene DENGAN menambahkan scene saat ini ke history stack.
// Gunakan ini untuk navigasi maju normal (klik opsi).
function renderScene(sceneId) {
  const scene = state.script.scenes?.[sceneId];

  if (!scene) {
    console.error(`[Engine] Scene "${sceneId}" tidak ditemukan di JSON!`);
    DOM.dialogText().textContent = `⚠️ Scene "${sceneId}" tidak ditemukan.`;
    return;
  }

  // Simpan scene saat ini ke history (kecuali saat render pertama)
  if (state.currentSceneId !== null) {
    state.history.push(state.currentSceneId);
  }
  state.currentSceneId = sceneId;

  _applyScene(scene);
}

// Render scene TANPA menambahkan ke history.
// Digunakan khusus oleh tombol Rewind agar tidak membuat loop.
function renderSceneDirect(sceneId) {
  const scene = state.script.scenes?.[sceneId];
  if (!scene) return;

  state.currentSceneId = sceneId;
  _applyScene(scene);
}


// Fungsi internal: menerapkan semua elemen scene ke UI.
// Tidak perlu dipanggil dari luar, gunakan renderScene() atau renderSceneDirect().
function _applyScene(scene) {
  // Batalkan animasi yang mungkin masih berjalan
  cancelTyping();

  // Bersihkan opsi lama
  clearOptions();

  if (scene.hideUI) {
document.body.classList.add('no-ui');
} else {
  document.body.classList.remove('no-ui');
}

// Mengambil kode dari S-hafidz
const cards = document.querySelectorAll(".card");

// Mengambil kode dari main
// Reset index dialog ke awal scene
state.dialogIndex = 0;

// reset semua card
cards.forEach(c => c.classList.add("hidden"));

if (scene.layout === "card") {
  document.body.classList.add("no-ui");

  const card1 = document.getElementById("about-card-1");
  const card2 = document.getElementById("about-card-2");

  if (card1) card1.classList.remove("hidden");
  if (card2) card2.classList.remove("hidden");

  showOptions(scene.options ?? []);
  return;


  // 🔥 langsung tampilkan opsi (biar tombol muncul)
  showOptions(scene.options ?? []);
  return; // ❗ PENTING: stop di sini
}
  // Reset flag quiz & perbarui tombol Rewind
  state.inQuiz = false;
  updateRewindBtn();

  // ── Ganti background ──
  if (scene.background) {
    setBackground(scene.background);
  }

  // ── Set nama speaker ──
  // Jika kosong (''), nameplate disembunyikan (narasi)
  setSpeaker(scene.speaker ?? '');

  // ── Cek tipe scene ──
  if (scene.type === 'quiz') {
    // Scene quiz: ambil baris pertama dialog, animasikan, lalu tombol "Mulai Test!"
    const lines = getDialogLines(scene);
    renderDialogLine(lines, 0, () => {
      showOptions([{ label: '✏️   Mulai Test!', _isQuizStart: true }], scene);
    });
    return;
  }

  // ── Scene biasa: mulai dari baris dialog index 0 ──
  // ── Scene biasa ──
  const lines = getDialogLines(scene);

  if (scene.hideUI) {
      // Jika UI disembunyikan, langsung munculkan opsi tanpa animasi teks
      showOptions(scene.options ?? []);
  } else {
      // Jika UI ada, ketik dulu baru munculkan opsi
      renderDialogLine(lines, 0, () => {
          showOptions(scene.options ?? []);
      });
  }
}

// ─────────────────────────────────────────────────────────────
// NORMALISASI DIALOG
// Memastikan field "dialog" selalu berupa array of strings,
// apapun formatnya di JSON.
//
// Format yang didukung:
//   String tunggal → dibungkus jadi array 1 elemen (kompatibilitas mundur)
//   Array of strings → langsung dipakai
//
// Contoh:
//   "dialog": "Halo!"              → ["Halo!"]
//   "dialog": ["Halo!", "Apa kabar?"] → ["Halo!", "Apa kabar?"]
// ─────────────────────────────────────────────────────────────
function getDialogLines(scene) {
  const raw = scene.dialog;
  if (!raw) return [''];
  return Array.isArray(raw) ? raw : [raw];
}

// ─────────────────────────────────────────────────────────────
// RENDER SATU BARIS DIALOG
// Menampilkan teks pada index tertentu dengan animasi typewriter.
// Setelah selesai (typewriter tuntas), kursor berkedip muncul.
// Klik selanjutnya ditangani oleh handleTextBoxClick().
//
// Parameter:
//   lines      → array string hasil getDialogLines()
//   index      → index baris yang akan ditampilkan sekarang
//   onFinished → fungsi yang dipanggil setelah SEMUA baris habis
//                (yaitu saat opsi harus ditampilkan)
// ─────────────────────────────────────────────────────────────
function renderDialogLine(lines, index, onFinished) {
  state.dialogIndex = index;

  const text = lines[index] ?? '';
  const isLast = (index === lines.length - 1);

  typewriter(text, () => {
    // Typewriter selesai → kursor muncul
    // Jika ini baris terakhir, onFinished (tampilkan opsi) dipanggil
    // SETELAH user klik lagi — bukan otomatis langsung.
    // Logika lanjutnya ada di handleTextBoxClick().
    if (isLast) {
      // Simpan callback agar bisa dipanggil saat klik berikutnya
      state._pendingFinish = onFinished;
    }
  });

  // Simpan referensi untuk digunakan handleTextBoxClick
  state._dialogLines    = lines;
  state._onDialogFinish = onFinished;
}


// ═════════════════════════════════════════════════════════════
// TYPEWRITER EFFECT
// Menampilkan teks karakter per karakter untuk efek mesin ketik.
// ═════════════════════════════════════════════════════════════

function tokenize(text) {
  const tokens = [];
  const pattern = /\*\*\*([\s\S]+?)\*\*\*|\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*/gs;

  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index), bold: false, italic: false });
    }

    if      (match[1] !== undefined) tokens.push({ text: match[1], bold: true,  italic: true  });
    else if (match[2] !== undefined) tokens.push({ text: match[2], bold: true,  italic: false });
    else if (match[3] !== undefined) tokens.push({ text: match[3], bold: false, italic: true  });

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex), bold: false, italic: false });
  }

  return tokens;
}

// Buat elemen DOM dari satu token
function createTokenNode(token) {
  if (!token.bold && !token.italic) {
    return document.createTextNode(token.text);
  }
  if (token.bold && token.italic) {
    const strong = document.createElement('strong');
    const em = document.createElement('em');
    em.textContent = token.text;
    strong.appendChild(em);
    return strong;
  }
  const el = document.createElement(token.bold ? 'strong' : 'em');
  el.textContent = token.text;
  return el;
}

// Render teks penuh sekaligus tanpa animasi (dipakai saat skip)
function renderFull(text) {
  const el = DOM.dialogText();
  el.innerHTML = '';
  tokenize(text).forEach(token => el.appendChild(createTokenNode(token)));
}

// Parameter:
//   text       → string yang akan dianimasikan
//   onComplete → fungsi yang dipanggil setelah semua karakter muncul
function typewriter(text, onComplete) {
  const el = DOM.dialogText();
  el.innerHTML = '';
  DOM.textCursor().style.display = 'none';

  const tokens = tokenize(text);
  state.isTyping = true;

  let tokenIndex = 0;
  let charIndex  = 0;
  let currentNode = null;

  function tick() {
    // Lewati token kosong
    while (tokenIndex < tokens.length && tokens[tokenIndex].text.length === 0) {
      tokenIndex++;
    }

    if (tokenIndex >= tokens.length) {
      state.isTyping = false;
      DOM.textCursor().style.display = 'inline';
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    const token = tokens[tokenIndex];

    // Buat node DOM baru di karakter pertama setiap token
    if (charIndex === 0) {
      currentNode = createTokenNode({ ...token, text: '' });
      el.appendChild(currentNode);
    }

    // Tambah satu karakter ke node aktif
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
// Membatalkan animasi typewriter yang sedang berjalan.
// Dipanggil saat user klik untuk skip, atau saat pindah scene.
function cancelTyping() {
  if (state.typingTimer) {
    clearTimeout(state.typingTimer);  // Batalkan setTimeout yang terjadwal
    state.typingTimer = null;
  }
  state.isTyping = false;
}

// Handler klik pada text box.
// Logika dua langkah:
//
//   LANGKAH 1 — Typewriter masih berjalan:
//     → Batalkan animasi, cetak teks penuh sekaligus, tampilkan kursor.
//     → Klik berikutnya akan masuk ke Langkah 2.
//
//   LANGKAH 2 — Typewriter sudah selesai (kursor berkedip):
//     → Jika masih ada baris dialog berikutnya → render baris itu.
//     → Jika ini baris terakhir → panggil _onDialogFinish (tampilkan opsi).
function handleTextBoxClick() {
  // Delegasikan ke quiz jika sedang dalam mode quiz
  if (state.inQuiz) {
    if (state.isTyping) skipQuizTypewriter();
    return;
  }

  const lines = state._dialogLines;
  if (!lines) return;

  // ── LANGKAH 1: skip typewriter yang sedang berjalan ──
  if (state.isTyping) {
    cancelTyping();
    renderFull(lines[state.dialogIndex] ?? '');
    DOM.textCursor().style.display = 'inline';
    return; // Klik berikutnya tangani di Langkah 2
  }

  // ── LANGKAH 2: typewriter sudah selesai, tentukan aksi berikutnya ──
  const nextIndex = state.dialogIndex + 1;

  if (nextIndex < lines.length) {
    // Masih ada baris → maju ke baris berikutnya
    renderDialogLine(lines, nextIndex, state._onDialogFinish);
  } else {
    // Semua baris sudah habis → panggil callback (tampilkan opsi)
    if (typeof state._onDialogFinish === 'function') {
      // Sembunyikan kursor sebelum opsi muncul
      DOM.textCursor().style.display = 'none';
      state._onDialogFinish();
      state._onDialogFinish = null; // Bersihkan agar tidak dipanggil dua kali
    }
  }
}


// ═════════════════════════════════════════════════════════════
// TAMPILKAN OPSI
// Membuat tombol-tombol pilihan secara dinamis dari data JSON.
// ═════════════════════════════════════════════════════════════

// Parameter:
//   options   → array opsi: [{ label, next }, ...]
//   sceneCtx  → (opsional) data scene saat ini, diperlukan untuk quiz
function showOptions(options, sceneCtx = null) {
  const wrap = DOM.optionsWrap();
  wrap.innerHTML = ''; // Hapus tombol lama

  if (!options || options.length === 0) return;

  options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt.label;

    btn.addEventListener('click', () => {

      // ── Kasus: Keluar dari aplikasi ──
      if (opt.next === 'EXIT') {
        handleExit();
        return;
      }

      // ── Kasus: Mulai Quiz ──
      // Tombol ini dibuat engine jika scene bertipe "quiz"
      if (opt._isQuizStart && sceneCtx) {
        clearOptions();
        state.inQuiz = true;
        updateRewindBtn(); // Disable Rewind selama quiz
        // startQuiz() didefinisikan di quiz.js
        startQuiz(sceneCtx.quizId, sceneCtx.onComplete);
        return;
      }

      // ── Kasus: Pindah ke scene lain ──
      if (opt.next) {
        renderScene(opt.next);
      }
    });

    wrap.appendChild(btn);
  });
}

// Menghapus semua tombol opsi dari layar
function clearOptions() {
  DOM.optionsWrap().innerHTML = '';
}


// ═════════════════════════════════════════════════════════════
// TOMBOL REWIND (KEMBALI 1 LANGKAH)
// ═════════════════════════════════════════════════════════════
function goBack() {
  // Tidak bisa rewind jika sedang di scene pertama atau sedang quiz
  if (state.history.length === 0 || state.inQuiz) return;

  // Ambil (pop) scene terakhir dari tumpukan history
  const previousSceneId = state.history.pop();

  // Render scene itu tanpa menambah history lagi
  renderSceneDirect(previousSceneId);
  updateRewindBtn();
}

// Perbarui tampilan tombol Rewind (aktif/nonaktif)
function updateRewindBtn() {
  const shouldDisable = state.history.length === 0 || state.inQuiz;
  DOM.backBtn().disabled = shouldDisable;
}


// ═════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// Fungsi kecil yang dipakai di banyak tempat
// ═════════════════════════════════════════════════════════════

// Mengganti gambar background
// path → string URL gambar, misalnya: 'assets/bg_intro.jpg'
function setBackground(path) {
  DOM.bg().style.backgroundImage = `url('${path}')`;
}

// Mengatur nama speaker di nameplate
// Jika name kosong (''), nameplate disembunyikan
function setSpeaker(name) {
  DOM.speakerName().textContent = name;
  DOM.speakerWrap().style.visibility = name ? 'visible' : 'hidden';

  // Atur sudut kiri atas text box:
  // Jika ada speaker → menyatu (sudut rata) | Jika tidak → rounded normal
  if (name) {
    DOM.textBox().classList.remove('no-speaker');
  } else {
    DOM.textBox().classList.add('no-speaker');
  }
}

// Menambah gambar karakter (untuk digunakan nanti)
// Jika src kosong, sembunyikan area karakter
function setCharacter(src) {
  const area = document.getElementById('char-area');
  const placeholder = document.getElementById('char-placeholder');

  if (!src) {
    area.style.visibility = 'hidden';
    return;
  }

  area.style.visibility = 'visible';
  placeholder.innerHTML = `<img src="${src}" alt="Character">`;
}

// Konfirmasi sebelum menutup/reload
function handleExit() {
  if (confirm('Yakin ingin keluar dari English Journey?')) {
    // location.reload() → kembali ke awal (refresh halaman)
    // Ganti dengan window.close() jika dijalankan di Electron
    location.reload();
  }
}


// ─────────────────────────────────────────────────────────────
// JALANKAN ENGINE
// DOMContentLoaded memastikan semua elemen HTML sudah ada
// di halaman sebelum engine mencoba mengaksesnya.
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
