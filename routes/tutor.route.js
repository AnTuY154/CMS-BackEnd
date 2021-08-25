const express = require('express');
const router = express.Router();
const { check } = require('express-validator');

const tutorController = require('../controllers/tutor.controller');

router.get('/', tutorController.getTutors);

router.get('/:tutorId', tutorController.getTutorById);

router.post(
	'/create',
	[
		check('full_name').isString().notEmpty().isLength({ max: 255 }),
		check('display_name').isString().notEmpty().isLength({ max: 255 }),
		check('email').isString().isEmail().isLength({ max: 255 }),
		check('phone')
			.isString()
			.matches(/^[0-9]+$/)
			.isLength({ min: 10, max: 11 })
			.isLength({ max: 255 }),
		check('address').isString().isLength({ max: 255 }),
		check('note').isString().isLength({ max: 255 }),
		check('gender').isString().isLength({ max: 255 }),
		check('subject').isArray(),
	],
	tutorController.createTutor
);

router.patch(
	'/:tutorId',
	[
		check('profile').isObject().notEmpty(),
		check('tutorsubject').isArray().notEmpty(),
		check('defaultTutorSubject').isArray().notEmpty(),
	],
	tutorController.updateTutor
);

router.post('/delete/:tutorId', tutorController.deleteTutor);

router.post('/restore/:tutorId', tutorController.restoreTutor);

module.exports = router;
