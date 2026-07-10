import { render, screen } from '@testing-library/react';

jest.mock('../contexts/WebSocketContext', () => ({
  WebSocketProvider: ({ children }) => children
}));
jest.mock('../pages/Dashboard', () => () => <div />);
jest.mock('../pages/Interaction', () => () => <div />);
jest.mock('../pages/Resources', () => () => <div />);
jest.mock('../pages/Analytics', () => () => <div />);

import App from '../App';

test('renders the parent login route', async () => {
  localStorage.clear();
  window.history.pushState({}, 'Parent login', '/login');

  render(<App />);

  expect(await screen.findByRole('heading', { name: '家长登录' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
});
