const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const attendanceController = require('../controllers/attendance.controller');

router.get('/getattendancedaily', attendanceController.getAttendanceDaily);

router.get('/getCountAttendance', attendanceController.getCountAttendance);

router.get(
	'/history/:classId',
	attendanceController.getDetailAttendanceHistory
);

router.get(
	'/getStudentsAttendanceDaily',
	attendanceController.getStudentsAttendanceDaily
);

router.post(
	'/updateAttendanceDaily',
	[
		check('attendance').isObject().notEmpty(),
		check('schedule_id').isString().notEmpty(),
		check('class_id').isString().notEmpty(),
	],
	attendanceController.updateAttendanceDaily
);

router.get(
	'/attendstudent/:classId',
	attendanceController.getStudentAttendanceByClassId
);

module.exports = router;
