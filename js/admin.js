/* =====================================================
   ADMIN — admin.js v2.0
   ===================================================== */

const URL_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR5bbbsZ3ZyyocRFjl0KRS0i7vxq8TOWpTDd3ijBTVo5kZOwkDI_GI6rfOSMPOWbkkn1U_GVbgpf95O/pub?output=csv';
const URL_API = 'https://script.google.com/macros/s/AKfycbzId2pawzW0w_fSTuv77p9LutlcGiYmW-ff5ZMg7RM38u3p1jsTFE_NVirHr4k9uzeE/exec';
const SENHA_MESTRA = "2026";
const NOMES_DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const HORARIOS = ["12:00–14:25", "14:30–16:45", "12:00–14:25", "14:30–16:45", "12:00–16:45", "12:00–16:45", "12:00–16:45", "12:00–16:45", "12:00–16:45", "12:00–16:45"];
const MAPA_DIAS = { 0:0, 1:0, 2:1, 3:1, 4:2, 5:2, 6:3, 7:3, 8:4, 9:4 };

let dadosAdmin = [];
let acaoSenha = null; // callback after auth

/* =====================================================
   INIT
   ===================================================== */
window.addEventListener('DOMContentLoaded', () => {
    carregarAdmin();
    logEntry('Admin panel iniciado.');
});

/* =====================================================
   CARREGAR DADOS
   ===================================================== */
async function carregarAdmin() {
    const body = document.getElementById('admin-body');
    body.innerHTML = `<tr><td colspan="7" class="loading-row"><div class="adm-spinner"></div> A carregar dados...</td></tr>`;

    try {
        const resp = await fetch(URL_CSV + '&t=' + Date.now());
        const texto = await resp.text();
        dadosAdmin = parsearCSVAdmin(texto);
        renderAdmin(dadosAdmin);
        atualizarStats(dadosAdmin);
        renderChart(dadosAdmin);
        logEntry(`Dados carregados: ${dadosAdmin.length} registos.`);
        document.getElementById('admin-status').style.color = 'var(--adm-green)';
    } catch(e) {
        body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--adm-red)">⚠️ Erro ao carregar dados: ${e.message}</td></tr>`;
        document.getElementById('admin-status').style.color = 'var(--adm-red)';
        logEntry('ERRO: ' + e.message);
    }
}

