let operacoes = [];
let chart;
let filtroAtual = "geral";
let ctx;

// COLE O SEU NOVO LINK DO APPS SCRIPT AQUI DENTRO DAS ASPAS:
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_D0Bg1pfJMR9YMEfriD3-wYO0m2EDSNgE3-P4dDZucJflJ8xN9075RNybpq0KV9qXKg/exec";

/* INIT */
window.addEventListener("load", () => {
    ctx = document.getElementById("equityChart");
    
    // Carrega os dados imediatamente ao abrir a página
    carregarDadosDaPlanilha();
    
    // Configura o Sincronismo Automático a cada 1 segundo (1000 milissegundos)
    setInterval(carregarDadosDaPlanilha, 1000);
});

/* BUSCAR DADOS DO GOOGLE SHEETS (SINCRONISMO) */
function carregarDadosDaPlanilha() {
    fetch(GOOGLE_SCRIPT_URL)
        .then(response => response.json())
        .then(dadosVindosDaPlanilha => {
            // Mapeia os dados recebidos para o formato que o gráfico usa
            // Como a planilha armazena strings, recriamos uma rawDate aproximada para os filtros funcionarem
            operacoes = dadosVindosDaPlanilha.map(item => {
                const partesData = item.data.split('/');
                let dataObjeto = new Date();
                if(partesData.length === 3) {
                    // Formato PT-BR: DD/MM/AAAA -> Ano, Mês(0-11), Dia
                    dataObjeto = new Date(partesData[2], partesData[1] - 1, partesData[0]);
                }
                return {
                    valor: Number(item.valor),
                    data: item.data,
                    rawDate: dataObjeto.toISOString()
                };
            });
            
            // Atualiza a tela com os dados mais recentes da nuvem
            atualizarGrafico();
        })
        .catch(err => console.error("Erro ao sincronizar dados do Google Sheets:", err));
}

/* RESET */
function resetar(){
    if(!confirm("Tem certeza que deseja resetar tudo na nuvem?")) return;

    operacoes = [];
    atualizarGrafico();

    fetch(GOOGLE_SCRIPT_URL + "?reset=true")
        .then(r => r.text())
        .then(() => {
            console.log("Planilha resetada com sucesso.");
            carregarDadosDaPlanilha();
        })
        .catch(err => console.error("ERRO RESET:", err));
}

/* FILTRO */
function filtrar(tipo){
    filtroAtual = tipo;
    atualizarGrafico();
}

/* CALCULAR SALDO */
function calcularSaldo(){
    let saldo = 0;
    let dados = [...operacoes];
    const agora = new Date();

    if(filtroAtual === "semanal"){
        const seteDias = new Date();
        seteDias.setDate(agora.getDate() - 7);
        dados = dados.filter(op => new Date(op.rawDate) >= seteDias);
    }

    if(filtroAtual === "mensal"){
        const trintaDias = new Date();
        trintaDias.setDate(agora.getDate() - 30);
        dados = dados.filter(op => new Date(op.rawDate) >= trintaDias);
    }

    return dados.map(op => {
        saldo += Number(op.valor);
        let label = op.data;

        if(filtroAtual === "geral"){
            const d = new Date(op.rawDate);
            const meses = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
            label = meses[d.getMonth()];
        }

        return { data: label, saldo: saldo };
    });
}

/* GRÁFICO */
function atualizarGrafico(){
    if(!ctx) return;

    const dados = calcularSaldo();
    const labels = dados.map(x => x.data);
    const valores = dados.map(x => x.saldo);

    const saldoAtual = valores.length ? valores[valores.length - 1] : 0;
    const saldoElemento = document.getElementById("saldoAtual");

    if(saldoElemento){
        saldoElemento.innerHTML = saldoAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        saldoElemento.style.color = saldoAtual >= 0 ? "#00ff88" : "#ff4d4d";
    }

    if(chart) chart.destroy();

    const gradient = ctx.getContext("2d").createLinearGradient(0,0,0,500);
    if(saldoAtual >= 0){
        gradient.addColorStop(0,"rgba(0,255,136,0.35)");
        gradient.addColorStop(1,"rgba(0,255,136,0)");
    } else {
        gradient.addColorStop(0,"rgba(255,77,77,0.35)");
        gradient.addColorStop(1,"rgba(255,77,77,0)");
    }

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    data: valores.map(v => v >= 0 ? v : null),
                    borderColor: "#00ff88",
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 0,
                    borderWidth: 3
                },
                {
                    data: valores.map(v => v < 0 ? v : null),
                    borderColor: "#ff4d4d",
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 0,
                    borderWidth: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: "rgba(255,255,255,.05)" }, ticks: { color: "#b5b5b5" } },
                y: { position: "right", grid: { color: "rgba(255,255,255,.08)" }, ticks: { color: "#b5b5b5" } }
            }
        }
    });

    atualizarTabela();
}

/* TABELA */
function atualizarTabela(){
    const body = document.getElementById("historicoBody");
    if(!body) return;

    body.innerHTML = "";
    let saldo = 0;

    operacoes.forEach(op => {
        saldo += Number(op.valor);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${op.data}</td>
            <td class="${op.valor >= 0 ? "positivo" : "negativo"}">R$ ${Number(op.valor).toFixed(2)}</td>
            <td>R$ ${saldo.toFixed(2)}</td>
        `;
        body.appendChild(tr);
    });
}

/* ADICIONAR OPERAÇÃO À PLANILHA */
function adicionarOperacao(){
    const input = document.getElementById("valor");
    const valor = Number(input.value);

    if(input.value.trim() === "" || isNaN(valor)) return;

    const agora = new Date();
    const dataFormatada = agora.toLocaleDateString("pt-BR");

    input.value = "";

    // Monta o envio para a API da Planilha
    const url = new URL(GOOGLE_SCRIPT_URL);
    url.searchParams.append("data", dataFormatada);
    url.searchParams.append("valor", valor);

    // Envia diretamente para a Planilha do Google
    fetch(url.toString(), { method: "GET" })
        .then(() => {
            console.log("Dado salvo com sucesso na Planilha!");
            // Força uma leitura rápida logo após inserir para atualizar a tela sem esperar o próximo segundo
            carregarDadosDaPlanilha();
        })
        .catch(err => console.error("Erro ao enviar dados para a planilha:", err));
}

/* EVENTO DO TECLADO ENTER */
document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("valor");
    if(input){
        input.addEventListener("keydown", (e) => {
            if(e.key === "Enter"){
                e.preventDefault();
                adicionarOperacao();
            }
        });
    }
});
