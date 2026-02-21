const express = require('express');
const router = express.Router();
const { syncTelemetry } = require('../controllers/iotController');

// IoT endpoints don't use JWT, they use HMAC signatures
router.post('/sync', syncTelemetry);

module.exports = router;
