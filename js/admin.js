const URL_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR5bbbsZ3ZyyocRFjl0KRS0i7vxq8TOWpTDd3ijBTVo5kZOwkDI_GI6rfOSMPOWbkkn1U_GVbgpf95O/pub?output=csv';
const URL_API = 'https://script.google.com/macros/s/AKfycbzId2pawzW0w_fSTuv77p9LutlcGiYmW-ff5ZMg7RM38u3p1jsTFE_NVirHr4k9uzeE/exec';
const SENHA_MESTRA = "2026";

async function carregarAdmin() {
    const response = await fetch(URL_CSV + "&t=" + new Date().getTime());
    const data = await response.text();
    const rows = data.split(/\r?\n/).filter(r => r.trim() !== "").slice(1);
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = "";

    rows.forEach(row => {
        const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const cadeira = cols[1].replace(/"/g, "").trim();
        const statusRaw = cols[3].trim().toUpperCase();
        
        let statusTxt = "[pendente]";
        let cor = "status-off";
        if(statusRaw === "TRUE") { statusTxt = "[confirmada]"; cor = "status-on"; }
        else if(statusRaw === "CANCELADA") { statusTxt = "[cancelada]"; cor = "status-blue"; }

        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${cadeira}</td><td class="${cor}">${statusTxt}</td>
            <td><button class="btn-action" onclick="toggleStatus('${cadeira}')">./toggle</button></td>`;
        tableBody.appendChild(tr);
    });
}

async function toggleStatus(nome) {
    if(prompt("Sudo password:") !== SENHA_MESTRA) return;
    const op = prompt("1-Conf, 2-Pend, 3-Canc");
    let acao = op === "1" ? "TRUE" : op === "3" ? "CANCELADA" : "FALSE";
    
    await fetch(URL_API, { method: 'POST', mode: 'no-cors', body: JSON.stringify({cadeira: nome, novoStatus: acao}) });
    setTimeout(carregarAdmin, 1500);
}
window.onload = carregarAdmin;
