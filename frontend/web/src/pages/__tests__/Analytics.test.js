import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom'; // Needed if there are Link components or routing logic
import { AuthContext } from '../../contexts/AuthContext'; // If user role is used
import Analytics from '../Analytics'; // The component to test

// Mock child chart components from AnalyticsCharts.js
// We've already tested them individually. Here we just want to ensure they are called.
jest.mock('../../components/charts/AnalyticsCharts', () => ({
  ScoreTrendChart: jest.fn(({ data, subject, height, showTableView }) => (
    <div data-testid="mock-score-trend-chart" data-subject={subject} data-showtable={showTableView?.toString()}>ScoreTrendChart</div>
  )),
  SubjectComparisonChart: jest.fn(({ data, height, showTableView }) => (
    <div data-testid="mock-subject-comparison-chart" data-showtable={showTableView?.toString()}>SubjectComparisonChart</div>
  )),
  ClassScoreDistributionChart: jest.fn(({ data, subject, height, showTableView }) => (
    <div data-testid="mock-class-score-distribution-chart" data-subject={subject} data-showtable={showTableView?.toString()}>ClassScoreDistributionChart</div>
  )),
  LearningProgressChart: jest.fn(({ data, subject, height, showTableView }) => (
    <div data-testid="mock-learning-progress-chart" data-subject={subject} data-showtable={showTableView?.toString()}>LearningProgressChart</div>
  )),
  // Add other charts if Analytics.js directly uses them under specific tabs/conditions
}));

// Mock axios for data fetching
jest.mock('axios');

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  onopen: jest.fn(),
  onmessage: jest.fn(),
  onclose: jest.fn(),
  onerror: jest.fn(),
  close: jest.fn(),
  send: jest.fn(),
}));

// Default mock user for AuthContext
const mockUser = {
  role: 'teacher', // Or any role that allows access to all features for comprehensive testing
  name: 'Test Teacher'
};

const renderAnalyticsPage = (user = mockUser) => {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user, loading: false, login: jest.fn(), logout: jest.fn() }}>
        <Analytics />
      </AuthContext.Provider>
    </MemoryRouter>
  );
};

