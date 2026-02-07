const API = '/api';
const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_NAMES_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

let editingRuleId = null;
let dashboardConfig = null;
let selectedLogIds = new Set();

// ===== TOAST NOTIFICATIONS =====

function toast(type, title, message, duration = 4000) {
  const container = document.getElementById('toast-container');
  const icons = { success: '\u2705', error: '\u274C', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F' };

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icons[type] || ''}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="dismissToast(this)">\u00D7</button>
    <div class="toast-progress" style="animation-duration:${duration}ms"></div>
  `;
  container.appendChild(el);

  const timer = setTimeout(() => dismissToast(el.querySelector('.toast-close')), duration);
  el._timer = timer;
}

function dismissToast(btnOrEl) {
  const toastEl = btnOrEl.closest ? btnOrEl.closest('.toast') : btnOrEl;
  if (!toastEl || toastEl.classList.contains('toast-out')) return;
  clearTimeout(toastEl._timer);
  toastEl.classList.add('toast-out');
  toastEl.addEventListener('animationend', () => toastEl.remove());
}

// ===== CONFIRM MODAL =====

function confirmModal(title, message, confirmLabel = 'Confirmer', confirmClass = 'btn-primary') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">${title}</div>
        <div class="modal-message">${message}</div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-action="cancel">Annuler</button>
          <button class="btn ${confirmClass}" data-action="confirm">${confirmLabel}</button>
        </div>
      </div>
    `;

    function close(result) {
      overlay.classList.add('modal-out');
      overlay.addEventListener('animationend', () => overlay.remove());
      resolve(result);
    }

    overlay.querySelector('[data-action="cancel"]').onclick = () => close(false);
    overlay.querySelector('[data-action="confirm"]').onclick = () => close(true);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

    document.body.appendChild(overlay);
  });
}

// ===== BUTTON LOADING STATE =====

function btnLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn._origHTML = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = `<span class="spinner"></span> ${btn.textContent.trim()}`;
  } else {
    btn.disabled = false;
    btn.classList.remove('loading');
    if (btn._origHTML !== undefined) btn.innerHTML = btn._origHTML;
  }
}

// ===== API HELPERS =====

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiPut(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiDelete(path, body) {
  const opts = { method: 'DELETE' };
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, opts);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(res.ok ? text.substring(0, 200) : `HTTP ${res.status}: ${text.substring(0, 200)}`);
  }
}

// ===== DASHBOARD =====

