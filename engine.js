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
    // Scene quiz: tampilkan dialog intro → lalu tombol "Mulai Test!"
    // Data quizId dan onComplete ada di scene JSON
    typewriter(scene.dialog ?? 'Siap untuk test?', () => {
      // Tombol khusus yang menandai _isQuizStart untuk handler di showOptions
      showOptions([{ label: '✏️   Mulai Test!', _isQuizStart: true }], scene);
    });
    return;
  }

  // ── Scene biasa: tampilkan dialog → lalu opsi ──
  typewriter(scene.dialog ?? '', () => {
    showOptions(scene.options ?? []);
  });
}


// ═════════════════════════════════════════════════════════════
// TYPEWRITER EFFECT
// Menampilkan teks karakter per karakter untuk efek mesin ketik.
// ═════════════════════════════════════════════════════════════

// Parameter:
//   text       → string yang akan dianimasikan
//   onComplete → fungsi yang dipanggil setelah semua karakter muncul
function typewriter(text, onComplete) {
  const el = DOM.dialogText();

  // Kosongkan teks sebelumnya & sembunyikan kursor
  el.textContent = '';
  DOM.textCursor().style.display = 'none';

  state.isTyping = true;
  let charIndex = 0;

  // Fungsi rekursif: munculkan 1 karakter, jadwalkan karakter berikutnya
  function tick() {
    if (charIndex < text.length) {
      // Tambahkan satu karakter ke teks yang sudah ada
      el.textContent += text[charIndex];
      charIndex++;
      // setTimeout: jalankan tick() lagi setelah CONFIG.typewriterSpeed ms
      state.typingTimer = setTimeout(tick, CONFIG.typewriterSpeed);
    } else {
      // Semua karakter sudah muncul → animasi selesai
      state.isTyping = false;
      DOM.textCursor().style.display = 'inline';  // Tampilkan kursor berkedip
      if (typeof onComplete === 'function') onComplete();
    }
  }

  tick(); // Mulai animasi
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

// Handler klik pada text box:
// Jika typewriter masih berjalan → langsung tampilkan teks penuh (skip).
// Jika sudah selesai → tidak melakukan apa-apa.
function handleTextBoxClick() {
  if (!state.isTyping) return;

  const scene = state.script.scenes?.[state.currentSceneId];
  if (!scene) return;

  cancelTyping();

  // Langsung tampilkan seluruh teks sekaligus
  DOM.dialogText().textContent = scene.dialog ?? '';
  DOM.textCursor().style.display = 'inline';

  // Tampilkan opsi yang sesuai
  if (scene.type === 'quiz') {
    showOptions([{ label: '✏️   Mulai Test!', _isQuizStart: true }], scene);
  } else {
    showOptions(scene.options ?? []);
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
