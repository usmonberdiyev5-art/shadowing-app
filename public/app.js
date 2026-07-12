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
  if (!name) { input.style.borderColor = 'var(--danger)'; return; }
  localStorage.setItem('shadowing_username', name);
  document.getElementById('name-modal').classList.remove('active');
}

if (!getUsername()) showNameModal();

// ---------- Admin tizimi ----------
function getAdminPassword() { return sessionStorage.getItem('shadowing_admin_pw'); }
function isAdmin() { return !!getAdminPassword(); }

function updateAdminUI() {
  document.getElementById('upload-tab-btn').style.display = isAdmin() ? 'inline-block' : 'none';
}

document.getElementById('admin-login-btn').addEventListener('click', () => {
  if (isAdmin()) {
    if (confirm("Admin rejimidan chiqmoqchimisiz?")) {
      sessionStorage.removeItem('shadowing_admin_pw');
      updateAdminUI();
      switchTab('lessons');
    }
    return;
  }
  document.getElementById('admin-modal').classList.add('active');
  document.getElementById('admin-password-input').value = '';
  document.getElementById('admin-error').style.display = 'none';
});

document.getElementById('admin-password-submit').addEventListener('click', submitAdminPassword);
document.getElementById('admin-password-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitAdminPassword();
});

async function submitAdminPassword() {
  const pw = document.getElementById('admin-password-input').value;
  try {
    const res = await fetch(`${API_BASE}/admin/check`, { method: 'POST', headers: { 'x-admin-password': pw } });
    if (res.ok) {
      sessionStorage.setItem('shadowing_admin_pw', pw);
      document.getElementById('admin-modal').classList.remove('active');
      updateAdminUI();
    } else {
      document.getElementById('admin-error').style.display = 'block';
    }
  } catch (err) {
    document.getElementById('admin-error').textContent = "Serverga ulanib bo'lmadi";
    document.getElementById('admin-error').style.display = 'block';
  }
}

updateAdminUI();

// ---------- Tab almashtirish ----------
document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('active');
  if (tabName !== 'player') stopActiveMedia();
  if (tabName === 'lessons') loadLessons();
  if (tabName === 'leaderboard') loadLeaderboard();
  if (tabName === 'profile') loadProfile();
}

document.getElementById('back-btn').addEventListener('click', () => {
  stopActiveMedia();
  switchTab('lessons');
});

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => switchTab('lessons'));
});

// ---------- Vaqt yordamchi funksiyalari ----------
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
      text, translation
    });
  }
  return result;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Deterministik "waveform" generatsiyasi (dars kartochkasi uchun imzo vizuali) ----------
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateWaveformSVG(seedStr, barCount = 40) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed += seedStr.charCodeAt(i) * (i + 1);
  const rand = seededRandom(seed || 1);

  const width = 300, height = 36, gap = 2;
  const barWidth = (width / barCount) - gap;
  let bars = '';
  for (let i = 0; i < barCount; i++) {
    const h = 6 + rand() * (height - 6);
    const x = i * (barWidth + gap);
    const y = (height - h) / 2;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`;
  }
  return `<svg class="waveform" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${bars}</svg>`;
}

// Hero fonidagi katta waveform (bir marta chiziladi)
(function renderHeroWave() {
  const g = document.querySelector('.hero-bars');
  if (!g) return;
  const rand = seededRandom(42);
  let bars = '';
  const barCount = 60, width = 400, height = 120, gap = 2;
  const barWidth = (width / barCount) - gap;
  for (let i = 0; i < barCount; i++) {
    const h = 10 + rand() * (height - 10);
    const x = i * (barWidth + gap);
    const y = (height - h) / 2;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="var(--accent)" opacity="0.5"/>`;
  }
  g.innerHTML = bars;
})();

