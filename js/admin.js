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
        if (cols.length >= 4) {
            const cadeira = cols[1].replace(/"/g, "").trim();
            const isConfirmed = cols[3].trim().toUpperCase() === "TRUE";
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${cadeira.toLowerCase()}</td>
                <td class="${isConfirmed ? 'status-on' : 'status-off'}">${isConfirmed ? '[confirmada]' : '[pendente]'}</td>
                <td><button class="btn-action" onclick="toggleStatus('${cadeira}', ${isConfirmed}, this)">./execute --toggle</button></td>
            `;
            tableBody.appendChild(tr);
        }
    });
}

async function toggleStatus(nome, statusAtual, btn) {
    if(prompt("Sudo password:") !== SENHA_MESTRA) return alert("Access Denied.");
    btn.disabled = true;
    const novoStatus = !statusAtual;

    await fetch(URL_API, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ cadeira: nome, novoStatus: novoStatus })
    });

    setTimeout(() => { carregarAdmin(); }, 1500);
}

window.onload = carregarAdmin;