function parsearCSVAdmin(texto) {
    const linhas = texto.split(/\r?\n/).filter(l => l.trim()).slice(1);
    return linhas.map((linha, idx) => {
        const cols = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (cols.length < 4 || !cols[1]?.trim()) return null;
        const statusRaw = cols[3]?.trim().toUpperCase() || '';
        let status = 'pendente', statusCls = 'adm-pend', statusTxt = 'Pendente';
        if (statusRaw === 'TRUE') { status = 'confirmada'; statusCls = 'adm-conf'; statusTxt = 'Confirmada'; }
        else if (statusRaw === 'CANCELADA') { status = 'cancelada'; statusCls = 'adm-canc'; statusTxt = 'Cancelada'; }
        return {
            idx, status, statusCls, statusTxt, statusRaw,
            dia: NOMES_DIAS[MAPA_DIAS[idx] ?? 0],
            cadeira: cols[1].replace(/"/g,'').trim(),
            docente: cols[2]?.replace(/"/g,'').trim() || '—',
            horario: HORARIOS[idx] || '—'
        };
    }).filter(Boolean);
}

/* =====================================================
   RENDER TABLE
   ===================================================== */
function renderAdmin(dados) {
    const body = document.getElementById('admin-body');
    if (!dados.length) {
        body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--adm-text2)">Nenhum resultado.</td></tr>`;
        return;
    }
    body.innerHTML = dados.map(r => `
        <tr id="row-${r.idx}">
            <td><input type="checkbox" class="row-check" data-idx="${r.idx}" value="${r.idx}"></td>
            <td><strong>${r.dia}</strong></td>
            <td style="font-family:var(--mono);font-size:12px;color:var(--adm-accent)">${escHtml(r.cadeira)}</td>
            <td style="color:var(--adm-text2)">${escHtml(r.docente)}</td>
            <td style="font-size:11px;color:var(--adm-text2)">${r.horario}</td>
            <td><span class="adm-badge ${r.statusCls}" id="badge-${r.idx}">${r.statusTxt}</span></td>
            <td>
                <div class="adm-row-actions">
                    <button class="adm-row-btn confirm" onclick="toggleStatus('${escHtml(r.cadeira)}','TRUE',${r.idx})">✅ Conf</button>
                    <button class="adm-row-btn pending" onclick="toggleStatus('${escHtml(r.cadeira)}','FALSE',${r.idx})">⏳ Pend</button>
                    <button class="adm-row-btn cancel" onclick="toggleStatus('${escHtml(r.cadeira)}','CANCELADA',${r.idx})">❌ Canc</button>
                </div>
            </td>
        </tr>
    `).join('');
}

/* =====================================================
   FILTER
   ===================================================== */
function filterAdmin() {
    const q = document.getElementById('adm-search')?.value.toLowerCase() || '';
    const s = document.getElementById('adm-filter-status')?.value || '';
    const filtrado = dadosAdmin.filter(r => {
        const matchQ = !q || r.cadeira.toLowerCase().includes(q) || r.docente.toLowerCase().includes(q);
        const matchS = !s || r.status === s;
        return matchQ && matchS;
    });
    renderAdmin(filtrado);
}

/* =====================================================
   TOGGLE STATUS (com senha)
   ===================================================== */
function toggleStatus(cadeira, novoStatus, idx) {
    pedirSenha(() => executarToggle(cadeira, novoStatus, idx));
}

async function executarToggle(cadeira, novoStatus, idx) {
    // Visual feedback imediato
    const badge = document.getElementById(`badge-${idx}`);
    if (badge) {
        badge.textContent = '⏳ A actualizar...';
        badge.className = 'adm-badge';
    }

    try {
        await fetch(URL_API, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ cadeira, novoStatus })
        });
        logEntry(`Status de "${cadeira}" alterado para ${novoStatus}`);
        admToast(`✅ "${cadeira}" → ${novoStatus}`);
        setTimeout(carregarAdmin, 1500);
    } catch(e) {
        logEntry(`ERRO ao actualizar "${cadeira}": ${e.message}`);
        admToast('⚠️ Erro ao actualizar', true);
        if (badge) badge.textContent = 'Erro';
    }
}

/* ===== BULK ACTIONS ===== */
function bulkAction(novoStatus) {
    const checks = [...document.querySelectorAll('.row-check:checked')];
    if (!checks.length) { admToast('⚠️ Nenhuma aula seleccionada', true); return; }
    pedirSenha(async () => {
        for (const c of checks) {
            const idx = parseInt(c.dataset.idx);
            const row = dadosAdmin.find(r => r.idx === idx);
            if (row) await executarToggle(row.cadeira, novoStatus, idx);
            await delay(300);
        }
    });
}

function selectAll(el) {
    document.querySelectorAll('.row-check').forEach(c => c.checked = el.checked);
}

/* =====================================================
   AUTENTICAÇÃO
   ===================================================== */
function pedirSenha(callback) {
    acaoSenha = callback;
    document.getElementById('senha-input').value = '';
    document.getElementById('senha-erro').textContent = '';
    document.getElementById('adm-overlay-senha').style.display = 'block';
    document.getElementById('adm-overlay-senha').classList.add('show');
    document.getElementById('modal-senha').classList.add('show');
    document.getElementById('senha-input').focus();
}

function fecharSenha() {
    document.getElementById('adm-overlay-senha').classList.remove('show');
    document.getElementById('adm-overlay-senha').style.display = 'none';
    document.getElementById('modal-senha').classList.remove('show');
    acaoSenha = null;
}

