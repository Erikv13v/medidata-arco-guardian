const express = require('express');
const publicArcoController = require('../controllers/publicArcoController');

const router = express.Router();

router.post('/arco', publicArcoController.manejarArcoPublico);

module.exports = router;
