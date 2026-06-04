let operacoes = [];
let chart;
let filtroAtual = "geral";
let ctx;

// Substitua o link abaixo pelo novo link gerado no seu Apps Script:
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_D0Bg1pfJMR9YMEfriD3-wYO0m2EDSNgE3-P4dDZucJflJ8xN9075RNybpq0KV9qXKg/exec";

/* INIT */
window.addEventListener("load", () => {
    ctx = document.getElementById("equityChart");
    
    // Puxa os dados assim que abre o site
    carregarDadosDaPlanilha();
    
    // Fica vigiando a planilha de 1 em 1 segundo. 
    // Se outro celular enviar algo, este dispositivo atualiza sozinho!
    setInterval(carregarDadosDaPlanilha, 1000);
});

/* BUSCAR DADOS DO GOOGLE SHEETS */
function carregarDadosDaPlanilha() {
    fetch(GOOGLE_SCRIPT_URL)
        .then(response => response.text()) // Lemos como texto puro para burlar o bloqueio do celular
        .then(texto => {
            const dadosVindosDaPlanilha = JSON.parse(texto);
            if (!Array.isArray(dadosVindosDaPlanilha)) return;

            operacoes = dadosVindosDaPlanilha.map(item => {
                const partesData = item.data.split('/');
                let dataObjeto = new Date();
                if(partesData.length === 3) {
                    // DD/MM/AAAA -> Ano, Mês(0-11), Dia
                    dataObjeto = new Date(partesData[2], partesData[1] - 1, partesData[0]);
                }
                return {
                    valor: Number(item.valor),
                    data: item.data,
                    rawDate: dataObjeto.toISOString()
                };
            });
            
            atualizarGrafico();
        })
        .catch(err => console.error("Erro ao sincronizar dados:", err));
}

/* ADICIONAR OPERAÇÃO */
function adicionarOperacao(){
    const input = document.getElementById("valor");
    const valor = Number(input.value);

    if(input.value.trim() === "" || isNaN(valor)) return;

    const agora = new Date();
    const dataFormatada = agora.toLocaleDateString("pt-BR");

    // Limpa o campo na hora para o usuário digitar o próximo
    input.value = "";

    const url = new URL(GOOGLE_SCRIPT_URL);
    url.searchParams.append("data", dataFormatada);
    url.searchParams.append("valor", valor);

    // Envia para a planilha
    fetch(url.toString())
        .then(response => response.text())
        .then(texto => {
            console.log("Enviado e atualizado na planilha!");
            // Quando a planilha responde, nós já processamos os dados novos na hora
            const dadosVindosDaPlanilha = JSON.parse(texto);
            if (Array.isArray(dadosVindosDaPlanilha)) {
                window.processarNovosDados(dadosVindosDaPlanilha);
            }
        })
        .catch(err => console.error("Erro ao enviar:", err));
}

/* FUNÇÃO AUXILIAR DE ATUALIZAÇÃO RÁPIDA */
window.processarNovosDados = function(dadosVindosDaPlanilha) {
    operacoes = dadosVindosDaPlanilha.map(item => {
        const partesData = item.data.split('/');
        let dataObjeto = new Date();
        if(partesData.length === 3) {
            dataObjeto = new Date(partesData[2], partesData[1] - 1, partesData[0]);
        }
        return {
            valor: Number(item.valor),
            data: item.data,
            rawDate: dataObjeto.toISOString()
        };
    });
    atualizarGrafico();
};

/* RESET */
function resetar(){
    if(!confirm("Tem certeza que deseja resetar tudo na nuvem?")) return;

    operacoes = [];
    atualizarGrafico();

    fetch(GOOGLE_SCRIPT_URL + "?reset=true")
        .then(() => {
            console.log("Planilha resetada!");
            carregarDadosDaPlanilha();
        })
        .catch(err => console.error("Erro ao resetar:", err));
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
