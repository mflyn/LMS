const express = require('express');
const { authenticateGateway } = require('../../../common/middleware/auth');
const familyController = require('../controllers/familyController');
const membershipController = require('../controllers/parentMembershipController');

const router = express.Router();

router.get('/me', authenticateGateway, familyController.getMyFamily);
router.post('/', authenticateGateway, familyController.createFamily);
router.patch('/:familyId', authenticateGateway, familyController.updateFamily);
router.post('/:familyId/parent-invitations', authenticateGateway, membershipController.createInvitation);
router.get('/:familyId/parent-invitations/active', authenticateGateway, membershipController.getActiveInvitation);
router.delete(
  '/:familyId/parent-invitations/:invitationId',
  authenticateGateway,
  membershipController.revokeInvitation
);
router.delete('/:familyId/members/me', authenticateGateway, membershipController.leaveFamily);
router.delete('/:familyId/members/:parentId', authenticateGateway, membershipController.removeMember);
router.patch('/:familyId/owner', authenticateGateway, membershipController.transferOwnership);

module.exports = router;
