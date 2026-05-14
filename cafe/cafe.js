console.log("JS conectado!");
const url="https://script.google.com/macros/s/AKfycby4gwho-0QULxI_vn7Hf-vaFlxREmMQZSi58y35Bz_Uz3j0mOs2nSjhU5QMmtZD5NSLKQ/exec";
let produtos=[];
let produtosMap = new Map();
let contagensPendentes = [];
let produtoSelecionado = null;
let setorSelecionado = null;

// =======================
// Função para formatar setores
// =======================
function formatarSetor(setor){
  // Remove espaços extras e acentos
  setor = setor.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Primeira letra maiúscula, resto minúsculo
  setor = setor.charAt(0).toUpperCase() + setor.slice(1).toLowerCase();
  return setor;
}

// =======================
// Função de navegação
// =======================
function abrir(id){
  document.querySelectorAll("section").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  if(id === "contagem"){
  setTimeout(() => {
    document.getElementById("contSetor").value = "Estoque";
    verificarPainelCafe();
  }, 100);
}
}

// =======================
// Função para mostrar mensagens
// =======================
function mostrarMsg(idDiv, mensagem, sucesso=true, duracao=2000){
  const div = document.getElementById(idDiv);
  div.textContent = mensagem;
  div.style.color = sucesso ? "green" : "red";
  setTimeout(()=> div.textContent="", duracao);
}

// =======================
// Cadastro de produto
// =======================
function cadastrar() {
  let ean = document.getElementById("ean").value.trim();
  let produto = document.getElementById("produto").value.trim();
  let qtd = parseFloat(document.getElementById("qtd").value) || 0;
  let minimo = parseFloat(document.getElementById("min").value) || 0;
  let familia = normalizarTexto(document.getElementById("familia").value);
  let unidade = document.getElementById("unidade").value;
  let subsetor = document.getElementById("subsetor") 
  ? document.getElementById("subsetor").value 
  : "";

  let setores = [];

  if(document.getElementById("est").checked) setores.push("Estoque");
  if(document.getElementById("coz").checked) setores.push("Cozinha");
  if(document.getElementById("caf").checked) setores.push("Cafe");
  if(document.getElementById("sal").checked) setores.push("Salao");

  // Aplica formatação
  let setor = setores.map(s => formatarSetor(s)).join(",");
  
   if(setores.length == 0){
  mostrarMsg("msgCadastro","Selecione pelo menos um setor!", false);
  return;
  }

  if (!ean || ean.length !== 13 || isNaN(ean)) {
    mostrarMsg("msgCadastro","EAN13 inválido! Deve conter 13 números", false);
    return;
  }

  // 🔒 NOVA VALIDAÇÃO
  if (produtosMap.has(ean)) {
  mostrarMsg("msgCadastro","Este EAN já está cadastrado!", false);
  return;
  }

  if (!produto) {
    mostrarMsg("msgCadastro","Digite o nome do produto!", false);
    return;
  }

  let estoque = qtd;
  let cozinha = 0;
  let cafe = 0;
  let salao = 0;

  fetch(url, {
    method: "POST",
    body: JSON.stringify({
    tipo: "cadastro",
    ean: ean,
    produto: produto,
    familia: familia,
    estoque: estoque,
    cozinha: cozinha,
    cafe: cafe,
    salao:salao,
    minimo: minimo,
    setor: setor,
    imagem: "",
    unidade: unidade,
    subsetor: subsetor

    })
  })
  .then(res => res.text())
  .then(resposta => {
    if (resposta === "EAN_DUPLICADO") { mostrarMsg("msgCadastro","Este EAN já está cadastrado!", false); return; }
    if (resposta === "EAN_INVALIDO") { mostrarMsg("msgCadastro","EAN inválido!", false); return; }

    mostrarMsg("msgCadastro","Produto cadastrado com sucesso!");
    document.getElementById("ean").value = "";
    document.getElementById("produto").value = "";
    document.getElementById("familia").value = "";
    document.getElementById("qtd").value = "";
    document.getElementById("est").checked = false;
    document.getElementById("coz").checked = false;
    document.getElementById("caf").checked = false;
    document.getElementById("sal").checked = false;
    document.getElementById("min").value = "";
    carregarProdutos();
  })
  .catch(err => { mostrarMsg("msgCadastro","Erro ao cadastrar produto!", false); console.error(err); });
}

// =======================
// Movimentação de produtos
// =======================
function movimentar() {
  let ean = document.getElementById("movEan").value.trim();
  let origemSetor = formatarSetor(document.getElementById("origem").value);
  let destinoSetor = formatarSetor(document.getElementById("destino").value);
  let qtd = parseFloat(document.getElementById("movQtd").value);

  if (!ean || isNaN(qtd) || qtd <= 0) { mostrarMsg("msgMov","Informe EAN e quantidade válidos!", false); return; }
  if (origemSetor === destinoSetor) { mostrarMsg("msgMov","Origem e destino não podem ser iguais!", false); return; }

  let p = produtosMap.get(ean);

  if (!p) {
  mostrarMsg("msgMov","Produto não encontrado!", false);
  return;
  }

  let setoresPermitidos = p.setor.split(",").map(s => formatarSetor(s));
  if(!setoresPermitidos.includes(destinoSetor)){

  mostrarMsg("msgMov","⚠️ Este produto não pertence a este setor!", false);
  return;
  }
  let origemValor = Number(p[origemSetor.toLowerCase()]) || 0;

  if (origemValor < qtd) {
  mostrarMsg("msgMov","Quantidade insuficiente na origem!", false);
  return;
  }

  
  fetch(url, {
    method: "POST",
    body: JSON.stringify({
      tipo: "movimentacao",
      ean: ean,
      origem: origemSetor,
      destino: destinoSetor,
      quantidade: qtd
    })
  })
  .then(res => res.text())
  .then(resposta => {
    if (resposta === "OK") {
      mostrarMsg("msgMov","Movimentação realizada!");
      carregarProdutos();
      document.getElementById("movEan").value = "";
      document.getElementById("movQtd").value = "";
    } else if(resposta === "ESTOQUE_INSUFICIENTE") {
      mostrarMsg("msgMov","Quantidade insuficiente na origem!", false);
    } else {
      mostrarMsg("msgMov","Erro ao movimentar produto!", false);
    }
  });
}

