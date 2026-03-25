const urlPlanilha = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5bbbsZ3ZyyocRFjl0KRS0i7vxq8TOWpTDd3ijBTVo5kZOwkDI_GI6rfOSMPOWbkkn1U_GVbgpf95O/pub?output=csv";

const frases = [
    "A felicidade da túa vida depende da calidade dos teus pensamentos. - Marco Aurelio",
    "Non é o que che pasa, senón como reaccionas o que importa. - Epicteto",
    "A sorte é o que sucede cando a preparación se encontra coa oportunidade. - Séneca",
    "Onde hai un ser humano, hai unha oportunidade para a bondade.",
    "Foco no proceso, non só no resultado."
];

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

async function carregarDados() {
    const btn = document.getElementById('btn-refresh');
    if (btn) btn.innerText = "🌀 Syncing...";

    try {
        const resposta = await fetch(urlPlanilha + "&t=" + new Date().getTime());
        const dados = await resposta.text();
        renderizarTabela(dados);
        gerarQuote();
        updateWeather();
    } catch (e) {
        document.querySelector("#tabela-aulas tbody").innerHTML = "<tr><td colspan='4'>⚠️ Erro de conexión.</td></tr>";
    } finally {
        if (btn) btn.innerText = "🔄 Sync";
    }
}

function renderizarTabela(dados) {
    const linhas = dados.split(/\r?\n/).filter(l => l.trim() !== "").slice(1);
    const corpoTabela = document.querySelector("#tabela-aulas tbody");
    corpoTabela.innerHTML = ""; 

    const diaSemanaAtual = new Date().getDay(); // 1 (Seg) a 6 (Sáb)
    const nomesDias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const mapaDias = { 0:1, 1:1, 2:2, 3:2, 4:3, 5:3, 6:4, 7:4, 8:5, 9:5 };

    linhas.forEach((linha, index) => {
        const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (colunas.length >= 4 && colunas[1]) {
            const statusTexto = colunas[3].trim().toUpperCase();
            let classeStatus = "por-confirmar", textoExibido = "Pendente";

            if (statusTexto === "TRUE") { classeStatus = "confirmada"; textoExibido = "Confirmada"; }
            else if (statusTexto === "CANCELADA") { classeStatus = "cancelada"; textoExibido = "Cancelada"; }

            const diaDaLinha = mapaDias[index] || 0;
            const eHoje = diaSemanaAtual === diaDaLinha;

            const tr = document.createElement("tr");
            if(eHoje) tr.className = "row-today";
            tr.style.animationDelay = `${index * 0.05}s`;
            tr.classList.add("fadeInUp");

            tr.innerHTML = `
                <td data-label="Dia"><strong>${nomesDias[diaDaLinha]}</strong></td>
                <td data-label="Cadeira"><code>${colunas[1].replace(/"/g, "")}</code></td>
                <td data-label="Docente">${colunas[2] || "---"}</td>
                <td data-label="Status"><span class="status-badge ${classeStatus}">${textoExibido}</span></td>
            `;
            corpoTabela.appendChild(tr);
        }
    });
}

function filtrarTabela() {
    const input = document.getElementById("searchInput").value.toUpperCase();
    const rows = document.querySelector("#tabela-aulas tbody").getElementsByTagName("tr");

    for (let i = 0; i < rows.length; i++) {
        const text = rows[i].textContent || rows[i].innerText;
        rows[i].style.display = text.toUpperCase().indexOf(input) > -1 ? "" : "none";
    }
}

function gerarQuote() {
    const q = frases[Math.floor(Math.random() * frases.length)];
    document.getElementById('quote-container').innerHTML = `<p>"${q}"</p>`;
}

function updateWeather() {
    const temp = Math.floor(Math.random() * (31 - 25) + 25);
    document.getElementById('weather-widget').innerHTML = `📍 Beira: ${temp}°C ☀️`;
}

function mostrarCafe() { 
    document.getElementById('overlay-cafe').style.display = 'block'; 
    document.getElementById('modal-cafe').style.display = 'block'; 
}

function fecharCafe() { 
    document.getElementById('overlay-cafe').style.display = 'none'; 
    document.getElementById('modal-cafe').style.display = 'none'; 
}

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    carregarDados();
});
