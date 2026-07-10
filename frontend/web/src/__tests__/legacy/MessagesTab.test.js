import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthContext } from '../../../contexts/AuthContext'; // Adjust path as needed
import MessagesTab from '../MessagesTab';

// Mock antd components that might be complex or portal-based if needed
// For Select, if options are an issue, sometimes direct value manipulation or 
// more complex fireEvent sequences are needed. For now, we'll assume basic interaction.

// Mock axios if MessagesTab itself makes API calls (e.g., for sending messages)
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

const mockMessages = [
  {
    id: 'msg1',
    sender: { id: 'teacher1', name: 'Test Teacher', role: 'teacher' },
    receiver: { id: 'student1', name: 'Test Student', role: 'student' },
    title: '关于作业的问题',
    content: '请尽快提交数学作业。',
    timestamp: new Date().toISOString(),
    read: false,
    attachments: []
  },
  {
    id: 'msg2',
    sender: { id: 'student1', name: 'Test Student', role: 'student' },
    receiver: { id: 'teacher1', name: 'Test Teacher', role: 'teacher' },
    title: '回复：关于作业的问题',
    content: '好的老师，我今天会提交。',
    timestamp: new Date(Date.now() + 10000).toISOString(), // Slightly later
    read: true,
    attachments: []
  }
];

const mockUsersForSelect = [
  { id: 'student1', name: 'Test Student (学生)', role: 'student' },
  { id: 'student2', name: 'Another Student (学生)', role: 'student' },
  { id: 'teacher2', name: 'Other Teacher (教师)', role: 'teacher' },
];

// Mock the onRefreshMessages function passed as a prop
const mockOnRefreshMessages = jest.fn();

const renderMessagesTab = (user, messages = [], users = [], isLoading = false, error = null) => {
  return render(
    <AuthContext.Provider value={{ user, loading: false /* app level loading */ }}>
      <MessagesTab 
        initialMessages={messages} 
        allUsersForSelect={users} 
        onRefreshMessages={mockOnRefreshMessages} 
        isLoading={isLoading} // Prop for loading state within the tab
        error={error}       // Prop for error state within the tab
      />
    </AuthContext.Provider>
  );
};

