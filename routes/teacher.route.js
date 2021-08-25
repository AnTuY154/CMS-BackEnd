const express = require('express');
const router = express.Router();
const { check } = require('express-validator');

const teacherController = require('../controllers/teacher.controller');

router.get('/', teacherController.getTeachers);

router.get('/:teacherId', teacherController.getTeacherById);

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
		check('address').isString().isLength({ max: 255 }),
		check('note').isString().isLength({ max: 255 }),
		check('gender').isString().isLength({ max: 255 }),
		check('subject').isArray(),
	],
	teacherController.createTeacher
);

router.patch(
	'/:teacherId',
	[
		check('profile').isObject().notEmpty(),
		check('teachersubject').isArray().notEmpty(),
		check('defaultTeacherSubject').isArray().notEmpty(),
	],
	teacherController.updateTeacher
);

router.post('/delete/:teacherId', teacherController.deleteTeacher);

router.post('/restore/:teacherId', teacherController.restoreTeacher);

module.exports = router;
