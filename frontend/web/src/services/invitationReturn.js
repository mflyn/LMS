const INVITATION_PATH = '/family/invitations';

const invitationHash = (hash) => {
  if (typeof hash !== 'string' || !hash.startsWith('#')) return '';
  const token = new URLSearchParams(hash.slice(1)).get('token');
  return token && token.trim() ? `#token=${encodeURIComponent(token.trim())}` : '';
};

export const safeInvitationReturn = (location) => {
  if (!location || location.pathname !== INVITATION_PATH) return null;
  const hash = invitationHash(location.hash);
  return hash ? { pathname: INVITATION_PATH, hash } : null;
};

export const authDestination = (location) => {
  const invitation = safeInvitationReturn(location);
  return invitation ? `${invitation.pathname}${invitation.hash}` : '/app/today';
};

export const invitationTokenFromHash = (hash) => {
  const normalized = invitationHash(hash);
  return normalized ? new URLSearchParams(normalized.slice(1)).get('token') : '';
};
