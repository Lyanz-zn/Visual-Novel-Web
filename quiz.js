// ============================================================
// quiz.js — Modul Quiz Pilihan Ganda
// ============================================================
// Dipisah dari engine.js agar lebih mudah dikelola.
//
// File ini BERGANTUNG pada engine.js. Ia menggunakan:
//   • state         → objek state dari engine.js
//   • DOM           → referensi elemen dari engine.js
//   • typewriter()  → fungsi animasi dari engine.js
//   • cancelTyping()→ fungsi cancel animasi dari engine.js
//   • clearOptions()→ fungsi hapus opsi dari engine.js
//   • renderScene() → fungsi navigasi dari engine.js
//
// Karena itu, engine.js harus dimuat SEBELUM quiz.js di HTML.
// ============================================================


// ─────────────────────────────────────────────────────────────
// STATE QUIZ
// Menyimpan kondisi sesi quiz yang sedang berjalan.
// ─────────────────────────────────────────────────────────────
const quizState = {
  questions       : [],    // Array soal (sudah mungkin diacak)
  currentIndex    : 0,     // Index soal yang sedang ditampilkan (mulai dari 0)
  score           : 0,     // Jumlah jawaban yang benar
  onCompleteScene : null,  // ID scene yang ditampilkan setelah quiz selesai
  isWaiting       : false, // True saat jeda feedback (cegah klik ganda)
};


// ═════════════════════════════════════════════════════════════
// MULAI QUIZ
// Dipanggil dari engine.js saat user klik "Mulai Test!"
//
// Parameter:
//   quizId          → string, ID quiz di JSON (contoh: "quiz_grammar")
//   onCompleteScene → string, ID scene setelah quiz selesai
// ═════════════════════════════════════════════════════════════
function startQuiz(quizId, onCompleteScene) {

  // Ambil data quiz dari JSON berdasarkan ID
  const quizData = state.script.quizzes?.[quizId];

  if (!quizData) {
    console.error(`[Quiz] Quiz "${quizId}" tidak ditemukan di JSON!`);
    DOM.dialogText().textContent = `⚠️ Quiz "${quizId}" tidak ditemukan.`;
    return;
  }

  // Salin array soal menggunakan spread [...arr]
  // PENTING: jangan modifikasi array asli dari JSON
  let questions = [...quizData.questions];

  // Acak urutan soal jika "shuffle": true di JSON
  if (quizData.shuffle) {
    questions = shuffleArray(questions);
  }

  // Inisialisasi state quiz
  quizState.questions       = questions;
  quizState.currentIndex    = 0;
  quizState.score           = 0;
  quizState.onCompleteScene = onCompleteScene ?? quizData.onComplete ?? 'main_menu';
  quizState.isWaiting       = false;

  // Sembunyikan nameplate speaker selama quiz
  DOM.speakerWrap().style.visibility = 'hidden';

  // Tampilkan soal pertama
  renderQuestion();
}


// ═════════════════════════════════════════════════════════════
// TAMPILKAN PERTANYAAN
// Merender soal yang sedang aktif dengan animasi typewriter.
// ═════════════════════════════════════════════════════════════
function renderQuestion() {
  const question  = quizState.questions[quizState.currentIndex];
  const current   = quizState.currentIndex + 1;
  const total     = quizState.questions.length;

  // Kosongkan pilihan jawaban lama
  clearOptions();

  // Format label soal: [1/5]  Teks soal...
  const questionText = `[${current}/${total}]   ${question.question}`;

  // Animasikan soal → setelah selesai, tampilkan pilihan jawaban
  typewriter(questionText, () => {
    renderChoices(question);
  });
}


// ─────────────────────────────────────────────────────────────
// TAMPILKAN PILIHAN JAWABAN
// Membuat tombol A/B/C/D dari array "choices" pada soal.
// ─────────────────────────────────────────────────────────────
function renderChoices(question) {
  const wrap   = DOM.optionsWrap();
  const labels = ['A', 'B', 'C', 'D'];

  wrap.innerHTML = '';

  question.choices.forEach((choiceText, index) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn quiz-choice';
    btn.textContent = `${labels[index]}.   ${choiceText}`;

    btn.addEventListener('click', () => {
      // Abaikan klik jika engine sedang dalam jeda feedback
      if (quizState.isWaiting) return;
      checkAnswer(index, question.correct);
    });

    wrap.appendChild(btn);
  });
}


// ═════════════════════════════════════════════════════════════
// CEK JAWABAN
// Membandingkan pilihan user dengan jawaban benar,
// memberikan feedback visual, lalu lanjut ke soal berikutnya.
// ═════════════════════════════════════════════════════════════

