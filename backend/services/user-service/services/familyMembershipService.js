const crypto = require('crypto');
const mongoose = require('mongoose');

const Family = require('../../../common/models/Family');
const FamilyMembershipEvent = require('../../../common/models/FamilyMembershipEvent');
const FamilyParentInvitation = require('../../../common/models/FamilyParentInvitation');
const User = require('../../../common/models/User');
const { runMongoTransaction } = require('../../../common/services/mongoTransaction');

const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;
const FAMILY_ROLES = Object.freeze(['father', 'mother', 'guardian', 'other']);

const membershipError = (status, code, message, details = []) => Object.assign(new Error(message), {
  status,
  code,
  details
});
const inactiveInvitation = () => membershipError(
  409,
  'FAMILY_INVITATION_NOT_ACTIVE',
  'Invitation is not active'
);
const governanceDenied = () => membershipError(
  403,
  'FAMILY_GOVERNANCE_DENIED',
  'Family governance permission is required'
);
const familyMemberNotFound = () => membershipError(
  404,
  'FAMILY_MEMBER_NOT_FOUND',
  'Family member not found'
);
const idString = (value) => (value ? value.toString() : null);
const digestToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const isToken = (token) => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);

const createFamilyMembershipService = ({
  FamilyModel = Family,
  UserModel = User,
  InvitationModel = FamilyParentInvitation,
  EventModel = FamilyMembershipEvent,
  mongooseInstance = mongoose,
  now = () => new Date(),
  randomBytes = crypto.randomBytes
} = {}) => {
  const withSession = (query, session) => (session ? query.session(session) : query);
  const ownerFamily = (familyId, parentId, session) => withSession(FamilyModel.findOne({
    _id: familyId,
    ownerParentId: parentId,
    memberParentIds: parentId
  }), session);

  const buildFamilyView = async (family, session = null) => {
    const parentsQuery = UserModel.find({
      _id: { $in: family.memberParentIds },
      role: 'parent'
    }).select('name parentProfile.familyRole');
    const parents = await withSession(parentsQuery, session);
    const byId = new Map(parents.map((parent) => [idString(parent._id), parent]));
    const ownerId = idString(family.ownerParentId);

    return {
      familyId: idString(family._id),
      familyName: family.familyName,
      timezone: family.timezone,
      ownerParentId: ownerId,
      memberParentIds: family.memberParentIds.map(idString),
      childIds: family.childIds.map(idString),
      parents: family.memberParentIds.map((parentId) => {
        const parent = byId.get(idString(parentId));
        if (!parent) throw new Error(`Active parent ${parentId} is missing`);
        return {
          parentId: idString(parent._id),
          name: parent.name,
          familyRole: parent.parentProfile?.familyRole || 'guardian',
          isOwner: idString(parent._id) === ownerId
        };
      }),
      createdAt: family.createdAt,
      updatedAt: family.updatedAt
    };
  };

  const expireElapsed = async (familyId, currentTime, session) => InvitationModel.updateMany({
    familyId,
    status: 'pending',
    expiresAt: { $lte: currentTime }
  }, {
    $set: { status: 'expired' }
  }, { session });

  const appendEvent = (event, session) => EventModel.create([event], { session });

  const createInvitation = async ({ actorParentId, familyId }) => {
    let created;
    let clearToken;
    await runMongoTransaction({
      mongooseInstance,
      work: async (session) => {
        const family = await ownerFamily(familyId, actorParentId, session);
        if (!family) throw governanceDenied();
        if (family.memberParentIds.length >= 2) {
          throw membershipError(409, 'FAMILY_PARENT_LIMIT_REACHED', 'Family already has two parents');
        }

        const currentTime = now();
        await expireElapsed(family._id, currentTime, session);
        const active = await withSession(InvitationModel.findOne({
          familyId: family._id,
          status: 'pending',
          expiresAt: { $gt: currentTime }
        }), session);
        if (active) {
          throw membershipError(
            409,
            'FAMILY_INVITATION_ALREADY_ACTIVE',
            'Family already has an active invitation'
          );
        }

        clearToken = randomBytes(32).toString('base64url');
        [created] = await InvitationModel.create([{
          familyId: family._id,
          invitedByParentId: actorParentId,
          tokenDigest: digestToken(clearToken),
          status: 'pending',
          expiresAt: new Date(currentTime.getTime() + INVITATION_TTL_MS)
        }], { session });
        await appendEvent({
          familyId: family._id,
          action: 'invitation_created',
          actorParentId,
          invitationId: created._id
        }, session);
      }
    });

    return {
      invitationId: idString(created._id),
      token: clearToken,
      expiresAt: created.expiresAt
    };
  };

  const getActiveInvitation = async ({ actorParentId, familyId }) => {
    const family = await ownerFamily(familyId, actorParentId);
    if (!family) throw governanceDenied();
    const currentTime = now();
    await expireElapsed(family._id, currentTime);
    const invitation = await InvitationModel.findOne({
      familyId: family._id,
      status: 'pending',
      expiresAt: { $gt: currentTime }
    });
    return invitation ? {
      invitationId: idString(invitation._id),
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt
    } : null;
  };

  const revokeInvitation = async ({ actorParentId, familyId, invitationId }) => {
    await runMongoTransaction({
      mongooseInstance,
      work: async (session) => {
        const family = await ownerFamily(familyId, actorParentId, session);
        if (!family) throw governanceDenied();
        const currentTime = now();
        await expireElapsed(family._id, currentTime, session);
        const invitation = await InvitationModel.findOneAndUpdate({
          _id: invitationId,
          familyId: family._id,
          status: 'pending',
          expiresAt: { $gt: currentTime }
        }, {
          $set: { status: 'revoked', revokedAt: currentTime }
        }, { new: true, session });
        if (!invitation) throw inactiveInvitation();
        await appendEvent({
          familyId: family._id,
          action: 'invitation_revoked',
          actorParentId,
          invitationId: invitation._id
        }, session);
      }
    });
  };

  const findActiveByToken = (token, session) => withSession(InvitationModel.findOne({
    tokenDigest: digestToken(token),
    status: 'pending',
    expiresAt: { $gt: now() }
  }), session);

  const previewInvitation = async ({ token }) => {
    if (!isToken(token)) throw membershipError(400, 'VALIDATION_ERROR', 'token is invalid');
    const invitation = await findActiveByToken(token);
    if (!invitation) throw inactiveInvitation();
    const [family, owner] = await Promise.all([
      FamilyModel.findById(invitation.familyId),
      UserModel.findById(invitation.invitedByParentId).select('name')
    ]);
    if (!family || !owner) throw inactiveInvitation();
    return {
      familyName: family.familyName,
      owner: { name: owner.name },
      expiresAt: invitation.expiresAt
    };
  };

  const acceptInvitation = async ({ actorParentId, token, familyRole }) => {
    if (!isToken(token)) throw membershipError(400, 'VALIDATION_ERROR', 'token is invalid');
    if (!FAMILY_ROLES.includes(familyRole)) {
      throw membershipError(400, 'VALIDATION_ERROR', 'familyRole is invalid');
    }
    let familyView;
    await runMongoTransaction({
      mongooseInstance,
      work: async (session) => {
        const invitation = await findActiveByToken(token, session);
        if (!invitation) throw inactiveInvitation();

        const parent = await withSession(UserModel.findOne({
          _id: actorParentId,
          role: 'parent'
        }), session);
        if (!parent) throw membershipError(403, 'FAMILY_GOVERNANCE_DENIED', 'Parent account is required');
        const existingFamily = await withSession(FamilyModel.findOne({
          $or: [
            { ownerParentId: actorParentId },
            { memberParentIds: actorParentId }
          ]
        }), session);
        if (parent.familyId || existingFamily) {
          throw membershipError(409, 'PARENT_ALREADY_IN_FAMILY', 'Parent already belongs to a family');
        }

        const family = await withSession(FamilyModel.findById(invitation.familyId), session);
        if (!family || family.memberParentIds.length >= 2) {
          throw membershipError(409, 'FAMILY_PARENT_LIMIT_REACHED', 'Family already has two parents');
        }
        family.memberParentIds.addToSet(parent._id);
        if (family.memberParentIds.length > 2) {
          throw membershipError(409, 'FAMILY_PARENT_LIMIT_REACHED', 'Family already has two parents');
        }
        await family.save({ session });

        parent.familyId = family._id;
        parent.children = [...family.childIds];
        parent.parentProfile.familyRole = familyRole;
        parent.parentProfile.defaultChildId = family.childIds[0] || undefined;
        await parent.save({ session });

        const accepted = await InvitationModel.findOneAndUpdate({
          _id: invitation._id,
          status: 'pending',
          expiresAt: { $gt: now() }
        }, {
          $set: {
            status: 'accepted',
            acceptedByParentId: parent._id,
            acceptedAt: now()
          }
        }, { new: true, session });
        if (!accepted) throw inactiveInvitation();
        await appendEvent({
          familyId: family._id,
          action: 'member_joined',
          actorParentId: parent._id,
          targetParentId: parent._id,
          invitationId: invitation._id
        }, session);
        familyView = await buildFamilyView(family, session);
      }
    });
    return familyView;
  };

  const leaveFamily = async ({ actorParentId, familyId }) => {
    await runMongoTransaction({
      mongooseInstance,
      work: async (session) => {
        const family = await withSession(FamilyModel.findOne({
          _id: familyId,
          memberParentIds: actorParentId
        }), session);
        if (!family) throw familyMemberNotFound();
        if (idString(family.ownerParentId) === idString(actorParentId)) {
          throw membershipError(409, 'OWNER_TRANSFER_REQUIRED', 'Owner must transfer ownership before leaving');
        }
        await removeMember({ family, actorParentId, targetParentId: actorParentId, action: 'member_left', session });
      }
    });
  };

  const removeMember = async ({ family, actorParentId, targetParentId, action, session }) => {
    const targetId = idString(targetParentId);
    if (idString(family.ownerParentId) === targetId) {
      throw membershipError(409, 'OWNER_TRANSFER_REQUIRED', 'Owner cannot be removed');
    }
    if (!family.memberParentIds.some((id) => idString(id) === targetId)) throw familyMemberNotFound();
    family.memberParentIds.pull(targetParentId);
    await family.save({ session });
    const result = await UserModel.updateOne({ _id: targetParentId, role: 'parent' }, {
      $unset: { familyId: 1, 'parentProfile.defaultChildId': 1 },
      $set: { children: [] }
    }, { session });
    if (result.matchedCount !== 1) throw familyMemberNotFound();
    await appendEvent({
      familyId: family._id,
      action,
      actorParentId,
      targetParentId
    }, session);
  };

  const removeFamilyMember = async ({ actorParentId, familyId, targetParentId }) => {
    await runMongoTransaction({
      mongooseInstance,
      work: async (session) => {
        const family = await ownerFamily(familyId, actorParentId, session);
        if (!family) throw governanceDenied();
        await removeMember({
          family,
          actorParentId,
          targetParentId,
          action: 'member_removed',
          session
        });
      }
    });
  };

  const transferOwnership = async ({ actorParentId, familyId, newOwnerParentId }) => {
    let familyView;
    await runMongoTransaction({
      mongooseInstance,
      work: async (session) => {
        const family = await ownerFamily(familyId, actorParentId, session);
        if (!family) throw governanceDenied();
        const targetId = idString(newOwnerParentId);
        if (targetId === idString(actorParentId)
          || !family.memberParentIds.some((id) => idString(id) === targetId)) {
          throw familyMemberNotFound();
        }
        const target = await withSession(UserModel.findOne({ _id: newOwnerParentId, role: 'parent' }), session);
        if (!target) throw familyMemberNotFound();
        const previousOwnerParentId = family.ownerParentId;
        family.ownerParentId = target._id;
        await family.save({ session });
        await appendEvent({
          familyId: family._id,
          action: 'ownership_transferred',
          actorParentId,
          targetParentId: target._id,
          previousOwnerParentId,
          newOwnerParentId: target._id
        }, session);
        familyView = await buildFamilyView(family, session);
      }
    });
    return familyView;
  };

  return {
    acceptInvitation,
    buildFamilyView,
    createInvitation,
    getActiveInvitation,
    leaveFamily,
    previewInvitation,
    removeFamilyMember,
    revokeInvitation,
    transferOwnership
  };
};

module.exports = {
  FAMILY_ROLES,
  INVITATION_TTL_MS,
  createFamilyMembershipService,
  digestToken,
  inactiveInvitation,
  membershipError
};
