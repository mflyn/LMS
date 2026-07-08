const { createIdentityHeaders, resetIdentityNonceStore } = require('../../../../common/middleware/gatewayIdentity');

const SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'test-gateway-identity-secret-32-bytes-long';

const FAMILY_A_ID = '665000000000000000000001';
const FAMILY_B_ID = '665000000000000000000002';
const CHILD_A1_ID = '665000000000000000000011';
const CHILD_A2_ID = '665000000000000000000012';
const CHILD_B1_ID = '665000000000000000000021';
const PARENT_A_ID = '665000000000000000000101';
const PARENT_B_ID = '665000000000000000000102';

const parentA = () => ({
  id: PARENT_A_ID,
  role: 'parent',
  familyId: FAMILY_A_ID
});

const parentB = () => ({
  id: PARENT_B_ID,
  role: 'parent',
  familyId: FAMILY_B_ID
});

const childA1 = () => ({
  id: CHILD_A1_ID,
  role: 'student',
  familyId: FAMILY_A_ID,
  childId: CHILD_A1_ID,
  tokenVersion: 0
});

const childA2 = () => ({
  id: CHILD_A2_ID,
  role: 'student',
  familyId: FAMILY_A_ID,
  childId: CHILD_A2_ID,
  tokenVersion: 0
});

const childB1 = () => ({
  id: CHILD_B1_ID,
  role: 'student',
  familyId: FAMILY_B_ID,
  childId: CHILD_B1_ID,
  tokenVersion: 0
});

const signedHeaders = (user, method, originalUrl) => createIdentityHeaders({
  method,
  originalUrl,
  user,
  secret: SECRET
});

module.exports = {
  CHILD_A1_ID,
  CHILD_A2_ID,
  CHILD_B1_ID,
  FAMILY_A_ID,
  FAMILY_B_ID,
  PARENT_A_ID,
  PARENT_B_ID,
  childA1,
  childA2,
  childB1,
  parentA,
  parentB,
  resetIdentityNonceStore,
  signedHeaders
};
