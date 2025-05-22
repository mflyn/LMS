import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import Interaction from '../Interaction';

// Mock child Tab components
jest.mock('../interaction/MessagesTab', () => jest.fn(() => <div data-testid="mock-messages-tab">MessagesTab Content</div>));
jest.mock('../interaction/MeetingsTab', () => jest.fn(() => <div data-testid="mock-meetings-tab">MeetingsTab Content</div>));
jest.mock('../interaction/AnnouncementsTab', () => jest.fn(() => <div data-testid="mock-announcements-tab">AnnouncementsTab Content</div>));

// Mock axios for the initial data fetch in Interaction.js (if any, or in its children)
// For Interaction.js itself, the refactor moved most fetching to subcomponents.
// However, Interaction.js might still have an initial fetch for user/role specific data or shared data.
// Based on the summary, it still uses mock fetch functions for initial data.
jest.mock('axios');

const mockUserTeacher = {
  role: 'teacher',
  name: 'Test Teacher',
  id: 'teacher-id'
};

const mockUserStudent = {
  role: 'student',
  name: 'Test Student',
  id: 'student-id'
};

const renderInteractionPage = (user = mockUserTeacher, initialLoading = false, initialError = null) => {
  // Simulate the initial data fetching state if Interaction.js itself handles it.
  // The mock fetch functions (fetchMessages, fetchMeetings, etc.) are inside Interaction.js.
  // We will rely on those to be called or mock them if they were external.
  
  // If Interaction.js uses a custom hook that returns loading/error, that hook would need mocking.
  // For now, assuming Interaction.js has internal state for loading/error based on its own fetches.

  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user, loading: false }}>
        <Interaction />
      </AuthContext.Provider>
    </MemoryRouter>
  );
};

describe('Interaction Page (Main Tab Container)', () => {
  const MessagesTab = require('../interaction/MessagesTab');
  const MeetingsTab = require('../interaction/MeetingsTab');
  const AnnouncementsTab = require('../interaction/AnnouncementsTab');
  const axios = require('axios');

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for any initial data fetch in Interaction.js itself (if applicable)
    axios.get.mockResolvedValue({ data: { messages: [], meetings: [], announcements: [] } });
    // Reset mock component calls
    MessagesTab.mockClear();
    MeetingsTab.mockClear();
    AnnouncementsTab.mockClear();
  });

  describe('Initial Rendering and Tab Structure', () => {
    it('should render the page with correct tabs and default to Messages tab', async () => {
      renderInteractionPage();

      expect(screen.getByText('交流互动平台')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '消息列表', selected: true })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '会议安排' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '通知公告' })).toBeInTheDocument();
      
      // Check if the default tab content (MessagesTab) is rendered
      await waitFor(() => {
        expect(MessagesTab).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('mock-messages-tab')).toBeInTheDocument();
      });
      expect(MeetingsTab).not.toHaveBeenCalled();
      expect(AnnouncementsTab).not.toHaveBeenCalled();
    });

    // TODO: Add tests for initial loading and error states if Interaction.js handles them directly
    // For example:
    // it('should show loading spinner during initial data fetch', () => { ... });
    // it('should show error message if initial data fetch fails', () => { ... });
  });

  describe('Tab Switching', () => {
    it('should switch to Meetings tab and render its content', async () => {
      renderInteractionPage();
      // Wait for initial tab to render
      await waitFor(() => expect(MessagesTab).toHaveBeenCalled());
      MessagesTab.mockClear(); // Clear call count before switching

      fireEvent.click(screen.getByRole('tab', { name: '会议安排' }));

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: '会议安排', selected: true })).toBeInTheDocument();
        expect(MeetingsTab).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('mock-meetings-tab')).toBeInTheDocument();
      });
      expect(MessagesTab).not.toHaveBeenCalled();
      expect(AnnouncementsTab).not.toHaveBeenCalled();
    });

    it('should switch to Announcements tab and render its content', async () => {
      renderInteractionPage();
      await waitFor(() => expect(MessagesTab).toHaveBeenCalled());
      MessagesTab.mockClear(); 

      fireEvent.click(screen.getByRole('tab', { name: '通知公告' }));

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: '通知公告', selected: true })).toBeInTheDocument();
        expect(AnnouncementsTab).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('mock-announcements-tab')).toBeInTheDocument();
      });
      expect(MessagesTab).not.toHaveBeenCalled();
      expect(MeetingsTab).not.toHaveBeenCalled();
    });

    it('should switch back to Messages tab from another tab', async () => {
      renderInteractionPage();
      await waitFor(() => expect(MessagesTab).toHaveBeenCalledTimes(1));
      
      // Go to Meetings
      fireEvent.click(screen.getByRole('tab', { name: '会议安排' }));
      await waitFor(() => expect(MeetingsTab).toHaveBeenCalledTimes(1));
      MessagesTab.mockClear();
      MeetingsTab.mockClear();

      // Go back to Messages
      fireEvent.click(screen.getByRole('tab', { name: '消息列表' }));
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: '消息列表', selected: true })).toBeInTheDocument();
        expect(MessagesTab).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('mock-messages-tab')).toBeInTheDocument();
      });
      expect(MeetingsTab).not.toHaveBeenCalled();
      expect(AnnouncementsTab).not.toHaveBeenCalled();
    });
  });

  // Further tests in Interaction.test.js might be limited, as most logic resides in child tabs.
  // We can test props passed down to child tabs if Interaction.js fetches and passes shared data.
  // Example: if Interaction.js fetched a list of all users and passed it to MessagesTab and MeetingsTab.

  // describe('Data Passing to Tabs', () => {
  //   it('should pass correct props to MessagesTab', async () => {
  //     axios.get.mockResolvedValueOnce({ data: { messages: [{id:1, text:'Hi'}], users: [{id:1, name:'UserA'}] } });
  //     renderInteractionPage();
  //     await waitFor(() => {
  //        expect(MessagesTab).toHaveBeenCalledWith(expect.objectContaining({ 
  //          // initialMessages: expect.any(Array),
  //          // allUsersForSelect: expect.any(Array) 
  //          // Check specific props based on what Interaction.js is meant to pass
  //        }), {});
  //     });
  //   });
  // });

}); 