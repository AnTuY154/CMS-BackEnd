const express = require('express');
const router = express.Router();
const { check } = require('express-validator');

const managerController = require('../controllers/manager.controller');

router.get('/', managerController.getManagers);

router.get('/:managerId', managerController.getManagerById);

router.post(
	'/create',
	[
		check('full_name').isString().notEmpty().isLength({ max: 255 }),
		check('display_name').isString().notEmpty().isLength({ max: 255 }),
		check('email').isString().isEmail().isLength({ max: 255 }),
		check('phone')
			.isString()
			.matches(/^[0-9]+$/)
			.isLength({ min: 10, max: 11 }),

		check('gender').isString().notEmpty().isLength({ max: 255 }),
		check('shift').isArray().notEmpty(),
		check('address').isString().isLength({ max: 255 }),
		check('note').isString().isLength({ max: 1000 }),
		check('gender').isString().isLength({ max: 255 }),
		check('managerType')
			.notEmpty()
			.isString()
			.matches(/^(2|7)$/),
	],
	managerController.createManager
);

router.patch(
	'/:managerId',
	[
		check('profile').isObject().notEmpty(),
		check('managerShift').isArray().notEmpty(),
		check('defaultManagerShift').isArray().notEmpty(),
	],
	managerController.updateManager
);

router.post('/delete/:managerId', managerController.deleteManager);

router.post('/restore/:managerId', managerController.restoreManager);

module.exports = router;
