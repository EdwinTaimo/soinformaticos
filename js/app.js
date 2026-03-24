const urlPlanilha = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5bbbsZ3ZyyocRFjl0KRS0i7vxq8TOWpTDd3ijBTVo5kZOwkDI_GI6rfOSMPOWbkkn1U_GVbgpf95O/pub?output=csv";

async function carregarDados() {
    try {
        const resposta = await fetch(urlPlanilha + "&t=" + new Date().getTime());
        const dados = await resposta.text();
        localStorage.setItem('backup_aulas', dados);
        renderizarTabela(dados);
    } catch (erro) {
        const backup = localStorage.getItem('backup_aulas');
        if(backup) renderizarTabela(backup);
    }
}

function renderizarTabela(dados) {
    const linhas = dados.split(/\r?\n/).filter(l => l.trim() !== "").slice(1);
    const corpoTabela = document.querySelector("#tabela-aulas tbody");
    corpoTabela.innerHTML = ""; 

    const hoje = new Date();
    const diaSemanaAtual = hoje.getDay(); 
    let segundaRef = new Date(hoje);
    segundaRef.setDate(hoje.getDate() - (diaSemanaAtual === 0 ? 6 : diaSemanaAtual - 1));

    const nomesDias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
    const mapaDias = { 0:0, 1:0, 2:1, 3:1, 4:2, 5:3, 6:4 };

    linhas.forEach((linha, index) => {
        const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if(colunas.length >= 4 && colunas[1]) {
            const statusTexto = colunas[3].trim().toUpperCase();
            let classeStatus = "por-confirmar";
            let textoExibido = "Pendente";

            if (statusTexto === "TRUE") { classeStatus = "confirmada"; textoExibido = "Confirmada"; }
            else if (statusTexto === "CANCELADA") { classeStatus = "cancelada"; textoExibido = "Cancelada"; }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><b>${nomesDias[mapaDias[index] || 0]}</b></td>
                <td><strong>${colunas[1].replace(/"/g, "")}</strong></td>
                <td class="col-docente">${colunas[2] || "---"}</td>
                <td><span class="status-badge ${classeStatus}">${textoExibido}</span></td>
            `;
            corpoTabela.appendChild(tr);
        }
    });
}

async function refreshData() {
    const btn = document.getElementById('btn-refresh');
    btn.innerHTML = `<span class="spinning">🔄</span> Conectando...`;
    await carregarDados();
    setTimeout(() => {
        btn.innerHTML = `🔄 Atualizar Status`;
    }, 1000);
}

function mostrarCafe() { document.getElementById('overlay-cafe').style.display = 'block'; document.getElementById('modal-cafe').style.display = 'block'; }
function fecharCafe() { document.getElementById('overlay-cafe').style.display = 'none'; document.getElementById('modal-cafe').style.display = 'none'; }

window.onload = carregarDados;