// =======================
// Contagem noturna
// =======================
/*
function contagem() {
  let ean = contEan.value.trim();
  let setor = formatarSetor(document.getElementById("contSetor").value);
  let qtd = parseInt(contQtd.value);

  if (!ean || isNaN(qtd) || qtd < 0) { mostrarMsg("msgCont","Informe EAN e quantidade válidos!", false); return; }

  fetch(url, {
    method: "POST",
    body: JSON.stringify({
      tipo: "contagem",
      ean: ean,
      setor: setor,
      quantidade: qtd
    })
  })
  .then(res => res.text())
  .then(resposta => {
    if (resposta === "OK") {
      mostrarMsg("msgCont","Contagem registrada!");
      carregarProdutos();
      contEan.value = "";
      contQtd.value = "";
    } else {
      mostrarMsg("msgCont","Erro na contagem!", false);
    }
  });
}
*/
// =======================
// Atualiza tabela HTML
// =======================
function atualizar(){

let t = document.getElementById("tabela");
t.innerHTML = "";

let familias = {};

produtos.forEach(p => {

if(!familias[p.familia]){
familias[p.familia] = [];
}

familias[p.familia].push(p);

});

for(let familia in familias){

t.innerHTML += `
<tr style="background:#0f172a;color:white;font-weight:bold">
<td colspan="7">${familia}</td>
</tr>
`;

familias[familia].forEach(p => {

let total = 
(Number(p.estoque) || 0) + 
(Number(p.cozinha) || 0) + 
(Number(p.cafe) || 0) + 
(Number(p.salao) || 0);

let classe = "";

let minimo = Number(p.minimo) || 0;

if(total <= minimo){
classe = "class='estoque-baixo'";
}

t.innerHTML += `
<tr ${classe}>
<td>${p.ean}</td>
<td>${p.produto}</td>
<td>${p.familia}</td>
<td>${p.estoque} ${p.unidade}</td>
<td>${p.cozinha} ${p.unidade}</td>
<td>${p.cafe} ${p.unidade}</td>
<td>${p.salao || 0} ${p.unidade}</td>
<td>${total} ${p.unidade}</td>

<td>
<button onclick="abrirModalEditar('${p.ean}')">✏️</button>
<button onclick="excluirProduto('${p.ean}')">🗑</button>
</td>

</tr>
`;

});

}

}
// =======================
// Carrega produtos do Google Sheets
// =======================
function carregarProdutos() {
  fetch(url)
    .then(res => res.json())
    .then(dados => {
      produtos = [];
      for (let i = 1; i < dados.length; i++) {
        // Padroniza os setores com formatarSetor
        let setoresFormatados = (dados[i][8] ? dados[i][8] : "")
       .split(",")
       .map(s => formatarSetor(s))
       .join(",");

        produtos.push({
        ean: String(dados[i][0]),
        produto: dados[i][1],
        familia: dados[i][2],
        estoque: Number(dados[i][3]) || 0,
        cozinha: Number(dados[i][4]) || 0,
        cafe: Number(dados[i][5]) || 0,
        salao: Number(dados[i][6]) || 0,
        minimo: Number(dados[i][7]) || 0,
        setor: setoresFormatados,
        imagem: dados[i][9] || "",
        unidade: (dados[i][10] || "UN").toString().trim(),
        subsetor: dados[i][11] || ""
      });
}
// 🚀 CRIA O MAPA DEPOIS DO LOOP
produtosMap = new Map();
produtos.forEach(p=>{
produtosMap.set(p.ean,p);
});

     atualizar();
     verificarPainelCafe();
     console.log("PRODUTOS CARREGADOS:", produtos);
     })
    .catch(err => { 
      mostrarMsg("msgCadastro","Não foi possível carregar os produtos!", false); 
      console.error(err); 
    });
}

function buscarProduto(){

let termo = document.getElementById("buscaProduto").value.toLowerCase().trim();
let t = document.getElementById("tabela");

if(termo === ""){
atualizar();
return;
}

t.innerHTML = "";

produtos
.filter(p => 
p.produto.toLowerCase().includes(termo) ||
p.ean.includes(termo)
)
.forEach(p => {

let total = 
(Number(p.estoque) || 0) + 
(Number(p.cozinha) || 0) + 
(Number(p.cafe) || 0) + 
(Number(p.salao) || 0);

let classe = "";

let minimo = Number(p.minimo) || 0;

if(total <= minimo){
classe = "class='estoque-baixo'";
}

t.innerHTML += `
<tr ${classe}>
<td>${p.ean}</td>
<td>${p.produto}</td>
<td>${p.familia}</td>
<td>${p.estoque} ${p.unidade}</td>
<td>${p.cozinha} ${p.unidade}</td>
<td>${p.cafe} ${p.unidade}</td>
<td>${p.salao || 0} ${p.unidade}</td>
<td>${total} ${p.unidade}</td>

<td>
<button onclick="abrirModalEditar('${p.ean}')">✏️</button>
<button onclick="excluirProduto('${p.ean}')">🗑</button>
</td>

</tr>`;
});
}
function filtrarFamilia(){

let familia = document.getElementById("filtroFamilia").value;
let t = document.getElementById("tabela");

t.innerHTML = "";

let lista = produtos;

if(familia !== ""){
lista = produtos.filter(p => p.familia == familia);
}

lista.forEach(p => {

let total = 
(Number(p.estoque) || 0) + 
(Number(p.cozinha) || 0) + 
(Number(p.cafe) || 0) + 
(Number(p.salao) || 0);

let classe = "";

let minimo = Number(p.minimo) || 0;

if(total <= minimo){
classe = "class='estoque-baixo'";
}

t.innerHTML += `
<tr ${classe}>
<td>${p.ean}</td>
<td>${p.produto}</td>
<td>${p.familia}</td>
<td>${p.estoque} ${p.unidade}</td>
<td>${p.cozinha} ${p.unidade}</td>
<td>${p.cafe} ${p.unidade}</td>
<td>${p.salao || 0} ${p.unidade}</td>
<td>${total} ${p.unidade}</td>

<td>
<button onclick="abrirModalEditar('${p.ean}')">✏️</button>
<button onclick="excluirProduto('${p.ean}')">🗑</button>
</td>

</tr>
`;
});
}
function produtosDoCafe() {
  return produtos.filter(p =>
    p.setor && p.setor.split(",").map(s => formatarSetor(s)).includes("Cafe")
  );
}
function adicionarContagem() {

  let ean = String(document.getElementById("contEan").value.trim());
  let setor = setorSelecionado || formatarSetor(document.getElementById("contSetor").value);
  if(!setor){
  mostrarMsg("msgCont","Selecione o setor!", false);
  return;
  }
  let qtd = parseFloat(document.getElementById("contQtd").value);

  if (!ean || isNaN(qtd) || qtd < 0) {
  mostrarMsg("msgCont","Informe EAN e quantidade válidos!", false);
  return;
  }
  // 🔎 verifica se produto existe
  let produtoExiste = produtosMap.get(ean);

  if (!produtoExiste) {
    mostrarMsg("msgCont","Produto não cadastrado!", false);
    return;
  }

  // 🔁 verifica se já está na lista
  let existente = contagensPendentes.find(c => 
    c.ean === ean && formatarSetor(c.setor) === formatarSetor(setor)
  );

  if (existente) {
    existente.quantidade += qtd; // soma se já existir
  } else {
    contagensPendentes.push({
      ean: ean,
      setor: setor,
      quantidade: qtd
    });
  }

  mostrarMsg("msgCont","Adicionado à lista!");

  document.getElementById("contEan").value = "";
  document.getElementById("contQtd").value = "";

  atualizarTabelaContagens();
}
function atualizarTabelaContagens() {

  let tbody = document.querySelector("#tabelaContagens tbody");
  tbody.innerHTML = "";

  contagensPendentes.forEach((c, index) => {

    let produto = produtosMap.get(c.ean);
    let nome = produto ? produto.produto : "Produto não encontrado";

    tbody.innerHTML += `
    <tr>
      <td>${c.ean}</td>
      <td>${nome}</td>
      <td>${c.setor}</td>
      <td>${c.quantidade}</td>
      <td class="acoes">
        <button onclick="editarContagem(${index})">✏️</button>
        <button onclick="removerContagem(${index})">🗑</button>
      </td>
    </tr>`;

  });

}

