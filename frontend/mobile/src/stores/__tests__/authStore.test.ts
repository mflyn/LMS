import { renderHook, act } from '@testing-library/react-native';
import { useAuthStore } from '../authStore';

// Mock AsyncStorage
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.getState().signOut();
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore());
      
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.role).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.showRoleSelection).toBe(false);
    });
  });

  describe('signIn', () => {
    it('should sign in successfully with token only', async () => {
      const { result } = renderHook(() => useAuthStore());
      const token = 'test-token';

      await act(async () => {
        await result.current.signIn(token);
      });

      expect(result.current.token).toBe(token);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.showRoleSelection).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should sign in successfully with token and user data', async () => {
      const { result } = renderHook(() => useAuthStore());
      const token = 'test-token';
      const userData = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'parent' as const,
      };

      await act(async () => {
        await result.current.signIn(token, userData);
      });

      expect(result.current.token).toBe(token);
      expect(result.current.role).toBe('parent');
      expect(result.current.user).toEqual(userData);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      // First sign in
      await act(async () => {
        await result.current.signIn('test-token', { role: 'student' });
      });

      // Then sign out
      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.role).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.showRoleSelection).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('switchRole', () => {
    it('should switch role successfully', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      // First sign in as parent
      await act(async () => {
        await result.current.signIn('test-token', {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          role: 'parent',
        });
      });

      // Switch to student role
      await act(async () => {
        await result.current.switchRole('student');
      });

      expect(result.current.role).toBe('student');
      expect(result.current.user?.role).toBe('student');
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
      expect(result.current.role).toBe('teacher');
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

  describe('showRoleSelector', () => {
    it('should show role selector', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.showRoleSelector();
      });

      expect(result.current.showRoleSelection).toBe(true);
    });
  });
}); 