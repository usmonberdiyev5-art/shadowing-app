// app.js — Shadowing for English frontend mantiqi

// Nisbiy manzillar ishlatiladi — shunda kod ham localhost'da, ham hostingda o'zgarishsiz ishlaydi
const API_BASE = '/api';
const MEDIA_BASE = '/uploads';

// ---------- Foydalanuvchi ismi (login/parolsiz, oddiy) ----------
function getUsername() {
  return localStorage.getItem('shadowing_username');
}

function showNameModal() {
  document.getElementById('name-modal').classList.add('active');
}

document.getElementById('name-submit').addEventListener('click', submitName);
document.getElementById('name-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitName();
});

function submitName() {
  const input = document.getElementById('name-input');
  const name = input.value.trim();
  if (!name) {
    input.style.borderColor = 'var(--danger)';
    return;
  }
  localStorage.setItem('shadowing_username', name);
  document.getElementById('name-modal').classList.remove('active');
}

if (!getUsername()) showNameModal();

// ---------- Tab almashtirish ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('active');
  if (tabName === 'lessons') loadLessons();
}

document.getElementById('back-btn').addEventListener('click', () => {
  stopActiveMedia();
  switchTab('lessons');
});

// ---------- "MM:SS-MM:SS" ni soniyaga aylantirish ----------
function timeToSeconds(str) {
  const parts = str.trim().split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parseFloat(str) || 0;
}

