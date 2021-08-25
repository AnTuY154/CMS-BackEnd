const express = require('express');
const router = express.Router();
const { check } = require('express-validator');

const lessonController = require('../controllers/lesson.controller');

router.get('/getTopics/:courseId', lessonController.getTopics);

router.post(
	'/createLesson',
	[
		check('lesson').isObject().notEmpty(),
		check('source').isObject().notEmpty(),
	],
	lessonController.createLesson
);

router.get('/getListLesson', lessonController.getListLesson);

router.get('/getTotalLesson', lessonController.getTotalLesson);

router.post(
	'/updateLessonSourceStatus',
	[
		check('source_id').isString().notEmpty(),
		check('status')
			.isString()
			.matches(/^(0|1|2|3)$/)
			.notEmpty(),
	],
	lessonController.updateLessonSourceStatus
);

router.get('/getTopics2/:courseId', lessonController.getTopics2);

router.get('/getSourceById/:sourceId', lessonController.getSourceById);

router.post(
	'/updateSource',
	[
		check('lesson').isObject().notEmpty(),
		check('source').isObject().notEmpty(),
	],
	lessonController.updateSource
);

module.exports = router;