function removerContagem(index){

  contagensPendentes.splice(index,1);

  atualizarTabelaContagens();

  mostrarMsg("msgCont","Item removido!");

}
function editarContagem(index){

  let item = contagensPendentes[index];

  document.getElementById("contEan").value = item.ean;
  document.getElementById("contSetor").value = item.setor;
  document.getElementById("contQtd").value = item.quantidade;

  // remove item antigo para reedição
  contagensPendentes.splice(index,1);
  // garante setor correto
  document.getElementById("contSetor").value = item.setor;
  // garante que painel café atualize
  verificarPainelCafe();

  atualizarTabelaContagens();
  buscarProdutoContagem();
  mostrarMsg("msgCont","Item carregado para edição!");

}
// =======================
// Contagem CAFÉ padronizada
// =======================
function enviarContagens(){

if(contagensPendentes.length === 0){
mostrarMsg("msgCont","Nenhuma contagem para enviar!",false);
return;
}

mostrarMsg("msgCont","Enviando contagens...");

// ===== COMPRESSÃO =====
let dadosCompactados = contagensPendentes.map(c =>
`${c.ean},${c.setor},${c.quantidade}`
);

// ===== ENVIO ÚNICO =====
fetch(url,{
method:"POST",
body: JSON.stringify({
tipo:"contagem_lote",
dados:dadosCompactados
})
})

.then(()=>{

// ===== ATUALIZAÇÃO LOCAL =====
contagensPendentes.forEach(c=>{
  c.ean = String(c.ean).trim();

let p = produtosMap.get(c.ean);
if(!p) return;

let setor = c.setor.toLowerCase();

if(setor=="estoque") p.estoque = c.quantidade;
if(setor=="cozinha") p.cozinha = c.quantidade;
if(setor=="cafe") p.cafe = c.quantidade;
if(setor=="salao") p.salao = c.quantidade;

});

atualizar();

contagensPendentes = [];
atualizarTabelaContagens();

mostrarMsg("msgCont","Contagens enviadas!");

})

.catch(err=>{
console.error(err);
mostrarMsg("msgCont","Erro ao enviar!",false);
});

}

function atualizarListaCompra(){

let tabela = document.getElementById("listaCompra");
tabela.innerHTML = "";

produtos.forEach(p => {

let total = 
(Number(p.estoque) || 0) + 
(Number(p.cozinha) || 0) + 
(Number(p.cafe) || 0) + 
(Number(p.salao) || 0);

let consumo7 = p.consumo7dias || 0;

let mediaDia = consumo7 / 7;

let previsao = mediaDia * 7;

let necessidade = previsao + p.minimo - total;

if(necessidade < 0) necessidade = 0;

if(necessidade > 0){

tabela.innerHTML += `
<tr>
<td>${p.produto}</td>
<td>${total}</td>
<td>${p.minimo}</td>
<td>${Math.ceil(necessidade)}</td>
</tr>
`;

}

});

}
function gerarPedido(){
document.getElementById("modalFormato").style.display="flex";
}
function fecharModalFormato(){
document.getElementById("modalFormato").style.display="none";
}

function gerarTextoPedido(){

let texto = "PEDIDO DE COMPRA\n\n";

produtos.forEach(p=>{

let total = 
(Number(p.estoque) || 0) + 
(Number(p.cozinha) || 0) + 
(Number(p.cafe) || 0) + 
(Number(p.salao) || 0);

let minimo = Number(p.minimo) || 0;

if(total <= minimo){

let comprar = p.minimo - total;

texto += `${p.produto} - Comprar: ${comprar}\n`;

}

});

return texto;
}

