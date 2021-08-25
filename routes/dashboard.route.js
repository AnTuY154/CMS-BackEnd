const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboard.controller');

router.get('/admin', dashboardController.getAdminDashboard);
router.get('/manager', dashboardController.getManagerDashboard);
router.get('/teacher', dashboardController.getTeacherDashboard);
router.get('/marketer', dashboardController.getMarketerDashboard);
router.get('/managerPost', dashboardController.getManagerPostDashboard);
router.get('/getRevenus', dashboardController.getRevenus);
router.get('/getCountRevenus', dashboardController.getCountRevenus);
router.get('/getProceedsAndSale', dashboardController.getProceedsAndSale);
router.get('/getRevenusOnline', dashboardController.getRevenusOnline);
router.get('/getCountRevenusOnline', dashboardController.getCountRevenusOnline);
router.get('/getProceedsAndSaleOn', dashboardController.getProceedsAndSaleOn);
router.get('/getRefundMoney', dashboardController.getRefundMoney);
router.patch('/updateRefundMoney', dashboardController.updateRefundMoney);
router.get('/getCountRefundMoney', dashboardController.getCountRefundMoney);
router.get(
	'/getTotalAdditionalChargesAndresidualFee',
	dashboardController.getTotalAdditionalChargesAndresidualFee
);

module.exports = router;
