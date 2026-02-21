const express = require('express');
const router = express.Router();
const { activatePermit, scanRfid } = require('../controllers/receiverController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken); // Require base login

router.post('/activate', authorizeRoles('RECEIVER'), activatePermit);
router.post('/scan', authorizeRoles('RECEIVER'), scanRfid);

module.exports = router;