function baixarPedido(tipo){

let texto = gerarTextoPedido();

let blob;
let nome;

if(tipo=="txt"){
blob = new Blob([texto], {type:"text/plain"});
nome = "pedido_compra.txt";
}

if(tipo=="doc"){
blob = new Blob([texto], {type:"application/msword"});
nome = "pedido_compra.doc";
}

if(tipo=="excel"){

let linhas = "Produto\tQuantidade\n";

produtos.forEach(p=>{

let total = 
(Number(p.estoque) || 0) + 
(Number(p.cozinha) || 0) + 
(Number(p.cafe) || 0) + 
(Number(p.salao) || 0);

let minimo = Number(p.minimo) || 0;

if(total <= minimo){

let comprar = p.minimo - total;

linhas += `${p.produto}\t${comprar}\n`;

}

});

blob = new Blob([linhas], {type:"application/vnd.ms-excel"});
nome = "pedido_compra.xls";
}

if(tipo=="pdf"){

let janela = window.open("");

janela.document.write("<pre>"+texto+"</pre>");

janela.print();

fecharModalFormato();

return;

}

let link = document.createElement("a");

link.href = URL.createObjectURL(blob);

link.download = nome;

link.click();

fecharModalFormato();

}
function enviarWhatsApp(){

let msg="PEDIDO DE COMPRA:%0A%0A";

produtos.forEach(p=>{

let total = 
(Number(p.estoque) || 0) + 
(Number(p.cozinha) || 0) + 
(Number(p.cafe) || 0) + 
(Number(p.salao) || 0);

let minimo = Number(p.minimo) || 0;

if(total <= minimo){

let comprar = p.minimo - total;

msg += `${p.produto} - Comprar ${comprar}%0A`;
}
});
window.open(`https://wa.me/?text=${msg}`);
}

let campoScanner = null;
let scanner = null;

function iniciarScanner(campo){

campoScanner = campo;

document.getElementById("scanner").style.display = "block";

scanner = new Html5Qrcode("camera");

scanner.start(
{ facingMode: "environment" },
{
fps: 10,
qrbox: { width: 300, height: 150 },

formatsToSupport: [
Html5QrcodeSupportedFormats.EAN_13,
Html5QrcodeSupportedFormats.EAN_8,
Html5QrcodeSupportedFormats.CODE_128,
Html5QrcodeSupportedFormats.CODE_39
]
},
(decodedText) => {
document.getElementById(campoScanner).value = decodedText;

if(campoScanner === "eanEntrada")
{
buscarProdutoEntrada();
}
if(campoScanner === "contEan")
{
buscarProdutoContagem();
}
if(campoScanner === "movEan"){
buscarProdutoMov();
}
pararScanner();
},
(errorMessage) => {
}
);
}

function pararScanner(){

if(scanner){
scanner.stop().then(()=>{
scanner.clear();
});
}

document.getElementById("scanner").style.display = "none";
}
// =======================
// Entrada de nota fiscal
// =======================

function registrarEntrada()
{
let ean = document.getElementById("eanEntrada").value.trim();
let quantidade = parseFloat(document.getElementById("qtdEntrada").value);
let fornecedor = document.getElementById("fornecedor").value.trim();
let nota = document.getElementById("nota").value.trim();

if(!ean || isNaN(quantidade) || quantidade <= 0){
mostrarMsg("msgEntrada","Informe EAN e quantidade válidos!", false);
return;
}

fetch(url,{
method:"POST",
body: JSON.stringify({
tipo:"entrada",
ean:ean,
quantidade:quantidade,
fornecedor:fornecedor,
nota:nota
})
})
.then(res=>res.text())
.then(resposta=>{

if(resposta=="OK"){

mostrarMsg("msgEntrada","Entrada registrada!");

document.getElementById("eanEntrada").value="";
document.getElementById("qtdEntrada").value="";
document.getElementById("fornecedor").value="";
document.getElementById("nota").value="";

carregarProdutos();
}else{
mostrarMsg("msgEntrada","Produto não encontrado!", false);
}
});
}

function buscarProdutoEntrada()
{
let ean = String(document.getElementById("eanEntrada").value.trim());
let produto = produtosMap.get(ean);
if(produto){
document.getElementById("produtoEntrada").value = produto.produto;
}else{
document.getElementById("produtoEntrada").value = "";
}
}

function buscarProdutoContagem()
{
let ean = String(document.getElementById("contEan").value.trim());
let produto = produtosMap.get(ean);
if(produto){
document.getElementById("produtoContagem").value = produto.produto;
}else{
document.getElementById("produtoContagem").value = "";
}
}
function buscarProdutoMov()
{
let ean = String(document.getElementById("movEan").value.trim());
let produto = produtosMap.get(ean);
if(produto){
document.getElementById("produtoMov").value = produto.produto;
}else{
document.getElementById("produtoMov").value = "";
}
}


function verificarPainelCafe(){

let setor = formatarSetor(document.getElementById("contSetor").value);

let painel = document.getElementById("painelTouch");

painel.innerHTML="";
painel.style.display="none";

let setorFormatado = formatarSetor(setor);

if(setorFormatado === "Cafe"){
painel.style.display="grid";
gerarPainelTouch("Cafe");
}

if(setorFormatado === "Salao"){
painel.style.display="grid";
gerarPainelTouch("Salao");
}

if(setorFormatado === "Cozinha"){
painel.style.display="grid";
gerarPainelTouch("Cozinha");
}

if(setorFormatado === "Estoque"){
painel.style.display="grid";
gerarPainelTouch("Estoque");
}

}


function abrirPainelCozinha(){

let painel = document.getElementById("painelCozinha");
let container = document.getElementById("botoesCozinha");

painel.style.display = "block";

if(container.children.length === 0){
//gerarPainelCozinha();
}

}

function produtosDaCozinha(){

return produtos.filter(p =>
p.setor &&
p.setor.split(",").map(s => formatarSetor(s)).includes("Cozinha")
);

}

function desfazerCozinha(ean){
  ean = String(ean).trim();

let setor="Cozinha";

let existente=contagensPendentes.find(c =>
c.ean===ean && c.setor===setor
);

if(existente){

existente.quantidade--;

if(existente.quantidade<0)
existente.quantidade=0;

}

atualizarTabelaContagens();
atualizarContadorBotao(ean,"Cozinha");

}


function contarCozinha(ean){
   ean = String(ean).trim();

if(navigator.vibrate) navigator.vibrate(50);

let setor = "Cozinha";

let existente = contagensPendentes.find(c =>
c.ean === ean && formatarSetor(c.setor) === formatarSetor(setor)
);

if(existente){
existente.quantidade++;
}else{
contagensPendentes.push({
ean: ean,
setor: setor,
quantidade: 1
});
}

atualizarTabelaContagens();
atualizarContadorBotao(ean,"Cozinha");

}