function confirmarSenha() {
    const senha = document.getElementById('senha-input').value;
    if (senha !== SENHA_MESTRA) {
        document.getElementById('senha-erro').textContent = '❌ Senha incorrecta!';
        logEntry('Tentativa de autenticação falhada.');
        return;
    }
    fecharSenha();
    if (acaoSenha) { acaoSenha(); acaoSenha = null; }
    logEntry('Autenticado com sucesso.');
}

// Fix overlay ID
document.addEventListener('DOMContentLoaded', () => {
    const ov = document.getElementById('overlay-senha');
    if (ov) ov.id = 'adm-overlay-senha';
});

/* =====================================================
   SECTIONS
   ===================================================== */
function showSection(id, link) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.snav-link').forEach(l => l.classList.remove('active'));
    document.getElementById('section-' + id)?.classList.add('active');
    if (link) link.classList.add('active');

    const titles = { aulas: ['Gestão de Aulas', 'Gerir status das cadeiras'], estatisticas: ['Estatísticas', 'Visão geral dos dados'], log: ['Log de Actividade', 'Registo de acções'] };
    const t = titles[id];
    if (t) {
        document.getElementById('page-title').textContent = t[0];
        document.getElementById('page-sub').textContent = t[1];
    }
    return false;
}

/* =====================================================
   STATS + CHART
   ===================================================== */
function atualizarStats(dados) {
    const conf = dados.filter(r => r.status === 'confirmada').length;
    const pend = dados.filter(r => r.status === 'pendente').length;
    const canc = dados.filter(r => r.status === 'cancelada').length;
    document.getElementById('adm-total').textContent = dados.length;
    document.getElementById('adm-conf').textContent = conf;
    document.getElementById('adm-pend').textContent = pend;
    document.getElementById('adm-canc').textContent = canc;
}

function renderChart(dados) {
    const canvas = document.getElementById('adm-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.offsetWidth - 40;
    canvas.height = 200;

    const conf = dados.filter(r => r.status === 'confirmada').length;
    const pend = dados.filter(r => r.status === 'pendente').length;
    const canc = dados.filter(r => r.status === 'cancelada').length;
    const total = dados.length || 1;

    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Simple bar chart
    const bars = [
        { label: 'Confirmadas', value: conf, color: '#3fb950' },
        { label: 'Pendentes', value: pend, color: '#f85149' },
        { label: 'Canceladas', value: canc, color: '#58a6ff' }
    ];

    const barW = 60, gap = 40, startX = 60;
    const maxVal = Math.max(...bars.map(b => b.value), 1);

    bars.forEach((bar, i) => {
        const x = startX + i * (barW + gap);
        const barH = (bar.value / maxVal) * (h - 60);
        const y = h - 40 - barH;

        // Bar
        ctx.fillStyle = bar.color;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Value
        ctx.fillStyle = '#e6edf3';
        ctx.font = 'bold 14px "Space Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(bar.value, x + barW/2, y - 8);

        // Label
        ctx.fillStyle = '#8b949e';
        ctx.font = '11px Syne';
        ctx.fillText(bar.label, x + barW/2, h - 15);
    });

    // Percentage labels
    ctx.fillStyle = '#6e7681';
    ctx.font = '11px "Space Mono"';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(conf/total*100)}% confirmadas`, 20, 20);
}

/* =====================================================
   LOG
   ===================================================== */
function logEntry(msg) {
    const log = document.getElementById('adm-log');
    if (!log) return;
    const now = new Date().toLocaleTimeString('pt');
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-time">[${now}]</span> ${escHtml(msg)}`;
    log.insertBefore(div, log.firstChild);
}

/* =====================================================
   UTILS
   ===================================================== */
function admToast(msg, isError = false) {
    const t = document.getElementById('adm-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = isError ? 'var(--adm-red)' : 'var(--adm-surface)';
    t.style.color = isError ? '#fff' : 'var(--adm-text)';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Keyboard shortcut: ESC to close modal
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') fecharSenha();
    if (e.key === 'Enter' && document.getElementById('modal-senha')?.classList.contains('show')) confirmarSenha();
});