describe('MessagesTab Component', () => {
  const axios = require('axios');

  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { message: '操作成功' } }); // Default mock for POST requests
  });

  describe('Initial Rendering and UI based on Role', () => {
    it('should render messages list and details view', () => {
      renderMessagesTab(mockUserTeacher, mockMessages);
      expect(screen.getByText('消息列表')).toBeInTheDocument();
      expect(screen.getByText('消息详情')).toBeInTheDocument();
    });

    it('should display "发送新消息" button for teacher', () => {
      renderMessagesTab(mockUserTeacher);
      expect(screen.getByRole('button', { name: /发送新消息/i })).toBeInTheDocument();
    });

    it('should NOT display "发送新消息" button for student', () => {
      renderMessagesTab(mockUserStudent);
      expect(screen.queryByRole('button', { name: /发送新消息/i })).not.toBeInTheDocument();
    });

    it('should display initial messages if provided', () => {
      renderMessagesTab(mockUserTeacher, mockMessages);
      expect(screen.getByText('关于作业的问题')).toBeInTheDocument();
      expect(screen.getByText('回复：关于作业的问题')).toBeInTheDocument();
    });

    it('should display "没有消息" when initialMessages is empty', () => {
      renderMessagesTab(mockUserTeacher, []);
      expect(screen.getByText('没有消息')).toBeInTheDocument();
    });

    it('should display loading state when isLoading prop is true', () => {
      renderMessagesTab(mockUserTeacher, [], [], true);
      expect(screen.getAllByRole('status', { 'aria-busy': 'true' }).length).toBeGreaterThan(0); // Ant Spin uses role status and aria-busy
    });

    it('should display error state when error prop is provided', () => {
      renderMessagesTab(mockUserTeacher, [], [], false, { message: '加载消息失败' });
      expect(screen.getByText('加载消息失败')).toBeInTheDocument();
    });
  });

  describe('Message Selection and Display', () => {
    it('should display message details when a message is clicked', async () => {
      renderMessagesTab(mockUserTeacher, mockMessages);
      fireEvent.click(screen.getByText('关于作业的问题')); // Click the first message
      
      await waitFor(() => {
        // Detail view should update
        expect(screen.getByText((content, element) => content.startsWith('发件人: Test Teacher'))).toBeInTheDocument();
        expect(screen.getByText((content, element) => content.startsWith('收件人: Test Student'))).toBeInTheDocument();
        expect(screen.getByText('请尽快提交数学作业。')).toBeInTheDocument(); // Content of the message
        expect(screen.getByRole('button', { name: /回复/i })).toBeInTheDocument();
      });
    });
  });

  describe('Send New Message (Teacher Role)', () => {
    it('should open send message modal and allow sending a message', async () => {
      axios.post.mockResolvedValueOnce({ data: { id: 'newMsg123', /* ... other fields */ } });
      renderMessagesTab(mockUserTeacher, [], mockUsersForSelect);

      fireEvent.click(screen.getByRole('button', { name: /发送新消息/i }));
      expect(screen.getByRole('dialog', { name: /发送新消息/i })).toBeInTheDocument();

      // Fill form (simplified due to antd component complexity)
      // To truly test Select, you might need to click it, then click an option.
      // For now, assume the component handles Select value correctly internally or mock it more deeply.
      // This is a common challenge with testing antd Select with RTL.
      const titleInput = screen.getByLabelText('标题');
      fireEvent.change(titleInput, { target: { value: '测试新消息标题' } });

      const contentInput = screen.getByLabelText('内容');
      fireEvent.change(contentInput, { target: { value: '这是新消息的内容。' } });
      
      // TODO: Simulate Ant Design Select more accurately if needed
      // For example, by finding the select input, focusing/clicking, then selecting an option from the dropdown.
      // For now, we assume the onChange for Select is triggered correctly by the component based on form values.
      // For instance, if the Select component's `onChange` updates a form state that we can check.

      fireEvent.click(screen.getByRole('button', { name: '发送' }));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith('/api/interaction/messages', expect.objectContaining({
          title: '测试新消息标题',
          content: '这是新消息的内容。',
          // receiverId would be part of the form values if Select worked as expected.
        }));
        expect(mockOnRefreshMessages).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog', { name: /发送新消息/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Reply to Message', () => {
    it('should open reply modal with prefilled fields (receiver, title)', async () => {
      renderMessagesTab(mockUserStudent, mockMessages); // Student replying to teacher
      fireEvent.click(screen.getByText('关于作业的问题')); // Click message from teacher

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /回复/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /回复/i }));

      expect(screen.getByRole('dialog', { name: /回复消息/i })).toBeInTheDocument();
      
      // Check if receiver is prefilled (Teacher in this case)
      // This depends on how receiver is displayed (e.g., in a disabled input or text)
      // expect(screen.getByDisplayValue(`Test Teacher (${mockUserTeacher.id})`)).toBeInTheDocument(); 
      // or check the form's initialValues if accessible

      // Check if title is prefilled (e.g., "Re: 关于作业的问题")
      const titleInput = screen.getByLabelText('标题');
      expect(titleInput.value).toMatch(/^Re: 关于作业的问题/i);
      
      // Fill content and send
      const contentInput = screen.getByLabelText('内容');
      fireEvent.change(contentInput, { target: { value: '这是回复的内容。' } });
      fireEvent.click(screen.getByRole('button', { name: '发送' }));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith('/api/interaction/messages', expect.objectContaining({
          receiverId: mockMessages[0].sender.id, // Replying to the sender of original message
          title: expect.stringMatching(/^Re: 关于作业的问题/i),
          content: '这是回复的内容。',
        }));
        expect(mockOnRefreshMessages).toHaveBeenCalledTimes(1);
      });
    });
  });

  // TODO: Add tests for pagination if implemented
  // TODO: Add tests for attachment handling if implemented beyond placeholder
}); 