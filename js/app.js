const urlPlanilha = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5bbbsZ3ZyyocRFjl0KRS0i7vxq8TOWpTDd3ijBTVo5kZOwkDI_GI6rfOSMPOWbkkn1U_GVbgpf95O/pub?output=csv";

// Tema
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// Carregar Dados
async function carregarDados() {
    const btn = document.getElementById('btn-refresh');
    if (btn) btn.innerText = "🌀 Syncing...";

    try {
        const resposta = await fetch(urlPlanilha + "&t=" + new Date().getTime());
        const dados = await resposta.text();
        renderizarTabela(dados);
    } catch (e) {
        console.error("Erro na conexão");
        document.querySelector("#tabela-aulas tbody").innerHTML = "<tr><td colspan='4' style='text-align:center'>⚠️ Erro ao conectar ao repositório de dados.</td></tr>";
    } finally {
        if (btn) btn.innerText = "🔄 Sync";
    }
}

// Renderizar Tabela
function renderizarTabela(dados) {
    const linhas = dados.split(/\r?\n/).filter(l => l.trim() !== "").slice(1);
    const corpoTabela = document.querySelector("#tabela-aulas tbody");
    corpoTabela.innerHTML = ""; 

    const nomesDias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
    // Mapeamento corrigido para index das linhas (assumindo 2 aulas por dia)
    const mapaDias = { 0:0, 1:0, 2:1, 3:1, 4:2, 5:2, 6:3, 7:3, 8:4, 9:4 };

    linhas.forEach((linha, index) => {
        // Regex para aceitar vírgulas dentro de aspas
        const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if(colunas.length >= 4 && colunas[1]) {
            const statusTexto = colunas[3].trim().toUpperCase();
            let classeStatus = "por-confirmar", textoExibido = "Pendente";

            if (statusTexto === "TRUE") { classeStatus = "confirmada"; textoExibido = "Confirmada"; }
            else if (statusTexto === "CANCELADA") { classeStatus = "cancelada"; textoExibido = "Cancelada"; }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td data-label="Dia"><strong>${nomesDias[mapaDias[index] || 0]}</strong></td>
                <td data-label="Cadeira"><code>${colunas[1].replace(/"/g, "")}</code></td>
                <td data-label="Docente" class="col-docente">${colunas[2] || "---"}</td>
                <td data-label="Status"><span class="status-badge ${classeStatus}">${textoExibido}</span></td>
            `;
            corpoTabela.appendChild(tr);
        }
    });
}

// Modais
function mostrarCafe() { document.getElementById('overlay-cafe').style.display = 'block'; document.getElementById('modal-cafe').style.display = 'block'; }
function fecharCafe() { document.getElementById('overlay-cafe').style.display = 'none'; document.getElementById('modal-cafe').style.display = 'none'; }

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Carregar Tema
    const savedTheme = localStorage.getItem('theme') || 'dark'; // Padrão 'dark' do Github
    setTheme(savedTheme);
    // Carregar Dados
    carregarDados();
});