async function loadDashboard() {
  try {
    const data = await apiGet('/dashboard');
    dashboardConfig = data.config;
    window._dashboardData = data;
    renderStats(data);
    renderRules(data.rules);
    renderLogs(data.recent_logs);
    loadBookings();
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

async function loadBookings() {
  const btn = document.getElementById('btn-refresh-bookings');
  btnLoading(btn, true);
  try {
    const bookings = await apiGet('/bookings');
    renderBookings(bookings);
    document.getElementById('stat-upcoming').textContent = bookings.length;
  } catch (err) {
    console.error('Failed to load bookings:', err);
    document.getElementById('bookings-list').innerHTML =
      '<p class="empty-state">Erreur de chargement des réservations.</p>';
  } finally {
    btnLoading(btn, false);
  }
}

function renderStats(data) {
  const activeRules = data.rules.filter(r => r.enabled).length;
  document.getElementById('stat-rules').textContent = activeRules;

  const advanceDays = data.config.advance_days;
  document.getElementById('stat-advance').textContent = `J-${advanceDays}`;
  const infoEl = document.getElementById('info-advance');
  if (infoEl) infoEl.textContent = advanceDays;
}

// ===== ADVANCE DAYS SETTING =====

async function editAdvanceDays() {
  const current = dashboardConfig ? dashboardConfig.advance_days : 45;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">Intervalle de réservation</div>
      <div class="modal-message">Nombre de jours à l'avance pour la réservation automatique (entre 1 et 90).</div>
      <div class="form-group" style="margin-bottom: 24px">
        <label>Jours d'avance (J-N)</label>
        <input type="number" id="input-advance-days" value="${current}" min="1" max="90" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; font-size: 14px;">
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="cancel">Annuler</button>
        <button class="btn btn-primary" data-action="confirm">Enregistrer</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = overlay.querySelector('#input-advance-days');
  input.focus();
  input.select();

  return new Promise((resolve) => {
    async function save() {
      const val = parseInt(input.value);
      if (isNaN(val) || val < 1 || val > 90) {
        toast('warning', 'Valeur invalide', 'La valeur doit être entre 1 et 90.');
        return;
      }
      try {
        await apiPut('/settings', { booking_advance_days: val });
        toast('success', 'Paramètre mis à jour', `Intervalle de réservation : J-${val}`);
        loadDashboard();
      } catch (err) {
        toast('error', 'Erreur', err.message);
      }
      close();
    }

    function close() {
      overlay.classList.add('modal-out');
      overlay.addEventListener('animationend', () => overlay.remove());
      resolve();
    }

    overlay.querySelector('[data-action="cancel"]').onclick = close;
    overlay.querySelector('[data-action="confirm"]').onclick = save;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  });
}

// ===== RULES =====

function renderRules(rules) {
  const container = document.getElementById('rules-list');

  if (!rules || rules.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucune règle configurée. Cliquez sur "+ Nouvelle règle" pour commencer.</p>';
    return;
  }

  container.innerHTML = rules.map(rule => {
    const pgOrder = rule.playground_order;
    const pgLabel = pgOrder && pgOrder.length > 0
      ? pgOrder.join(', ')
      : 'Aucune préférence';

    const j45 = rule.j45;
    let j45Label = '';
    if (j45.days_until_attempt === 0) {
      j45Label = `Réservation auto aujourd'hui à 00:00 pour le ${formatDate(j45.target_date)}`;
    } else if (j45.days_until_attempt === 1) {
      j45Label = `Réservation auto demain à 00:00 pour le ${formatDate(j45.target_date)}`;
    } else {
      j45Label = `Réservation auto le ${formatDate(j45.attempt_date)} à 00:00 pour le ${formatDate(j45.target_date)} (dans ${j45.days_until_attempt}j)`;
    }

    return `
      <div class="rule-card ${rule.enabled ? '' : 'disabled'}">
        <div class="rule-day">${DAY_NAMES[rule.day_of_week]}</div>
        <div class="rule-info">
          <div class="rule-time">${rule.target_time}</div>
          <div class="rule-details">Football 5v5 - ${rule.duration_label} - Tarif variable selon horaire</div>
          <div class="rule-pg">Terrains : ${pgLabel}</div>
          <div class="rule-next">${j45Label}</div>
        </div>
        <div class="rule-actions">
          <button class="btn btn-success btn-sm" id="btn-book-${rule.id}" onclick="bookNow(${rule.id}, '${j45.target_date}', this)" title="Réserver maintenant">&#9889; Réserver</button>
          <button class="btn-icon" onclick="editRule(${rule.id})" title="Modifier">&#9998;</button>
          <label class="toggle" title="${rule.enabled ? 'Désactiver' : 'Activer'}">
            <input type="checkbox" ${rule.enabled ? 'checked' : ''} onchange="toggleRule(${rule.id}, this.checked)">
            <span class="toggle-slider"></span>
          </label>
          <button class="btn-icon" onclick="deleteRuleConfirm(${rule.id})" title="Supprimer">&#128465;</button>
        </div>
      </div>
    `;
  }).join('');
}

// ===== PLAYGROUND PREFERENCES UI =====

function initPlaygroundPrefs(selected) {
  const container = document.getElementById('playground-prefs');
  const names = dashboardConfig ? dashboardConfig.playground_names : ['Foot 1','Foot 2','Foot 3','Foot 4','Foot 5','Foot 6','Foot 7'];

  let ordered;
  if (selected && selected.length > 0) {
    const rest = names.filter(n => !selected.includes(n));
    ordered = [...selected, ...rest];
  } else {
    ordered = [...names];
  }

  container.innerHTML = ordered.map((name) => {
    const checked = !selected || selected.length === 0 || selected.includes(name);
    return `
      <div class="pg-item" draggable="true" data-name="${name}">
        <span class="pg-handle">&#8942;&#8942;</span>
        <label class="pg-label">
          <input type="checkbox" ${checked ? 'checked' : ''} value="${name}">
          ${name}
        </label>
      </div>
    `;
  }).join('');

  let dragItem = null;
  container.querySelectorAll('.pg-item').forEach(item => {
    item.addEventListener('dragstart', () => { dragItem = item; item.classList.add('dragging'); });
    item.addEventListener('dragend', () => { dragItem = null; item.classList.remove('dragging'); });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (dragItem && dragItem !== item) {
        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          container.insertBefore(dragItem, item);
        } else {
          container.insertBefore(dragItem, item.nextSibling);
        }
      }
    });
  });
}

