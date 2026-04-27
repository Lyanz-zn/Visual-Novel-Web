const quizState = {
  questions: [],
  currentIndex: 0,
  score: 0,
  onCompleteScene: null,
  isWaiting: false,
};

function startQuiz(quizId, onCompleteScene) {
  const quizData = state.script.quizzes?.[quizId];

  if (!quizData) {
    console.error(`[Quiz] Quiz "${quizId}" tidak ditemukan di JSON!`);
    DOM.dialogText().textContent = `⚠️ Quiz "${quizId}" tidak ditemukan.`;
    return;
  }

  let questions = [...quizData.questions];

  if (quizData.shuffle) {
    questions = shuffleArray(questions);
  }

  quizState.questions = questions;
  quizState.currentIndex = 0;
  quizState.score = 0;
  quizState.onCompleteScene =
    onCompleteScene ?? quizData.onComplete ?? "main_menu";
  quizState.isWaiting = false;

  DOM.speakerWrap().style.visibility = "hidden";

  renderQuestion();
}

function renderQuestion() {
  const question = quizState.questions[quizState.currentIndex];
  const current = quizState.currentIndex + 1;
  const total = quizState.questions.length;

  clearOptions();

  const questionText = `[${current}/${total}]   ${question.question}`;

  typewriter(questionText, () => {
    renderChoices(question);
  });
}

function renderChoices(question) {
  const wrap = DOM.optionsWrap();
  const labels = ["A", "B", "C", "D"];

  wrap.innerHTML = "";

  question.choices.forEach((choiceText, index) => {
    const btn = document.createElement("button");
    btn.className = "option-btn quiz-choice";
    btn.textContent = `${labels[index]}.   ${choiceText}`;

    btn.addEventListener("click", () => {
      if (quizState.isWaiting) return;
      checkAnswer(index, question.correct);
    });

    wrap.appendChild(btn);
  });
}

function checkAnswer(selectedIndex, correctIndex) {
  quizState.isWaiting = true; // Kunci agar tidak bisa klik lagi

  const allButtons = DOM.optionsWrap().querySelectorAll(".quiz-choice");

  allButtons.forEach((btn, i) => {
    btn.disabled = true; // Nonaktifkan semua tombol
    if (i === correctIndex) {
      btn.classList.add("correct"); // Jawaban benar → hijau
    } else if (i === selectedIndex) {
      btn.classList.add("wrong"); // Pilihan salah user → merah
    }
  });

  const isCorrect = selectedIndex === correctIndex;
  if (isCorrect) quizState.score++;

  const labels = ["A", "B", "C", "D"];
  const feedback = isCorrect
    ? "✓   Benar! Bagus sekali."
    : `✗   Kurang tepat.   Jawaban yang benar adalah ${labels[correctIndex]}.`;

  cancelTyping();
  DOM.dialogText().textContent = feedback;
  DOM.textCursor().style.display = "none";

  setTimeout(() => {
    quizState.isWaiting = false;
    quizState.currentIndex++;

    if (quizState.currentIndex < quizState.questions.length) {
      renderQuestion();
    } else {
      showQuizResult();
    }
  }, 1500); // 1500ms = 1.5 detik
}

function showQuizResult() {
  const score = quizState.score;
  const total = quizState.questions.length;
  const percentage = Math.round((score / total) * 100);

  let message;
  if (percentage === 100) message = "Sempurna! Luar biasa! 🎉";
  else if (percentage >= 80) message = "Bagus sekali! Terus tingkatkan!";
  else if (percentage >= 60)
    message = "Lumayan! Masih ada ruang untuk berkembang.";
  else if (percentage >= 40) message = "Cukup, tapi bisa lebih baik lagi!";
  else message = "Jangan menyerah, pelajari lagi ya!";

  clearOptions();

  const resultText =
    `Hasil Quiz\n` +
    `──────────────────────\n` +
    `Benar  :  ${score} dari ${total} soal\n` +
    `Nilai  :  ${percentage}%\n\n` +
    `${message}`;

  typewriter(resultText, () => {
    const wrap = DOM.optionsWrap();
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = "↩   Kembali ke Menu Utama";

    btn.addEventListener("click", () => {
      state.inQuiz = false; // Tandai: mode quiz sudah berakhir
      state.history = []; // Reset history agar Rewind tidak mengarah ke hasil quiz
      renderScene(quizState.onCompleteScene);
    });

    wrap.appendChild(btn);
  });
}

function skipQuizTypewriter() {
  if (!state.isTyping || quizState.questions.length === 0) return;

  const question = quizState.questions[quizState.currentIndex];
  if (!question) return;

  cancelTyping();

  const current = quizState.currentIndex + 1;
  const total = quizState.questions.length;
  renderFull(`[${current}/${total}]   ${question.question}`);
  DOM.textCursor().style.display = "none"; // Kursor tidak perlu muncul di soal

  renderChoices(question);
}

function shuffleArray(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // Index acak antara 0 dan i
    [result[i], result[j]] = [result[j], result[i]]; // Tukar dua elemen
  }

  return result;
}
