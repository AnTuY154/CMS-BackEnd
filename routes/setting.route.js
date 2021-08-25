const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const { check } = require('express-validator');

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

const settingController = require('../controllers/setting.controller');

// router.get('/', settingController.getTest);

router.post(
	'/',
	[
		check('category').isString().notEmpty(),
		check('category_des').isString().notEmpty(),
	],
	settingController.postSetting
);

router.post(
	'/updateSlides',
	upload.array('upload', 8),
	settingController.updateSlides
);
router.get('/getListSlides', settingController.getListSlides);
router.patch(
	'/updateSlidesFlag',
	[check('slider_id').isString().notEmpty()],
	settingController.updateSlidesFlag
);

router.get('/getListSlides', settingController.getListSlides);

router.get('/getListSlot/:type', settingController.getListSlot);

router.post('/updateSlot', settingController.updateSlot);

router.post(
	'/updateSlotFlag',
	[
		check('slot_id').isString().notEmpty(),
		check('flag').isBoolean().notEmpty(),
	],
	settingController.updateSlotFlag
);

router.get('/getListRooms', settingController.getListRooms);

router.post(
	'/updateRoomFlag',
	[
		check('room_id').isString().notEmpty(),
		check('flag').isBoolean().notEmpty(),
	],
	settingController.updateRoomFlag
);

router.post('/updateRooms', settingController.updateRooms);

router.get('/checkExistSlot', settingController.checkExistSlot);

router.get('/checkExistRoom', settingController.checkExistRoom);

router.get('/getRolesSetting', settingController.getRolesSetting);




module.exports = router;
