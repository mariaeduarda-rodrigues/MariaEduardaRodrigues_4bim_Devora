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

async function carregarPaginaMeusPedidos() {
  const container = document.getElementById('containerMeusPedidos');
  const saudacao = document.getElementById('saudacaoCliente');

  try {
    // Verifica quem está logado
    const respLogin = await fetch('/login/verificaLogado', { credentials: 'include' });
    const sessao = await respLogin.json();

    if (sessao.status !== 'ok') {
      window.location.href = '/frontend/login/login.html';
      return;
    }

    if (saudacao) {
      saudacao.textContent = 'Olá, ' + String(sessao.nome || '').split(' ')[0];
    }

    // Busca os pedidos do cliente logado
    const resposta = await fetch('/pedido/meusPedidos', { credentials: 'include' });
    if (!resposta.ok) {
      container.innerHTML = `<p style="color: #b00;">Erro ${resposta.status} ao carregar seus pedidos.</p>`;
      return;
    }

    const pedidos = await resposta.json();

    if (!pedidos.length) {
      container.innerHTML = `
        <div style="background: #fff; padding: 28px; border-radius: 14px; text-align: center; border: 1px solid #e6dfd5;">
          <p style="margin-bottom: 14px;">Você ainda não realizou nenhum pedido.</p>
          <a class="btn-dourado" href="cliente.html#cardapio">Explorar cardápio →</a>
        </div>
      `;
      return;
    }

    container.innerHTML = pedidos.map(p => `
      <article style="background: #fff; border: 1px solid #e6dfd5; border-radius: 14px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; box-shadow: 0 4px 14px rgba(0,0,0,0.04);">
        <div>
          <span style="font-size: 0.8rem; letter-spacing: 1px; text-transform: uppercase; color: #8b1e24; font-weight: 600;">
            Pedido #${p.id_pedido} • ${formatarData(p.data_pedido)}
          </span>
          <h3 style="margin: 6px 0; font-size: 1.1rem; color: #2b0b09;">
            ${p.resumo_itens || 'Itens do pedido'}
          </h3>
          <small style="color: #666;">Forma de pagamento: <strong>${p.forma_pagamento || 'Confirmado'}</strong></small>
        </div>
        <div style="text-align: right;">
          <small style="display: block; color: #666;">Valor total</small>
          <strong style="font-size: 1.25rem; color: #2b0b09;">${moeda(p.valor_total)}</strong>
        </div>
      </article>
    `).join('');
  } catch (err) {
    console.error('Erro ao carregar pedidos do cliente:', err);
    container.innerHTML = '<p style="color: #b00;">Falha de comunicação com o servidor.</p>';
  }
}

carregarPaginaMeusPedidos();