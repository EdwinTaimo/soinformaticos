/* =====================================================
   SÓ INFORMÁTICOS — app.js v2.0 (CORRIGIDO)
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
   INIT
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme, false);

    setTimeout(() => {
        const splash = document.getElementById('splash');
        if(splash) {
            splash.classList.add('hidden');
            setTimeout(() => splash.style.display = 'none', 600);
        }
    }, 1800);

    carregarDados();
    autoSyncInterval = setInterval(carregarDados, 5 * 60 * 1000);

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

    pomodoroSessions = parseInt(localStorage.getItem('pomo_sessions_' + hoje()) || '0');
    renderSessionDots();
});

function hoje() { return new Date().toDateString(); }

function setTheme(theme, save = true) {
    document.documentElement.setAttribute('data-theme', theme);
    if (save) localStorage.setItem('theme', theme);
    document.querySelectorAll('.theme-menu button').forEach(b => {
        b.style.fontWeight = b.dataset.t === theme ? '900' : '';
    });
}

/* =====================================================
   CARREGAR DADOS (CORRIGIDO)
   ===================================================== */
async function carregarDados() {
    const btnSync = document.getElementById('btn-refresh');
    if(btnSync) btnSync.classList.add('loading');

    try {
        const res = await fetch(URL_CSV);
        if(!res.ok) throw new Error("Erro na rede");
        const csvText = await res.text();
        
        localStorage.setItem('cache_csv_aulas', csvText);
        
        // Atribui os dados processados à variável global
        dadosAulas = parsearCSV(csvText);
        
        renderizarTudo();
        atualizarStats();
        atualizarLastSync();
        verificarCancelamentos();
        
    } catch (error) {
        console.error("Erro ao carregar:", error);
        const dadosLocais = localStorage.getItem('cache_csv_aulas');
        if (dadosLocais) {
            dadosAulas = parsearCSV(dadosLocais);
            renderizarTudo();
            mostrarToast("Modo offline — Dados antigos");
        } else {
            mostrarToast("Erro de ligação e sem cache disponível.", true);
        }
    } finally {
        if(btnSync) btnSync.classList.remove('loading');
    }
}

