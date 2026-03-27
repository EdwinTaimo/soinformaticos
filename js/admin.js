/* =====================================================
   ADMIN — admin.js v2.2 (HORÁRIO ATUALIZADO)
   ===================================================== */

const URL_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR5bbbsZ3ZyyocRFjl0KRS0i7vxq8TOWpTDd3ijBTVo5kZOwkDI_GI6rfOSMPOWbkkn1U_GVbgpf95O/pub?output=csv';
const URL_API = 'https://script.google.com/macros/s/AKfycbztOm8PqM2v0u_KkOHwSjBcr4aM458l6KDW8z7CViVAjFH0GUT8b9RKG_S9XyJbVlhu/exec';
const SENHA_MESTRA = "2026";

const NOMES_DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

// Horários e Mapeamento conforme solicitado:
// Segunda: Inglês e Matemática | Terça: SO e PTP II | Quarta: LISP | Quinta: EDA | Sexta: POO
const HORARIOS = [
    "12:00–14:25", "14:30–16:45", // Segunda (0, 1) -> Inglês, Matemática
    "12:00–14:25", "14:30–16:45", // Terça   (2, 3) -> SO, PTP II
    "12:00–14:25", "14:30–16:45", // Quarta  (4, 5) -> LISP
    "12:00–14:25", "14:30–16:45", // Quinta  (6, 7) -> EDA
    "12:00–14:25", "14:30–16:45"  // Sexta   (8, 9) -> POO
];

const MAPA_DIAS = { 
    0:0, 1:0, // Segunda
    2:1, 3:1, // Terça
    4:2, 5:2, // Quarta
    6:3, 7:3, // Quinta
    8:4, 9:4  // Sexta
};

let dadosAulas = [];

/* =====================================================
   INICIALIZAÇÃO
   ===================================================== */
window.onload = () => {
    atualizarDadosAdmin();
    
    if(sessionStorage.getItem('adm_auth') === 'true') {
        const overlay = document.getElementById('adm-overlay-senha');
        const modal = document.getElementById('modal-senha');
        if(overlay) overlay.style.display = 'none';
        if(modal) modal.style.display = 'none';
    } else {
        abrirSenha();
    }
};

/* =====================================================
   CORE: FETCH & PARSE
   ===================================================== */
async function atualizarDadosAdmin() {
    const btn = document.getElementById('btn-sync');
    const icon = document.getElementById('sync-icon');
    if (btn) btn.disabled = true;
    if (icon) icon.style.animation = "spin 1s linear infinite";

    try {
        const res = await fetch(`${URL_CSV}&t=${Date.now()}`);
        const csv = await res.text();
        const linhas = csv.split(/\r?\n/).map(row => row.split(','));

        dadosAulas = [];
        
        for (let idx = 0; idx < 10; idx++) {
            const linhaTabela = linhas[idx + 1];
            
            // Se a linha estiver vazia na folha, mantém a estrutura mas sinaliza vazio
            if (!linhaTabela || linhaTabela.length < 1 || !linhaTabela[0] || linhaTabela[0].trim() === "") {
                dadosAulas.push({
                    id: idx + 1,
                    dia: NOMES_DIAS[MAPA_DIAS[idx]],
                    horario: HORARIOS[idx],
                    disciplina: "---",
                    status: "pendente"
                });
                continue;
            }

            const statusRaw = (linhaTabela[1] || '').trim().toUpperCase();
            let statusFinal = 'pendente';
            
            if (statusRaw === 'TRUE' || statusRaw === 'CONFIRMADA' || statusRaw === 'VERDADEIRO') {
                statusFinal = 'confirmada';
            } else if (statusRaw === 'CANCELADA' || statusRaw === 'FALSE' || statusRaw === 'FALSO') {
                statusFinal = 'cancelada';
            }

            dadosAulas.push({
                id: idx + 1,
                dia: NOMES_DIAS[MAPA_DIAS[idx]],
                horario: HORARIOS[idx],
                disciplina: linhaTabela[0].trim(),
                status: statusFinal
            });
        }

        renderAdminAulas();
        atualizarStats();
        logEntry("Sincronização concluída com o novo horário.");
    } catch (err) {
        console.error(err);
        logEntry("Erro na leitura: " + err.message);
        admToast("Erro ao ligar à base de dados", true);
    } finally {
        if (btn) btn.disabled = false;
        if (icon) icon.style.animation = "";
    }
}

/* =====================================================
   RENDERIZAÇÃO
   ===================================================== */
