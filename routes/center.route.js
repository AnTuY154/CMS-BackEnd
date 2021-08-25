const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const centerController = require('../controllers/center.controller');

router.get(
	'/',
	[check('date').isDate().notEmpty()],
	centerController.getScheduleOfCenter
);

module.exports = router;