function contarSalao(ean){
  ean = String(ean).trim();

if(navigator.vibrate) navigator.vibrate(50);

let setor = formatarSetor("Salao");

let produto = produtosMap.get(ean);

if(!produto) return;

let existente = contagensPendentes.find(p =>
p.ean === ean && p.setor === setor
);

if(existente){
existente.quantidade += 1;
}else{
contagensPendentes.push({
ean: ean,
setor: setor,
quantidade: 1
});
}

atualizarTabelaContagens();
atualizarContadorBotao(ean,"Salao");

}

function desfazerSalao(ean){
  ean = String(ean).trim();

let setor = formatarSetor("Salao");

let existente = contagensPendentes.find(c =>
c.ean === ean && formatarSetor(c.setor) === formatarSetor(setor)
);

if(existente){

existente.quantidade--;

if(existente.quantidade < 0)
existente.quantidade = 0;

}else{

contagensPendentes.push({
ean: ean,
setor: setor,
quantidade: 0
});

}

if(navigator.vibrate)
navigator.vibrate([50,50,50]);

atualizarTabelaContagens();
atualizarContadorBotao(ean,"Salao");

}

function contarCafe(ean){
  ean = String(ean).trim(); 

  if(navigator.vibrate) navigator.vibrate(50);

  let setor = formatarSetor("Cafe");

  let existente = contagensPendentes.find(c =>
    c.ean === ean &&
    formatarSetor(c.setor) === setor
  );

  if(existente){
    existente.quantidade++;
  } else {
    contagensPendentes.push({
      ean: ean,
      setor: setor,
      quantidade: 1
    });
  }

  atualizarTabelaContagens();
  atualizarContadorBotao(ean,"Cafe");
}

function desfazerCafe(ean){
  ean = String(ean).trim();

  let setor = formatarSetor("Cafe");

  let existente = contagensPendentes.find(c =>
    c.ean === ean && formatarSetor(c.setor) === setor
  );

  if(existente){
    existente.quantidade--;
    if(existente.quantidade < 0) existente.quantidade = 0;
  }

  if(navigator.vibrate) navigator.vibrate([50,50,50]);

  atualizarTabelaContagens();
  atualizarContadorBotao(ean,"Cafe");
}

function gerarPlanilhaGoogle(){

let linhas = "Produto\tQuantidade\n";

produtos.forEach(p=>{

let total = 
(Number(p.estoque) || 0) + 
(Number(p.cozinha) || 0) + 
(Number(p.cafe) || 0) + 
(Number(p.salao) || 0);

let minimo = Number(p.minimo) || 0;

if(total <= minimo){

let comprar = p.minimo - total;

linhas += `${p.produto}\t${comprar}\n`;

}

});

let blob = new Blob([linhas], {type:"text/tab-separated-values"});

let link = document.createElement("a");

link.href = URL.createObjectURL(blob);

link.download = "pedido_compra_google_planilhas.tsv";

link.click();

fecharModalFormato();

}

function abrirModalQuantidade(produto, setor){
  produtoSelecionado = produto;
  setorSelecionado = formatarSetor(setor);

  document.getElementById("modalProduto").innerText =
  produto.produto + " (" + produto.unidade + ")";

  document.getElementById("modalValor").value = "";

  document.getElementById("modalQtd").style.display = "flex";
}

function abrirModalQuantidadeSalao(produto){

produtoSelecionado = produto;
setorSelecionado = "Salao";

document.getElementById("modalProduto").innerText =
produto.produto + " (" + produto.unidade + ")";

document.getElementById("modalValor").value = "";

document.getElementById("modalQtd").style.display = "flex";
}

function confirmarQuantidade(){

  if(!produtoSelecionado) return;
  let valor = parseFloat(document.getElementById("modalValor").value);

  if(!valor || valor <= 0){
    alert("Informe uma quantidade");
    return;
  }

  let ean = produtoSelecionado.ean;
  let setor = setorSelecionado;

   /* if(setor !== "Cafe" && setor !== "Salao"){
    alert("Esse tipo de produto só pode ser contado no Café ou Salão.");
    fecharModalQtd();
    return;
  }*/

  let existente = contagensPendentes.find(c =>
    c.ean === ean && c.setor == setor
  );

  if(existente){
    existente.quantidade += valor;
  }else{
    contagensPendentes.push({
      ean: ean,
      setor: setor,
      quantidade: valor
    });
  }

  atualizarTabelaContagens();

  atualizarContadorBotao(ean, setor);

  fecharModalQtd();
  produtoSelecionado = null;
  setorSelecionado = null;
}

function fecharModalQtd(){
  document.getElementById("modalQtd").style.display = "none";
}


function abrirPedidos(){

abrir("pedidos");

atualizarListaCompra();
}

function editarProduto(ean){

let p = produtosMap.get(ean);

if(!p) return;

let novoEan = prompt("EAN:", p.ean);
if(novoEan === null) return;

let novoProduto = prompt("Produto:", p.produto);
let novaFamilia = prompt("Família:", p.familia);

let novoEstoque = prompt("Estoque:", p.estoque);
let novaCozinha = prompt("Cozinha:", p.cozinha);
let novoCafe = prompt("Café:", p.cafe);

let novoMin = prompt("Estoque mínimo:", p.minimo);
let novoSetor = prompt("Setores (Ex: Estoque,Cozinha,Cafe):", p.setor);

fetch(url,{
method:"POST",
body: JSON.stringify({
tipo:"editar",
eanOriginal: p.ean,
ean: novoEan,
produto: novoProduto,
familia: novaFamilia,
estoque: novoEstoque,
cozinha: novaCozinha,
cafe: novoCafe,
minimo: novoMin,
setor: novoSetor
})
})
.then(res=>res.text())
.then(r=>{
if(r=="OK"){
alert("Produto atualizado!");
carregarProdutos();
}else{
alert("Erro ao editar!");
}
});

}

function excluirProduto(ean){

if(!confirm("Deseja realmente excluir este produto?")){
return;
}

fetch(url,{
method:"POST",
body: JSON.stringify({
tipo:"excluir",
ean:ean
})
})
.then(res=>res.text())
.then(r=>{
if(r=="OK"){
alert("Produto excluído!");
carregarProdutos();
}else{
alert("Erro ao excluir!");
}
});
}
let produtoEditando = null;