function renderAdminAulas() {
    const body = document.getElementById('adm-table-body');
    const filtroDia = document.getElementById('adm-filter-dia').value;
    const filtroStatus = document.getElementById('adm-filter-status').value;
    
    if (!body) return;
    body.innerHTML = '';

    const filtrados = dadosAulas.filter(a => {
        const dMatch = filtroDia === 'todos' || a.dia === filtroDia;
        const sMatch = filtroStatus === 'todos' || a.status === filtroStatus;
        return dMatch && sMatch;
    });

    if (filtrados.length === 0) {
        body.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--adm-text2)">Sem aulas para os filtros selecionados.</td></tr>`;
        return;
    }

    filtrados.forEach(aula => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="adm-td-dia">${aula.dia}</div>
                <div class="adm-td-hora">${aula.horario}</div>
            </td>
            <td>
                <div class="adm-td-disc">${escHtml(aula.disciplina)}</div>
            </td>
            <td>
                <span class="adm-badge badge-${aula.status}">${aula.status.toUpperCase()}</span>
            </td>
            <td style="text-align:right">
                <div class="adm-actions">
                    <button class="adm-btn-circle" onclick="updateStatus(${aula.id}, 'TRUE')" title="Confirmar">✅</button>
                    <button class="adm-btn-circle" onclick="updateStatus(${aula.id}, 'CANCELADA')" title="Cancelar">❌</button>
                    <button class="adm-btn-circle" onclick="updateStatus(${aula.id}, 'PENDENTE')" title="Pendente">🔄</button>
                </div>
            </td>
        `;
        body.appendChild(tr);
    });
}

/* =====================================================
   API (GOOGLE SCRIPTS)
   ===================================================== */
async function updateStatus(id, novoStatus) {
    if (sessionStorage.getItem('adm_auth') !== 'true') {
        abrirSenha();
        return;
    }

    admToast("A processar...");
    
    try {
        await fetch(URL_API, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: novoStatus })
        });

        logEntry(`Aula #${id} -> ${novoStatus}`);
        admToast("Estado atualizado!");
        setTimeout(atualizarDadosAdmin, 1200);
    } catch (e) {
        admToast("Erro na API", true);
    }
}

async function bulkAction(status) {
    const filtroDia = document.getElementById('adm-filter-dia').value;
    const msg = filtroDia === 'todos' ? "TODAS as aulas?" : `Todas as aulas de ${filtroDia}?`;
    if (!confirm(`Deseja marcar como ${status} ${msg}`)) return;
    
    const targets = dadosAulas.filter(a => filtroDia === 'todos' || a.dia === filtroDia);

    for (const a of targets) {
        await updateStatus(a.id, status);
        await delay(200);
    }
}

/* =====================================================
   AUTENTICAÇÃO
   ===================================================== */
function abrirSenha() {
    const overlay = document.getElementById('adm-overlay-senha');
    const modal = document.getElementById('modal-senha');
    if(overlay) overlay.style.display = 'block';
    if(modal) modal.style.display = 'block';
    document.getElementById('senha-input')?.focus();
}

function fecharSenha() {
    if(sessionStorage.getItem('adm_auth') === 'true') {
        document.getElementById('adm-overlay-senha').style.display = 'none';
        document.getElementById('modal-senha').style.display = 'none';
    } else {
        window.location.href = 'index.html';
    }
}

function confirmarSenha() {
    const input = document.getElementById('senha-input');
    const erro = document.getElementById('senha-erro');
    if (input.value === SENHA_MESTRA) {
        sessionStorage.setItem('adm_auth', 'true');
        fecharSenha();
    } else {
        erro.textContent = "Incorreta!";
        input.value = "";
    }
}

/* =====================================================
   STATS & UI
   ===================================================== */
function atualizarStats() {
    const conf = dadosAulas.filter(a => a.status === 'confirmada').length;
    const pend = dadosAulas.filter(a => a.status === 'pendente').length;
    const canc = dadosAulas.filter(a => a.status === 'cancelada').length;

    document.getElementById('adm-total').textContent = dadosAulas.length;
    document.getElementById('adm-conf').textContent = conf;
    document.getElementById('adm-pend').textContent = pend;
    document.getElementById('adm-canc').textContent = canc;

    renderChart(conf, pend, canc);
}

function renderChart(conf, pend, canc) {
    const canvas = document.getElementById('adm-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const total = conf + pend + canc || 1;

    ctx.clearRect(0,0,400,200);
    const w = 360, h = 15, x = 20, y = 80;
    const w1 = (conf/total) * w, w2 = (pend/total) * w, w3 = (canc/total) * w;

    ctx.fillStyle = "#10b981"; ctx.fillRect(x, y, w1, h);
    ctx.fillStyle = "#f59e0b"; ctx.fillRect(x + w1, y, w2, h);
    ctx.fillStyle = "#ef4444"; ctx.fillRect(x + w1 + w2, y, w3, h);
    
    ctx.fillStyle = "#9ca3af";
    ctx.font = "11px Space Mono";
    ctx.fillText(`C: ${conf} | P: ${pend} | X: ${canc}`, 20, 110);
}

function showSection(id, el) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.snav-link').forEach(l => l.classList.remove('active'));
    document.getElementById('section-' + id).classList.add('active');
    el.classList.add('active');
}

function logEntry(msg) {
    const log = document.getElementById('adm-log');
    if (!log) return;
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString('pt')}]</span> ${escHtml(msg)}`;
    log.insertBefore(div, log.firstChild);
}

function admToast(msg, isError = false) {
    const t = document.getElementById('adm-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = isError ? '#ef4444' : '#1f2937';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function escHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
