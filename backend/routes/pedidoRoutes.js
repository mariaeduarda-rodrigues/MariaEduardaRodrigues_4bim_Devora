const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const { verificaFuncionarioApi } = require('../middlewares/authMiddleware');

router.get('/dadosCliente', pedidoController.dadosCliente);
router.post('/finalizar', pedidoController.finalizarPedido);
router.get('/meusPedidos', pedidoController.meusPedidos);
router.get('/', verificaFuncionarioApi, pedidoController.listarPedidos);

module.exports = router;