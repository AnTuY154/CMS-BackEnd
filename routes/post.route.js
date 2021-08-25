const express = require('express');
const router = express.Router();
const multer = require('multer');
const { check } = require('express-validator');
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

const postController = require('../controllers/post.controller');

router.get('/categoryList', postController.getPostCategory);

router.post('/createPost', upload.single('upload'), postController.createPost);

router.get('/getPostList', postController.getPostList);

router.get('/totalPost', postController.total_record);

router.get('/maketing/:maketingId', postController.getCountPostByMaketingId);

router.get('/approvePosts', postController.getApprovePost);

router.get('/:postId', postController.getPostById);

router.post(
	'/updatePost',
	// [
	// 	check('title').isString().notEmpty(),
	// 	check('brief_info').isString().notEmpty(),
	// 	check('full_content').isString().notEmpty(),
	// 	check('ebook_link').isString(),
	// 	check('category_list').isString().notEmpty(),
	// 	check('post_id').isString().notEmpty(),
	// 	check('thumbnailUrl').isString(),
	// 	check('isFeatured').isBoolean().notEmpty(),
	// ],
	upload.single('upload'),
	postController.updatePost
);

router.patch(
	'/reviewPost',
	[
		check('post_id').isString().notEmpty(),
		check('status')
			.isString()
			.matches(/^(1|2)$/)
			.notEmpty(),
		check('isFeatured').isBoolean().notEmpty(),
	],
	postController.reviewPost
);

router.patch(
	'/updatePostFlag',
	[
		check('post_id').isString().notEmpty(),
		check('status')
			.isString()
			.matches(/^(0|1|2|3|4)$/)
			.notEmpty(),
	],
	postController.updatePostFlag
);

router.patch('/updatePostCategory', postController.updatePostCategory);

router.patch(
	'/updateCategoryFlagD',
	[check('setting_id').isString().notEmpty()],
	postController.updateCategoryFlagD
);

module.exports = router;
