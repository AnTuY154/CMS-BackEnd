require('dotenv').config();
const router = require('express').Router();
const { check } = require('express-validator');

const authControllers = require('../controllers/auth.controller');

router.post(
	'/signin',
	[
		check('username').notEmpty().isEmail(),
		check('password').notEmpty().isString(),
	],
	authControllers.signin
);

router.post(
	'/reset',
	[check('username').notEmpty().isEmail()],
	authControllers.forgotPassword
);

router.post(
	'/reset/recover/:userId',
	[check('code').notEmpty().isInt()],
	authControllers.checkRecoverCode
);

router.post(
	'/reset/newpassword/:userId',
	[check('newpassword').notEmpty().isString().isLength({ min: 6, max: 100 })],
	authControllers.setNewPassword
);

router.post('/logout', authControllers.logout);

router.get('/getListFunctionByRole', authControllers.getListFunctionByRole);

module.exports = router;
