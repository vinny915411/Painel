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

        const novasOperacoes = dados

            .filter(op =>
                op.data &&
                op.data !== "" &&
                op.valor !== null &&
                op.valor !== "" &&
                !isNaN(Number(op.valor))
            )

            .map(op => {

                const dataObj = new Date(op.data);

                return {

                    valor: Number(op.valor),

                    data: isNaN(dataObj)
                        ? "Data inválida"
                        : dataObj.toLocaleDateString("pt-BR"),

                    rawDate: op.data

                };

            });

        const hashAtual =
            JSON.stringify(novasOperacoes);

        if(hashAtual !== ultimoHash){

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

    ctx =
        document.getElementById("equityChart");

    carregarDados();

    setInterval(() => {

        carregarDados();

    }, 1000);

});

/* ENVIAR PARA PLANILHA */
function enviarParaPlanilha(url){

    fetch(url, {
        method: "GET",
        mode: "no-cors",
        cache: "no-cache"
    })
    .then(() => {
        console.log(
            "Dados enviados para a planilha."
        );
    })
    .catch(err => {
        console.error(
            "ERRO AO ENVIAR:",
            err
        );
    });
}

/* RESET */
function resetar(){

    if(
        !confirm(
            "Tem certeza que deseja resetar tudo?"
        )
    ) return;

    operacoes = [];
    ultimoHash = "";

    atualizarGrafico();

    enviarParaPlanilha(
        GOOGLE_SCRIPT_URL + "?reset=true"
    );

    setTimeout(() => {

        carregarDados();

    }, 1000);
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

        seteDias.setDate(
            agora.getDate() - 7
        );

        dados = dados.filter(op =>
            new Date(op.rawDate) >= seteDias
        );
    }

    if(filtroAtual === "mensal"){

        const trintaDias = new Date();

        trintaDias.setDate(
            agora.getDate() - 30
        );

        dados = dados.filter(op =>
            new Date(op.rawDate) >= trintaDias
        );
    }

    return dados.map(op => {

        saldo += Number(op.valor);

        let label = op.data;

        if(filtroAtual === "geral"){

            const d =
                new Date(op.rawDate);

            const meses = [
                "JAN","FEV","MAR","ABR",
                "MAI","JUN","JUL","AGO",
                "SET","OUT","NOV","DEZ"
            ];

            label =
                meses[d.getMonth()] ||
                op.data;
        }

        return {
            data: label,
            saldo: saldo
        };
    });
}

/* TABELA */
function atualizarTabela(){

    const body =
        document.getElementById(
            "historicoBody"
        );

    if(!body) return;

    body.innerHTML = "";

    let saldo = 0;

    operacoes.forEach(op => {

        saldo += Number(op.valor);

        const tr =
            document.createElement("tr");

        tr.innerHTML = `
            <td>${op.data}</td>

            <td class="${
                op.valor >= 0
                ? "positivo"
                : "negativo"
            }">

            ${Number(op.valor)
                .toLocaleString(
                    "pt-BR",
                    {
                        style: "currency",
                        currency: "BRL"
                    }
                )}

            </td>

            <td>

            ${saldo.toLocaleString(
                "pt-BR",
                {
                    style: "currency",
                    currency: "BRL"
                }
            )}

            </td>
        `;

        body.appendChild(tr);

    });

}

/* ADICIONAR OPERAÇÃO */
function adicionarOperacao(){

    const input =
        document.getElementById("valor");

    const valor =
        Number(input.value);

    if(
        input.value === "" ||
        isNaN(valor)
    ) return;

    const agora =
        new Date();

    const operacao = {

        valor: valor,

        data:
            agora.toISOString(),

        rawDate:
            agora.toISOString()

    };

    operacoes.push(
        operacao
    );

    atualizarGrafico();

    input.value = "";

    const url =
        new URL(
            GOOGLE_SCRIPT_URL
        );

    url.searchParams.append(
        "data",
        operacao.data
    );

    url.searchParams.append(
        "valor",
        operacao.valor
    );

    enviarParaPlanilha(
        url.toString()
    );

    setTimeout(() => {

        carregarDados();

    }, 500);

}

/* ENTER */
document.addEventListener(
    "DOMContentLoaded",
    () => {

        const input =
            document.getElementById(
                "valor"
            );

        if(input){

            input.addEventListener(
                "keydown",
                (e) => {

                    if(
                        e.key === "Enter"
                    ){

                        e.preventDefault();

                        adicionarOperacao();

                    }

                }
            );

        }

    }
);
