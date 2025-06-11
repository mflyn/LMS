import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../authStore';

// Mock fetch
global.fetch = jest.fn();

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.getState().logout();
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore());
      
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'parent' as const,
      };
      
      const mockResponse = {
        user: mockUser,
        token: 'test-token',
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useAuthStore());
      const credentials = { username: 'testuser', password: 'password' };

      await act(async () => {
        await result.current.login(credentials);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe('test-token');
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle login failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const { result } = renderHook(() => useAuthStore());
      const credentials = { username: 'testuser', password: 'wrongpassword' };

      await act(async () => {
        try {
          await result.current.login(credentials);
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('登录失败');
    });

    it('should handle network error', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuthStore());
      const credentials = { username: 'testuser', password: 'password' };

      await act(async () => {
        try {
          await result.current.login(credentials);
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      // First set some user data
      act(() => {
        result.current.setUser({
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          role: 'parent',
        });
        result.current.setToken('test-token');
      });

      // Then logout
      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('setUser', () => {
    it('should set user correctly', () => {
      const { result } = renderHook(() => useAuthStore());
      const user = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'teacher' as const,
      };

      act(() => {
        result.current.setUser(user);
      });

      expect(result.current.user).toEqual(user);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('setToken', () => {
    it('should set token correctly', () => {
      const { result } = renderHook(() => useAuthStore());
      const token = 'new-token';

      act(() => {
        result.current.setToken(token);
      });

      expect(result.current.token).toBe(token);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('setLoading', () => {
    it('should set loading state correctly', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('setError and clearError', () => {
    it('should set and clear error correctly', () => {
      const { result } = renderHook(() => useAuthStore());
      const errorMessage = 'Test error';

      act(() => {
        result.current.setError(errorMessage);
      });

      expect(result.current.error).toBe(errorMessage);

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update user profile correctly', () => {
      const { result } = renderHook(() => useAuthStore());
      const user = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'parent' as const,
      };

      // Set initial user
      act(() => {
        result.current.setUser(user);
      });

      // Update profile
      const profileUpdate = {
        username: 'updateduser',
        email: 'updated@example.com',
      };

      act(() => {
        result.current.updateProfile(profileUpdate);
      });

      expect(result.current.user?.username).toBe('updateduser');
      expect(result.current.user?.email).toBe('updated@example.com');
      expect(result.current.user?.id).toBe('1'); // Should remain unchanged
      expect(result.current.user?.role).toBe('parent'); // Should remain unchanged
    });

    it('should not update profile if no user is set', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.updateProfile({ username: 'newuser' });
      });

      expect(result.current.user).toBeNull();
    });
  });

  describe('switchRole', () => {
    it('should switch role successfully', () => {
      const { result } = renderHook(() => useAuthStore());
      const user = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'parent' as const,
      };

      // Set initial user
      act(() => {
        result.current.setUser(user);
      });

      // Switch role
      act(() => {
        result.current.switchRole('teacher');
      });

      expect(result.current.user?.role).toBe('teacher');
    });

    it('should not switch role if no user is set', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.switchRole('teacher');
      });

      expect(result.current.user).toBeNull();
    });
  });
}); 