import axios from 'axios';
import { expireParentSession, loadParentSession } from './familySession';

const parentRequestConfig = () => {
  const session = loadParentSession();
  if (!session) {
    const error = new Error('Parent session is required');
    error.response = { status: 401, data: { error: { code: 'UNAUTHENTICATED' } } };
    throw error;
  }

  return {
    headers: {
      Authorization: `Bearer ${session.token}`
    }
  };
};

const unwrap = (response) => response?.data?.data || response?.data;

const parentRequest = async (request) => {
  try {
    return await request(parentRequestConfig());
  } catch (error) {
    if (error?.response?.status === 401) expireParentSession();
    throw error;
  }
};

export const getMyFamily = async () => {
  const response = await parentRequest((config) => axios.get('/api/families/me', config));
  return unwrap(response);
};

export const createFamily = async ({ familyName, timezone = 'Asia/Shanghai' }) => {
  const response = await parentRequest((config) => axios.post('/api/families', { familyName, timezone }, config));
  return unwrap(response);
};
