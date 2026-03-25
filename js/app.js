/* =====================================================
   SÓ INFORMÁTICOS — app.js v2.0
   ===================================================== */

const URL_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5bbbsZ3ZyyocRFjl0KRS0i7vxq8TOWpTDd3ijBTVo5kZOwkDI_GI6rfOSMPOWbkkn1U_GVbgpf95O/pub?output=csv";
const NOMES_DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const HORARIOS = ["07:30–09:00", "09:15–10:45", "11:00–12:30", "14:00–15:30", "15:45–17:15", "17:30–19:00", "19:15–20:45", "20:45–22:15", "07:30–09:00", "09:15–10:45"];
const MAPA_DIAS = { 0:0, 1:0, 2:1, 3:1, 4:2, 5:2, 6:3, 7:3, 8:4, 9:4 };

let dadosAulas = [];
let sortCol = -1, sortAsc = true;
let currentNoteColor = '#f59e0b';
let pomodoroInterval = null;
let pomodoroSecondsLeft = 25 * 60;
let pomodoroTotalSeconds = 25 * 60;
let pomodoroRunning = false;
let pomodoroSessions = 0;
let dragItem = null;
let notificacoes = [];
let autoSyncInterval = null;

/* =====================================================
   SPLASH + INIT
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Tema
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme, false);

    // Splash
    setTimeout(() => {
        const splash = document.getElementById('splash');
        splash.classList.add('hidden');
        setTimeout(() => splash.style.display = 'none', 600);
    }, 1800);

    // Dados
    carregarDados();
    autoSyncInterval = setInterval(carregarDados, 5 * 60 * 1000); // 5min

    // UI init
    initTabs();
    initSearch();
    initFAB();
    initHeader();
    initViewToggle();
    initSortable();
    initFilters();
    initDragDrop();
    loadLocalData();
    renderRecursosPadrao();
    updateWeekLabel();
    initNotifBtn();

    // Pomodoro sessions from storage
    pomodoroSessions = parseInt(localStorage.getItem('pomo_sessions_' + hoje()) || '0');
    renderSessionDots();
});

function hoje() {
    return new Date().toDateString();
}

/* =====================================================
   TEMA
   ===================================================== */
function setTheme(theme, save = true) {
    document.documentElement.setAttribute('data-theme', theme);
    if (save) localStorage.setItem('theme', theme);
    // Highlight active button
    document.querySelectorAll('.theme-menu button').forEach(b => {
        b.style.fontWeight = b.dataset.t === theme ? '900' : '';
    });
}

/* =====================================================
   CARREGAR DADOS (Google Sheets)
   ===================================================== */
