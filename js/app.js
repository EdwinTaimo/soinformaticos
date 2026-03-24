const urlPlanilha = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5bbbsZ3ZyyocRFjl0KRS0i7vxq8TOWpTDd3ijBTVo5kZOwkDI_GI6rfOSMPOWbkkn1U_GVbgpf95O/pub?output=csv";
let estadoAnterior = localStorage.getItem('backup_aulas');

async function carregarDados() {
    try {
        const resposta = await fetch(urlPlanilha + "&t=" + new Date().getTime());
        const dados = await resposta.text();
        verificarMudancas(dados);
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
    
    if (diaSemanaAtual === 0 || diaSemanaAtual === 6) {
        segundaRef.setDate(hoje.getDate() + (diaSemanaAtual === 0 ? 1 : 2));
    } else {
        segundaRef.setDate(hoje.getDate() - (diaSemanaAtual - 1));
    }

    const mapaDias = { 0:0, 1:0, 2:1, 3:1, 4:2, 5:3, 6:4 };
    const nomesDias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

    linhas.forEach((linha, index) => {
        const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if(colunas.length >= 4 && colunas[1] && mapaDias[index] !== undefined) {
            const dataCadeira = new Date(segundaRef);
            dataCadeira.setDate(segundaRef.getDate() + mapaDias[index]);
            const diaMes = dataCadeira.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
            const isChecked = colunas[3].trim().toUpperCase() === "TRUE";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-size: 11px; color: #8e9297;">${nomesDias[mapaDias[index]]}<br><b style="color: #dcddde;">${diaMes}</b></td>
                <td><strong>${colunas[1].replace(/"/g, "")}</strong></td>
                <td class="col-docente">${colunas[2] || "---"}</td>
                <td><span class="status-badge ${isChecked ? 'confirmada' : 'por-confirmar'}">${isChecked ? 'Confirmada' : 'Pendente'}</span></td>
            `;
            corpoTabela.appendChild(tr);
        }
    });
}

async function refreshData() {
    const btn = document.getElementById('btn-refresh');
    btn.innerHTML = `<span id="icon-sync" class="spinning">🔄</span> Conectando...`;
    await carregarDados();
    setTimeout(() => {
        btn.innerHTML = `<span id="icon-sync">🔄</span> Atualizar Status`;
        updateTimestamp();
    }, 1000);
}

function updateTimestamp() {
    const agora = new Date();
    document.getElementById('last-update').innerText = `Verificado: ${agora.getHours()}:${agora.getMinutes().toString().padStart(2, '0')}`;
}

function verificarMudancas(novos) {
    if (estadoAnterior && estadoAnterior !== novos && "Notification" in window && Notification.permission === "granted") {
        new Notification("Aulas ET", { body: "O status das aulas foi atualizado!" });
    }
    estadoAnterior = novos;
}

function mostrarCafe() {
    document.getElementById('overlay-cafe').style.display = 'block';
    document.getElementById('modal-cafe').style.display = 'block';
}

function fecharCafe() {
    document.getElementById('overlay-cafe').style.display = 'none';
    document.getElementById('modal-cafe').style.display = 'none';
}

window.onload = () => { carregarDados(); updateTimestamp(); };
setInterval(carregarDados, 60000);
