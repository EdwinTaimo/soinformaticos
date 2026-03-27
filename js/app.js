/* =====================================================
   SÓ INFORMÁTICOS — app.js v2.3 (SINCRONIZAÇÃO TOTAL)
   ===================================================== */

const URL_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5bbbsZ3ZyyocRFjl0KRS0i7vxq8TOWpTDd3ijBTVo5kZOwkDI_GI6rfOSMPOWbkkn1U_GVbgpf95O/pub?output=csv";
const NOMES_DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

// Horários sincronizados exatamente com o Admin
const HORARIOS = [
    "12:00–14:25", "14:30–16:45", // Segunda
    "12:00–14:25", "14:30–16:45", // Terça
    "12:00–14:25", "14:30–16:45", // Quarta
    "12:00–14:25", "14:30–16:45", // Quinta
    "12:00–14:25", "14:30–16:45"  // Sexta
];

const MAPA_DIAS = { 
    0:0, 1:0, 
    2:1, 3:1, 
    4:2, 5:2, 
    6:3, 7:3, 
    8:4, 9:4 
};

let dadosAulas = [];

window.onload = () => {
    fetchAulas();
    initTabs();
    initSearch();
    initFilters();
    updateWeekLabel();
    
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 500);
        }
    }, 1200);
};

async function fetchAulas() {
    try {
        const res = await fetch(`${URL_CSV}&t=${Date.now()}`);
        const csv = await res.text();
        const linhas = csv.split(/\r?\n/).map(row => row.split(','));

        dadosAulas = [];
        for (let idx = 0; idx < 10; idx++) {
            const linhaTabela = linhas[idx + 1];

            if (!linhaTabela || linhaTabela.length < 1 || !linhaTabela[0] || linhaTabela[0].trim() === "") {
                dadosAulas.push({
                    id: idx + 1, dia: NOMES_DIAS[MAPA_DIAS[idx]], horario: HORARIOS[idx],
                    disciplina: "Livre", status: "pendente", statusTexto: "Pendente"
                });
                continue;
            }

            const statusRaw = (linhaTabela[1] || '').trim().toUpperCase();
            let status = 'pendente', statusTexto = 'Pendente';

            if (['TRUE', 'CONFIRMADA', 'VERDADEIRO'].includes(statusRaw)) {
                status = 'confirmada'; statusTexto = 'Confirmada';
            } else if (['CANCELADA', 'FALSE', 'FALSO'].includes(statusRaw)) {
                status = 'cancelada'; statusTexto = 'Cancelada';
            }

            dadosAulas.push({
                id: idx + 1,
                dia: NOMES_DIAS[MAPA_DIAS[idx]],
                horario: HORARIOS[idx],
                disciplina: linhaTabela[0].trim(),
                status: status,
                statusTexto: statusTexto
            });
        }
        renderizarTudo();
    } catch (e) {
        showToast("Erro ao carregar dados", true);
    }
}

function renderizarTudo() {
    renderTabela();
    renderCards();
    renderResumo();
}

function renderTabela() {
    const body = document.getElementById('table-body');
    const fDia = document.getElementById('filter-dia')?.value || 'todos';
    const fStatus = document.getElementById('filter-status')?.value || 'todos';
    const busca = document.getElementById('search-input')?.value.toLowerCase() || '';
    if(!body) return;
    body.innerHTML = '';

    dadosAulas.filter(a => 
        (fDia === 'todos' || a.dia === fDia) && 
        (fStatus === 'todos' || a.status === fStatus) && 
        (a.disciplina.toLowerCase().includes(busca))
    ).forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><div class="td-dia">${a.dia}</div><div class="td-hora">${a.horario}</div></td>
            <td><strong>${escHtml(a.disciplina)}</strong></td>
            <td><span class="status-pill ${a.status}">${a.statusTexto}</span></td>
        `;
        body.appendChild(tr);
    });
}

function renderCards() {
    const grid = document.getElementById('view-cards-wrap');
    if(!grid) return;
    grid.innerHTML = '';

    NOMES_DIAS.forEach(diaNome => {
        const aulasDoDia = dadosAulas.filter(a => a.dia === diaNome);
        const card = document.createElement('div');
        card.className = 'day-card';
        card.innerHTML = `<div class="day-header">${diaNome}</div><div class="day-content">
            ${aulasDoDia.map(a => `
                <div class="card-item ${a.status}">
                    <div class="item-info"><span class="item-time">${a.horario}</span><span class="item-name">${escHtml(a.disciplina)}</span></div>
                    <span class="item-status">${a.statusTexto}</span>
                </div>`).join('')}</div>`;
        grid.appendChild(card);
    });
}

function renderResumo() {
    document.getElementById('stat-conf').textContent = dadosAulas.filter(a => a.status === 'confirmada').length;
    document.getElementById('stat-canc').textContent = dadosAulas.filter(a => a.status === 'cancelada').length;
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn, .tab-panel').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    }));
}

function initSearch() { document.getElementById('search-input')?.addEventListener('input', renderizarTudo); }
function initFilters() {
    document.getElementById('filter-dia')?.addEventListener('change', renderizarTudo);
    document.getElementById('filter-status')?.addEventListener('change', renderizarTudo);
}

function updateWeekLabel() {
    const el = document.getElementById('val-week');
    if(el) {
        const d = new Date(), s = new Date(d.getFullYear(), 0, 1);
        el.textContent = "Semana " + Math.ceil((((d - s) / 86400000) + s.getDay() + 1) / 7);
    }
}

function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg; t.style.background = isError ? '#ef4444' : '#1f2937';
    t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000);
}

function escHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
}
