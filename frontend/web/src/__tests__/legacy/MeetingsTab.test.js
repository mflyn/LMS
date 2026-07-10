import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthContext } from '../../../contexts/AuthContext'; // Adjust path as needed
import MeetingsTab from '../MeetingsTab';

// Mock VideoMeeting component
jest.mock('../../../components/meeting/VideoMeeting', () => jest.fn(() => <div data-testid="mock-video-meeting">VideoMeeting Component</div>));

// Mock axios if MeetingsTab itself makes API calls (e.g., for creating meetings)
jest.mock('axios');

const mockUserTeacher = {
  id: 'teacher1',
  name: 'Test Teacher',
  role: 'teacher'
};

const mockUserStudent = {
  id: 'student1',
  name: 'Test Student',
  role: 'student'
};

const mockMeetings = [
  {
    id: 'meet1',
    title: '周一数学辅导课',
    startTime: new Date(Date.now() + 3600 * 1000).toISOString(), // In an hour
    endTime: new Date(Date.now() + 7200 * 1000).toISOString(),   // In two hours
    createdBy: { id: 'teacher1', name: 'Test Teacher' },
    participants: [{ id: 'student1', name: 'Test Student' }],
    meetingLink: 'http://zoom.us/j/12345',
    description: '讨论第一章内容'
  },
  {
    id: 'meet2',
    title: '项目讨论会议',
    startTime: new Date(Date.now() + 86400 * 1000).toISOString(), // Tomorrow
    endTime: new Date(Date.now() + 86400 * 1000 + 3600 * 1000).toISOString(),
    createdBy: { id: 'teacher1', name: 'Test Teacher' },
    participants: [{ id: 'student1', name: 'Test Student' }, { id: 'teacher1', name: 'Test Teacher' }],
    description: '关于学期项目的讨论'
  }
];

const mockUsersForSelect = [
  { id: 'student1', name: 'Test Student (学生)', role: 'student' },
  { id: 'student2', name: 'Another Student (学生)', role: 'student' },
  { id: 'teacher1', name: 'Test Teacher (教师)', role: 'teacher' }, // Current teacher might also be selectable
];

const mockOnRefreshMeetings = jest.fn();

const renderMeetingsTab = (user, meetings = [], users = [], isLoading = false, error = null) => {
  return render(
    <AuthContext.Provider value={{ user, loading: false }}>
      <MeetingsTab 
        initialMeetings={meetings} 
        allUsersForSelect={users} 
        onRefreshMeetings={mockOnRefreshMeetings}
        isLoading={isLoading}
        error={error}
      />
    </AuthContext.Provider>
  );
};

describe('MeetingsTab Component', () => {
  const axios = require('axios');
  const VideoMeeting = require('../../../components/meeting/VideoMeeting');

  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { message: '操作成功' } });
    VideoMeeting.mockClear();
  });

  describe('Initial Rendering and UI based on Role', () => {
    it('should render meetings list', () => {
      renderMeetingsTab(mockUserTeacher, mockMeetings);
      expect(screen.getByText('会议列表')).toBeInTheDocument();
    });

    it('should display "创建新会议" button for teacher', () => {
      renderMeetingsTab(mockUserTeacher);
      expect(screen.getByRole('button', { name: /创建新会议/i })).toBeInTheDocument();
    });

    it('should NOT display "创建新会议" button for student', () => {
      renderMeetingsTab(mockUserStudent);
      expect(screen.queryByRole('button', { name: /创建新会议/i })).not.toBeInTheDocument();
    });

    it('should display initial meetings if provided', () => {
      renderMeetingsTab(mockUserTeacher, mockMeetings);
      expect(screen.getByText('周一数学辅导课')).toBeInTheDocument();
      expect(screen.getByText('项目讨论会议')).toBeInTheDocument();
    });

    it('should display "暂无会议安排" when initialMeetings is empty', () => {
      renderMeetingsTab(mockUserTeacher, []);
      expect(screen.getByText('暂无会议安排')).toBeInTheDocument();
    });

    it('should display loading state when isLoading prop is true', () => {
      renderMeetingsTab(mockUserTeacher, [], [], true);
      expect(screen.getAllByRole('status', { 'aria-busy': 'true' }).length).toBeGreaterThan(0);
    });

    it('should display error state when error prop is provided', () => {
      renderMeetingsTab(mockUserTeacher, [], [], false, { message: '加载会议失败' });
      expect(screen.getByText('加载会议失败')).toBeInTheDocument();
    });
  });

  describe('Create New Meeting (Teacher Role)', () => {
    it('should open create meeting modal and allow creating a meeting', async () => {
      axios.post.mockResolvedValueOnce({ data: { id: 'newMeet123', title: '新创建的会议' } });
      renderMeetingsTab(mockUserTeacher, [], mockUsersForSelect);

      fireEvent.click(screen.getByRole('button', { name: /创建新会议/i }));
      expect(screen.getByRole('dialog', { name: /创建新会议/i })).toBeInTheDocument();

      // Fill form
      fireEvent.change(screen.getByLabelText('会议主题'), { target: { value: '新会议主题' } });
      // TODO: Test DateTimePicker and Select for participants more thoroughly
      // fireEvent.change(screen.getByLabelText('开始时间'), { target: { value: '...' } });
      // fireEvent.change(screen.getByLabelText('结束时间'), { target: { value: '...' } });
      fireEvent.change(screen.getByLabelText('会议描述/链接'), { target: { value: '这是一个测试会议' } });

      fireEvent.click(screen.getByRole('button', { name: '创建会议' }));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith('/api/interaction/meetings', expect.objectContaining({
          title: '新会议主题',
          description: '这是一个测试会议' 
          // participants: [...] - would depend on Select mock
          // startTime, endTime - would depend on DateTimePicker mock
        }));
        expect(mockOnRefreshMeetings).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog', { name: /创建新会议/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Joining/Viewing a Meeting', () => {
    it('should show meeting details and join button when a meeting is selected', async () => {
      renderMeetingsTab(mockUserStudent, mockMeetings);
      fireEvent.click(screen.getByText('周一数学辅导课')); // Select first meeting

      await waitFor(() => {
        expect(screen.getByText('会议详情')).toBeInTheDocument();
        expect(screen.getByText((content, el) => content.includes('讨论第一章内容'))).toBeInTheDocument(); // Description
        expect(screen.getByRole('button', { name: /加入会议/i })).toBeInTheDocument();
      });
    });

    it('should attempt to show VideoMeeting component when "加入会议" is clicked', async () => {
      renderMeetingsTab(mockUserStudent, mockMeetings);
      fireEvent.click(screen.getByText('周一数学辅导课')); 
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /加入会议/i }));
      });
      
      // Verify VideoMeeting component is rendered (mocked version)
      // This depends on the state logic in MeetingsTab to show/hide VideoMeeting
      await waitFor(() => {
         expect(VideoMeeting).toHaveBeenCalledTimes(1);
         expect(screen.getByTestId('mock-video-meeting')).toBeInTheDocument();
      });
      // You might also want to check props passed to VideoMeeting if they are important
      // expect(VideoMeeting).toHaveBeenCalledWith(expect.objectContaining({ meetingId: 'meet1' }), {});
    });
  });

  // TODO: Add tests for editing/deleting meetings if role allows
  // TODO: Add tests for pagination if implemented
}); 