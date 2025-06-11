import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { createLazyComponent, LazyLoadErrorBoundary } from '../LazyLoader';

// Mock component for testing
const TestComponent = ({ message }: { message: string }) => (
  <View>
    <Text>{message}</Text>
  </View>
);

// Mock lazy import that resolves successfully
const mockSuccessfulImport = () => 
  Promise.resolve({ default: TestComponent });

// Mock lazy import that fails
const mockFailedImport = () => 
  Promise.reject(new Error('Failed to load component'));

describe('LazyLoader', () => {
  describe('createLazyComponent', () => {
    it('should render loading component initially', () => {
      const LazyTestComponent = createLazyComponent(mockSuccessfulImport);
      
      render(<LazyTestComponent message="Test message" />);
      
      expect(screen.getByText('正在加载...')).toBeTruthy();
    });

    it('should render the actual component after loading', async () => {
      const LazyTestComponent = createLazyComponent(mockSuccessfulImport);
      
      render(<LazyTestComponent message="Test message" />);
      
      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeTruthy();
      });
    });

    it('should render custom fallback component', () => {
      const CustomFallback = () => (
        <View>
          <Text>Custom loading...</Text>
        </View>
      );
      
      const LazyTestComponent = createLazyComponent(
        mockSuccessfulImport,
        <CustomFallback />
      );
      
      render(<LazyTestComponent message="Test message" />);
      
      expect(screen.getByText('Custom loading...')).toBeTruthy();
    });
  });

  describe('LazyLoadErrorBoundary', () => {
    // Suppress console.error for error boundary tests
    const originalError = console.error;
    beforeAll(() => {
      console.error = jest.fn();
    });
    
    afterAll(() => {
      console.error = originalError;
    });

    it('should render children when no error occurs', () => {
      render(
        <LazyLoadErrorBoundary>
          <View>
            <Text>Normal content</Text>
          </View>
        </LazyLoadErrorBoundary>
      );
      
      expect(screen.getByText('Normal content')).toBeTruthy();
    });

    it('should render error UI when error occurs', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };
      
      render(
        <LazyLoadErrorBoundary>
          <ThrowError />
        </LazyLoadErrorBoundary>
      );
      
      expect(screen.getByText('加载失败')).toBeTruthy();
      expect(screen.getByText('Test error')).toBeTruthy();
      expect(screen.getByText('重试')).toBeTruthy();
    });

    it('should render default error message when no error message provided', () => {
      const ThrowError = () => {
        throw new Error();
      };
      
      render(
        <LazyLoadErrorBoundary>
          <ThrowError />
        </LazyLoadErrorBoundary>
      );
      
      expect(screen.getByText('组件加载时发生错误')).toBeTruthy();
    });
  });
}); 