function getPlaygroundOrder() {
  const items = document.querySelectorAll('#playground-prefs .pg-item');
  const order = [];
  items.forEach(item => {
    const cb = item.querySelector('input[type="checkbox"]');
    if (cb.checked) {
      order.push(cb.value);
    }
  });
  return order.length > 0 ? order : null;
}

// ===== RULE FORM =====

function showAddRule() {
  editingRuleId = null;
  document.getElementById('form-title').textContent = 'Ajouter une règle';
  document.getElementById('input-day').value = '1';
  document.getElementById('input-time').value = '19:00';
  document.getElementById('input-duration').value = '60';
  document.getElementById('rule-form').style.display = 'block';
  initPlaygroundPrefs(null);
}

function editRule(id) {
  const data = window._dashboardData;
  if (!data) return;
  const rule = data.rules.find(r => r.id === id);
  if (!rule) return;

  editingRuleId = id;
  document.getElementById('form-title').textContent = 'Modifier la règle';
  document.getElementById('input-day').value = String(rule.day_of_week);
  document.getElementById('input-time').value = rule.target_time;
  document.getElementById('input-duration').value = String(rule.duration);
  document.getElementById('rule-form').style.display = 'block';
  initPlaygroundPrefs(rule.playground_order);
}

function hideAddRule() {
  document.getElementById('rule-form').style.display = 'none';
  editingRuleId = null;
}

async function saveRule() {
  const day_of_week = parseInt(document.getElementById('input-day').value);
  const target_time = document.getElementById('input-time').value;
  const duration = parseInt(document.getElementById('input-duration').value);
  const playground_order = getPlaygroundOrder();

  if (!target_time) {
    toast('warning', 'Champ manquant', 'Veuillez renseigner une heure.');
    return;
  }

  const btn = document.getElementById('btn-save-rule');
  btnLoading(btn, true);
  try {
    if (editingRuleId) {
      await apiPut(`/rules/${editingRuleId}`, { day_of_week, target_time, duration, playground_order });
      toast('success', 'Règle modifiée', `${DAY_NAMES_FULL[day_of_week]} à ${target_time}`);
    } else {
      await apiPost('/rules', { day_of_week, target_time, duration, playground_order });
      toast('success', 'Règle créée', `${DAY_NAMES_FULL[day_of_week]} à ${target_time}`);
    }
    hideAddRule();
    loadDashboard();
  } catch (err) {
    toast('error', 'Erreur', err.message);
  } finally {
    btnLoading(btn, false);
  }
}

async function toggleRule(id, enabled) {
  try {
    await apiPut(`/rules/${id}`, { enabled });
    toast('info', enabled ? 'Règle activée' : 'Règle désactivée');
    loadDashboard();
  } catch (err) {
    toast('error', 'Erreur', err.message);
    loadDashboard();
  }
}

