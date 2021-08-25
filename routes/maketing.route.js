const express = require('express');
const router = express.Router();
const { check } = require('express-validator');

const maketingController = require('../controllers/maketing.controller');

router.get('/', maketingController.getMaketings);

router.get('/:maketingId', maketingController.getMaketingById);

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
		check('address').isString().isLength({ max: 255 }),
		check('note').isString().isLength({ max: 1000 }),
	],
	maketingController.createMaketing
);

router.patch(
	'/:maketingId',
	[check('profile').isObject().notEmpty()],
	maketingController.updateMaketing
);

router.post('/delete/:maketingId', maketingController.deleteMaketing);

router.post('/restore/:maketingId', maketingController.restoreMaketing);

module.exports = router;
