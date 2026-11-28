const { query, pool } = require('../database');

// 1. Buscar dados do cliente logado para preencher o checkout (GET /pedido/dadosCliente)
exports.dadosCliente = async (req, res) => {
    try {
        const cpf = req.signedCookies ? req.signedCookies.usuarioLogado : null;

        if (!cpf) {
            return res.status(401).json({ status: 'erro', mensagem: 'Usuário não autenticado.' });
        }

        const sql = `
            SELECT cpf_usuario, nome_usuario, endereco_usuario 
            FROM usuario 
            WHERE cpf_usuario = $1
        `;
        const resultado = await query(sql, [cpf]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ status: 'erro', mensagem: 'Cliente não encontrado.' });
        }

        const usuario = resultado.rows[0];
        return res.json({
            status: 'ok',
            cpf: usuario.cpf_usuario,
            nome: usuario.nome_usuario,
            endereco: usuario.endereco_usuario || ''
        });
    } catch (error) {
        console.error('Erro ao buscar dados do cliente:', error);
        return res.status(500).json({ status: 'erro', mensagem: 'Erro interno no servidor.' });
    }
};

// 2. Registrar o pedido vindo do pagamento.js (POST /pedido/finalizar)
exports.finalizarPedido = async (req, res) => {
    const cpfCliente = req.signedCookies ? req.signedCookies.usuarioLogado : null;
    const { endereco_entrega, id_forma_pagamento, itens } = req.body;

    if (!cpfCliente) {
        return res.status(401).json({ status: 'erro', mensagem: 'Faça login para finalizar o pedido.' });
    }

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ status: 'erro', mensagem: 'O carrinho está vazio.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Atualiza o endereço do usuário caso ele tenha preenchido/alterado no checkout
        if (endereco_entrega) {
            await client.query(
                'UPDATE usuario SET endereco_usuario = $1 WHERE cpf_usuario = $2',
                [endereco_entrega, cpfCliente]
            );
        }

        // Garante que o usuário exista na tabela cliente (por causa da FK fk_pedido_cliente)
        await client.query(
            `INSERT INTO cliente (usuario_cpf_usuario, renda_cliente, data_cadastro_cliente)
             VALUES ($1, 0, CURRENT_DATE)
             ON CONFLICT (usuario_cpf_usuario) DO NOTHING`,
            [cpfCliente]
        );

        // Insere o pedido (usa '00000000000' como funcionário online padrão, igual ao seu banco)
        const resPedido = await client.query(
            `INSERT INTO pedido (data_pedido, cliente_usuario_cpf_usuario, funcionario_usuario_cpf_usuario)
             VALUES (CURRENT_DATE, $1, '00000000000')
             RETURNING id_pedido`,
            [cpfCliente]
        );
        const id_pedido = resPedido.rows[0].id_pedido;

        // Insere cada prato em pedido_has_prato, calcula o total e atualiza estoque
        let valorTotal = 0;

        for (const item of itens) {
            const resPrato = await client.query(
                'SELECT preco_unitario_prato, quantidade_estoque_prato FROM prato WHERE id_prato = $1',
                [item.id_prato]
            );

            if (resPrato.rows.length === 0) {
                throw new Error(`Prato ID ${item.id_prato} não encontrado.`);
            }

            const precoUnitario = Number(resPrato.rows[0].preco_unitario_prato || 0);
            const qtd = Number(item.quantidade || 1);
            valorTotal += precoUnitario * qtd;

            await client.query(
                `INSERT INTO pedido_has_prato (prato_id_prato, pedido_id_pedido, quantidade, preco_unitario)
                 VALUES ($1, $2, $3, $4)`,
                [item.id_prato, id_pedido, qtd, precoUnitario]
            );

            await client.query(
                `UPDATE prato 
                 SET quantidade_estoque_prato = GREATEST(quantidade_estoque_prato - $1, 0)
                 WHERE id_prato = $2`,
                [qtd, item.id_prato]
            );
        }

        // Registra o pagamento
        await client.query(
            `INSERT INTO pagamento (pedido_id_pedido, data_pagamento, valor_total_pagamento)
             VALUES ($1, CURRENT_TIMESTAMP, $2)`,
            [id_pedido, valorTotal.toFixed(2)]
        );

        // Registra a forma de pagamento selecionada
        if (id_forma_pagamento) {
            await client.query(
                `INSERT INTO pagamento_has_forma_pagamento (pagamento_id_pedido, forma_pagamento_id_forma_pagamento, valor_pago)
                 VALUES ($1, $2, $3)`,
                [id_pedido, Number(id_forma_pagamento), valorTotal.toFixed(2)]
            );
        }

        await client.query('COMMIT');

        return res.status(201).json({
            status: 'ok',
            mensagem: 'Pedido registrado com sucesso!',
            id_pedido
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao finalizar pedido:', error);
        return res.status(500).json({
            status: 'erro',
            mensagem: 'Erro ao registrar pedido: ' + error.message
        });
    } finally {
        client.release();
    }
};

// 3. Listar todos os pedidos registrados (GET /pedido)
exports.listarPedidos = async (req, res) => {
    try {
        const sql = `
            SELECT 
                p.id_pedido,
                p.data_pedido,
                p.cliente_usuario_cpf_usuario AS cpf_cliente,
                u.nome_usuario AS nome_cliente,
                pag.valor_total_pagamento AS valor_total,
                fp.nome_forma_pagamento AS forma_pagamento,
                STRING_AGG(php.quantidade || 'x ' || pr.nome_prato, ', ') AS resumo_itens
            FROM pedido p
            LEFT JOIN usuario u ON p.cliente_usuario_cpf_usuario = u.cpf_usuario
            LEFT JOIN pedido_has_prato php ON p.id_pedido = php.pedido_id_pedido
            LEFT JOIN prato pr ON php.prato_id_prato = pr.id_prato
            LEFT JOIN pagamento pag ON p.id_pedido = pag.pedido_id_pedido
            LEFT JOIN pagamento_has_forma_pagamento phfp ON pag.pedido_id_pedido = phfp.pagamento_id_pedido
            LEFT JOIN forma_pagamento fp ON phfp.forma_pagamento_id_forma_pagamento = fp.id_forma_pagamento
            GROUP BY p.id_pedido, p.data_pedido, p.cliente_usuario_cpf_usuario, u.nome_usuario, pag.valor_total_pagamento, fp.nome_forma_pagamento
            ORDER BY p.id_pedido DESC
        `;
        const resultado = await query(sql);
        return res.json(resultado.rows);
    } catch (error) {
        console.error('Erro ao listar pedidos:', error);
        return res.status(500).json({ erro: 'Erro ao listar pedidos.' });
    }
};
// 4. Listar apenas os pedidos do cliente logado (GET /pedido/meusPedidos)
exports.meusPedidos = async (req, res) => {
    try {
        const cpf = req.signedCookies ? req.signedCookies.usuarioLogado : null;

        if (!cpf) {
            return res.status(401).json({ status: 'erro', mensagem: 'Usuário não autenticado.' });
        }

        const sql = `
            SELECT 
                p.id_pedido,
                p.data_pedido,
                pag.valor_total_pagamento AS valor_total,
                fp.nome_forma_pagamento AS forma_pagamento,
                STRING_AGG(php.quantidade || 'x ' || pr.nome_prato, ', ') AS resumo_itens
            FROM pedido p
            LEFT JOIN pedido_has_prato php ON p.id_pedido = php.pedido_id_pedido
            LEFT JOIN prato pr ON php.prato_id_prato = pr.id_prato
            LEFT JOIN pagamento pag ON p.id_pedido = pag.pedido_id_pedido
            LEFT JOIN pagamento_has_forma_pagamento phfp ON pag.pedido_id_pedido = phfp.pagamento_id_pedido
            LEFT JOIN forma_pagamento fp ON phfp.forma_pagamento_id_forma_pagamento = fp.id_forma_pagamento
            WHERE p.cliente_usuario_cpf_usuario = $1
            GROUP BY p.id_pedido, p.data_pedido, pag.valor_total_pagamento, fp.nome_forma_pagamento
            ORDER BY p.id_pedido DESC
        `;
        const resultado = await query(sql, [cpf]);
        return res.json(resultado.rows);
    } catch (error) {
        console.error('Erro ao buscar pedidos do cliente:', error);
        return res.status(500).json({ erro: 'Erro ao buscar seus pedidos.' });
    }
};