// ---------- Darslar ro'yxatini yuklash ----------
async function loadLessons() {
  const container = document.getElementById('lessons-list');
  container.innerHTML = '<p class="muted">Yuklanmoqda...</p>';
  try {
    const res = await fetch(`${API_BASE}/lessons`);
    const lessons = await res.json();

    document.getElementById('stat-lessons').textContent = lessons.length;
    // Umumiy qatnashuvchilar sonini reyting orqali baholaymiz (taxminiy)
    fetch(`${API_BASE}/leaderboard`).then(r => r.json()).then(lb => {
      document.getElementById('stat-participants').textContent = lb.length;
    }).catch(() => {});

    if (lessons.length === 0) {
      container.innerHTML = '<p class="muted">Hozircha darslar yo\'q. "Yangi dars qo\'shish" bo\'limidan boshlang.</p>';
      return;
    }

    container.innerHTML = '';
    lessons.forEach((lesson, idx) => {
      const card = document.createElement('div');
      card.className = 'lesson-card';
      card.style.animationDelay = (idx * 0.05) + 's';
      card.innerHTML = `
        ${isAdmin() ? '<button class="delete-btn" title="O\'chirish">✕</button>' : ''}
        ${generateWaveformSVG(lesson.title + lesson.id)}
        <span class="badge">${lesson.media_type === 'video' ? '🎬 Video' : '🎧 Audio'}</span>
        <h3>${escapeHtml(lesson.title)}</h3>
        <p class="muted" style="font-size:12px;margin:0;">${new Date(lesson.created_at).toLocaleDateString()}</p>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) return;
        openPlayer(lesson.id);
      });
      const deleteBtn = card.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`"${lesson.title}" darsini o'chirmoqchimisiz?`)) {
            await fetch(`${API_BASE}/lessons/${lesson.id}`, {
              method: 'DELETE',
              headers: { 'x-admin-password': getAdminPassword() || '' }
            });
            loadLessons();
          }
        });
      }
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<p class="muted">Backend bilan bog'lanib bo'lmadi. Server ishga tushganini tekshiring.</p>`;
  }
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
    const res = await fetch(`${API_BASE}/lessons`, {
      method: 'POST',
      headers: { 'x-admin-password': getAdminPassword() || '' },
      body: formData
    });
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
let practicedLineIds = new Set();
let slowModeEndTime = null;

async function openPlayer(lessonId) {
  const res = await fetch(`${API_BASE}/lessons/${lessonId}`);
  currentLesson = await res.json();

  document.getElementById('player-title').textContent = currentLesson.title;

  const container = document.getElementById('media-container');
  const tag = currentLesson.media_type === 'video' ? 'video' : 'audio';
  container.innerHTML = `<${tag} id="player-media" controls src="${MEDIA_BASE}/${currentLesson.media_filename}"></${tag}>`;
  mediaEl = document.getElementById('player-media');

  mediaEl.addEventListener('timeupdate', onTimeUpdate);

  const username = getUsername();

  // Progress: qaysi qatorlarni mashq qilgani
  practicedLineIds = new Set();
  if (username) {
    try {
      const pRes = await fetch(`${API_BASE}/lessons/${lessonId}/my-progress?name=${encodeURIComponent(username)}`);
      const pData = await pRes.json();
      practicedLineIds = new Set(pData.practicedLineIds);
    } catch (err) {}
  }

  renderTranscript();
  updateProgressBar();

  // Ism bilan darsga "qo'shilish" va qatnashuvchilar ro'yxatini ko'rsatish
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
    if (list.length === 0) { box.innerHTML = '<span>Hozircha hech kim qatnashmagan</span>'; return; }
    const me = getUsername();
    box.innerHTML = '👥 Qatnashganlar: ' + list.map(p =>
      `<span class="participant-chip ${p.name.toLowerCase() === (me || '').toLowerCase() ? 'you' : ''}">${escapeHtml(p.name)}</span>`
    ).join('');
  } catch (err) { box.innerHTML = ''; }
}

function stopActiveMedia() {
  if (mediaEl) { mediaEl.pause(); mediaEl.removeEventListener('timeupdate', onTimeUpdate); }
}

function updateProgressBar() {
  const total = currentLesson.lines.length;
  const done = practicedLineIds.size;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  document.getElementById('progress-bar-fill').style.width = pct + '%';
  document.getElementById('progress-bar-label').textContent = pct + '%';
}

function renderTranscript() {
  const list = document.getElementById('transcript-list');
  list.innerHTML = '';
  currentLesson.lines.forEach(line => {
    const row = document.createElement('div');
    row.className = 'transcript-line' + (practicedLineIds.has(line.id) ? ' practiced' : '');
    row.dataset.start = line.start_time;
    row.dataset.end = line.end_time;
    row.dataset.lineId = line.id;
    row.innerHTML = `
      <span class="timestamp">${secondsToLabel(line.start_time)}</span>
      <div class="content">
        <div class="en">${escapeHtml(line.text)}</div>
        ${line.translation ? `<div class="uz">${escapeHtml(line.translation)}</div>` : ''}
      </div>
      <div class="repeat-group">
        <button class="repeat-btn normal" title="Oddiy tezlikda takrorlash">🔁</button>
        <button class="repeat-btn slow" title="Sekin (0.5x) takrorlash">🐢</button>
      </div>
    `;
    row.querySelector('.content').addEventListener('click', () => {
      mediaEl.playbackRate = 1;
      mediaEl.currentTime = line.start_time;
      mediaEl.play();
    });
    row.querySelector('.repeat-btn.normal').addEventListener('click', () => {
      mediaEl.playbackRate = 1;
      mediaEl.currentTime = line.start_time;
      mediaEl.play();
      markLinePracticed(row, line.id);
    });
    row.querySelector('.repeat-btn.slow').addEventListener('click', () => {
      mediaEl.playbackRate = 0.5;
      slowModeEndTime = line.end_time;
      mediaEl.currentTime = line.start_time;
      mediaEl.play();
      markLinePracticed(row, line.id);
    });
    list.appendChild(row);
  });
}

function markLinePracticed(row, lineId) {
  const username = getUsername();
  if (!practicedLineIds.has(lineId)) {
    practicedLineIds.add(lineId);
    row.classList.add('practiced');
    updateProgressBar();
  }
  fetch(`${API_BASE}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lesson_id: currentLesson.id, line_id: lineId, name: username || 'Mehmon' })
  }).catch(() => {});
}

