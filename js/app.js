const urlPlanilha = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5bbbsZ3ZyyocRFjl0KRS0i7vxq8TOWpTDd3ijBTVo5kZOwkDI_GI6rfOSMPOWbkkn1U_GVbgpf95O/pub?output=csv";

// Funções de Interface
function toggleMenu() {
    document.getElementById('side-menu').classList.toggle('active');
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if(window.innerWidth < 600) toggleMenu(); // Fecha o menu no mobile após escolher
}

// Carregar Dados
async function carregarDados() {
    try {
        const resposta = await fetch(urlPlanilha + "&t=" + new Date().getTime());
        const dados = await resposta.text();
        renderizarTabela(dados);
    } catch (e) { console.error("Erro ao carregar", e); }
}

function renderizarTabela(dados) {
    const linhas = dados.split(/\r?\n/).filter(l => l.trim() !== "").slice(1);
    const corpo = document.querySelector("#tabela-aulas tbody");
    corpo.innerHTML = "";

    const nomesDias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
    const mapaDias = { 0:0, 1:0, 2:1, 3:1, 4:2, 5:2, 6:3, 7:3, 8:4, 9:4 };

    linhas.forEach((linha, index) => {
        const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if(colunas.length >= 4) {
            const status = colunas[3].trim().toUpperCase();
            let classe = "por-confirmar", texto = "Pendente";
            
            if(status === "TRUE") { classe = "confirmada"; texto = "Confirmada"; }
            else if(status === "CANCELADA") { classe = "cancelada"; texto = "Cancelada"; }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td data-label="Dia">${nomesDias[mapaDias[index]] || "---"}</td>
                <td data-label="Cadeira">${colunas[1].replace(/"/g, "")}</td>
                <td data-label="Docente">${colunas[2] || "---"}</td>
                <td data-label="Status"><span class="status-badge ${classe}">${texto}</span></td>
            `;
            corpo.appendChild(tr);
        }
    });
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    carregarDados();
});
