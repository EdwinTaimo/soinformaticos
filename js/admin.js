// ... (mantenha as constantes iniciais URL_CSV, URL_API, etc.)

async function atualizarDadosAdmin() {
    const btn = document.getElementById('btn-sync');
    const icon = document.getElementById('sync-icon');
    if (btn) btn.disabled = true;
    if (icon) icon.style.animation = "spin 1s linear infinite";

    try {
        const res = await fetch(`${URL_CSV}&t=${Date.now()}`);
        const csv = await res.text();
        const linhas = csv.split('\n').map(row => row.split(','));

        dadosAulas = [];
        // O segredo está aqui: verificamos se a linha existe [idx + 1]
        for (let idx = 0; idx < 10; idx++) {
            const linhaAtual = linhas[idx + 1];
            
            // Se a linha não existir na planilha, criamos um dado vazio para não dar erro
            if (!linhaAtual || linhaAtual.length < 2) {
                dadosAulas.push({
                    id: idx + 1,
                    dia: NOMES_DIAS[MAPA_DIAS[idx] ?? 0],
                    horario: HORARIOS[idx],
                    disciplina: "---",
                    status: "pendente"
                });
                continue;
            }

            const statusRaw = (linhaAtual[1] || '').trim().toUpperCase();
            let status = 'pendente';
            if (statusRaw === 'TRUE' || statusRaw === 'CONFIRMADA') status = 'confirmada';
            if (statusRaw === 'CANCELADA' || statusRaw === 'FALSE') status = 'cancelada';

            dadosAulas.push({
                id: idx + 1,
                dia: NOMES_DIAS[MAPA_DIAS[idx] ?? 0],
                horario: HORARIOS[idx],
                disciplina: (linhaAtual[0] || 'Sem Disciplina').trim(),
                status: status
            });
        }

        renderAdminAulas();
        atualizarStats();
        logEntry("Dados sincronizados com sucesso.");
    } catch (err) {
        logEntry("Erro ao sincronizar: " + err.message);
        admToast("Erro ao carregar dados", true);
    } finally {
        if (btn) btn.disabled = false;
        if (icon) icon.style.animation = "";
    }
}
// ... (mantenha o resto das funções igual)