// Parameter:
//   selectedIndex → index tombol yang diklik user (0-3)
//   correctIndex  → index jawaban benar dari JSON
function checkAnswer(selectedIndex, correctIndex) {
  quizState.isWaiting = true; // Kunci agar tidak bisa klik lagi

  // Warnai semua tombol berdasarkan benar/salah
  const allButtons = DOM.optionsWrap().querySelectorAll('.quiz-choice');

  allButtons.forEach((btn, i) => {
    btn.disabled = true; // Nonaktifkan semua tombol
    if (i === correctIndex) {
      btn.classList.add('correct');   // Jawaban benar → hijau
    } else if (i === selectedIndex) {
      btn.classList.add('wrong');     // Pilihan salah user → merah
    }
  });

  // Tambah skor jika jawaban benar
  const isCorrect = (selectedIndex === correctIndex);
  if (isCorrect) quizState.score++;

  // Tampilkan feedback di teks dialog
  const labels   = ['A', 'B', 'C', 'D'];
  const feedback = isCorrect
    ? '✓   Benar! Bagus sekali.'
    : `✗   Kurang tepat.   Jawaban yang benar adalah ${labels[correctIndex]}.`;

  // Batalkan typewriter yang mungkin masih berjalan, langsung ganti teks
  cancelTyping();
  DOM.dialogText().textContent = feedback;
  DOM.textCursor().style.display = 'none';

  // Jeda 1.5 detik sebelum soal berikutnya
  // Ini memberikan waktu user membaca feedback dan melihat pewarnaan tombol
  setTimeout(() => {
    quizState.isWaiting = false;
    quizState.currentIndex++;

    if (quizState.currentIndex < quizState.questions.length) {
      renderQuestion();   // Masih ada soal → tampilkan berikutnya
    } else {
      showQuizResult();   // Semua soal selesai → tampilkan hasil
    }
  }, 1500); // 1500ms = 1.5 detik
}


// ═════════════════════════════════════════════════════════════
// TAMPILKAN HASIL QUIZ
// Menampilkan skor akhir dan pesan berdasarkan persentase nilai.
// ═════════════════════════════════════════════════════════════
function showQuizResult() {
  const score      = quizState.score;
  const total      = quizState.questions.length;
  const percentage = Math.round((score / total) * 100);

  // Pilih pesan motivasi berdasarkan persentase nilai
  let message;
  if (percentage === 100) message = 'Sempurna! Luar biasa! 🎉';
  else if (percentage >= 80) message = 'Bagus sekali! Terus tingkatkan! 👍';
  else if (percentage >= 60) message = 'Lumayan! Masih ada ruang untuk berkembang.';
  else if (percentage >= 40) message = 'Cukup, tapi bisa lebih baik lagi!';
  else                       message = 'Jangan menyerah, pelajari lagi ya!';

  clearOptions();

  // Format teks hasil
  // \n membuat baris baru (karena dialog-text memakai white-space: pre-wrap)
  const resultText =
    `Hasil Quiz\n` +
    `──────────────────────\n` +
    `Benar  :  ${score} dari ${total} soal\n` +
    `Nilai  :  ${percentage}%\n\n` +
    `${message}`;

  typewriter(resultText, () => {
    // Buat tombol kembali ke menu secara manual
    // (tidak melalui showOptions karena butuh aksi khusus: reset inQuiz)
    const wrap = DOM.optionsWrap();
    const btn  = document.createElement('button');
    btn.className   = 'option-btn';
    btn.textContent = '↩   Kembali ke Menu Utama';

    btn.addEventListener('click', () => {
      state.inQuiz   = false; // Tandai: mode quiz sudah berakhir
      state.history  = [];    // Reset history agar Rewind tidak mengarah ke hasil quiz
      renderScene(quizState.onCompleteScene);
    });

    wrap.appendChild(btn);
  });
}


// ─────────────────────────────────────────────────────────────
// UTILITY: Fisher-Yates Shuffle
// Mengacak urutan elemen dalam array secara acak yang adil.
// Tidak memodifikasi array asli (menggunakan spread copy).
// ─────────────────────────────────────────────────────────────
function shuffleArray(array) {
  const result = [...array]; // Salin array agar aslinya tidak berubah

  // Algoritma Fisher-Yates:
  // Mulai dari elemen terakhir, tukar dengan elemen di posisi acak sebelumnya
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // Index acak antara 0 dan i
    [result[i], result[j]] = [result[j], result[i]]; // Tukar dua elemen
  }

  return result;
}
