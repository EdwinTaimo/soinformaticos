/* =====================================================
   ADMIN — admin.js v3.0 (SEGURANÇA MELHORADA)
   ===================================================== */

const URL_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR5bbbsZ3ZyyocRFjl0KRS0i7vxq8TOWpTDd3ijBTVo5kZOwkDI_GI6rfOSMPOWbkkn1U_GVbgpf95O/pub?output=csv';
const URL_API = 'https://script.google.com/macros/s/AKfycbztOm8PqM2v0u_KkOHwSjBcr4aM458l6KDW8z7CViVAjFH0GUT8b9RKG_S9XyJbVlhu/exec';

// A SENHA FOI REMOVIDA DAQUI. A VALIDAÇÃO É FEITA NO SERVIDOR.

const NOMES_DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

// Horários e Mapeamento
const HORARIOS = [
    "12:00–14:25", "14:30–16:45", // Segunda (0, 1)
    "12:00–14:25", "14:30–16:45", // Terça   (2, 3)
    "12:00–14:25", "14:30–16:45", // Quarta  (4, 5)
    "12:00–14:25", "14:30–16:45", // Quinta  (6, 7)
    "12:00–14:25", "14:30–16:45"  // Sexta   (8, 9)
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
    // Verifica se já está autenticado
    if(sessionStorage.getItem('adm_auth') === 'true') {
        fecharModalSenhaCompleto();
        atualizarDadosAdmin();
    } else {
        abrirSenha();
    }
};

/* =====================================================
   CORE: FETCH & PARSE
   ===================================================== */
