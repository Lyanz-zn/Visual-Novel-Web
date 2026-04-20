# 📖 PANDUAN — English Journey VN Engine

Panduan ini menjelaskan cara mengisi konten, menambah scene, dan mengatur quiz
tanpa perlu mengubah kode JavaScript.

---

## 📁 Struktur File

```
english-journey/
├── index.html          ← Halaman utama (jarang diubah)
├── style.css           ← Tampilan & warna (bisa dikustomisasi)
├── engine.js           ← Logika utama VN (jarang diubah)
├── quiz.js             ← Logika quiz (jarang diubah)
├── content/
│   └── main.json       ← KONTEN UTAMA — di sinilah kamu bekerja
└── assets/
    ├── bg_intro.jpg    ← Gambar background (taruh gambar kamu di sini)
    ├── bg_menu.jpg
    ├── bg_study.jpg
    └── bg_quiz.jpg
```

---

## 🖼️ Background

Taruh file gambar di folder `assets/`. Format yang didukung: `.jpg`, `.png`, `.webp`.

Di JSON, referensikan gambar dengan path relatif:
```json
"background": "assets/nama_file.jpg"
```

Jika tidak ada gambar, background akan menggunakan warna fallback (biru gelap).

---

## 📝 Struktur Scene

Setiap "scene" adalah satu tampilan dalam VN. Di JSON, semua scene ada di dalam
objek `"scenes"`.

### Struktur dasar:

```json
"id_scene_kamu": {
    "background": "assets/bg_study.jpg",
    "speaker": "Nama Karakter",
    "dialog": "Teks yang ditampilkan di kotak dialog.",
    "options": [
        { "label": "Teks tombol", "next": "id_scene_berikutnya" },
        { "label": "Tombol lain", "next": "id_scene_lain"       }
    ]
}
```

### Field yang tersedia:

| Field        | Wajib? | Keterangan |
|--------------|--------|------------|
| `background` | Tidak  | Path gambar background. Jika tidak ada, tetap memakai background scene sebelumnya. |
| `speaker`    | Tidak  | Nama karakter. Jika kosong `""`, nameplate tidak muncul (cocok untuk narasi). |
| `dialog`     | Ya     | Teks yang akan dianimasi typewriter. Gunakan `\n` untuk baris baru. |
| `options`    | Ya     | Array tombol pilihan (minimal 1). |
| `type`       | Tidak  | Isi `"quiz"` jika scene ini memulai quiz. |
| `quizId`     | Tidak  | ID quiz yang akan dijalankan (jika `type: "quiz"`). |
| `onComplete` | Tidak  | ID scene setelah quiz selesai (jika `type: "quiz"`). |

---

## 🔀 Cabang Dialog

Setiap scene bisa punya beberapa opsi yang mengarah ke scene berbeda:

```json
"pertanyaan_1": {
    "speaker": "Guide",
    "dialog": "Kamu lebih suka belajar apa?",
    "options": [
        { "label": "Grammar",    "next": "materi_grammar"    },
        { "label": "Vocabulary", "next": "materi_vocabulary" },
        { "label": "Keduanya",   "next": "materi_keduanya"   }
    ]
}
```

Tidak ada batasan kedalaman cabang. Setiap scene bisa bercabang lagi.

---

## 🚪 Tombol Keluar

Gunakan `"next": "EXIT"` pada opsi untuk memicu konfirmasi keluar:

```json
{ "label": "Keluar", "next": "EXIT" }
```

---

## ✏️ Scene Quiz

Untuk memulai quiz, buat scene dengan `"type": "quiz"`:

```json
"halaman_quiz": {
    "background": "assets/bg_quiz.jpg",
    "speaker": "",
    "dialog": "Siap untuk test? Soal akan diacak setiap sesi.",
    "type": "quiz",
    "quizId": "quiz_grammar",
    "onComplete": "main_menu"
}
```

Engine akan otomatis menampilkan tombol "Mulai Test!" setelah dialog selesai.
Setelah quiz selesai, user akan diarahkan ke scene `onComplete`.

---

## 🎯 Struktur Soal Quiz

Semua data quiz ada di dalam objek `"quizzes"` di JSON.

```json
"quizzes": {
    "id_quiz_kamu": {
        "title": "Judul Quiz",
        "shuffle": true,
        "onComplete": "main_menu",
        "questions": [
            {
                "question": "Teks pertanyaan?",
                "choices": [
                    "Pilihan A",
                    "Pilihan B",
                    "Pilihan C",
                    "Pilihan D"
                ],
                "correct": 1
            }
        ]
    }
}
```

### Nilai `"correct"`:
- `0` = A (pilihan pertama)
- `1` = B (pilihan kedua)
- `2` = C (pilihan ketiga)
- `3` = D (pilihan keempat)

### Field quiz:

| Field        | Keterangan |
|--------------|------------|
| `shuffle`    | `true` = acak urutan soal setiap sesi, `false` = urutan tetap |
| `onComplete` | ID scene setelah semua soal selesai |
| `questions`  | Array soal, bisa ditambah sebanyak yang diinginkan |

---

## ⚙️ Mengubah Kecepatan Typewriter

Buka `engine.js`, cari baris:
```javascript
typewriterSpeed: 30,
```

Ganti angkanya:
- `10`  → sangat cepat
- `30`  → normal (default)
- `60`  → pelan, dramatis
- `100` → sangat pelan

---

## 🎨 Mengubah Warna Tema

Buka `style.css`, cari bagian `:root { ... }` di bagian atas.
Semua warna tema ada di sana dalam format CSS variable.

---

## 🖥️ Cara Menjalankan

File ini **tidak bisa** dibuka langsung dengan double-click di browser karena
browser memblokir `fetch()` dari protokol `file://`.

Cara termudah adalah menggunakan server lokal:

**Python (sudah terinstall di Arch):**
```bash
cd /path/ke/english-journey
python -m http.server 8080
```
Lalu buka `http://localhost:8080` di browser.

**Alternatif lain:**
- VS Code dengan ekstensi "Live Server"
- `npx serve .`

---

## ➕ Menambah Scene Baru

1. Buka `content/main.json`
2. Di dalam objek `"scenes"`, tambahkan entry baru:
```json
"id_scene_baru": {
    "background": "assets/bg_study.jpg",
    "speaker": "Guide",
    "dialog": "Teks dialog baru kamu di sini.",
    "options": [
        { "label": "Oke", "next": "scene_selanjutnya" }
    ]
}
```
3. Pastikan `"next"` mengarah ke ID scene yang valid
4. Simpan file → refresh browser

> **Tips**: Gunakan nama ID yang deskriptif seperti `"grammar_present_rumus"`
> bukan `"scene_42"`. Ini akan memudahkan saat konten sudah banyak.

---

## 🐛 Troubleshooting

**Dialog tidak muncul / layar hitam:**
- Cek console browser (F12 → Console) untuk pesan error
- Pastikan server lokal berjalan (bukan `file://`)
- Validasi format JSON di https://jsonlint.com

**Scene tidak ditemukan:**
- Periksa ID scene di `"next"` sudah sama persis dengan ID di `"scenes"`
- JSON bersifat case-sensitive: `"Grammar_intro"` ≠ `"grammar_intro"`

**Gambar tidak muncul:**
- Pastikan file gambar ada di folder `assets/`
- Path di JSON harus sama persis dengan nama file
