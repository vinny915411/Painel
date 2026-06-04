let operacoes = [];
let chart;
let filtroAtual = "geral";
let ctx;

// COLOQUE SEU LINK NOVO AQUI
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_D0Bg1pfJMR9YMEfriD3-wYO0m2EDSNgE3-P4dDZucJflJ8xN9075RNybpq0KV9qXKg/exec";

window.addEventListener("load", () => {
    ctx = document.getElementById("equityChart");
    carregarDados();
    setInterval(carregarDados, 1000); // Sincronismo de 1 segundo
});

function carregarDados() {
    fetch(GOOGLE_SCRIPT_URL)
        .then(res => res.json())
        .then(dados => {
            operacoes = dados.map(item => {
                const p = item.data.split('/');
                const d = p.length === 3 ? new Date(p[2], p[1]-1, p[0]) : new Date();
                return { valor: Number(item.valor), data: item.data, rawDate: d.toISOString() };
            });
            atualizarGrafico();
        })
        .catch(e => console.log("Aguardando conexão..."));
}

function adicionarOperacao() {
    const input = document.getElementById("valor");
    const valor = input.value;
    if (!valor) return;

    const data = new Date().toLocaleDateString("pt-BR");
    input.value = ""; // Limpa na hora

    // ENVIO "CEGO" (Mais seguro para celular)
    const url = `${GOOGLE_SCRIPT_URL}?data=${data}&valor=${valor}`;
    
    fetch(url, { mode: 'no-cors' })
        .then(() => {
            console.log("Enviado!");
            // Não tentamos ler a resposta aqui para evitar erro de CORS
            // O setInterval de 1s vai mostrar o dado na tela automaticamente
        });
}

function resetar() {
    if (!confirm("Resetar planilha?")) return;
    fetch(`${GOOGLE_SCRIPT_URL}?reset=true`, { mode: 'no-cors' }).then(() => carregarDados());
}

function filtrar(t) { filtroAtual = t; atualizarGrafico(); }

function calcularSaldo() {
    let saldo = 0;
    let dados = [...operacoes];
    const agora = new Date();

    if (filtroAtual === "semanal") {
        const sete = new Date(); sete.setDate(agora.getDate() - 7);
        dados = dados.filter(op => new Date(op.rawDate) >= sete);
    } else if (filtroAtual === "mensal") {
        const trinta = new Date(); trinta.setDate(agora.getDate() - 30);
        dados = dados.filter(op => new Date(op.rawDate) >= trinta);
    }

    return dados.map(op => {
        saldo += op.valor;
        let label = op.data;
        if (filtroAtual === "geral") {
            const meses = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
            label = meses[new Date(op.rawDate).getMonth()];
        }
        return { data: label, saldo: saldo };
    });
}

function atualizarGrafico() {
    if (!ctx) return;
    const dados = calcularSaldo();
    const labels = dados.map(x => x.data);
    const valores = dados.map(x => x.saldo);
    const saldoAtual = valores.length ? valores[valores.length - 1] : 0;

    const el = document.getElementById("saldoAtual");
    if (el) {
        el.innerHTML = saldoAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        el.style.color = saldoAtual >= 0 ? "#00ff88" : "#ff4d4d";
    }

    if (chart) chart.destroy();
    const grad = ctx.getContext("2d").createLinearGradient(0,0,0,500);
    grad.addColorStop(0, saldoAtual >= 0 ? "rgba(0,255,136,0.3)" : "rgba(255,77,77,0.3)");
    grad.addColorStop(1, "transparent");

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                borderColor: saldoAtual >= 0 ? "#00ff88" : "#ff4d4d",
                backgroundColor: grad,
                fill: true,
                tension: 0.3,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: "#888" } },
                y: { position: "right", grid: { color: "#222" }, ticks: { color: "#888" } }
            }
        }
    });
    atualizarTabela();
}

function atualizarTabela() {
    const body = document.getElementById("historicoBody");
    if (!body) return;
    body.innerHTML = "";
    let saldo = 0;
    operacoes.forEach(op => {
        saldo += op.valor;
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${op.data}</td><td class="${op.valor >= 0 ? 'positivo':'negativo'}">R$ ${op.valor.toFixed(2)}</td><td>R$ ${saldo.toFixed(2)}</td>`;
        body.appendChild(tr);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("valor");
    if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); adicionarOperacao(); } });
});
