import { assertAi2MediaEntry, createAi2MediaApi, isAi2MediaId, validateAi2MediaFile } from './ai2MediaApi';

export const isAi3MediaId = isAi2MediaId;
export const validateAi3MediaFile = validateAi2MediaFile;
export const assertAi3MediaEntry = (entry, options) => assertAi2MediaEntry(entry, { ...options, profile: 'ai3' });
export const createAi3MediaApi = role => createAi2MediaApi(role, 'ai3');