async function carregarDados() {
    const btn = document.getElementById('btn-refresh');
    if (btn) { btn.innerHTML = '<span class="refresh-icon" style="animation:spin 1s linear infinite;display:inline-block">🌀</span> Sync...'; btn.disabled = true; }

    try {
        const resp = await fetch(URL_CSV + "&t=" + Date.now());
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const texto = await resp.text();
        dadosAulas = parsearCSV(texto);
        renderizarTudo();
        atualizarStats();
        atualizarLastSync();
        verificarCancelamentos();
        mostrarToast('✅ Dados actualizados!');
    } catch (e) {
        console.error("Erro sync:", e);
        const tbody = document.getElementById('tabela-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--danger)">⚠️ Erro ao conectar. Verifica a tua ligação à internet.</td></tr>`;
        mostrarToast('⚠️ Erro ao sincronizar', true);
    } finally {
        if (btn) { btn.innerHTML = '🔄 Sync'; btn.disabled = false; }
    }
}

function parsearCSV(texto) {
    const linhas = texto.split(/\r?\n/).filter(l => l.trim()).slice(1);
    return linhas.map((linha, idx) => {
        const cols = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (cols.length < 4 || !cols[1]?.trim()) return null;
        const statusRaw = cols[3]?.trim().toUpperCase() || '';
        let status = 'por-confirmar', statusTexto = 'Pendente';
        if (statusRaw === 'TRUE') { status = 'confirmada'; statusTexto = 'Confirmada'; }
        else if (statusRaw === 'CANCELADA') { status = 'cancelada'; statusTexto = 'Cancelada'; }
        return {
            idx,
            dia: NOMES_DIAS[MAPA_DIAS[idx] ?? 0],
            cadeira: cols[1].replace(/"/g, '').trim(),
            docente: cols[2]?.replace(/"/g, '').trim() || '—',
            horario: HORARIOS[idx] || '—',
            status,
            statusTexto
        };
    }).filter(Boolean);
}

/* =====================================================
   RENDER
   ===================================================== */
function renderizarTudo() {
    let filtrado = filtrarDados();

    // Sorting
    if (sortCol >= 0) {
        const cols = ['dia', 'cadeira', 'docente', 'status'];
        filtrado.sort((a, b) => {
            const va = a[cols[sortCol]] || '';
            const vb = b[cols[sortCol]] || '';
            return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        });
    }

    renderTabela(filtrado);
    renderCards(filtrado);
    renderSemana(dadosAulas);

    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.style.display = filtrado.length === 0 ? 'block' : 'none';
}

function filtrarDados() {
    const q = document.getElementById('search-input')?.value.toLowerCase() || '';
    const dia = document.getElementById('filter-dia')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    return dadosAulas.filter(a => {
        const matchQ = !q || a.cadeira.toLowerCase().includes(q) || a.docente.toLowerCase().includes(q) || a.dia.toLowerCase().includes(q);
        const matchDia = !dia || a.dia === dia;
        const matchStatus = !status || a.status === status;
        return matchQ && matchDia && matchStatus;
    });
}

function renderTabela(dados) {
    const tbody = document.getElementById('tabela-body');
    if (!tbody) return;
    if (!dados.length) { tbody.innerHTML = ''; return; }
    tbody.innerHTML = dados.map(a => `
        <tr>
            <td data-label="Dia"><strong>${a.dia}</strong></td>
            <td data-label="Cadeira"><code>${escHtml(a.cadeira)}</code></td>
            <td data-label="Docente" class="col-docente">${escHtml(a.docente)}</td>
            <td data-label="Horário"><span class="horario-chip">🕐 ${a.horario}</span></td>
            <td data-label="Status">
                <span class="status-badge ${a.status}">
                    <span class="status-dot"></span>${a.statusTexto}
                </span>
            </td>
            <td data-label="Ações">
                <div class="row-actions">
                    <button class="row-btn" onclick="copiarAula('${escHtml(a.cadeira)}','${a.dia}','${a.horario}')" title="Copiar info">📋</button>
                    <button class="row-btn" onclick="adicionarNota('${escHtml(a.cadeira)}')" title="Adicionar nota">📝</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderCards(dados) {
    const grid = document.getElementById('cards-grid');
    if (!grid) return;
    if (!dados.length) { grid.innerHTML = ''; return; }
    grid.innerHTML = dados.map(a => `
        <div class="aula-card ${a.status}">
            <div class="card-dia">${a.dia} · ${a.horario}</div>
            <div class="card-cadeira">${escHtml(a.cadeira)}</div>
            <div class="card-docente">👤 ${escHtml(a.docente)}</div>
            <div class="card-footer">
                <span class="status-badge ${a.status}"><span class="status-dot"></span>${a.statusTexto}</span>
                <button class="row-btn" onclick="adicionarNota('${escHtml(a.cadeira)}')">📝</button>
            </div>
        </div>
    `).join('');
}

function renderSemana(dados) {
    const grid = document.getElementById('week-grid');
    if (!grid) return;
    const diaDaSemana = new Date().getDay(); // 1=seg .. 5=sex
    const diasIdx = [1,2,3,4,5];
    grid.innerHTML = NOMES_DIAS.map((dNome, i) => {
        const aulasDodia = dados.filter(a => a.dia === dNome);
        const isHoje = diasIdx[i] === diaDaSemana;
        return `
            <div class="week-day ${isHoje ? 'today' : ''}">
                <div class="week-day-header">${dNome}${isHoje ? ' 📍' : ''}</div>
                <div class="week-aulas">
                    ${aulasDodia.length ? aulasDodia.map(a => `
                        <div class="week-aula ${a.status}">
                            <div class="week-aula-name">${escHtml(a.cadeira)}</div>
                            <div class="week-aula-docente">${a.horario}</div>
                        </div>
                    `).join('') : '<div style="font-size:11px;color:var(--text3);padding:4px">Sem aulas</div>'}
                </div>
            </div>
        `;
    }).join('');
}

/* =====================================================
   STATS
   ===================================================== */
function atualizarStats() {
    const conf = dadosAulas.filter(a => a.status === 'confirmada').length;
    const pend = dadosAulas.filter(a => a.status === 'por-confirmar').length;
    const canc = dadosAulas.filter(a => a.status === 'cancelada').length;
    const vConf = document.getElementById('val-conf');
    const vPend = document.getElementById('val-pend');
    const vCanc = document.getElementById('val-canc');
    if (vConf) animateNumber(vConf, conf);
    if (vPend) animateNumber(vPend, pend);
    if (vCanc) animateNumber(vCanc, canc);
}

function animateNumber(el, target) {
    let current = 0;
    const step = Math.ceil(target / 20);
    const t = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current;
        if (current >= target) clearInterval(t);
    }, 40);
}

function atualizarLastSync() {
    const el = document.getElementById('val-sync');
    if (el) {
        const now = new Date();
        el.textContent = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
    }
}

function updateWeekLabel() {
    const el = document.getElementById('val-week');
    const semLabel = document.getElementById('semana-label');
    if (!el && !semLabel) return;
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    const label = `Semana ${weekNum}`;
    if (el) el.textContent = label;
    if (semLabel) semLabel.textContent = label + ' · ' + now.getFullYear();
}

/* =====================================================
   VERIFICAR CANCELAMENTOS (notificações)
   ===================================================== */
function verificarCancelamentos() {
    const canceladas = dadosAulas.filter(a => a.status === 'cancelada');
    const prevCanceladas = JSON.parse(localStorage.getItem('prev_canceladas') || '[]');
    const novas = canceladas.filter(a => !prevCanceladas.includes(a.cadeira));
    novas.forEach(a => {
        adicionarNotificacao(`❌ Aula cancelada: ${a.cadeira}`, a.dia + ' · ' + a.horario);
    });
    localStorage.setItem('prev_canceladas', JSON.stringify(canceladas.map(a => a.cadeira)));
}

function adicionarNotificacao(titulo, sub = '') {
    notificacoes.unshift({ titulo, sub, time: new Date().toLocaleTimeString('pt') });
    const dot = document.getElementById('notif-dot');
    if (dot) dot.classList.add('show');
    renderNotificacoes();
}

function renderNotificacoes() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    if (!notificacoes.length) {
        list.innerHTML = '<div class="notif-empty">Sem notificações</div>';
        return;
    }
    list.innerHTML = notificacoes.slice(0,20).map(n => `
        <div class="notif-item">
            <div class="notif-item-title">${n.titulo}</div>
            ${n.sub ? `<div class="notif-item-time">${n.sub}</div>` : ''}
            <div class="notif-item-time">${n.time}</div>
        </div>
    `).join('');
}

function limparNotificacoes() {
    notificacoes = [];
    const dot = document.getElementById('notif-dot');
    if (dot) dot.classList.remove('show');
    renderNotificacoes();
}

function initNotifBtn() {
    const btn = document.getElementById('notif-btn');
    const panel = document.getElementById('notif-panel');
    const overlay = document.getElementById('notif-overlay');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const isOpen = panel.classList.contains('show');
        if (isOpen) fecharNotif();
        else {
            panel.classList.add('show');
            overlay.classList.add('show');
            const dot = document.getElementById('notif-dot');
            if (dot) dot.classList.remove('show');
        }
    });
}
function fecharNotif() {
    document.getElementById('notif-panel')?.classList.remove('show');
    document.getElementById('notif-overlay')?.classList.remove('show');
}

/* =====================================================
   TABS
   ===================================================== */
function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById('panel-' + tab.dataset.tab);
            if (panel) panel.classList.add('active');
        });
    });
}

/* =====================================================
   SEARCH
   ===================================================== */
function initSearch() {
    const toggle = document.getElementById('search-toggle');
    const box = document.getElementById('search-box');
    const input = document.getElementById('search-input');
    const clear = document.getElementById('search-clear');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
        box.classList.toggle('open');
        if (box.classList.contains('open')) input.focus();
    });
    input.addEventListener('input', () => renderizarTudo());
    clear.addEventListener('click', () => { input.value = ''; renderizarTudo(); });
}

/* =====================================================
   FILTROS
   ===================================================== */
function initFilters() {
    document.getElementById('filter-dia')?.addEventListener('change', renderizarTudo);
    document.getElementById('filter-status')?.addEventListener('change', renderizarTudo);
}

function limparFiltros() {
    const dia = document.getElementById('filter-dia');
    const status = document.getElementById('filter-status');
    const input = document.getElementById('search-input');
    if (dia) dia.value = '';
    if (status) status.value = '';
    if (input) input.value = '';
    renderizarTudo();
}

/* =====================================================
   VIEW TOGGLE (Table / Cards)
   ===================================================== */
function initViewToggle() {
    document.getElementById('view-table')?.addEventListener('click', () => {
        document.getElementById('view-table-wrap').style.display = '';
        document.getElementById('view-cards-wrap').style.display = 'none';
        document.getElementById('view-table').classList.add('active');
        document.getElementById('view-cards').classList.remove('active');
    });
    document.getElementById('view-cards')?.addEventListener('click', () => {
        document.getElementById('view-table-wrap').style.display = 'none';
        document.getElementById('view-cards-wrap').style.display = '';
        document.getElementById('view-cards').classList.add('active');
        document.getElementById('view-table').classList.remove('active');
    });
}

/* =====================================================
   SORT
   ===================================================== */
function initSortable() {
    document.querySelectorAll('.main-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = parseInt(th.dataset.col);
            if (sortCol === col) sortAsc = !sortAsc;
            else { sortCol = col; sortAsc = true; }
            document.querySelectorAll('.sort-icon').forEach(s => s.textContent = '⇅');
            th.querySelector('.sort-icon').textContent = sortAsc ? '↑' : '↓';
            renderizarTudo();
        });
    });
}

/* =====================================================
   FAB
   ===================================================== */
function initFAB() {
    const btn = document.getElementById('fab-main');
    const group = document.getElementById('fab-group');
    if (!btn) return;
    btn.addEventListener('click', () => {
        btn.classList.toggle('open');
        group.classList.toggle('open');
    });
}

/* =====================================================
   HEADER SCROLL + HAMBURGER
   ===================================================== */
function initHeader() {
    const header = document.getElementById('site-header');
    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 20);
    });
    const ham = document.getElementById('hamburger');
    const nav = document.getElementById('header-nav');
    if (!ham) return;
    ham.addEventListener('click', () => {
        ham.classList.toggle('open');
        nav.classList.toggle('mobile-open');
    });
}

/* =====================================================
   MODAIS
   ===================================================== */
function mostrarModal(id) {
    document.getElementById('overlay-' + id)?.classList.add('show');
    document.getElementById('overlay-' + id).style.display = 'block';
    document.getElementById('modal-' + id)?.classList.add('show');
}
function fecharModal(id) {
    document.getElementById('overlay-' + id)?.classList.remove('show');
    const ov = document.getElementById('overlay-' + id);
    if (ov) ov.style.display = 'none';
    document.getElementById('modal-' + id)?.classList.remove('show');
}
function mostrarModalCafe() { mostrarModal('cafe'); }
function mostrarModalTarefa() { mostrarModal('tarefa'); }
function mostrarModalRecurso() { mostrarModal('recurso'); }

/* =====================================================
   NOTAS
   ===================================================== */
function adicionarNota(cadeira = '') {
    const inp = document.getElementById('nota-cadeira');
    if (inp && cadeira) inp.value = cadeira;
    // Abrir tab notas
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('.tab[data-tab="notas"]')?.classList.add('active');
    document.getElementById('panel-notas')?.classList.add('active');
    mostrarModal('nota');
}

function selectNoteColor(color, el) {
    currentNoteColor = color;
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    el.classList.add('active');
}

function salvarNota() {
    const titulo = document.getElementById('nota-titulo')?.value.trim();
    const cadeira = document.getElementById('nota-cadeira')?.value.trim();
    const conteudo = document.getElementById('nota-conteudo')?.value.trim();
    if (!titulo) { mostrarToast('⚠️ Título obrigatório', true); return; }
    const notas = carregarNotas();
    notas.unshift({ id: Date.now(), titulo, cadeira, conteudo, cor: currentNoteColor, data: new Date().toLocaleDateString('pt') });
    localStorage.setItem('notas', JSON.stringify(notas));
    fecharModal('nota');
    document.getElementById('nota-titulo').value = '';
    document.getElementById('nota-cadeira').value = '';
    document.getElementById('nota-conteudo').value = '';
    renderNotas();
    mostrarToast('📝 Nota guardada!');
}

function carregarNotas() {
    return JSON.parse(localStorage.getItem('notas') || '[]');
}

function renderNotas() {
    const grid = document.getElementById('notes-grid');
    const notas = carregarNotas();
    const emptyEl = document.getElementById('notes-empty');
    if (!notas.length) {
        if (emptyEl) emptyEl.style.display = '';
        if (grid) grid.querySelectorAll('.note-card').forEach(c => c.remove());
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    // Remove old cards
    if (grid) grid.querySelectorAll('.note-card').forEach(c => c.remove());
    notas.forEach(n => {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.style.background = n.cor;
        card.innerHTML = `
            <button class="note-card-del" onclick="deletarNota(${n.id}, event)">×</button>
            <div class="note-card-title">${escHtml(n.titulo)}</div>
            ${n.cadeira ? `<div class="note-card-cadeira">📚 ${escHtml(n.cadeira)}</div>` : ''}
            <div class="note-card-content">${escHtml(n.conteudo || '')}</div>
            <div class="note-card-date">${n.data}</div>
        `;
        if (grid) grid.insertBefore(card, grid.firstChild);
    });
}

function deletarNota(id, e) {
    e?.stopPropagation();
    let notas = carregarNotas().filter(n => n.id !== id);
    localStorage.setItem('notas', JSON.stringify(notas));
    renderNotas();
    mostrarToast('🗑️ Nota eliminada');
}

/* =====================================================
   TAREFAS (Kanban)
   ===================================================== */
function salvarTarefa() {
    const titulo = document.getElementById('task-titulo')?.value.trim();
    const cadeira = document.getElementById('task-cadeira')?.value.trim();
    const data = document.getElementById('task-data')?.value;
    const prioridade = document.getElementById('task-prioridade')?.value;
    const notas = document.getElementById('task-notas')?.value.trim();
    if (!titulo) { mostrarToast('⚠️ Título obrigatório', true); return; }
    const tarefas = carregarTarefas();
    tarefas.push({ id: Date.now(), titulo, cadeira, data, prioridade, notas, status: 'todo' });
    localStorage.setItem('tarefas', JSON.stringify(tarefas));
    fecharModal('tarefa');
    ['task-titulo','task-cadeira','task-data','task-notas'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    renderTarefas();
    mostrarToast('✅ Tarefa criada!');
}

function carregarTarefas() {
    return JSON.parse(localStorage.getItem('tarefas') || '[]');
}

function renderTarefas() {
    const tarefas = carregarTarefas();
    const grupos = { todo: [], doing: [], done: [] };
    tarefas.forEach(t => { if (grupos[t.status]) grupos[t.status].push(t); });

    Object.entries(grupos).forEach(([status, lista]) => {
        const listEl = document.getElementById('list-' + status);
        const countEl = document.getElementById('count-' + status);
        if (!listEl) return;
        if (countEl) countEl.textContent = lista.length;
        listEl.innerHTML = lista.map(t => {
            const deadlineClass = calcDeadlineClass(t.data);
            return `
            <div class="task-item" data-id="${t.id}" data-priority="${t.prioridade}" draggable="true">
                <button class="task-del-btn" onclick="deletarTarefa(${t.id})">×</button>
                <div class="task-item-title">${escHtml(t.titulo)}</div>
                ${t.cadeira ? `<div class="task-item-cadeira">📚 ${escHtml(t.cadeira)}</div>` : ''}
                ${t.data ? `<div class="task-item-deadline ${deadlineClass}">📅 ${formatarData(t.data)}</div>` : ''}
                ${t.notas ? `<div class="task-item-date">${escHtml(t.notas.slice(0,60))}${t.notas.length > 60 ? '…' : ''}</div>` : ''}
            </div>`;
        }).join('');
    });
    // Rebind drag
    initDragDrop();
}

function calcDeadlineClass(dateStr) {
    if (!dateStr) return '';
    const diff = (new Date(dateStr) - new Date()) / 86400000;
    if (diff < 0) return 'overdue';
    if (diff <= 3) return 'soon';
    return 'ok';
}

function formatarData(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt', { day:'2-digit', month:'short', year:'numeric' });
}

function deletarTarefa(id) {
    let tarefas = carregarTarefas().filter(t => t.id !== id);
    localStorage.setItem('tarefas', JSON.stringify(tarefas));
    renderTarefas();
    mostrarToast('🗑️ Tarefa eliminada');
}

function moverTarefa(id, novoStatus) {
    let tarefas = carregarTarefas();
    const t = tarefas.find(t => t.id === id);
    if (t) { t.status = novoStatus; localStorage.setItem('tarefas', JSON.stringify(tarefas)); }
    renderTarefas();
}

/* =====================================================
   DRAG & DROP (Kanban)
   ===================================================== */
function initDragDrop() {
    document.querySelectorAll('.task-item').forEach(item => {
        item.addEventListener('dragstart', e => {
            dragItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });
    });
    document.querySelectorAll('.task-list').forEach(list => {
        list.addEventListener('dragover', e => { e.preventDefault(); list.classList.add('drag-over'); });
        list.addEventListener('dragleave', () => list.classList.remove('drag-over'));
        list.addEventListener('drop', e => {
            e.preventDefault();
            list.classList.remove('drag-over');
            if (dragItem) {
                const novoStatus = list.dataset.status;
                const id = parseInt(dragItem.dataset.id);
                moverTarefa(id, novoStatus);
            }
        });
    });
}

/* =====================================================
   RECURSOS
   ===================================================== */
const RECURSOS_PADRAO = [
    { id: 1, titulo: 'Google Classroom UniLicungo', url: 'https://classroom.google.com', cadeira: 'Geral', tipo: '🔗 Link' },
    { id: 2, titulo: 'W3Schools', url: 'https://www.w3schools.com', cadeira: 'Programação', tipo: '📖 Livro' },
    { id: 3, titulo: 'GitHub Student Pack', url: 'https://education.github.com/pack', cadeira: 'Dev Tools', tipo: '🔗 Link' },
    { id: 4, titulo: 'Khan Academy', url: 'https://www.khanacademy.org', cadeira: 'Matemática', tipo: '🎥 Vídeo' },
];

function renderRecursosPadrao() {
    const grid = document.getElementById('recursos-grid');
    if (!grid) return;
    const guardados = carregarRecursos();
    const todos = [...RECURSOS_PADRAO, ...guardados];
    grid.innerHTML = todos.map(r => `
        <div class="recurso-card" onclick="${r.url ? `window.open('${escHtml(r.url)}','_blank')` : ''}">
            ${r.url && guardados.find(g => g.id === r.id) ? `<button class="recurso-del" onclick="deletarRecurso(${r.id},event)" title="Remover">×</button>` : ''}
            <div class="recurso-tipo">${r.tipo?.split(' ')[0] || '📄'}</div>
            <div class="recurso-titulo">${escHtml(r.titulo)}</div>
            <div class="recurso-cadeira">${escHtml(r.cadeira || '')}</div>
            ${r.url ? `<span class="recurso-link">${r.url}</span>` : ''}
        </div>
    `).join('');
}

function carregarRecursos() {
    return JSON.parse(localStorage.getItem('recursos') || '[]');
}

function salvarRecurso() {
    const titulo = document.getElementById('rec-titulo')?.value.trim();
    const url = document.getElementById('rec-url')?.value.trim();
    const cadeira = document.getElementById('rec-cadeira')?.value.trim();
    const tipo = document.getElementById('rec-tipo')?.value;
    if (!titulo) { mostrarToast('⚠️ Título obrigatório', true); return; }
    const recursos = carregarRecursos();
    recursos.push({ id: Date.now(), titulo, url, cadeira, tipo });
    localStorage.setItem('recursos', JSON.stringify(recursos));
    fecharModal('recurso');
    ['rec-titulo','rec-url','rec-cadeira'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    renderRecursosPadrao();
    mostrarToast('📚 Recurso guardado!');
}

function deletarRecurso(id, e) {
    e?.stopPropagation();
    let recursos = carregarRecursos().filter(r => r.id !== id);
    localStorage.setItem('recursos', JSON.stringify(recursos));
    renderRecursosPadrao();
    mostrarToast('🗑️ Recurso removido');
}

/* =====================================================
   POMODORO
   ===================================================== */
function setPomodoro(mins, label) {
    resetPomodoro();
    pomodoroTotalSeconds = mins * 60;
    pomodoroSecondsLeft = mins * 60;
    document.getElementById('pomo-time').textContent = formatPomoTime(pomodoroSecondsLeft);
    document.getElementById('pomo-label').textContent = label;
    document.querySelectorAll('.pomo-mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.pomo-mode-btn[data-mins="${mins}"]`)?.classList.add('active');
    updatePomoRing();
}

function togglePomodoro() {
    if (pomodoroRunning) {
        clearInterval(pomodoroInterval);
        pomodoroRunning = false;
        document.getElementById('pomo-start').textContent = '▶ Retomar';
    } else {
        pomodoroRunning = true;
        document.getElementById('pomo-start').textContent = '⏸ Pausar';
        pomodoroInterval = setInterval(() => {
            pomodoroSecondsLeft--;
            document.getElementById('pomo-time').textContent = formatPomoTime(pomodoroSecondsLeft);
            updatePomoRing();
            if (pomodoroSecondsLeft <= 0) {
                clearInterval(pomodoroInterval);
                pomodoroRunning = false;
                document.getElementById('pomo-start').textContent = '▶ Iniciar';
                pomodoroSessions++;
                localStorage.setItem('pomo_sessions_' + hoje(), pomodoroSessions);
                renderSessionDots();
                mostrarToast('🍅 Sessão concluída! Faz uma pausa.');
                adicionarNotificacao('🍅 Sessão Pomodoro terminada!', 'Descansa um pouco.');
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Pomodoro Concluído! 🍅', { body: 'Tempo de descanso.' });
                }
            }
        }, 1000);
    }
}

function resetPomodoro() {
    clearInterval(pomodoroInterval);
    pomodoroRunning = false;
    pomodoroSecondsLeft = pomodoroTotalSeconds;
    document.getElementById('pomo-time').textContent = formatPomoTime(pomodoroSecondsLeft);
    document.getElementById('pomo-start').textContent = '▶ Iniciar';
    updatePomoRing();
}

function updatePomoRing() {
    const circumference = 565.49;
    const progress = pomodoroSecondsLeft / pomodoroTotalSeconds;
    const offset = circumference * (1 - progress);
    const ring = document.getElementById('pomo-ring-fill');
    if (ring) ring.style.strokeDashoffset = offset;
}

function formatPomoTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2,'0');
    const s = (secs % 60).toString().padStart(2,'0');
    return `${m}:${s}`;
}

