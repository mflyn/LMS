import { useCallback, useEffect, useMemo, useRef } from 'react';
import { deletePrivateMedia } from '../services/familyApi';

const allowDelete = () => true;
export const useDraftMedia = ({ deleteMedia = deletePrivateMedia, canDelete = allowDelete } = {}) => {
  const draftsRef = useRef(new Set());
  const removedPersistedRef = useRef(new Set());

  const softDelete = useCallback((mediaId) => {
    if (mediaId && canDelete()) deleteMedia(mediaId).catch(() => {});
  }, [deleteMedia, canDelete]);

  const remove = useCallback((mediaId) => {
    if (!mediaId) return;
    if (draftsRef.current.delete(mediaId)) softDelete(mediaId);
    else removedPersistedRef.current.add(mediaId);
  }, [softDelete]);

  const replace = useCallback((mediaId, previousMediaId) => {
    if (previousMediaId && previousMediaId !== mediaId) remove(previousMediaId);
    if (mediaId) draftsRef.current.add(mediaId);
  }, [remove]);

  const commit = useCallback(() => {
    draftsRef.current.clear();
    removedPersistedRef.current.forEach(softDelete);
    removedPersistedRef.current.clear();
  }, [softDelete]);

  // Once a request may have bound these uploads, closing the view cannot delete them as drafts.
  const retainSubmitted = useCallback(() => { draftsRef.current.clear(); }, []);

  const cancel = useCallback(() => {
    draftsRef.current.forEach(softDelete);
    draftsRef.current.clear();
    removedPersistedRef.current.clear();
  }, [softDelete]);

  useEffect(() => cancel, [cancel]);

  return useMemo(() => ({ cancel, commit, remove, replace, retainSubmitted }), [cancel, commit, remove, replace, retainSubmitted]);
};
