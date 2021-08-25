const express = require('express');
const router = express.Router();

const excelController = require('../controllers/excel.controller');

router.get('/salarys', excelController.getSalaryListExcel);
router.get(
	'/getDetailSalaryListExcel',
	excelController.getDetailSalaryListExcel
);
router.get('/getSalaryCourseExcel', excelController.getSalaryCourseExcel);
router.get('/getAttendanceDailyExcel', excelController.getAttendanceDailyExcel);
router.get('/getCourseListExcel', excelController.getCourseListExcel);
router.get('/getListLessonExcel', excelController.getListLessonExcel);
router.get('/getFeedBackClassExcel', excelController.getFeedBackClassExcel);
router.get('/getFeedBackCourseExcel', excelController.getFeedBackCourseExcel);
router.get('/getPostListExcel', excelController.getPostListExcel);
router.get('/getRegisterListExcel', excelController.getRegisterListExcel);
router.get('/getRegisterListExcel', excelController.getRegisterListExcel);
router.get('/managers', excelController.getManagersExcel);
router.get('/teachers', excelController.getTeachersExcel);
router.get('/tutors', excelController.getTutorsExcel);
router.get('/students', excelController.getStudentsExcel);
router.get('/marketings', excelController.getMaketingsExcel);
router.get('/classes', excelController.getClassesExcel);
router.get('/classesStudent', excelController.getClassesByStudentExcel);
router.get('/getRevenueExcelOff', excelController.getRevenueExcelOff);
router.get('/getRevenueExcelOn', excelController.getRevenueExcelOn);
router.get('/getRefundMoneyExcel', excelController.getRefundMoneyExcel);

module.exports = router;