function renderSessionDots() {
    const container = document.getElementById('session-dots');
    if (!container) return;
    container.innerHTML = Array.from({length: 4}, (_, i) =>
        `<div class="session-dot ${i < pomodoroSessions ? 'done' : ''}"></div>`
    ).join('');
}

/* =====================================================
   EXPORT CSV
   ===================================================== */
function exportarCSV() {
    if (!dadosAulas.length) { mostrarToast('⚠️ Sem dados para exportar', true); return; }
    const header = 'Dia,Cadeira,Docente,Horário,Status';
    const rows = dadosAulas.map(a => `${a.dia},"${a.cadeira}","${a.docente}","${a.horario}",${a.statusTexto}`);
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'aulas_unilicungo.csv'; a.click();
    URL.revokeObjectURL(url);
    mostrarToast('📥 Ficheiro exportado!');
}

/* =====================================================
   UTILS
   ===================================================== */
function copiarAula(cadeira, dia, horario) {
    copiarTexto(`${cadeira} — ${dia} ${horario}`, 'Informação copiada!');
}

function copiarTexto(texto, msg) {
    navigator.clipboard?.writeText(texto).then(() => mostrarToast('📋 ' + msg)).catch(() => {
        // Fallback
        const el = document.createElement('textarea');
        el.value = texto; document.body.appendChild(el); el.select();
        document.execCommand('copy'); document.body.removeChild(el);
        mostrarToast('📋 ' + msg);
    });
}

function mostrarToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background = isError ? 'var(--danger)' : 'var(--surface2)';
    toast.style.color = isError ? '#fff' : 'var(--text)';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function scrollTopo() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function loadLocalData() {
    renderNotas();
    renderTarefas();
}

// Notificações browser
if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => Notification.requestPermission(), 5000);
}

// CSS spin helper
const style = document.createElement('style');
style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
document.head.appendChild(style);
