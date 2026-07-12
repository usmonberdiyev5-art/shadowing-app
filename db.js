// db.js — Oddiy JSON-fayl asosidagi "database" (native kompilyatsiya kerak emas)
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'shadowing-data.json');

function defaultData() {
  return {
    nextLessonId: 1,
    nextLineId: 1,
    nextProgressId: 1,
    nextParticipantId: 1,
    lessons: [],
    transcript_lines: [],
    progress: [],
    participants: []
  };
}

function loadData() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = defaultData();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    // Eski fayllarda yangi maydonlar bo'lmasligi mumkin — moslashtiramiz
    const defaults = defaultData();
    return { ...defaults, ...parsed };
  } catch (e) {
    return defaultData();
  }
}

function saveData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = { loadData, saveData };