async function deleteRuleConfirm(id) {
  const ok = await confirmModal('Supprimer la règle ?', 'Cette action est irréversible. La règle sera définitivement supprimée.', 'Supprimer', 'btn-danger');
  if (!ok) return;
  try {
    await apiDelete(`/rules/${id}`);
    toast('success', 'Règle supprimée');
    loadDashboard();
  } catch (err) {
    toast('error', 'Erreur', err.message);
  }
}

async function bookNow(ruleId, targetDate, btnEl) {
  const ok = await confirmModal('Réservation immédiate', `Lancer une réservation pour le ${formatDate(targetDate)} ?`, 'Réserver', 'btn-success');
  if (!ok) return;

  btnLoading(btnEl, true);
  try {
    const result = await apiPost('/book-now', { rule_id: ruleId, date: targetDate });
    if (result.status === 'success') {
      toast('success', 'Réservation réussie', `${result.playground} à ${result.booked_time} le ${formatDate(result.target_date)}`);
    } else if (result.status === 'skipped') {
      toast('warning', 'Doublon', `Une réservation existe déjà le ${formatDate(result.target_date)}.`);
    } else if (result.status === 'no_slots') {
      toast('warning', 'Indisponible', `Aucun créneau disponible le ${formatDate(result.target_date)}.`);
    } else {
      toast('error', 'Échec', result.error_message || result.error || 'Erreur inconnue');
    }
    loadDashboard();
  } catch (err) {
    toast('error', 'Erreur', err.message);
    loadDashboard();
  } finally {
    btnLoading(btnEl, false);
  }
}

// ===== MANUAL BOOKING =====

