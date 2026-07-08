const express = require('express');
const { authenticateGateway } = require('../../../common/middleware/auth');
const familyController = require('../controllers/familyController');

const router = express.Router();

router.get('/me', authenticateGateway, familyController.getMyFamily);
router.post('/', authenticateGateway, familyController.createFamily);
router.patch('/:familyId', authenticateGateway, familyController.updateFamily);

module.exports = router;
