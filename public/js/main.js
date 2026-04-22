// ── Stars ──
(function createStars() {
  const container = document.getElementById('stars-container');
  for (let i = 0; i < 180; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2.2 + 0.6;
    s.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      width: ${size}px;
      height: ${size}px;
      --dur: ${(Math.random() * 4 + 2).toFixed(1)}s;
      --delay: -${(Math.random() * 6).toFixed(1)}s;
      --base-op: ${(Math.random() * 0.5 + 0.2).toFixed(2)};
    `;
    container.appendChild(s);
  }
})();

// ── Timestamps ──
function formatTime(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
document.querySelectorAll('.timestamp[data-time]').forEach(el => {
  el.textContent = formatTime(el.dataset.time);
});

// ── Modal ──
const overlay    = document.getElementById('modal-overlay');
const openBtn    = document.getElementById('open-modal');
const closeBtn   = document.getElementById('close-modal');
const loadingEl  = document.getElementById('loading-overlay');

openBtn.addEventListener('click', () => overlay.classList.remove('hidden'));
closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function closeModal() {
  overlay.classList.add('hidden');
  loadingEl.classList.add('hidden');
}

// ── Word counter ──
const descEl      = document.getElementById('description');
const counterEl   = document.getElementById('word-counter');
const submitBtn   = document.getElementById('submit-btn');

function wordCount(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).filter(Boolean).length;
}

descEl.addEventListener('input', () => {
  const n = wordCount(descEl.value);
  counterEl.textContent = `${n} / 70 words`;
  counterEl.classList.toggle('warn', n >= 55 && n <= 70);
  counterEl.classList.toggle('over', n > 70);
  submitBtn.disabled = n > 70;
});

// ── Image conversion ──
async function imgToBase64(imgEl) {
  await new Promise((resolve, reject) => {
    if (imgEl.complete && imgEl.naturalWidth) return resolve();
    imgEl.onload  = resolve;
    imgEl.onerror = reject;
  });

  // Canvas approach (works for blob/data URLs)
  try {
    const canvas = document.createElement('canvas');
    canvas.width  = imgEl.naturalWidth  || 1024;
    canvas.height = imgEl.naturalHeight || 1024;
    canvas.getContext('2d').drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch (_) {
    // Fallback: fetch the src as a blob
    const resp   = await fetch(imgEl.src);
    const blob   = await resp.blob();
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload  = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }
}

// ── Form submit ──
document.getElementById('dream-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username    = document.getElementById('username').value.trim();
  const description = descEl.value.trim();

  if (!username || !description) return;
  if (wordCount(description) > 70) return;

  loadingEl.classList.remove('hidden');
  submitBtn.disabled = true;

  try {
    // Generate image with Puter.js (no API key needed)
    const imgEl  = await puter.ai.txt2img(description, { model: 'dall-e-2' });
    const b64    = await imgToBase64(imgEl);

    const resp = await fetch('/dreams', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, description, imageData: b64 }),
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || 'Server error');
    }

    const { dream } = await resp.json();

    // Add to DOM
    const feed      = document.getElementById('dream-feed');
    const emptyEl   = document.getElementById('empty-state');
    if (emptyEl) emptyEl.remove();

    const card = buildCard(dream);
    feed.insertBefore(card, feed.firstChild);

    // Update count
    const countEl = document.querySelector('.dream-count');
    if (countEl) {
      const n = document.querySelectorAll('.dream-card').length;
      countEl.textContent = `${n} vision${n !== 1 ? 's' : ''}`;
    }

    // Reset form and close
    document.getElementById('dream-form').reset();
    counterEl.textContent = '0 / 70 words';
    counterEl.classList.remove('warn', 'over');
    closeModal();

  } catch (err) {
    console.error(err);
    alert('Something went wrong: ' + err.message);
    loadingEl.classList.add('hidden');
  } finally {
    submitBtn.disabled = false;
  }
});

// ── Build card DOM ──
function buildCard(dream) {
  const art = document.createElement('article');
  art.className = 'dream-card';
  art.dataset.id = dream._id;

  const initial = dream.username.charAt(0).toUpperCase();

  art.innerHTML = `
    <div class="card-header">
      <div class="user-avatar">${initial}</div>
      <div class="user-info">
        <span class="username">@${escHtml(dream.username)}</span>
        <span class="timestamp">just now</span>
      </div>
      <button class="delete-btn" aria-label="Delete dream"
        onclick="deleteDream('${dream._id}', this.closest('.dream-card'))">&#x2715;</button>
    </div>
    <p class="dream-description">${escHtml(dream.description)}</p>
    <div class="dream-image-wrap">
      <img src="${dream.imageData}" alt="AI-generated dream scene" class="dream-image" />
    </div>
  `;
  return art;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Delete ──
async function deleteDream(id, cardEl) {
  if (!confirm('Delete this dream entry?')) return;

  try {
    const resp = await fetch(`/dreams/${id}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Delete failed');

    cardEl.classList.add('removing');
    cardEl.addEventListener('animationend', () => {
      cardEl.remove();

      // Show empty state if feed is now empty
      const feed  = document.getElementById('dream-feed');
      const cards = feed.querySelectorAll('.dream-card');
      if (cards.length === 0) {
        feed.innerHTML = `
          <div class="empty-state" id="empty-state">
            <div class="empty-icon">🌙</div>
            <p class="empty-title">No dreams yet</p>
            <p class="empty-sub">Be the first to share a vision from beyond.</p>
          </div>`;
      }

      // Update count
      const countEl = document.querySelector('.dream-count');
      if (countEl) {
        const n = document.querySelectorAll('.dream-card').length;
        countEl.textContent = `${n} vision${n !== 1 ? 's' : ''}`;
      }
    }, { once: true });

  } catch (err) {
    console.error(err);
    alert('Could not delete the dream. Please try again.');
  }
}