function abrirModalEditar(ean){
  let p = produtosMap.get(ean);
  if(!p) return;

  produtoEditando = p;

  document.getElementById("editEan").value = p.ean;
  document.getElementById("editProduto").value = p.produto;
  document.getElementById("editFamilia").value = p.familia;
  document.getElementById("editEstoque").value = p.estoque;
  document.getElementById("editCozinha").value = p.cozinha;
  document.getElementById("editCafe").value = p.cafe;
  document.getElementById("editMinimo").value = p.minimo;
  document.getElementById("editSetor").value = p.setor;
  document.getElementById("editSubsetor").value = p.subsetor || "";
  document.getElementById("editUnidade").value = p.unidade || "UN";

  document.getElementById("modalEditar").style.display = "flex";
}

function salvarEdicao(){
  // pega valores do modal
  let eanNovo = document.getElementById("editEan").value.trim();
  let produto = document.getElementById("editProduto").value.trim();
  let familia = document.getElementById("editFamilia").value.trim();
  let estoque = Number(document.getElementById("editEstoque").value) || 0;
  let cozinha = Number(document.getElementById("editCozinha").value) || 0;
  let cafe = Number(document.getElementById("editCafe").value) || 0;
  let minimo = Number(document.getElementById("editMinimo").value) || 0;
  let setor = document.getElementById("editSetor").value.trim();
  let unidade = document.getElementById("editUnidade").value;
  let subsetor = document.getElementById("editSubsetor").value.trim();

fetch(url,{
  method:"POST",
  body: JSON.stringify({
    tipo:"editar",
    eanOriginal: produtoEditando.ean, // <--- CORRETO
    ean: eanNovo,
    produto: produto,
    familia: familia,
    estoque: estoque,
    cozinha: cozinha,
    cafe: cafe,
    minimo: minimo,
    setor: document.getElementById("editSetor").value
        .split(",")
        .map(s => formatarSetor(s))
        .join(","),
    unidade: unidade,
    subsetor: subsetor
  })
})
  .then(res=>res.text())
    .then(r=>{
      if(r=="OK"){
        mostrarModalMsg("Produto editado com sucesso!"); // ✅ sucesso
        carregarProdutos();
        setTimeout(()=>fecharModal(),1600); // fecha modal principal após a mensagem
      }else{
        mostrarModalMsg("Erro ao editar produto!", false); // ❌ erro
      }
    }).catch(err=>{
      mostrarModalMsg("Erro de conexão!", false);
      console.error(err);
    });
}
function mostrarModalMsg(mensagem, sucesso=true, duracao=1500){
  const msg = document.getElementById("modalMsg");
  msg.textContent = mensagem;
  msg.style.background = sucesso ? "#0f172a" : "#ff2121"; // azul escuro para sucesso, vermelho para erro
  msg.style.display = "block";

  setTimeout(()=>{
    msg.style.display = "none";
  }, duracao);
}
function fecharModal(){
  document.getElementById("modalEditar").style.display = "none";
}

function movManual(){

let ean = document.getElementById("manualEan").value.trim();
let tipo = document.getElementById("manualTipo").value;
let setor = formatarSetor(document.getElementById("manualSetor").value);
let qtd = parseFloat(document.getElementById("manualQtd").value);

if(!ean || isNaN(qtd) || qtd <= 0){
  mostrarMsg("msgManual","Informe EAN e quantidade válidos!",false);
  return;
}

let p = produtosMap.get(ean);

if(!p){
  mostrarMsg("msgManual","Produto não encontrado!",false);
  return;
}

if(tipo === "SAIDA" && p[setor.toLowerCase()] < qtd){
  mostrarMsg("msgManual","Estoque insuficiente!",false);
  return;
}

fetch(url,{
method:"POST",
body:JSON.stringify({
tipo:"manual",
ean:ean,
setor:setor,
operacao:tipo,
quantidade:qtd
})
})
.then(res=>res.text())
.then(resp=>{

if(resp==="OK"){
mostrarMsg("msgManual","Movimentação registrada!");
carregarProdutos();

document.getElementById("manualEan").value="";
document.getElementById("manualQtd").value="";

}else{
mostrarMsg("msgManual","Erro ao registrar!",false);
}
});
}

function abrirModalRuptura(requisicao=false){

  document.getElementById("modalRuptura").style.display = "flex";

  gerarListaRupturaModal();

  const btn = document.getElementById("btnVoltarRequisicao");

  if(requisicao){
    btn.style.display = "inline-block";
  }else{
    btn.style.display = "none";
  }

}
function fecharModalRuptura(){
  document.getElementById("modalRuptura").style.display = "none";
}

function gerarListaRupturaModal(){
  let tabela = document.getElementById("listaRupturaModal");
  tabela.innerHTML = "";

  produtos.forEach(p => {
    let total = 
    (Number(p.estoque) || 0) + 
    (Number(p.cozinha) || 0) + 
    (Number(p.cafe) || 0) + 
    (Number(p.salao) || 0);

    let status = "";
    let cor = "";

    if(total == 0){
      status = "CRÍTICO";
      cor = "red";
    }
    else if(total < p.minimo){
      status = "BAIXO";
      cor = "orange";
    }
    else{
      return; // Não mostra produtos acima do mínimo
    }

    // Verifica se o produto já está na lista de contagem
    let adicionado = contagensPendentes.find(c => c.ean === p.ean && c.setor === "Estoque");

    tabela.innerHTML += `
      <tr id="linha-${p.ean}">
        <td>${p.produto}</td>
        <td>${total}</td>
        <td>${p.minimo}</td>
        <td style="color:${cor};font-weight:bold">${status}</td>
        <td id="acoes-${p.ean}">
          ${adicionado ? 
            `<span style="color:green;font-weight:bold">✅ Adicionado</span>
             <button onclick="removerRuptura('${p.ean}')">❌ Remover</button>` :
            `<button onclick="adicionarRuptura('${p.ean}')">➕ Adicionar</button>`}
        </td>
      </tr>
    `;
  });

  if(tabela.innerHTML === ""){
    tabela.innerHTML = `<tr><td colspan="5">Nenhum produto em ruptura!</td></tr>`;
  }
}