describe('Analytics Page', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Provide a default successful mock for axios.get, can be overridden in specific tests
    const axios = require('axios');
    axios.get.mockResolvedValue({ data: { message: "Data fetched successfully", mockData: {} } });
  });

  describe('Initial Rendering and Default View', () => {
    it('should render the page with default layout and first tab active', async () => {
      renderAnalyticsPage();

      expect(screen.getByText('数据分析中心')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '学生个人报告', selected: true })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '班级学习报告' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '学习趋势分析' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '学习进度跟踪' })).toBeInTheDocument();

      // Check for form elements in the default (student report) tab
      expect(screen.getByLabelText('选择学生')).toBeInTheDocument();
      // expect(screen.getByLabelText('选择学科')).toBeInTheDocument(); // May or may not be present by default
      expect(screen.getByLabelText('选择日期范围')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '查询报告' })).toBeInTheDocument();
      
      // Verify mock select options (as per previous refactor)
      // Since antd Select options are not direct children, we might need to open the select first
      // For simplicity, we'll assume the labels of Select components are enough for now.
    });

    it('should attempt to fetch initial data for the default tab', async () => {
      const axios = require('axios');
      axios.get.mockResolvedValueOnce({ data: { studentReport: { name: 'Student A'} }});
        
      renderAnalyticsPage();

      await waitFor(() => {
        // Check if axios.get was called for initial data of student report tab
        // The exact URL depends on the implementation within Analytics.js fetchData
        expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/student-report')); 
      });
      // Further checks can be added to see if a chart is rendered after data fetch, e.g., ScoreTrendChart
      // await waitFor(() => {
      //   expect(screen.getByTestId('mock-score-trend-chart')).toBeInTheDocument();
      // });
    });
  });

  describe('Tab Switching', () => {
    it('should switch to "班级学习报告" tab and display relevant filters and charts', async () => {
      const axios = require('axios');
      axios.get.mockResolvedValue({ data: { classReport: { className: 'Class 1'} }});
      renderAnalyticsPage();

      fireEvent.click(screen.getByRole('tab', { name: '班级学习报告' }));

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: '班级学习报告', selected: true })).toBeInTheDocument();
        expect(screen.getByLabelText('选择班级')).toBeInTheDocument();
        // expect(screen.getByLabelText('选择学科')).toBeInTheDocument();
        expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/class-report'));
        // expect(screen.getByTestId('mock-class-score-distribution-chart')).toBeInTheDocument();
      });
    });

    it('should switch to "学习趋势分析" tab and display relevant filters and charts', async () => {
      const axios = require('axios');
      axios.get.mockResolvedValue({ data: { trendReport: {} }});
      renderAnalyticsPage();

      fireEvent.click(screen.getByRole('tab', { name: '学习趋势分析' }));

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: '学习趋势分析', selected: true })).toBeInTheDocument();
        // Filters might be student, subject, date range etc.
        expect(screen.getByLabelText('选择学生')).toBeInTheDocument(); 
        expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/trends'));
        // expect(screen.getByTestId('mock-score-trend-chart')).toBeInTheDocument(); 
      });
    });

    it('should switch to "学习进度跟踪" tab and display relevant filters and charts', async () => {
      const axios = require('axios');
      axios.get.mockResolvedValue({ data: { progressReport: {} }});
      renderAnalyticsPage();

      fireEvent.click(screen.getByRole('tab', { name: '学习进度跟踪' }));

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: '学习进度跟踪', selected: true })).toBeInTheDocument();
        expect(screen.getByLabelText('选择学生')).toBeInTheDocument(); 
        // expect(screen.getByLabelText('选择学科')).toBeInTheDocument();
        expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/progress'));
        // expect(screen.getByTestId('mock-learning-progress-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Form Interaction and Data Fetching on a Tab (e.g., Student Report)', () => {
    it('should allow form input, trigger data fetch on submit, and show loading state', async () => {
      const axios = require('axios');
      // First call for initial load, second for form submission
      axios.get
        .mockResolvedValueOnce({ data: { studentReport: { initial: true } } })
        .mockResolvedValueOnce({ data: { studentReport: { name: 'Filtered Student'} }}); 

      renderAnalyticsPage();
      
      // Wait for initial load to complete to avoid race conditions with mocks
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));

      // Simulate selecting a student (assuming Ant Select, needs careful handling or simplified test)
      // For simplicity, we'll assume form values are handled correctly by Ant Form
      // and focus on the submit and data fetching part.
      // fireEvent.change(screen.getByLabelText('选择学生'), { target: { value: 'student123' } });
      
      const submitButton = screen.getByRole('button', { name: '查询报告' });
      fireEvent.click(submitButton);

      // Check for loading state (if Analytics.js implements it by showing a Spinner or specific text)
      // This part is highly dependent on the actual implementation of loading state
      // For example, if a Spinner with a specific testid is used:
      // expect(screen.getByTestId('analytics-loading-spinner')).toBeInTheDocument();
      // Or if a button is disabled while loading:
      // expect(submitButton).toBeDisabled();

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2); // Initial + form submit
        // The second call should have parameters from the form
        // expect(axios.get).toHaveBeenLastCalledWith(expect.stringContaining('studentId=student123')); // Example check
      });
      
      // After data fetch, loading should be gone
      // expect(screen.queryByTestId('analytics-loading-spinner')).not.toBeInTheDocument();
      // expect(submitButton).not.toBeDisabled();

      // Check if chart is rendered/updated with new data (mocked chart)
      // await waitFor(() => {
      //   const chart = screen.getByTestId('mock-score-trend-chart');
      //   expect(chart).toBeInTheDocument();
      //   // Potentially check attributes of the mock chart for new data if relevant
      // });
    });

    it('should display error message if data fetching fails', async () => {
      const axios = require('axios');
      axios.get.mockRejectedValueOnce(new Error('Network Error'));
      renderAnalyticsPage();

      // Trigger form submit or initial load that causes fetch
      fireEvent.click(screen.getByRole('button', { name: '查询报告' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/数据加载失败/i)).toBeInTheDocument(); // Or the specific error message
      });
    });
  });
  
  describe('WebSocket Connection', () => {
    it('should attempt to establish WebSocket connection on mount', () => {
      renderAnalyticsPage();
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
      // expect(global.WebSocket).toHaveBeenCalledWith(expect.stringContaining('ws://localhost:8080/api/analytics/ws'));
      // Check based on your actual WebSocket URL
    });

    // Add more tests for WebSocket onmessage, onclose, onerror if component handles these
  });

}); 