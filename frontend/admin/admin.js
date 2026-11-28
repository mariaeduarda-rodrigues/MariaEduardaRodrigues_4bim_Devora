// Preenche os contadores do resumo usando as rotas que já existem
async function contar(url, chave, idElemento) {
    const elemento = document.getElementById(idElemento);
    if (!elemento) return;

    try {
        const resposta = await fetch(url, {
            credentials: 'include',
            cache: 'no-store'
        });
        const dados = await resposta.json();
        const lista = Array.isArray(dados) ? dados : (dados[chave] || []);
        elemento.textContent = lista.length;
    } catch (erro) {
        console.warn('Não foi possível carregar ' + url);
    }
}

async function contarPedidos() {
    const elemento = document.getElementById('qtdPedidos');
    if (!elemento) return;

    try {
        const resposta = await fetch('/pedido', {
            credentials: 'include',
            cache: 'no-store'
        });
        const pedidos = await resposta.json();
        if (Array.isArray(pedidos) && pedidos.length > 0) {
            // Mostra o número do último pedido (91) para bater exato com a tabela
            const ultimoNumero = Math.max(...pedidos.map(p => Number(p.id_pedido) || 0));
            elemento.textContent = ultimoNumero;
        } else {
            elemento.textContent = '0';
        }
    } catch (erro) {
        console.warn('Erro ao carregar pedidos no resumo:', erro);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    contar('/prato/listar', 'pratos', 'qtdPratos');
    contar('/categoria/listar', 'categorias', 'qtdCategorias');
    contar('/medida/listar', 'medidas', 'qtdMedidas');
    contar('/usuario', 'usuarios', 'qtdUsuarios');
    contarPedidos();
});

// Logout: apaga o cookie de sessão no servidor e volta para a loja
const btnSair = document.getElementById('btnSair');
if (btnSair) {
    btnSair.addEventListener('click', async (e) => {
        e.preventDefault();
        await fetch('/login/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
        window.location.href = '../cliente/cliente.html';
    });
}