const express = require('express');
const router = express.Router();
const { createContainer, dispatchContainer, generateDeliveryPermit, getContainers, getContainerDetails } = require('../controllers/containerController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', getContainers);
router.get('/:containerId', getContainerDetails);

router.post('/create', authorizeRoles('MANUFACTURER'), createContainer);
router.post('/:containerId/dispatch', authorizeRoles('MANUFACTURER'), dispatchContainer);
router.post('/:containerId/permit', authorizeRoles('MANUFACTURER'), generateDeliveryPermit);

module.exports = router;
