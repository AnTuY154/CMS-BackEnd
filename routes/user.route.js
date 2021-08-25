const express = require('express');
const router = express.Router();
const { check } = require('express-validator');

const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

const userController = require('../controllers/user.controller');

aws.config.update({
	secretAccessKey: process.env.AWS_SECRET_KEY,
	accessKeyId: process.env.AWS_ACCESS_KEY,
	region: process.env.AWS_REGION,
});

const s3 = new aws.S3();

const upload = multer({
	storage: multerS3({
		s3: s3,
		acl: 'public-read',
		bucket: process.env.AWS_S3_BUCKET,
	}),
});

router.get('/', userController.getUserById);

router.get('/check', userController.checkRoleByUser);

router.get('/functions', userController.getFunctionByRoleId);

router.patch(
	'/',
	[
		check('full_name').isString().notEmpty(),
		check('display_name').isString().notEmpty(),
		check('email').isString().isEmail(),
		check('phone')
			.isString()
			.matches(/^[0-9]+$/)
			.isLength({ min: 10, max: 11 }),
		check('address').isString(),
		check('gender').isString(),
	],
	userController.updateProfile
);

router.get('/avatar', userController.getAvatar);

router.patch('/avatar', upload.single('image'), userController.changeAvatar);
router.post(
	'/changepassword',
	[
		check('oldPassword').isString().notEmpty(),
		check('newPassword').isString().notEmpty().isLength({ min: 6, max: 30 }),
	],
	userController.changeNewPassword
);

module.exports = router;