// Função para adicionar produto da ruptura à lista
function adicionarRuptura(ean){
  let produto = produtosMap.get(ean);
  if(!produto) return;

  // Adiciona 1 unidade à contagem de estoque
  let existente = contagensPendentes.find(c => c.ean === ean && c.setor === "Estoque");
  if(existente){
    existente.quantidade++;
  } else {
    contagensPendentes.push({
      ean: ean,
      setor: "Estoque",
      quantidade: 1
    });
  }

  // Atualiza o botão para "✅ Adicionado" + "Remover"
  const tdAcoes = document.getElementById(`acoes-${ean}`);
  tdAcoes.innerHTML = `<span style="color:green;font-weight:bold">✅ Adicionado</span>
                       <button onclick="removerRuptura('${ean}')">❌ Remover</button>`;

  atualizarTabelaContagens();
  mostrarMsg("msgCont", `${produto.produto} adicionado à contagem!`);
}

// Função para remover produto da ruptura
function removerRuptura(ean){
  // Remove da contagem pendente
  contagensPendentes = contagensPendentes.filter(c => !(c.ean === ean && c.setor === "Estoque"));

  // Atualiza o botão novamente para "Adicionar"
  const tdAcoes = document.getElementById(`acoes-${ean}`);
  tdAcoes.innerHTML = `<button onclick="adicionarRuptura('${ean}')">➕ Adicionar</button>`;

  mostrarMsg("msgCont", `Produto removido da contagem!`);
  atualizarTabelaContagens();
}

// Adiciona produto à requisição
function adicionarRequisicao(ean){
  let p = produtosMap.get(ean);
  if(!p) return;
  if(!requisicaoProdutos.includes(p)) requisicaoProdutos.push(p);
  alert(`${p.produto} adicionado à requisição`);
}

// Mostrar modal com produtos da requisição
function verRequisicaoModal(){
  let lista = requisicaoProdutos.map(p => `${p.produto} - Estoque: ${p.estoque + p.cozinha + p.cafe}`).join("\n");
  if(!lista) lista = "Nenhum produto adicionado";
  alert("Produtos da Requisição:\n\n" + lista);
}

// Fechar modal informativo
function fecharModalInfoRuptura() {
  document.getElementById("modalInfoRuptura").style.display = "none";
}