async function atualizarDadosAdmin() {
    // Impede a sincronização se não estiver autenticado
    if(sessionStorage.getItem('adm_auth') !== 'true') return;

    const btn = document.getElementById('btn-sync');
    const icon = document.getElementById('sync-icon');
    if (btn) btn.disabled = true;
    if (icon) icon.style.animation = "spin 1s linear infinite";

    try {
        const res = await fetch(`${URL_CSV}&t=${Date.now()}`);
        if (!res.ok) throw new Error("Falha ao carregar CSV");
        const csv = await res.text();
        const linhas = csv.split(/\r?\n/).map(row => row.split(','));

        dadosAulas = [];
        
        // Processa apenas as primeiras 10 linhas de dados (ignora cabeçalho)
        for (let idx = 0; idx < 10; idx++) {
            const linhaTabela = linhas[idx + 1];
            
            // Se a linha estiver vazia ou inválida na folha
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
            
            if (['TRUE', 'CONFIRMADA', 'VERDADEIRO'].includes(statusRaw)) {
                statusFinal = 'confirmada';
            } else if (['CANCELADA', 'FALSE', 'FALSO'].includes(statusRaw)) {
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
        logEntry("Sincronização concluída.");
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
                <span class="adm-badge adm-${aula.status.substring(0,4)}">${aula.status.toUpperCase()}</span>
            </td>
            <td style="text-align:right">
                <div class="adm-row-actions">
                    <button class="adm-row-btn confirm" onclick="updateStatus(${aula.id}, 'TRUE')" title="Confirmar">✅</button>
                    <button class="adm-row-btn cancel" onclick="updateStatus(${aula.id}, 'CANCELADA')" title="Cancelar">❌</button>
                    <button class="adm-row-btn pending" onclick="updateStatus(${aula.id}, 'PENDENTE')" title="Pendente">🔄</button>
                </div>
            </td>
        `;
        body.appendChild(tr);
    });
}

/* =====================================================
   API (GOOGLE SCRIPTS)
   ===================================================== */
async function updateStatus(id, novoStatus, silent = false) {
    if (sessionStorage.getItem('adm_auth') !== 'true') {
        abrirSenha();
        return false;
    }

    if(!silent) admToast("A processar...");
    
    try {
        // Usando metod POST com JSONP/CORS workaround se necessário, 
        // mas assumindo que o endpoint Apps Script aceita POST CORS configurado.
        const response = await fetch(URL_API, {
            method: 'POST',
            mode: 'no-cors', // Mantido 'no-cors' conforme original, mas limita feedback da resposta
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', id: id, status: novoStatus })
        });

        // Como 'no-cors' não permite ler a resposta, assumimos sucesso se não houver erro de rede
        logEntry(`Aula #${id} -> ${novoStatus}`);
        if(!silent) {
            admToast("Estado atualizado!");
            setTimeout(atualizarDadosAdmin, 1000);
        }
        return true;
    } catch (e) {
        console.error(e);
        if(!silent) admToast("Erro na API", true);
        return false;
    }
}

async function bulkAction(status) {
    const filtroDia = document.getElementById('adm-filter-dia').value;
    const msg = filtroDia === 'todos' ? "TODAS as aulas?" : `Todas as aulas de ${filtroDia}?`;
    if (!confirm(`Deseja marcar como ${status} ${msg}`)) return;
    
    const targets = dadosAulas.filter(a => filtroDia === 'todos' || a.dia === filtroDia);
    
    if(targets.length === 0) return;

    admToast(`A atualizar ${targets.length} aulas...`);
    logEntry(`Ação em massa: ${status} para ${targets.length} aulas.`);

    // Executa atualizações em paralelo para maior rapidez
    const promises = targets.map(a => updateStatus(a.id, status, true));
    
    await Promise.all(promises);
    
    admToast("Atualização em massa concluída!");
    setTimeout(atualizarDadosAdmin, 500);
}

/* =====================================================
   AUTENTICAÇÃO (MELHORADA - SEGURANÇA NO SERVIDOR)
   ===================================================== */
function abrirSenha() {
    const overlay = document.getElementById('adm-overlay-senha');
    const modal = document.getElementById('modal-senha');
    if(overlay) overlay.style.display = 'block';
    if(modal) modal.style.display = 'block';
    document.getElementById('senha-input')?.focus();
}

function fecharSenha() {
    // Se tentar fechar sem sucesso, volta ao site principal
    if(sessionStorage.getItem('adm_auth') !== 'true') {
        window.location.href = 'index.html';
    } else {
        fecharModalSenhaCompleto();
    }
}

function fecharModalSenhaCompleto() {
    const overlay = document.getElementById('adm-overlay-senha');
    const modal = document.getElementById('modal-senha');
    if(overlay) overlay.style.display = 'none';
    if(modal) modal.style.display = 'none';
}

async function confirmarSenha() {
    const input = document.getElementById('senha-input');
    const erro = document.getElementById('senha-erro');
    const btn = modal.querySelector('.adm-btn'); // Botão Entrar
    const senha = input.value;

    if(!senha) return;

    // Feedback visual de carregamento
    erro.textContent = "";
    if(btn) {
        btn.disabled = true;
        btn.textContent = "A verificar...";
    }

    try {
        // Envia a senha para validação no servidor (Google Apps Script)
        // Nota: Devido a restrições CORS com Apps Script POST, muitas vezes usa-se GET com JSONP 
        // ou POST com no-cors (que não permite ler a resposta). 
        // Para validação real, o ideal é o Apps Script retornar CORS headers corretos.
        // Assumindo uma implementação Apps Script que retorne JSON com CORS:
        
        const res = await fetch(URL_API, {
            method: 'POST',
            // mode: 'cors', // Requer configuração no Apps Script
            body: JSON.stringify({ action: 'verificarSenha', senha: senha })
        });

        // Como o exemplo original usa 'no-cors' nas atualizações, 
        // validar senha requer tratamento especial. Se mantivermos 'no-cors',
        // não conseguimos ler se a senha está correta.
        // VAMOS ASSUMIR QUE PARA LOGIN O ENDPOINT ESTÁ CONFIGURADO COM CORS.
        
        if (!res.ok) throw new Error("Erro na rede");
        const resultado = await res.json();

        if (resultado.autorizado === true) {
            sessionStorage.setItem('adm_auth', 'true');
            fecharModalSenhaCompleto();
            logEntry("Autenticação bem-sucedida.");
            atualizarDadosAdmin();
        } else {
            erro.textContent = "Senha incorreta!";
            input.value = "";
            input.focus();
        }
    } catch (e) {
        console.error(e);
        erro.textContent = "Erro ao conectar ao servidor.";
        // Fallback para teste local SE o Apps Script não estiver pronto
        // console.warn("Fallback de segurança local ativado para testes.");
        // if(senha === "2026") { sessionStorage.setItem('adm_auth', 'true'); fecharModalSenhaCompleto(); atualizarDadosAdmin(); }
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.textContent = "Entrar";
        }
    }
}

/* =====================================================
   STATS & UI
   ===================================================== */
function atualizarStats() {
    const conf = dadosAulas.filter(a => a.status === 'confirmada').length;
    const pend = dadosAulas.filter(a => a.status === 'pendente').length;
    const canc = dadosAulas.filter(a => a.status === 'cancelada').length;

    const elTotal = document.getElementById('adm-total');
    const elConf = document.getElementById('adm-conf');
    const elPend = document.getElementById('adm-pend');
    const elCanc = document.getElementById('adm-canc');

    if(elTotal) elTotal.textContent = dadosAulas.length;
    if(elConf) elConf.textContent = conf;
    if(elPend) elPend.textContent = pend;
    if(elCanc) elCanc.textContent = canc;

    renderChart(conf, pend, canc);
}

function renderChart(conf, pend, canc) {
    const canvas = document.getElementById('adm-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const total = conf + pend + canc || 1;

    ctx.clearRect(0,0,400,200);
    const w = 360, h = 20, x = 20, y = 80;
    const w1 = (conf/total) * w, w2 = (pend/total) * w, w3 = (canc/total) * w;

    // Cores baseadas no CSS (--adm-green, --adm-yellow, --adm-red)
    ctx.fillStyle = "#3fb950"; ctx.fillRect(x, y, w1, h);
    ctx.fillStyle = "#d29922"; ctx.fillRect(x + w1, y, w2, h);
    ctx.fillStyle = "#f85149"; ctx.fillRect(x + w1 + w2, y, w3, h);
    
    ctx.fillStyle = "#8b949e"; // --adm-text2
    ctx.font = "bold 12px 'Space Mono', monospace";
    ctx.fillText(`CONFIRMADAS: ${conf}`, x, y - 10);
    
    ctx.font = "11px 'Space Mono', monospace";
    ctx.fillText(`C: ${conf} (${Math.round(conf/total*100)}%) | P: ${pend} | X: ${canc}`, x, y + h + 20);
}

function showSection(id, el) {
    // Esconde todas as secções
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    // Remove classe active de todos os links
    document.querySelectorAll('.snav-link').forEach(l => l.classList.remove('active'));
    
    // Mostra a secção selecionada
    const section = document.getElementById('section-' + id);
    if(section) section.classList.add('active');
    
    // Ativa o link clicado
    if(el) el.classList.add('active');

    // Atualiza título da página se necessário
    const titulos = {'aulas': 'Gestão de Aulas', 'estatisticas': 'Dashboard & Estatísticas', 'log': 'Registos do Sistema'};
    const descricoes = {'aulas': 'Controlo em tempo real da folha de aulas.', 'estatisticas': 'Visão geral do estado das aulas.', 'log': 'Histórico de ações recentes.'};
    
    document.getElementById('section-title').textContent = titulos[id] || 'Admin';
    document.getElementById('section-desc').textContent = descricoes[id] || '';
}

function logEntry(msg) {
    const log = document.getElementById('adm-log');
    if (!log) return;
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString('pt')}]</span> ${escHtml(msg)}`;
    log.insertBefore(div, log.firstChild); // Adiciona no topo
}

function admToast(msg, isError = false) {
    const t = document.getElementById('adm-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = isError ? 'var(--adm-danger)' : 'var(--adm-surface2)';
    t.style.color = isError ? '#fff' : 'var(--adm-text)';
    t.style.borderColor = isError ? 'var(--adm-red)' : 'var(--adm-border)';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function escHtml(str) {
    if(!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
}
