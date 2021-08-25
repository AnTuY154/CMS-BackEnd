const express = require('express');
const router = express.Router();
const { check } = require('express-validator');

const feedbackController = require('../controllers/feedBack.controller');

router.get('/getFeedBackClass', feedbackController.getFeedBackClass);

router.get('/getFeedBackCourse', feedbackController.getFeedBackCourse);

router.get('/getCountFeedBackClass', feedbackController.getCountFeedBackClass);

router.get('/getClassesSelect', feedbackController.getClassesSelect);

router.get('/getCourseSelect', feedbackController.getCourseSelect);

router.post(
	'/updateFeedBackStatus',
	[
		check('feedback_id').isString().notEmpty(),
		check('status')
			.isString()
			.matches(/^(0|1)$/)
			.notEmpty(),
	],
	feedbackController.updateFeedBackStatus
);

router.get(
	'/getCountFeedBackCourse',
	feedbackController.getCountFeedBackCourse
);

router.post(
	'/send',
	[
		check('classId').isString().notEmpty(),
		check('feedback').isString().notEmpty(),
	],
	feedbackController.sendFeedback
);

module.exports = router;
