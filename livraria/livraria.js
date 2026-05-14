let nota = [];
let bip = document.getElementById("bip");
let input = document.getElementById("scanner");

/* ===== Atualiza tabela ===== */
function atualizarTela(){
    let tabela = "";
    let itensConferidos = 0;

    nota.forEach(p=>{
        let status = "", classe = "";

        if(p.qtdLida === 0){
            status = "❌ Faltando";
            classe = "faltando"; // vermelho
        } else if(p.qtdLida < p.qtdNota){
            status = "⚠ Parcial";
            classe = "parcial"; // amarelo
        } else if(p.qtdLida === p.qtdNota){
        status = "✔ Conferido";
        classe = "ok";
        itensConferidos++;
        } else {
        status = "🚨 Excedido";
        classe = "excedido"; // pode criar outra cor se quiser
        }

        tabela += `
        <tr class="${classe}">
            <td>${p.codigo}</td>
            <td>${p.ean}</td>
            <td>${p.nome}</td>
            <td>${p.qtdNota}</td>
            <td>${p.qtdLida}</td>
            <td>${status}</td>
        </tr>`;
    });

    document.getElementById("tabela").innerHTML = tabela;
    let percentual = nota.length > 0 ? Math.floor((itensConferidos / nota.length) * 100) : 0;
    document.getElementById("progresso").innerText = `Itens conferidos: ${itensConferidos} / ${nota.length} (${percentual}%)`;
}

/* ===== Lógica do scanner ===== */
input.addEventListener("keypress", function(e){
    if(e.key === "Enter"){
        let codigo = input.value.trim();
        let produto = nota.find(p => p.ean === codigo || p.codigo === codigo);
        if(produto){
    produto.qtdLida++;

    if(produto.qtdLida > produto.qtdNota){
        bip.play();
        alert("⚠ Produto excedeu a quantidade da nota:\n\n" + produto.nome);
    }
    } else {
    bip.play();
    }
        input.value = "";
        atualizarTela();
    }
});

/* ===== Carregar TXT contendo XML ===== */
document.getElementById('txtNFe').addEventListener('change', function(e){
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = function(){
        const txtContent = reader.result;

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(txtContent,"text/xml");

        const erro = xmlDoc.getElementsByTagName("parsererror");
        if(erro.length > 0){
        alert("Erro ao ler XML! Arquivo inválido.");
        return;
        }

        const dets = [...xmlDoc.getElementsByTagName("*")]
    .filter(el => el.localName === "det");

nota = [];

for(let i=0; i<dets.length; i++){

    const prod = Array.from(dets[i].children)
    .find(el => el.localName === "prod");

    if(!prod) continue;

    const get = (tag) => {
        const el = [...prod.getElementsByTagName("*")]
            .find(e => e.localName === tag);
        return el ? el.textContent : "";
    };

    const eanRaw = get("cEAN");
    const ean = (eanRaw === "SEM GTIN") ? "" : eanRaw.trim();

    const codigo = get("cProd");
    const nome = get("xProd") || "Produto";
    // 👉 DEBUG (ver no console)
    console.log(nome);
    const qtd = Number(get("qCom") || 0);

    let existente = null;

    const nomeLimpo = nome.trim().toUpperCase();

     if(ean){
    existente = nota.find(p => 
        p.ean === ean && p.nome === nomeLimpo
    );
    }

    if(existente){
        existente.qtdNota += qtd;
    } else {
        nota.push({
            codigo: codigo,
            ean: ean,
            nome: nome,
            qtdNota: qtd,
            qtdLida: 0
        });
    }
}

        input.disabled = false;
        input.focus();
        atualizarTela();
        alert("TXT/XML carregado! Todos os produtos da nota foram listados.");
    };
    reader.readAsText(file);
});