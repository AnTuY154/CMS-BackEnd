const express = require('express');
const router = express.Router();
const { check } = require('express-validator');

const salaryController = require('../controllers/salary.controller');

router.get('/getSalaryList', salaryController.getSalaryList);

router.get('/getTotalEmployeeSalary', salaryController.getTotalEmployeeSalary);

router.get('/getDetailSalaryList', salaryController.getDetailSalaryList);

router.get('/getSalaryCourse', salaryController.getSalaryCourse);

router.put('/updateSalary', salaryController.updateSalary);

router.put('/updateSalaryCourse', salaryController.updateSalaryCourse);

router.get('/getTotalSalary', salaryController.getTotalSalary);

router.get('/getTotalBillByUser', salaryController.getTotalBillByUser);

router.get(
	'/getTotalBillOnlineByUser',
	salaryController.getTotalBillOnlineByUser
);

router.post(
	'/caculateScheduleSalary',
	[
		check('schedule_id').isString().notEmpty(),
		check('class_id').isString().notEmpty(),
		check('teacher_id').isString().notEmpty(),
		check('is_update').isBoolean().notEmpty(),
	],
	salaryController.caculateScheduleSalary
);

module.exports = router;
