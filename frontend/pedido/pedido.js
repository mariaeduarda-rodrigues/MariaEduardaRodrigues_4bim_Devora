let todosPedidos = [];

function moeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function formatarData(dataStr) {
    if (!dataStr) return '-';
    return new Date(dataStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('tabelaTodosPedidos');
    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 14px;">Nenhum pedido encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(p => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 10px;"><strong>#${p.id_pedido}</strong></td>
            <td style="padding: 12px 10px;">${formatarData(p.data_pedido)}</td>
            <td style="padding: 12px 10px;">
                <strong>${p.nome_cliente || 'Cliente'}</strong><br>
                <small style="color: #666;">CPF: ${p.cpf_cliente || '-'}</small>
            </td>
            <td style="padding: 12px 10px;">${p.resumo_itens || 'Sem itens registrados'}</td>
            <td style="padding: 12px 10px;">${p.forma_pagamento || '-'}</td>
            <td style="padding: 12px 10px;"><strong>${moeda(p.valor_total)}</strong></td>
        </tr>
    `).join('');
}

async function carregarPedidosAdmin() {
    const tbody = document.getElementById('tabelaTodosPedidos');
    try {
        const resposta = await fetch('/pedido', { credentials: 'include' });
        if (!resposta.ok) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 14px; color: #b00;">Erro ${resposta.status} ao carregar pedidos.</td></tr>`;
            return;
        }
        todosPedidos = await resposta.json();
        renderizarTabela(todosPedidos);
    } catch (erro) {
        console.error(erro);
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 14px; color: #b00;">Erro de conexão com o servidor.</td></tr>';
    }
}

document.getElementById('buscaPedidoAdmin').addEventListener('input', e => {
    const termo = e.target.value.trim().toLowerCase();
    const filtrados = todosPedidos.filter(p =>
        String(p.id_pedido).includes(termo) ||
        String(p.nome_cliente || '').toLowerCase().includes(termo) ||
        String(p.cpf_cliente || '').includes(termo) ||
        String(p.resumo_itens || '').toLowerCase().includes(termo)
    );
    renderizarTabela(filtrados);
});

carregarPedidosAdmin();