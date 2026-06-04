let operacoes = [];

let chart;
let filtroAtual = "geral";
let ctx;

let ultimoHash = "";

const GOOGLE_SCRIPT_URL =
"https://script.google.com/macros/s/AKfycbwoOBXFcCbAfy09I7DBpQC2w0ty96j3Hrz62BkkbvamfZy79E1zEWWT0BtZtfnoQrlG/exec";

async function carregarDados() {

    try {

       const response = await fetch(
    GOOGLE_SCRIPT_URL + "?listar=true&t=" + Date.now(),
    {
        cache: "no-store"
    }
);

        const dados = await response.json();

        const novasOperacoes = dados.map(op => {

            const dataObj = new Date(op.data);

            return {

                valor: Number(op.valor),

                data: dataObj.toLocaleDateString("pt-BR"),

                rawDate: op.data

            };

        });

  const hashAtual = JSON.stringify(novasOperacoes);
        
        if (hashAtual !== ultimoHash) {

            ultimoHash = hashAtual;

            operacoes = novasOperacoes;

            atualizarGrafico();

            console.log("Dados alterados");

        }

    } catch (erro) {

        console.error(
            "Erro ao carregar dados:",
            erro
        );
    }
}

/* INIT */
window.addEventListener("load", () => {

    ctx = document.getElementById("equityChart");

    carregarDados();

setInterval(() => {

    carregarDados();

}, 200);

});

/* ENVIAR PARA PLANILHA */
function enviarParaPlanilha(url){

    fetch(url, {
        method: "GET",
        mode: "no-cors",
        cache: "no-cache"
    })
    .then(() => {
        console.log("Dados enviados para a planilha.");
    })
    .catch(err => {
        console.error("ERRO AO ENVIAR:", err);
    });
}

/* RESET */
function resetar(){

    if(!confirm("Tem certeza que deseja resetar tudo?")) return;

    operacoes = [];

    atualizarGrafico();

    enviarParaPlanilha(
        GOOGLE_SCRIPT_URL + "?reset=true"
    );

    setTimeout(() => {

        carregarDados();

    }, 255);
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

        dados = dados.filter(op =>
            new Date(op.rawDate) >= seteDias
        );
    }

    if(filtroAtual === "mensal"){
        const trintaDias = new Date();
        trintaDias.setDate(agora.getDate() - 30);

        dados = dados.filter(op =>
            new Date(op.rawDate) >= trintaDias
        );
    }

    return dados.map(op => {

        saldo += Number(op.valor);

        let label = op.data;

        if(filtroAtual === "geral"){

            const d = new Date(op.rawDate);

            const meses = [
                "JAN","FEV","MAR","ABR","MAI","JUN",
                "JUL","AGO","SET","OUT","NOV","DEZ"
            ];

            label = meses[d.getMonth()];
        }

        return {
            data: label,
            saldo: saldo
        };
    });
}

/* GRÁFICO */
function atualizarGrafico(){

    if(!ctx) return;

    const dados = calcularSaldo();

    const labels = dados.map(x => x.data);
    const valores = dados.map(x => x.saldo);

    const saldoAtual =
        valores.length ? valores[valores.length - 1] : 0;

    const saldoElemento =
        document.getElementById("saldoAtual");

    if(saldoElemento){

        saldoElemento.innerHTML =
        saldoAtual.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });

        saldoElemento.style.color =
        saldoAtual >= 0 ? "#00ff88" : "#ff4d4d";
    }

    if(chart) chart.destroy();

    const gradient =
        ctx.getContext("2d").createLinearGradient(0,0,0,500);

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

            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {

                x: {
                    grid: {
                        color: "rgba(255,255,255,.05)"
                    },
                    ticks: {
                        color: "#b5b5b5"
                    }
                },

                y: {
                    position: "right",
                    grid: {
                        color: "rgba(255,255,255,.08)"
                    },
                    ticks: {
                        color: "#b5b5b5"
                    }
                }
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
            <td class="${op.valor >= 0 ? "positivo" : "negativo"}">
                R$ ${Number(op.valor).toFixed(2)}
            </td>
            <td>R$ ${saldo.toFixed(2)}</td>
        `;

        body.appendChild(tr);
    });
}

/* ADICIONAR OPERAÇÃO */
function adicionarOperacao(){

    const input = document.getElementById("valor");
    const valor = Number(input.value);

    if(input.value === "" || isNaN(valor)) return;

    const agora = new Date();

    const operacao = {
        valor: valor,
        data: agora.toLocaleDateString("pt-BR"),
        rawDate: agora.toISOString()
    };

operacoes.push(operacao);

atualizarGrafico();

    input.value = "";

   const url = new URL(GOOGLE_SCRIPT_URL);

url.searchParams.append("data", operacao.data);
url.searchParams.append("valor", operacao.valor);

enviarParaPlanilha(url.toString());

setTimeout(() => {

    carregarDados();

}, 255);

}

/* ENTER */
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