function secondsToLabel(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------- Transcript matnini JSON'ga parse qilish ----------
// Format: 00:00-00:05 | English text | Uzbek tarjima (ixtiyoriy)
function parseTranscript(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const result = [];
  for (const line of lines) {
    const segments = line.split('|').map(s => s.trim());
    const timeRange = segments[0];
    const text = segments[1];
    const translation = segments[2] || '';
    if (!timeRange || !text) continue;

    const [startStr, endStr] = timeRange.split('-');
    result.push({
      start_time: timeToSeconds(startStr),
      end_time: timeToSeconds(endStr || startStr),
      text,
      translation
    });
  }
  return result;
}

// ---------- Darslar ro'yxatini yuklash ----------
async function loadLessons() {
  const container = document.getElementById('lessons-list');
  container.innerHTML = '<p class="muted">Yuklanmoqda...</p>';
  try {
    const res = await fetch(`${API_BASE}/lessons`);
    const lessons = await res.json();

    if (lessons.length === 0) {
      container.innerHTML = '<p class="muted">Hozircha darslar yo\'q. "Yangi dars qo\'shish" bo\'limidan boshlang.</p>';
      return;
    }

    container.innerHTML = '';
    lessons.forEach(lesson => {
      const card = document.createElement('div');
      card.className = 'lesson-card';
      card.innerHTML = `
        <button class="delete-btn" title="O'chirish">✕</button>
        <span class="badge">${lesson.media_type === 'video' ? '🎬 Video' : '🎧 Audio'}</span>
        <h3>${escapeHtml(lesson.title)}</h3>
        <p class="muted" style="font-size:12px;margin:0;">${lesson.created_at}</p>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) return;
        openPlayer(lesson.id);
      });
      card.querySelector('.delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`"${lesson.title}" darsini o'chirmoqchimisiz?`)) {
          await fetch(`${API_BASE}/lessons/${lesson.id}`, { method: 'DELETE' });
          loadLessons();
        }
      });
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<p class="muted">Backend bilan bog'lanib bo'lmadi. Server ishga tushganini tekshiring (localhost:3001).</p>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Yangi dars yuklash formasi ----------
document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('upload-status');
  const title = document.getElementById('lesson-title').value;
  const file = document.getElementById('media-file').files[0];
  const transcriptRaw = document.getElementById('transcript-input').value;

  const transcript = parseTranscript(transcriptRaw);
  if (transcript.length === 0) {
    status.textContent = "⚠️ Transcript bo'sh yoki formati noto'g'ri.";
    status.style.color = 'var(--danger)';
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('media', file);
  formData.append('transcript', JSON.stringify(transcript));

  status.textContent = 'Yuklanmoqda...';
  status.style.color = 'var(--text-muted)';

  try {
    const res = await fetch(`${API_BASE}/lessons`, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      status.textContent = '✅ Dars muvaffaqiyatli qo\'shildi!';
      status.style.color = 'var(--accent)';
      document.getElementById('upload-form').reset();
      switchTab('lessons');
    } else {
      status.textContent = '❌ Xato: ' + (data.error || 'Nomalum xato');
      status.style.color = 'var(--danger)';
    }
  } catch (err) {
    status.textContent = "❌ Serverga ulanib bo'lmadi.";
    status.style.color = 'var(--danger)';
  }
});

// ---------- Pleer ----------
let currentLesson = null;
let mediaEl = null;

async function openPlayer(lessonId) {
  const res = await fetch(`${API_BASE}/lessons/${lessonId}`);
  currentLesson = await res.json();

  document.getElementById('player-title').textContent = currentLesson.title;

  const container = document.getElementById('media-container');
  const tag = currentLesson.media_type === 'video' ? 'video' : 'audio';
  container.innerHTML = `<${tag} id="player-media" controls src="${MEDIA_BASE}/${currentLesson.media_filename}"></${tag}>`;
  mediaEl = document.getElementById('player-media');

  renderTranscript();

  mediaEl.addEventListener('timeupdate', onTimeUpdate);

  // Ism bilan darsga "qo'shilish" va qatnashuvchilar ro'yxatini ko'rsatish
  const username = getUsername();
  if (username) {
    fetch(`${API_BASE}/lessons/${lessonId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: username })
    }).catch(() => {}).finally(() => loadParticipants(lessonId));
  } else {
    loadParticipants(lessonId);
  }

  switchTab('player');
}

async function loadParticipants(lessonId) {
  const box = document.getElementById('participants-box');
  try {
    const res = await fetch(`${API_BASE}/lessons/${lessonId}/participants`);
    const list = await res.json();
    if (list.length === 0) {
      box.innerHTML = '<span>Hozircha hech kim qatnashmagan</span>';
      return;
    }
    const me = getUsername();
    box.innerHTML = '👥 Qatnashganlar: ' + list.map(p =>
      `<span class="participant-chip ${p.name.toLowerCase() === (me || '').toLowerCase() ? 'you' : ''}">${escapeHtml(p.name)}</span>`
    ).join('');
  } catch (err) {
    box.innerHTML = '';
  }
}

function stopActiveMedia() {
  if (mediaEl) { mediaEl.pause(); mediaEl.removeEventListener('timeupdate', onTimeUpdate); }
}

function renderTranscript() {
  const list = document.getElementById('transcript-list');
  list.innerHTML = '';
  currentLesson.lines.forEach(line => {
    const row = document.createElement('div');
    row.className = 'transcript-line';
    row.dataset.start = line.start_time;
    row.dataset.end = line.end_time;
    row.innerHTML = `
      <span class="timestamp">${secondsToLabel(line.start_time)}</span>
      <div class="content">
        <div class="en">${escapeHtml(line.text)}</div>
        ${line.translation ? `<div class="uz">${escapeHtml(line.translation)}</div>` : ''}
      </div>
      <button class="repeat-btn">🔁 Takrorlash</button>
    `;
    row.querySelector('.content').addEventListener('click', () => {
      mediaEl.currentTime = line.start_time;
      mediaEl.play();
    });
    row.querySelector('.repeat-btn').addEventListener('click', () => {
      // Faqat shu jumlaning boshiga o'tib, bir marta o'ynaydi — keyin davom etaveradi
      mediaEl.currentTime = line.start_time;
      mediaEl.play();

      // Progress belgilash (bazaga yozish)
      fetch(`${API_BASE}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: currentLesson.id, line_id: line.id })
      }).catch(() => {});
    });
    list.appendChild(row);
  });
}

function onTimeUpdate() {
  const t = mediaEl.currentTime;

  // Faol qatorni belgilash
  document.querySelectorAll('.transcript-line').forEach(row => {
    const start = parseFloat(row.dataset.start);
    const end = parseFloat(row.dataset.end);
    row.classList.toggle('active', t >= start && t < end);
  });
}

// ---------- Boshlang'ich yuklash ----------
loadLessons();
