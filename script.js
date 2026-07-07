// ==========================================
// CONFIGURAÇÃO DE SEGURANÇA (USUÁRIOS PERMITIDOS)
// ==========================================
const USUARIOS_CADASTRADOS = [
    { usuario: "Vinny", senha: "054769", nome: "Vinicius" }
];

let operacoes = [];
let chart;
let filtroAtual = "geral";
let ctx;
let ultimoHash = "";

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwoOBXFcCbAfy09I7DBpQC2w0ty96j3Hrz62BkkbvamfZy79E1zEWWT0BtZtfnoQrlG/exec";

// ==========================================
// LÓGICA DE CONTROLE DE ACESSO & BIOMETRIA
// ==========================================

function verificarSessao() {
    const usuarioLogado = sessionStorage.getItem("usuarioLogado");
    if (usuarioLogado) {
        exibirPainel(usuarioLogado);
    }
}

function realizarLogin() {
    const userIn = document.getElementById("username").value.trim().toLowerCase();
    const passIn = document.getElementById("password").value;
    const alertBox = document.getElementById("loginAlert");

    // Validação corrigida: aceita maiúsculas ou minúsculas de qualquer formato digitado
    const encontrado = USUARIOS_CADASTRADOS.find(u => 
        u.usuario.toLowerCase() === userIn && u.senha === passIn
    );

    if (encontrado) {
        alertBox.classList.add("hidden");
        sessionStorage.setItem("usuarioLogado", encontrado.nome);
        exibirPainel(encontrado.nome);
    } else {
        alertBox.textContent = "Usuário ou senha incorretos!";
        alertBox.classList.remove("hidden");
    }
}

// Suporte Avançado a Biometria Móvel (Exclusivo para Smartphones via Hardware Real)
async function autenticarBiometria() {
    const alertBox = document.getElementById("loginAlert");
    
    // DETECÇÃO INTEGRADA: Bloqueia o clique se o acesso partir de um computador
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) {
        return; // No PC, a assinatura "Nexus System" ignora o evento de clique por completo
    }

    // Se for um smartphone, inicia o escaneamento nativo do sistema
    if (!window.PublicKeyCredential) {
        alertBox.textContent = "Seu celular não suporta autenticação biométrica.";
        alertBox.classList.remove("hidden");
        return;
    }

    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const options = {
            publicKey: {
                challenge: challenge,
                rp: { name: "Sistema Financeiro" },
                user: {
                    id: new Uint8Array([1, 2, 3, 4]),
                    name: "usuario@sistema.com",
                    displayName: "Usuário Padrão"
                },
                pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                timeout: 60000,
                authenticatorSelection: {
                    authenticatorAttachment: "platform", // Exige estritamente o sensor embutido do celular
                    userVerification: "required"
                }
            }
        };

        // Aciona o sensor de digital/rosto do Android ou iOS
        await navigator.credentials.create(options);
        
        // Login validado pelo hardware nativo do smartphone
        const usuarioPadrao = USUARIOS_CADASTRADOS[0].nome;
        sessionStorage.setItem("usuarioLogado", usuarioPadrao);
        exibirPainel(usuarioPadrao);

    } catch (erro) {
        console.error("Falha ou cancelamento da biometria: ", erro);
        alertBox.textContent = "Falha na verificação biométrica. Use sua senha.";
        alertBox.classList.remove("hidden");
    }
}

function exibirPainel(nome) {
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("mainContent").classList.remove("hidden");
    document.getElementById("nomeUsuarioLogado").textContent = `Olá, ${nome}`;
    
    // Inicializa os dados do painel do seu Google Sheets após autenticar
    inicializarPainel();
}

function logout() {
    sessionStorage.clear();
    window.location.reload();
}

// ==========================================
// FUNÇÕES ORIGINAIS DO PAINEL (PRESERVADAS & CORRIGIDAS)
// ==========================================

function inicializarPainel() {
    ctx = document.getElementById("equityChart");
    carregarDados();
    // Mantém a sincronização contínua com a planilha
    setInterval(() => {
        if (!document.getElementById("mainContent").classList.contains("hidden")) {
            carregarDados();
        }
    }, 3000);
}

async function carregarDados() {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL + "?listar=true&t=" + Date.now(), { cache: "no-store" });
        const dados = await response.json();

        const novasOperacoes = dados.filter(op => {
            return (
                op &&
                op.data &&
                op.data.toString().trim() !== "" &&
                op.valor !== "" &&
                op.valor !== null &&
                op.valor !== undefined
            );
        }).map(op => {
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
        console.error("Erro ao carregar dados:", erro);
    }
}

function enviarParaPlanilha(url){
    fetch(url, { method: "GET", mode: "no-cors", cache: "no-cache" })
    .then(() => console.log("Dados enviados para a planilha."))
    .catch(err => console.error("ERRO AO ENVIAR:", err));
}

function resetar(){
    if(!confirm("Tem certeza que deseja resetar tudo?")) return;
    operacoes = [];
    atualizarGrafico();
    enviarParaPlanilha(GOOGLE_SCRIPT_URL + "?reset=true");
    setTimeout(() => { carregarDados(); }, 5000);
}

function filtrar(tipo){
    filtroAtual = tipo;
    atualizarGrafico();
}

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
    setTimeout(() => { carregarDados(); }, 5000);
}

// Inicializador de Eventos de Tela
window.addEventListener("load", () => {
    verificarSessao();
    
    // Captura o Enter no input de valor
    const inputValor = document.getElementById("valor");
    if(inputValor){
        inputValor.addEventListener("keydown", (e) => {
            if(e.key === "Enter"){
                e.preventDefault();
                adicionarOperacao();
            }
        });
    }

    // Captura o Enter nos campos de login para facilitar o acesso
    const inputPass = document.getElementById("password");
    if(inputPass){
        inputPass.addEventListener("keydown", (e) => {
            if(e.key === "Enter") realizarLogin();
        });
    }
});