function verRequisicao() {
  // Seleciona o tbody onde a requisição será exibida
  const tbody = document.getElementById("listaRupturaModal");
  tbody.innerHTML = "";

  if (contagensPendentes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Nenhuma requisição cadastrada</td></tr>`;
    return;
  }

  contagensPendentes.forEach(c => {
    // Busca os dados do produto completo
    const p = produtosMap.get(c.ean);
    if (!p) return;

    let total = 
    (Number(p.estoque) || 0) + 
    (Number(p.cozinha) || 0) + 
    (Number(p.cafe) || 0) + 
    (Number(p.salao) || 0);
    let status = total <= p.minimo ? "⚠️ Necessário" : "✔️ OK";

    tbody.innerHTML += `
      <tr>
        <td>${p.produto}</td>
        <td>${total}</td>
        <td>${p.minimo}</td>
        <td>${status}</td>
        <td>${c.quantidade}</td>
      </tr>
    `;
  });

  // Exibe o modal de ruptura/requisição
  document.getElementById("modalRuptura").style.display = "flex";
}
function voltarParaRequisicao() {
  // Fecha o modal de ruptura
  document.getElementById("modalRuptura").style.display = "none";

  // Abre a seção de pedidos
  abrir("pedidos");

  // Atualiza a lista de compra para garantir que os produtos estejam visíveis
  atualizarListaCompra();
}


function abrirModalRequisicao(){

  document.getElementById("modalRequisicao").style.display = "flex";

  let tabela = document.getElementById("listaRequisicao");
  tabela.innerHTML = "";

  if(contagensPendentes.length === 0){
    tabela.innerHTML = `<tr><td colspan="3">Nenhuma requisição solicitada</td></tr>`;
    return;
  }

  contagensPendentes.forEach(c => {

    let p = produtosMap.get(c.ean);
    if(!p) return;

    let total = 
    (Number(p.estoque) || 0) + 
    (Number(p.cozinha) || 0) + 
    (Number(p.cafe) || 0) + 
    (Number(p.salao) || 0);

    tabela.innerHTML += `
      <tr>
        <td>${p.produto}</td>
        <td>${total}</td>
        <td>${c.quantidade}</td>
      </tr>
    `;

  });

}

function fecharModalRequisicao(){
  document.getElementById("modalRequisicao").style.display = "none";
}

function voltarParaRuptura(){

  // fecha o modal de requisição
  document.getElementById("modalRequisicao").style.display = "none";

  // abre novamente o modal de ruptura
  abrirModalRuptura();

}

function normalizarTexto(texto){
return (texto || "")
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.toUpperCase()
.trim();
}

function gerarPainelTouch(setor){

let painel = document.getElementById("painelTouch");
if(!painel) return;

painel.innerHTML="";

let produtosSetor = produtos.filter(p =>
p.setor && p.setor.split(",").map(s=>formatarSetor(s)).includes(setor)
);

// 🔥 SE FOR SALÃO → SEPARA POR FAMÍLIA
if(setor === "Salao"){

let bebidas = produtosSetor.filter(p => {
let f = normalizarTexto(p.familia);
return f.includes("BEBIDA");
});

let bomboniere = produtosSetor.filter(p => {
let f = normalizarTexto(p.familia);
return f.includes("BOMBONIERE");
});

// limpa painel
painel.innerHTML = "";

// ===== BEBIDAS =====
if(bebidas.length > 0){
let titulo = document.createElement("div");
titulo.innerHTML = "🥤 BEBIDAS";
titulo.style.gridColumn = "1/-1";
titulo.style.fontWeight = "bold";
titulo.style.fontSize = "18px";
painel.appendChild(titulo);

bebidas.forEach(p => criarBotaoProduto(p,setor,painel));
}

// ===== BOMBONIERE =====
if(bomboniere.length > 0){
let titulo = document.createElement("div");
titulo.innerHTML = "🍫 BOMBONIERE";
titulo.style.gridColumn = "1/-1";
titulo.style.fontWeight = "bold";
titulo.style.fontSize = "18px";
painel.appendChild(titulo);

bomboniere.forEach(p => criarBotaoProduto(p,setor,painel));
}

return;
}

// 🔥 PADRÃO NORMAL
produtosSetor.forEach(p=>{

let btn = document.createElement("button");
btn.className = "botao-produto";

let existente = contagensPendentes.find(c =>
c.ean === p.ean && formatarSetor(c.setor) === formatarSetor(setor)
);

let qtd = existente ? existente.quantidade : 0;

let img = p.imagem ? `<img src="${p.imagem}" style="width:110px;height:110px;object-fit:cover;border-radius:10px;margin-bottom:6px">` : "";

btn.innerHTML = `
${img}
<div style="font-size:13px">${p.produto}</div>
<div id="qtd_${setor}_${p.ean}" style="font-size:22px;font-weight:bold">${qtd}</div>
`;

let pressTimer;
let toqueLongo = false;

btn.addEventListener("pointerdown", function(e){
  toqueLongo = false;

  pressTimer = setTimeout(()=>{
    toqueLongo = true;

    if(formatarSetor(setor) === "Cozinha"){
      desfazerCozinha(p.ean);
    }

  },1500);
});

btn.addEventListener("pointerup", function(e){
  clearTimeout(pressTimer);

  if(toqueLongo) return;

  executarAcao();
});

function executarAcao(){

let setorFormatado = formatarSetor(setor);

let unidade = (p.unidade || "")
  .toString()
  .trim()
  .toUpperCase()
  .replace(/\s/g, "");

const unidadesFracionadas = ["KG","G","L","ML"];

// 🔥 SE FOR FRACIONADO → abre modal
if(unidadesFracionadas.includes(unidade)){
abrirModalQuantidade(p, setorFormatado);
}

// 🔥 SENÃO → contagem normal
else{

  if(setorFormatado === "Cafe"){
    contarCafe(p.ean);
  }

  else if(setorFormatado === "Salao"){
    contarSalao(p.ean);
  }

  else if(setorFormatado === "Cozinha"){
    contarCozinha(p.ean);
  }

  else if(setorFormatado === "Estoque"){
    contarEstoque(p.ean);
  }

}
}

painel.appendChild(btn);

});

}


// ✅ FUNÇÃO MOVIDA PRA FORA (CORREÇÃO DO BUG)
function criarBotaoProduto(p, setor, painel){

let btn = document.createElement("button");
btn.className = "botao-produto";

let existente = contagensPendentes.find(c =>
c.ean === p.ean && formatarSetor(c.setor) === formatarSetor(setor)
);

let qtd = existente ? existente.quantidade : 0;

let img = p.imagem ? `<img src="${p.imagem}" style="width:110px;height:110px;object-fit:cover;border-radius:10px;margin-bottom:6px">` : "";

btn.innerHTML = `
${img}
<div style="font-size:13px">${p.produto}</div>
<div id="qtd_${setor}_${p.ean}" style="font-size:22px;font-weight:bold">${qtd}</div>
`;

btn.onclick = function(){

let unidade = (p.unidade || "").toUpperCase().trim();
const fracionados = ["KG","G","L","ML"];

if(fracionados.includes(unidade)){
abrirModalQuantidade(p, setor);
}else{

if(setor === "Salao") contarSalao(p.ean);
if(setor === "Cafe") contarCafe(p.ean);
if(setor === "Cozinha") contarCozinha(p.ean);
if(setor === "Estoque") contarEstoque(p.ean);

}

};

painel.appendChild(btn);

}


function contarEstoque(ean){
  ean = String(ean).trim();

  if(navigator.vibrate) navigator.vibrate(50);

  let setor = formatarSetor("Estoque");

  let existente = contagensPendentes.find(c =>
    c.ean === ean && formatarSetor(c.setor) === setor
  );

  if(existente){
    existente.quantidade++;
  } else {
    contagensPendentes.push({
      ean: ean,
      setor: setor,
      quantidade: 1
    });
  }

  atualizarTabelaContagens();
  atualizarContadorBotao(ean,"Estoque");
}

function atualizarContadorBotao(ean,setor){

setor = formatarSetor(setor);
let contador = document.getElementById("qtd_"+setor+"_"+ean);

if(!contador) return;

let existente = contagensPendentes.find(c =>
c.ean === ean && formatarSetor(c.setor) === formatarSetor(setor)
);

let valor = existente ? existente.quantidade : 0;

contador.innerText = valor;

contador.style.transform="scale(1.3)";
setTimeout(()=>{
contador.style.transform="scale(1)";
},150);

}

function entrarSistema(tipo)
{

if(tipo === "livraria"){
    // 👉 vai para a página da livraria
    window.location.href = "livraria.html";
    return; // 🔥 impede o resto de rodar
}

document.getElementById("telaInicial").style.display = "none";
document.getElementById("sistema").style.display = "block";

if(tipo === "cafeteria"){
document.querySelector("header h2").innerText = "📦 ESTOQUE SYSTEM - CAFETERIA ☕";
}

}

function abrirEstoqueSeco(){

  let painel = document.getElementById("painelTouch");

  painel.innerHTML = "";
  painel.style.display = "grid";

  gerarPainelEstoqueSeco();

}
function abrirEstoqueSeco(){

  let painel = document.getElementById("painelTouch");

  painel.innerHTML = "";
  painel.style.display = "grid";

  gerarPainelEstoqueSeco();

}
function gerarPainelEstoqueSeco(){

  let painel = document.getElementById("painelTouch");

  let lista = produtosEstoqueSeco();

  if(lista.length === 0){
    painel.innerHTML = "<div>Nenhum produto no estoque seco</div>";
    return;
  }

  lista.forEach(p => {

    let btn = document.createElement("button");
    btn.className = "botao-produto";

    let existente = contagensPendentes.find(c =>
      c.ean === p.ean && formatarSetor(c.setor) === "Estoque"
    );

    let qtd = existente ? existente.quantidade : 0;

    btn.innerHTML = `
      <div style="font-size:13px">${p.produto}</div>
      <div id="qtd_Estoque_${p.ean}" style="font-size:22px;font-weight:bold">${qtd}</div>
    `;

    btn.onclick = function(){
      contarEstoque(p.ean);
    };

    painel.appendChild(btn);

  });

}


window.onload = function(){

carregarProdutos();

let info = document.getElementById("infoRuptura");

if(info){
info.addEventListener("click",()=>{
document.getElementById("modalInfoRuptura").style.display="flex";
});
}

};