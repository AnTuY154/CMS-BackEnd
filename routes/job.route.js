const express = require('express');
const router = express.Router();
const jobController = require('../controllers/job.controller');

router.post('/mail/staff', jobController.sendSalaryMailForStaff);
router.post('/insert/payment', jobController.calculatePaymentStudent);
router.post('/mail/payment', jobController.sendPaymentMailForStudent);

module.exports = router;
