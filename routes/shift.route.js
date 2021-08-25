const express = require('express');
const router = express.Router();

const shiftController = require('../controllers/shift.controller');

router.get('/manager', shiftController.getManagerShifts);

router.get('/manager/:managerId', shiftController.getShiftsByManagerId);

router.get('/slot', shiftController.getSlots);

module.exports = router;
