const objectId = /^[a-f0-9]{24}$/i;

export const parseChildEntry = (hash = '') => {
  if (!hash) return { status: 'absent' };
  if (!hash.startsWith('#') || hash.length > 256) return { status: 'invalid' };
  try {
    // URLSearchParams tolerates malformed escapes; entry identifiers must not.
    decodeURIComponent(hash.slice(1));
    const params = new URLSearchParams(hash.slice(1));
    if ([...params.keys()].length !== 2 || params.getAll('familyId').length !== 1
      || params.getAll('childId').length !== 1) return { status: 'invalid' };
    const familyId = params.get('familyId'), childId = params.get('childId');
    if (!objectId.test(familyId) || !objectId.test(childId)) return { status: 'invalid' };
    return { status: 'valid', familyId: familyId.toLowerCase(), childId: childId.toLowerCase() };
  } catch (_error) { return { status: 'invalid' }; }
};

export const buildChildEntry = (origin, familyId, childId) => {
  if (!objectId.test(familyId) || !objectId.test(childId)) return null;
  const url = new URL('/child/login', origin);
  url.hash = new URLSearchParams({ familyId: familyId.toLowerCase(), childId: childId.toLowerCase() }).toString();
  return url.href;
};
