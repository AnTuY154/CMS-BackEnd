const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const classController = require('../controllers/class.controller');

router.get('/', classController.getClasses);

router.get('/all', classController.getAllClasses);

router.get('/getClassesSelect', classController.getClassesSelect);

router.get('/student/:classId', classController.getClassByStudentId);
router.get('/student', classController.getListClassByStudentId);
router.get(
	'/managerScreen/student/:studentId',
	classController.getListClassByStudentIdManagerScreen
);

router.get('/teacher/:teacherId', classController.getClassByTeacherId);

router.get('/manager/:managerId', classController.getClassesByManagerShift);

router.get('/:classId', classController.getClassByClassId);

router.post(
	'/',
	[
		check('classinfo').isObject().notEmpty(),
		check('classtimetable').isArray().notEmpty(),
	],
	classController.createClass
);

router.post('/:classId/student/:studentId', classController.addStudentToClass);

router.patch(
	'/:classId',
	[
		check('classInfo').isObject().notEmpty(),
		check('detailSchedules').isArray().notEmpty(),
	],
	classController.updateClass
);
router.post('/delete/:classId', classController.deleteClass);

router.post('/restore/:classId', classController.restoreClass);

router.post(
	'/:classId/delete/:studentId',
	classController.deleteStudentInClass
);

module.exports = router;
