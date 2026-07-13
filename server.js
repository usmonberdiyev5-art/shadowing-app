// server.js — Shadowing for English backend
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { loadData, saveData } = require('./db');

// Admin paroli — Railway'da "Variables" bo'limida ADMIN_PASSWORD environment variable sifatida sozlanadi
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'usmon123';

function requireAdmin(req, res, next) {
  const provided = req.headers['x-admin-password'];
  if (provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Admin paroli noto\'g\'ri' });
  }
  next();
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Yuklangan fayllarni ochiq qilish (audio/video pleer uchun)
// DATA_DIR muhit o'zgaruvchisi orqali doimiy saqlash joyi belgilanadi (Railway Volume uchun)
const DATA_DIR = process.env.DATA_DIR || __dirname;
const uploadsDir = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Frontend fayllarini xizmat qilish (index.html, style.css, app.js)
// Kesh muammolarining oldini olish uchun har doim eng yangi versiya yuboriladi
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// --- Fayl yuklash sozlamalari (multer) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 300 * 1024 * 1024 } }); // 300MB gacha
const uploadFields = upload.fields([{ name: 'media', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]);

// ============ API ROUTES ============

// 0) Admin parolini tekshirish (frontend uchun)
app.post('/api/admin/check', requireAdmin, (req, res) => {
  res.json({ success: true });
});

// 1) Yangi dars (lesson) yaratish: media fayl + transcript JSON + ixtiyoriy rasm
app.post('/api/lessons', requireAdmin, uploadFields, (req, res) => {
  try {
    const { title, transcript } = req.body;
    const mediaFile = req.files && req.files.media ? req.files.media[0] : null;
    const thumbFile = req.files && req.files.thumbnail ? req.files.thumbnail[0] : null;

    if (!mediaFile || !title || !transcript) {
      return res.status(400).json({ error: 'title, media va transcript majburiy' });
    }

    const lines = JSON.parse(transcript); // [{start_time, end_time, text, translation}, ...]
    const mediaType = mediaFile.mimetype.startsWith('video') ? 'video' : 'audio';

    const data = loadData();

    const lessonId = data.nextLessonId++;
    data.lessons.push({
      id: lessonId,
      title,
      media_filename: mediaFile.filename,
      media_type: mediaType,
      thumbnail_filename: thumbFile ? thumbFile.filename : null,
      created_at: new Date().toISOString()
    });

    for (const line of lines) {
      data.transcript_lines.push({
        id: data.nextLineId++,
        lesson_id: lessonId,
        start_time: line.start_time,
        end_time: line.end_time,
        text: line.text,
        translation: line.translation || null
      });
    }

    saveData(data);
    res.json({ success: true, lessonId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xatosi: ' + err.message });
  }
});

// 2) Barcha darslar ro'yxati
app.get('/api/lessons', (req, res) => {
  const data = loadData();
  const sorted = [...data.lessons].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(sorted);
});

// 3) Bitta darsni transcript bilan olish
app.get('/api/lessons/:id', (req, res) => {
  const data = loadData();
  const lessonId = parseInt(req.params.id, 10);
  const lesson = data.lessons.find(l => l.id === lessonId);
  if (!lesson) return res.status(404).json({ error: 'Dars topilmadi' });

  const lines = data.transcript_lines
    .filter(l => l.lesson_id === lessonId)
    .sort((a, b) => a.start_time - b.start_time);

  res.json({ ...lesson, lines });
});

// 4) Darsni tahrirlash (nomi, transcript, ixtiyoriy ravishda media/rasmni almashtirish)
app.put('/api/lessons/:id', requireAdmin, uploadFields, (req, res) => {
  try {
    const data = loadData();
    const lessonId = parseInt(req.params.id, 10);
    const lesson = data.lessons.find(l => l.id === lessonId);
    if (!lesson) return res.status(404).json({ error: 'Dars topilmadi' });

    const { title, transcript } = req.body;
    const mediaFile = req.files && req.files.media ? req.files.media[0] : null;
    const thumbFile = req.files && req.files.thumbnail ? req.files.thumbnail[0] : null;

    if (title) lesson.title = title;

    if (mediaFile) {
      const oldPath = path.join(uploadsDir, lesson.media_filename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      lesson.media_filename = mediaFile.filename;
      lesson.media_type = mediaFile.mimetype.startsWith('video') ? 'video' : 'audio';
    }

    if (thumbFile) {
      if (lesson.thumbnail_filename) {
        const oldThumb = path.join(uploadsDir, lesson.thumbnail_filename);
        if (fs.existsSync(oldThumb)) fs.unlinkSync(oldThumb);
      }
      lesson.thumbnail_filename = thumbFile.filename;
    }

    if (transcript) {
      const lines = JSON.parse(transcript);
      data.transcript_lines = data.transcript_lines.filter(l => l.lesson_id !== lessonId);
      for (const line of lines) {
        data.transcript_lines.push({
          id: data.nextLineId++,
          lesson_id: lessonId,
          start_time: line.start_time,
          end_time: line.end_time,
          text: line.text,
          translation: line.translation || null
        });
      }
    }

    saveData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xatosi: ' + err.message });
  }
});

// 5) Darsni o'chirish
app.delete('/api/lessons/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const lessonId = parseInt(req.params.id, 10);
  const lesson = data.lessons.find(l => l.id === lessonId);
  if (!lesson) return res.status(404).json({ error: 'Dars topilmadi' });

  const filePath = path.join(uploadsDir, lesson.media_filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  if (lesson.thumbnail_filename) {
    const thumbPath = path.join(uploadsDir, lesson.thumbnail_filename);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }

  data.lessons = data.lessons.filter(l => l.id !== lessonId);
  data.transcript_lines = data.transcript_lines.filter(l => l.lesson_id !== lessonId);
  data.progress = data.progress.filter(p => p.lesson_id !== lessonId);
  data.participants = data.participants.filter(p => p.lesson_id !== lessonId);

  saveData(data);
  res.json({ success: true });
});

// 5) Darsga "qo'shilish" — ism bilan (login/parolsiz, oddiy belgilash)
app.post('/api/lessons/:id/join', (req, res) => {
  const data = loadData();
  const lessonId = parseInt(req.params.id, 10);
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Ism kiritilishi shart' });
  }

  const cleanName = name.trim().slice(0, 40); // ortiqcha uzun ismni cheklash

  const existing = data.participants.find(
    p => p.lesson_id === lessonId && p.name.toLowerCase() === cleanName.toLowerCase()
  );

  if (existing) {
    existing.last_seen_at = new Date().toISOString();
    existing.visit_count = (existing.visit_count || 1) + 1;
  } else {
    data.participants.push({
      id: data.nextParticipantId++,
      lesson_id: lessonId,
      name: cleanName,
      joined_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      visit_count: 1
    });
  }

  saveData(data);
  res.json({ success: true });
});

// 6) Bitta darsning qatnashuvchilari ro'yxati
app.get('/api/lessons/:id/participants', (req, res) => {
  const data = loadData();
  const lessonId = parseInt(req.params.id, 10);
  const list = data.participants
    .filter(p => p.lesson_id === lessonId)
    .sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at));
  res.json(list);
});

// 7) Progress belgilash (bir qatorni mashq qilganda) — endi ism bilan
app.post('/api/progress', (req, res) => {
  const data = loadData();
  const { lesson_id, line_id, name } = req.body;
  const cleanName = (name || 'Mehmon').trim().slice(0, 40);

  const existing = data.progress.find(
    p => p.lesson_id === lesson_id && p.line_id === line_id && p.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (existing) {
    existing.practiced_count += 1;
    existing.last_practiced_at = new Date().toISOString();
  } else {
    data.progress.push({
      id: data.nextProgressId++,
      lesson_id,
      line_id,
      name: cleanName,
      practiced_count: 1,
      last_practiced_at: new Date().toISOString()
    });
  }

  saveData(data);
  res.json({ success: true });
});

// 8) Bitta foydalanuvchining bitta darsdagi progressi (qaysi qatorlarni mashq qilgan)
app.get('/api/lessons/:id/my-progress', (req, res) => {
  const data = loadData();
  const lessonId = parseInt(req.params.id, 10);
  const name = (req.query.name || '').trim().toLowerCase();

  const practicedLineIds = data.progress
    .filter(p => p.lesson_id === lessonId && p.name.toLowerCase() === name)
    .map(p => p.line_id);

  const totalLines = data.transcript_lines.filter(l => l.lesson_id === lessonId).length;

  res.json({ practicedLineIds, totalLines });
});

// 9) Reyting jadvali — barcha foydalanuvchilar bo'yicha faollik
app.get('/api/leaderboard', (req, res) => {
  const data = loadData();

  const statsByName = {};

  // Har bir mashq qilingan qator uchun umumiy takrorlashlar soni
  for (const p of data.progress) {
    const key = p.name.toLowerCase();
    if (!statsByName[key]) {
      statsByName[key] = { name: p.name, totalRepeats: 0, lessonsSet: new Set(), lastActive: p.last_practiced_at };
    }
    statsByName[key].totalRepeats += p.practiced_count;
    statsByName[key].lessonsSet.add(p.lesson_id);
    if (new Date(p.last_practiced_at) > new Date(statsByName[key].lastActive)) {
      statsByName[key].lastActive = p.last_practiced_at;
    }
  }

  // Qatnashgan darslar sonini participants orqali ham hisobga olish (mashq qilmagan, faqat ochgan bo'lsa ham)
  for (const p of data.participants) {
    const key = p.name.toLowerCase();
    if (!statsByName[key]) {
      statsByName[key] = { name: p.name, totalRepeats: 0, lessonsSet: new Set(), lastActive: p.last_seen_at };
    }
    statsByName[key].lessonsSet.add(p.lesson_id);
  }

  const leaderboard = Object.values(statsByName).map(s => ({
    name: s.name,
    totalRepeats: s.totalRepeats,
    lessonsJoined: s.lessonsSet.size,
    score: s.totalRepeats * 2 + s.lessonsSet.size * 5, // faollik bali: takrorlash + qatnashilgan darslar
    lastActive: s.lastActive
  }));

  leaderboard.sort((a, b) => b.score - a.score);

  res.json(leaderboard);
});

app.listen(PORT, () => {
  console.log(`Shadowing backend ${PORT}-portda ishlamoqda: http://localhost:${PORT}`);
});
