const express = require('express');
const router = express.Router();

const subjectController = require('../controllers/subject.controller');

router.get('/', subjectController.getSubjects);

router.get('/teacher/:teacherId', subjectController.getSubjectsByTeacherId);

router.post('/updateSubject', subjectController.updateSubject);

router.post('/updateSubjectFlagD', subjectController.updateSubjectFlagD);

module.exports = router;
