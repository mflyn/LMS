const express = require('express');
const { authenticateGateway } = require('../../../common/middleware/auth');
const familyController = require('../controllers/familyController');

const router = express.Router();

router.post('/', authenticateGateway, familyController.createChild);
router.get('/', authenticateGateway, familyController.listChildren);
router.get('/:childId', authenticateGateway, familyController.getChild);
router.patch('/:childId', authenticateGateway, familyController.updateChild);
router.post('/:childId/pin', authenticateGateway, familyController.setChildPin);

module.exports = router;
