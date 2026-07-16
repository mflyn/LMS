const express = require('express');

const { authenticateGateway } = require('../../../common/middleware/auth');
const controller = require('../controllers/parentMembershipController');

const router = express.Router();

router.post('/preview', authenticateGateway, controller.previewInvitation);
router.post('/accept', authenticateGateway, controller.acceptInvitation);

module.exports = router;
