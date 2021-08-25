const express = require('express');
const router = express.Router();
const { check } = require('express-validator');

const registerController = require('../controllers/register.controller');

router.get('/getRegisterYear', registerController.getRegisterYear);

router.get('/getRegisterList', registerController.getRegisterList);

router.post(
	'/updateRegisStatus',
	[
		check('regis_id').isArray().notEmpty(),
		check('status')
			.isString()
			.matches(/^(2|1|0|3)$/)
			.notEmpty(),
	],
	registerController.updateRegisStatus
);

router.get('/getTotalRegister', registerController.getTotalRegister);

module.exports = router;