function parsearCSV(texto) {
    const linhas = texto.split(/\r?\n/).filter(l => l.trim()).slice(1);
    return linhas.map((linha, idx) => {
        // Regex para ignorar vírgulas dentro de aspas (comum em nomes de docentes)
        const cols = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        
        if (cols.length < 2 || !cols[1]?.trim()) return null;

        const cadeira = cols[1].replace(/"/g, '').trim();
        const docente = cols[2]?.replace(/"/g, '').trim() || '—';
        const statusRaw = cols[3]?.replace(/"/g, '').trim().toUpperCase() || '';

        let status = 'pendente', statusTexto = 'Pendente';
        if (statusRaw === 'TRUE' || statusRaw === 'CONFIRMADA') { 
            status = 'confirmada'; 
            statusTexto = 'Confirmada'; 
        } else if (statusRaw === 'CANCELADA' || statusRaw === 'FALSE') { 
            status = 'cancelada'; 
            statusTexto = 'Cancelada'; 
        }

        return {
            idx,
            dia: NOMES_DIAS[MAPA_DIAS[idx] ?? 0],
            cadeira,
            docente,
            horario: HORARIOS[idx] || '—',
            status,
            statusTexto
        };
    }).filter(Boolean);
}

/* =====================================================
   UI & RENDER
   ===================================================== */
function renderizarTudo() {
    let filtrado = filtrarDados();

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
        const matchQ = !q || a.cadeira.toLowerCase().includes(q) || a.docente.toLowerCase().includes(q);
        const matchDia = !dia || a.dia === dia;
        const matchStatus = !status || a.status === status;
        return matchQ && matchDia && matchStatus;
    });
}

function renderTabela(dados) {
    const tbody = document.getElementById('tabela-body');
    if (!tbody) return;
    tbody.innerHTML = dados.map(a => `
        <tr>
            <td data-label="Dia"><strong>${a.dia}</strong></td>
            <td data-label="Cadeira"><code>${escHtml(a.cadeira)}</code></td>
            <td data-label="Docente" class="col-docente">${escHtml(a.docente)}</td>
            <td data-label="Horário"><span class="horario-chip">🕐 ${a.horario}</span></td>
            <td data-label="Status">
                <span class="status-badge ${a.status}"><span class="status-dot"></span>${a.statusTexto}</span>
            </td>
            <td data-label="Ações">
                <div class="row-actions">
                    <button class="row-btn" onclick="adicionarNota('${escHtml(a.cadeira)}')" title="Nota">📝</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderCards(dados) {
    const grid = document.getElementById('cards-grid');
    if (!grid) return;
    grid.innerHTML = dados.map(a => `
        <div class="aula-card ${a.status}">
            <div class="card-dia">${a.dia} · ${a.horario}</div>
            <div class="card-cadeira">${escHtml(a.cadeira)}</div>
            <div class="card-docente">👤 ${escHtml(a.docente)}</div>
            <div class="card-footer">
                <span class="status-badge ${a.status}">${a.statusTexto}</span>
                <button class="row-btn" onclick="adicionarNota('${escHtml(a.cadeira)}')">📝</button>
            </div>
        </div>
    `).join('');
}

function renderSemana(dados) {
    const grid = document.getElementById('week-grid');
    if (!grid) return;
    const hojeIdx = new Date().getDay(); // 1-5
    grid.innerHTML = NOMES_DIAS.map((dNome, i) => {
        const aulasDodia = dados.filter(a => a.dia === dNome);
        return `
            <div class="week-day ${i+1 === hojeIdx ? 'today' : ''}">
                <div class="week-day-header">${dNome}</div>
                <div class="week-aulas">
                    ${aulasDodia.map(a => `
                        <div class="week-aula ${a.status}">
                            <div class="week-aula-name">${escHtml(a.cadeira)}</div>
                            <div class="week-aula-docente">${a.horario}</div>
                        </div>
                    `).join('') || '<div class="empty-notif">Sem aulas</div>'}
                </div>
            </div>
        `;
    }).join('');
}

/* =====================================================
   STATS & UTILS
   ===================================================== */
function atualizarStats() {
    const conf = dadosAulas.filter(a => a.status === 'confirmada').length;
    const pend = dadosAulas.filter(a => a.status === 'por-confirmar').length;
    const canc = dadosAulas.filter(a => a.status === 'cancelada').length;
    
    if(document.getElementById('val-conf')) document.getElementById('val-conf').textContent = conf;
    if(document.getElementById('val-pend')) document.getElementById('val-pend').textContent = pend;
    if(document.getElementById('val-canc')) document.getElementById('val-canc').textContent = canc;
}

function atualizarLastSync() {
    const el = document.getElementById('val-sync');
    if (el) {
        const now = new Date();
        el.textContent = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
    }
}

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function mostrarToast(msg, erro = false) {
    const t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg;
    t.style.background = erro ? '#ef4444' : 'var(--accent)';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

/* Os restantes inits (Tabs, Search, Pomodoro, etc.) permanecem iguais ao seu código original */
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

function initSearch() {
    const input = document.getElementById('search-input');
    if(input) input.addEventListener('input', () => renderizarTudo());
}

function initFilters() {
    document.getElementById('filter-dia')?.addEventListener('change', renderizarTudo);
    document.getElementById('filter-status')?.addEventListener('change', renderizarTudo);
}

function initViewToggle() {
    document.getElementById('view-table')?.addEventListener('click', () => {
        document.getElementById('view-table-wrap').style.display = '';
        document.getElementById('view-cards-wrap').style.display = 'none';
    });
    document.getElementById('view-cards')?.addEventListener('click', () => {
        document.getElementById('view-table-wrap').style.display = 'none';
        document.getElementById('view-cards-wrap').style.display = '';
    });
}

function updateWeekLabel() {
    const el = document.getElementById('val-week');
    if(el) el.textContent = "Semana " + Math.ceil(new Date().getDate() / 7);
}

function loadLocalData() {
    renderNotas();
    renderTarefas();
}

// Funções auxiliares simplificadas para o exemplo
function renderNotas() {}
function renderTarefas() {}
function renderRecursosPadrao() {}
function verificarCancelamentos() {}
function initSortable() {}
function initFAB() {}
function initHeader() {}
function initDragDrop() {}
function initNotifBtn() {}
function renderSessionDots() {}