async function searchSlots() {
  const date = document.getElementById('manual-date').value;
  const from = document.getElementById('manual-time-from').value;
  const to = document.getElementById('manual-time-to').value;
  const duration = document.getElementById('manual-duration').value;
  const container = document.getElementById('manual-slots');
  const btn = document.getElementById('btn-search-slots');

  if (!date) {
    toast('warning', 'Champ manquant', 'Veuillez choisir une date.');
    return;
  }

  btnLoading(btn, true);
  container.innerHTML = '<div class="section-loading"><div class="section-spinner"></div> Recherche en cours...</div>';

  try {
    let url = `/slots?date=${date}`;
    if (duration) url += `&duration=${duration}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;
    const slots = await apiGet(url);

    if (!Array.isArray(slots) || slots.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucun créneau disponible pour cette date.</p>';
      return;
    }

    const showDuration = !duration;
    container.innerHTML = `
      <table class="logs-table" style="margin-top: 14px">
        <thead>
          <tr>
            <th>Heure</th>
            <th>Terrain</th>
            ${showDuration ? '<th>Durée</th>' : ''}
            <th>Prix/pers</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${slots.map(s => {
            const dur = s.duration / 60;
            return `
            <tr>
              <td><strong>${s.startAt}</strong></td>
              <td>${s.playground.name}</td>
              ${showDuration ? `<td>${dur} min</td>` : ''}
              <td>${(s.price / 100).toFixed(2)} EUR</td>
              <td><button class="btn btn-success btn-sm slot-book-btn" onclick="bookSlot('${date}', '${s.startAt}', ${dur}, '${s.playground.name}', this)">Réserver</button></td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<p class="empty-state">Erreur: ${err.message}</p>`;
  } finally {
    btnLoading(btn, false);
  }
}

async function bookSlot(date, startTime, duration, playgroundName, btnEl) {
  const ok = await confirmModal(
    'Confirmer la réservation',
    `${playgroundName} le ${formatDate(date)} à ${startTime} (${duration}min)`,
    'Réserver', 'btn-success'
  );
  if (!ok) return;

  btnLoading(btnEl, true);
  try {
    const result = await apiPost('/book-manual', { date, startTime, duration, playgroundName });
    if (result.status === 'success') {
      toast('success', 'Réservation réussie', `${result.playground} à ${result.booked_time} le ${formatDate(result.target_date)} - ${(result.price / 100).toFixed(2)} EUR/pers`);
      loadBookings();
      searchSlots();
    } else {
      toast('error', 'Échec', result.error || 'Erreur inconnue');
    }
  } catch (err) {
    toast('error', 'Erreur', err.message);
  } finally {
    btnLoading(btnEl, false);
  }
}

// ===== BOOKINGS (LIVE) =====

function renderBookings(bookings) {
  const container = document.getElementById('bookings-list');

  if (!bookings || bookings.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucune réservation à venir.</p>';
    return;
  }

  container.innerHTML = `
    <table class="logs-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Horaire</th>
          <th>Terrain</th>
          <th>Prix</th>
          <th>Statut</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${bookings.map(b => {
          const dateStr = formatDate(b.date);
          const startTime = b.startAt ? new Date(b.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-';
          const endTime = b.endAt ? new Date(b.endAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-';
          const priceStr = b.pricePerParticipant ? (b.pricePerParticipant / 100).toFixed(2) + ' EUR' : '-';
          const statusBadge = b.confirmed
            ? '<span class="badge badge-success">Confirmée</span>'
            : '<span class="badge badge-pending">Non confirmée</span>';
          const bookingId = b.id.replace(/'/g, "\\'");
          const pgName = (b.playground || '-').replace(/'/g, "\\'");
          return `
            <tr>
              <td><strong>${dateStr}</strong></td>
              <td>${startTime} - ${endTime}</td>
              <td>${b.playground || '-'}</td>
              <td>${priceStr}/pers</td>
              <td>${statusBadge}</td>
              <td><button class="btn btn-danger btn-sm" onclick="cancelBooking('${bookingId}', '${b.date}', '${startTime}', '${pgName}', this)">Annuler</button></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

async function cancelBooking(bookingId, date, time, playground, btnEl) {
  const ok = await confirmModal(
    'Annuler la réservation ?',
    `Réservation du ${formatDate(date)} à ${time} (${playground}). Le remboursement sera automatique si le paiement a été effectué.`,
    'Annuler la réservation', 'btn-danger'
  );
  if (!ok) return;

  btnLoading(btnEl, true);
  try {
    const params = new URLSearchParams({ date, time, playground });
    const result = await apiDelete(`/bookings/${bookingId}?${params}`);
    if (result.success) {
      toast('success', 'Réservation annulée', `${playground} le ${formatDate(date)} à ${time}`);
    } else {
      toast('error', 'Erreur', result.error || 'Erreur inconnue');
    }
    loadBookings();
    loadDashboard();
  } catch (err) {
    toast('error', 'Erreur', err.message);
  } finally {
    btnLoading(btnEl, false);
  }
}

// ===== LOGS =====

function renderLogs(logs) {
  const container = document.getElementById('logs-list');
  selectedLogIds.clear();
  updateDeleteButton();

  if (!logs || logs.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucun historique.</p>';
    return;
  }

  const statusLabels = {
    success: 'Réussi',
    failed: 'Échoué',
    payment_failed: 'Paiement échoué',
    no_slots: 'Indispo',
    pending: 'En cours',
    skipped: 'Doublon',
    cancelled: 'Annulé',
  };

  container.innerHTML = `
    <table class="logs-table">
      <thead>
        <tr>
          <th class="log-check-col"><input type="checkbox" id="log-select-all" onchange="toggleAllLogs(this.checked)" title="Tout sélectionner"></th>
          <th>Type</th>
          <th>Date cible</th>
          <th>Heure visée</th>
          <th>Heure réservée</th>
          <th>Terrain</th>
          <th>Statut</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map(log => {
          const isAuto = log.rule_id !== null && log.rule_id !== undefined;
          const typeBadge = isAuto
            ? '<span class="badge badge-auto">Auto</span>'
            : '<span class="badge badge-manual">Manuel</span>';
          return `
          <tr data-log-id="${log.id}">
            <td class="log-check-col"><input type="checkbox" class="log-checkbox" value="${log.id}" onchange="toggleLogSelection(${log.id}, this.checked)"></td>
            <td>${typeBadge}</td>
            <td>${formatDate(log.target_date)}</td>
            <td>${log.target_time}</td>
            <td>${log.booked_time || '-'}</td>
            <td>${log.playground || '-'}</td>
            <td><span class="badge badge-${log.status}${log.error_message ? ' log-error-hint' : ''}"${log.error_message ? ` title="${log.error_message.replace(/"/g, '&quot;')}"` : ''}>${statusLabels[log.status] || log.status}</span></td>
            <td>${formatDateTime(log.created_at)}</td>
          </tr>
        `}).join('')}
      </tbody>
    </table>
  `;
}

function toggleLogSelection(id, checked) {
  if (checked) {
    selectedLogIds.add(id);
  } else {
    selectedLogIds.delete(id);
  }
  updateDeleteButton();
  updateSelectAllCheckbox();
}

function toggleAllLogs(checked) {
  const checkboxes = document.querySelectorAll('.log-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
    const id = parseInt(cb.value);
    if (checked) {
      selectedLogIds.add(id);
    } else {
      selectedLogIds.delete(id);
    }
  });
  updateDeleteButton();
}

function updateSelectAllCheckbox() {
  const all = document.querySelectorAll('.log-checkbox');
  const selectAll = document.getElementById('log-select-all');
  if (!selectAll || all.length === 0) return;
  const allChecked = [...all].every(cb => cb.checked);
  const someChecked = [...all].some(cb => cb.checked);
  selectAll.checked = allChecked;
  selectAll.indeterminate = someChecked && !allChecked;
}

function updateDeleteButton() {
  const btn = document.getElementById('btn-delete-logs');
  if (!btn) return;
  if (selectedLogIds.size > 0) {
    btn.style.display = '';
    btn.textContent = `Supprimer (${selectedLogIds.size})`;
  } else {
    btn.style.display = 'none';
  }
}

async function deleteSelectedLogs() {
  if (selectedLogIds.size === 0) return;
  const count = selectedLogIds.size;
  const ok = await confirmModal(
    'Supprimer les entrées ?',
    `${count} entrée${count > 1 ? 's' : ''} de l'historique seront définitivement supprimée${count > 1 ? 's' : ''}.`,
    'Supprimer', 'btn-danger'
  );
  if (!ok) return;

  const btn = document.getElementById('btn-delete-logs');
  btnLoading(btn, true);
  try {
    await apiDelete('/logs', { ids: [...selectedLogIds] });
    toast('success', 'Historique nettoyé', `${count} entrée${count > 1 ? 's' : ''} supprimée${count > 1 ? 's' : ''}.`);
    selectedLogIds.clear();
    loadDashboard();
  } catch (err) {
    toast('error', 'Erreur', err.message);
  } finally {
    btnLoading(btn, false);
  }
}

// ===== HELPERS =====

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(dtStr) {
  if (!dtStr) return '-';
  const d = new Date(dtStr + 'Z');
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ===== INIT =====

async function init() {
  try {
    const data = await apiGet('/dashboard');
    dashboardConfig = data.config;
    window._dashboardData = data;
    renderStats(data);
    renderRules(data.rules);
    renderLogs(data.recent_logs);
    loadBookings();
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('manual-date').value = tomorrow.toISOString().split('T')[0];
  init();
});

// Auto-refresh every 60 seconds
setInterval(async () => {
  try {
    const data = await apiGet('/dashboard');
    dashboardConfig = data.config;
    window._dashboardData = data;
    renderStats(data);
    renderRules(data.rules);
    renderLogs(data.recent_logs);
    loadBookings();
  } catch (err) {
    console.error('Auto-refresh failed:', err);
  }
}, 60000);
