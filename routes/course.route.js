const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');

aws.config.update({
	secretAccessKey: process.env.AWS_SECRET_KEY,
	accessKeyId: process.env.AWS_ACCESS_KEY,
	region: process.env.AWS_REGION,
});
const s3 = new aws.S3({});

const upload = multer({
	storage: multerS3({
		s3: s3,
		acl: 'public-read',
		bucket: process.env.AWS_S3_BUCKET,
	}),
});

const courseController = require('../controllers/course.controller');

router.get('/getSubjectList', courseController.getSubjectList);

router.get('/getCourseList', courseController.getCourseList);

router.get(
	'/getTotalCourseListByFilter',
	courseController.getTotalCourseListByFilter
);
router.get('/student/:studentId', courseController.getListCourseByStudentId);

router.get('/getTeacherList', courseController.getTeacherList);

router.get('/getTeacherList', courseController.getTeacherList);

router.get('/getCourseFilter', courseController.getCourseFilter);

router.post(
	'/createCourse',
	upload.single('upload'),
	courseController.createCourse
);

router.get('/:course_id', courseController.getCourseById);

router.post(
	'/updateCourse',

	upload.single('upload'),
	courseController.updateCourse
);

router.patch(
	'/reviewCourse',
	[
		check('price')
			.isString()
			.matches(/^[0-9]+$/)
			.notEmpty(),
		check('course_id').isString().notEmpty(),
		check('discount')
			.isString()
			.matches(/^[0-9]+$/)
			.notEmpty(),
		check('percent')
			.isString()
			.matches(/^[0-9]+$/)
			.notEmpty(),
		check('status')
			.isString()
			.matches(/^(2|1|0)$/)
			.notEmpty(),
		check('isFeatured').isBoolean(),
	],
	courseController.reviewCourse
);

router.patch(
	'/updateCourseFlag',
	[
		check('course_id').isString().notEmpty(),
		check('status')
			.isString()
			.matches(/^(2|1|0|3|4)$/)
			.notEmpty(),
	],
	courseController.updateCourseFlag
);

module.exports = router;
