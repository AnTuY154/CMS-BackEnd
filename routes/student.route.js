const express = require('express');
const router = express.Router();
const { check } = require('express-validator');

const studentController = require('../controllers/student.controller');

router.get('/', studentController.getStudents);

router.get('/class/:classId', studentController.getStudentsByClassId);

router.get('/weekly', studentController.getStudentWeeklyTimetable);

router.get('/:studentId', studentController.getStudentById);

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
		check('note').isString().isLength({ max: 1000 }),
		check('gender').isString().isLength({ max: 255 }),
		check('classroom').isArray(),
	],
	studentController.createStudent
);

router.patch(
	'/:studentId',
	[
		check('profile').isObject().notEmpty(),
		check('listClass').isArray(),
		check('listCourse').isArray(),
	],
	studentController.updateStudent
);

router.post('/delete/:studentId', studentController.deleteStudent);

router.post('/restore/:studentId', studentController.restoreStudent);

module.exports = router;
