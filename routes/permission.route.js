require('dotenv').config();
const router = require('express').Router();

const permissionControllers = require('../controllers/perrmision.controller');

router.get('/menu', permissionControllers.getMenu);

router.get('/functions', permissionControllers.getFunctions);

router.post('/check', permissionControllers.checkPermission);

router.patch('/updatePermission', permissionControllers.updatePermission);

router.post('/checkmenu', permissionControllers.checkMenuChange);

module.exports = router;