function onTimeUpdate() {
  const t = mediaEl.currentTime;

  // Sekin (0.5x) rejim faqat belgilangan qator tugaguncha ishlaydi, keyin oddiy tezlikka qaytadi
  if (slowModeEndTime !== null && t >= slowModeEndTime) {
    mediaEl.playbackRate = 1;
    slowModeEndTime = null;
  }

  document.querySelectorAll('.transcript-line').forEach(row => {
    const start = parseFloat(row.dataset.start);
    const end = parseFloat(row.dataset.end);
    row.classList.toggle('active', t >= start && t < end);
  });
}

// ---------- Reyting ----------
async function loadLeaderboard() {
  const box = document.getElementById('leaderboard-list');
  box.innerHTML = '<p class="muted" style="padding:20px;">Yuklanmoqda...</p>';
  try {
    const res = await fetch(`${API_BASE}/leaderboard`);
    const list = await res.json();
    if (list.length === 0) {
      box.innerHTML = '<p class="muted" style="padding:20px;">Hozircha hech kim faollik ko\'rsatmagan.</p>';
      return;
    }
    const me = (getUsername() || '').toLowerCase();
    const medalClass = ['gold', 'silver', 'bronze'];
    box.innerHTML = list.map((entry, i) => `
      <div class="leaderboard-row ${entry.name.toLowerCase() === me ? 'me' : ''}">
        <span class="lb-rank ${medalClass[i] || ''}">${i + 1}</span>
        <span class="lb-name">${escapeHtml(entry.name)}</span>
        <div class="lb-stats">
          <span><b>${entry.totalRepeats}</b> takrorlash</span>
          <span><b>${entry.lessonsJoined}</b> dars</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    box.innerHTML = '<p class="muted" style="padding:20px;">Reytingni yuklab bo\'lmadi.</p>';
  }
}

// ---------- Profil ----------
async function loadProfile() {
  const username = getUsername() || '';
  document.getElementById('profile-name-input').value = username;
  const statsBox = document.getElementById('profile-stats');
  statsBox.innerHTML = '<p class="muted">Yuklanmoqda...</p>';

  try {
    const res = await fetch(`${API_BASE}/leaderboard`);
    const list = await res.json();
    const mine = list.find(e => e.name.toLowerCase() === username.toLowerCase());
    if (mine) {
      statsBox.innerHTML = `
        <div class="profile-stat"><span class="profile-stat-num">${mine.totalRepeats}</span><span class="profile-stat-label">Takrorlash</span></div>
        <div class="profile-stat"><span class="profile-stat-num">${mine.lessonsJoined}</span><span class="profile-stat-label">Qatnashilgan dars</span></div>
      `;
    } else {
      statsBox.innerHTML = '<p class="muted">Hali hech qanday dars mashq qilmadingiz.</p>';
    }
  } catch (err) {
    statsBox.innerHTML = '';
  }
}

document.getElementById('profile-name-save').addEventListener('click', () => {
  const input = document.getElementById('profile-name-input');
  const newName = input.value.trim();
  const status = document.getElementById('profile-save-status');
  if (!newName) {
    status.textContent = "Ism bo'sh bo'lishi mumkin emas";
    status.style.color = 'var(--danger)';
    return;
  }
  localStorage.setItem('shadowing_username', newName);
  status.textContent = "✅ Saqlandi! (Eslatma: eski faoliyat oldingi ism ostida qoladi)";
  status.style.color = 'var(--accent-dark)';
  loadProfile();
});

// ---------- Boshlang'ich yuklash ----------
loadLessons();
