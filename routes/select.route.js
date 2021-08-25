const express = require('express');
const router = express.Router();

const selectController = require('../controllers/select.controller');

router.get('/addclass/teacher', selectController.getTeacherAddClassScreen);

router.get('/addclass/tutor', selectController.getTutorAddClassScreen);

router.get('/addclass/subject', selectController.getSubjectAddClassScreen);

router.get('/addclass/room', selectController.getRoomAddClassScreen);

router.get('/addclass/slot', selectController.getSlotAddClassScreen);

module.exports = router;
