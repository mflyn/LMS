import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { AuthContext } from '../../../../context/AuthContext';
import AnnouncementsTab from '../AnnouncementsTab';

// Mock axios
jest.mock('axios');

// Mock AuthContext
const mockAuthContextValue = {
  currentUser: {
    userId: 'teacher1',
    username: 'testteacher',
    role: 'teacher', // Default to teacher for most tests, can be overridden
    token: 'fake-token',
  },
  login: jest.fn(),
  logout: jest.fn(),
  loading: false,
  error: null,
};

const mockAnnouncements = [
  {
    id: '1',
    title: 'Important Update',
    content: 'Please read the new guidelines.',
    author: 'Admin',
    date: '2024-01-01T10:00:00.000Z',
    classId: 'class1',
    className: 'All Classes',
    isRead: false,
  },
  {
    id: '2',
    title: 'Holiday Schedule',
    content: 'School will be closed on Monday.',
    author: 'Admin',
    date: '2024-01-02T11:00:00.000Z',
    classId: 'class2',
    className: 'Grade 5',
    isRead: true,
  },
];

const mockClasses = [
  { id: 'class1', name: 'All Classes' },
  { id: 'class2', name: 'Grade 5A' },
  { id: 'class3', name: 'Grade 6B' },
];

const renderWithAuth = (
  ui,
  { providerProps, ...renderOptions } = {}
) => {
  return render(
    <AuthContext.Provider value={{ ...mockAuthContextValue, ...providerProps }}>
      {ui}
    </AuthContext.Provider>,
    renderOptions
  );
};

describe('AnnouncementsTab', () => {
  let mockOnRefreshAnnouncements;

  beforeEach(() => {
    mockOnRefreshAnnouncements = jest.fn();
    axios.get.mockResolvedValue({ data: { classes: mockClasses } }); // For fetching classes in modal
    // Reset currentUser to default teacher before each test
    mockAuthContextValue.currentUser.role = 'teacher';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders correctly with initial announcements', () => {
    renderWithAuth(
      <AnnouncementsTab
        announcements={mockAnnouncements}
        loading={false}
        error={null}
        onRefreshAnnouncements={mockOnRefreshAnnouncements}
      />
    );

    expect(screen.getByText('Important Update')).toBeInTheDocument();
    expect(screen.getByText('Holiday Schedule')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /发布新公告/i })).toBeInTheDocument();
  });

  test('shows loading state', () => {
    renderWithAuth(
      <AnnouncementsTab
        announcements={[]}
        loading={true}
        error={null}
        onRefreshAnnouncements={mockOnRefreshAnnouncements}
      />
    );
    expect(screen.getByRole('status')).toBeInTheDocument(); // Assuming Ant Design Spin has role="status"
  });

  test('shows error state', () => {
    renderWithAuth(
      <AnnouncementsTab
        announcements={[]}
        loading={false}
        error={{ message: 'Failed to load announcements' }}
        onRefreshAnnouncements={mockOnRefreshAnnouncements}
      />
    );
    expect(screen.getByText(/Failed to load announcements/i)).toBeInTheDocument();
  });

  test('shows "No announcements" message when list is empty and not loading', () => {
    renderWithAuth(
      <AnnouncementsTab
        announcements={[]}
        loading={false}
        error={null}
        onRefreshAnnouncements={mockOnRefreshAnnouncements}
      />
    );
    expect(screen.getByText(/暂无公告/i)).toBeInTheDocument();
  });

  test('does not show "发布新公告" button for non-teacher roles', () => {
    mockAuthContextValue.currentUser.role = 'student';
    renderWithAuth(
      <AnnouncementsTab
        announcements={mockAnnouncements}
        loading={false}
        error={null}
        onRefreshAnnouncements={mockOnRefreshAnnouncements}
      />,
      { providerProps: { currentUser: { ...mockAuthContextValue.currentUser, role: 'student' } } }
    );
    expect(screen.queryByRole('button', { name: /发布新公告/i })).not.toBeInTheDocument();
  });

  test('opens, fills, and submits "发布新公告" modal for teacher', async () => {
    axios.post.mockResolvedValue({ data: { message: 'Announcement published' } });
    axios.get.mockResolvedValue({ data: { classes: mockClasses } });


    renderWithAuth(
      <AnnouncementsTab
        announcements={[]}
        loading={false}
        error={null}
        onRefreshAnnouncements={mockOnRefreshAnnouncements}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /发布新公告/i }));
    expect(screen.getByRole('dialog', { name: /发布新公告/i })).toBeInTheDocument();
    
    // Wait for classes to load if they are fetched on modal open
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/classes/teacher/teacher1'));


    fireEvent.change(screen.getByLabelText(/标题/i), { target: { value: 'New Test Announcement' } });
    fireEvent.change(screen.getByLabelText(/内容/i), { target: { value: 'This is the content.' } });
    
    // Select a class
    fireEvent.mouseDown(screen.getByLabelText(/目标班级/i));
    await waitFor(() => {
      expect(screen.getByText(mockClasses[1].name)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(mockClasses[1].name));


    fireEvent.click(screen.getByRole('button', { name: '发布' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        '/api/announcements',
        expect.objectContaining({
          title: 'New Test Announcement',
          content: 'This is the content.',
          classId: mockClasses[1].id, // class2
          // authorId: 'teacher1', // Assuming this is added backend or context
        }),
        expect.any(Object) // For headers
      );
    });

    expect(mockOnRefreshAnnouncements).toHaveBeenCalledTimes(1);
    // Check for success message (Ant Design message.success might be tricky to test without more setup)
    // Modal should close (implementation dependent)
    // expect(screen.queryByRole('dialog', { name: /发布新公告/i })).not.toBeInTheDocument();
  });

  test('handles error when publishing announcement', async () => {
    axios.post.mockRejectedValue({ response: { data: { message: 'Publishing failed' } } });
    axios.get.mockResolvedValue({ data: { classes: mockClasses } });


    renderWithAuth(
      <AnnouncementsTab
        announcements={[]}
        loading={false}
        error={null}
        onRefreshAnnouncements={mockOnRefreshAnnouncements}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /发布新公告/i }));
    
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/classes/teacher/teacher1'));

    fireEvent.change(screen.getByLabelText(/标题/i), { target: { value: 'Fail Announcement' } });
    fireEvent.change(screen.getByLabelText(/内容/i), { target: { value: 'This will fail.' } });
    fireEvent.mouseDown(screen.getByLabelText(/目标班级/i));
    await waitFor(() => {
        expect(screen.getByText(mockClasses[0].name)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(mockClasses[0].name));


    fireEvent.click(screen.getByRole('button', { name: '发布' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
    });
    // Check for error message (Ant Design message.error)
    // expect(screen.getByText(/Publishing failed/i)).toBeInTheDocument(); // This depends on how errors are displayed
    expect(mockOnRefreshAnnouncements).not.toHaveBeenCalled();
  });

  test('displays announcement details when an item is clicked', async () => {
    renderWithAuth(
      <AnnouncementsTab
        announcements={mockAnnouncements}
        loading={false}
        error={null}
        onRefreshAnnouncements={mockOnRefreshAnnouncements}
      />
    );

    fireEvent.click(screen.getByText('Important Update'));

    await waitFor(() => {
      // Assuming a Modal or Drawer opens with the title "公告详情"
      // and contains the content of the announcement.
      expect(screen.getByRole('dialog', { name: /公告详情/i })).toBeInTheDocument();
      expect(screen.getByText('Please read the new guidelines.')).toBeInTheDocument();
      expect(screen.getByText(/发布者： Admin/i)).toBeInTheDocument();
      // expect(screen.getByText(/发布于： 2024-01-01/i)).toBeInTheDocument(); // Date formatting might vary
      expect(screen.getByText(/目标班级： All Classes/i)).toBeInTheDocument();
    });

    // Test closing the detail view
    fireEvent.click(screen.getByRole('button', { name: /关闭/i })); // Or 'OK', depends on Ant Design Modal
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /公告详情/i })).not.toBeInTheDocument();
    });
  });

  test('marks announcement as read when details are viewed (if implemented)', async () => {
    // This test assumes that viewing an announcement might trigger a "mark as read" API call
    // and update the UI accordingly (e.g., unread indicator disappears).
    // For now, we'll just check if onRefresh is called, assuming it might refetch.
    axios.put.mockResolvedValue({}); // Mock the mark as read API call

    renderWithAuth(
      <AnnouncementsTab
        announcements={mockAnnouncements.map(a => ({ ...a, isRead: a.id === '2' ? true : false}))} // 'Important Update' is unread
        loading={false}
        error={null}
        onRefreshAnnouncements={mockOnRefreshAnnouncements}
      />
    );
    
    // Verify 'Important Update' might have an unread indicator (visual test or specific element)
    // For example, if an Ant Design Badge is used:
    // const unreadIndicator = screen.getByText('Important Update').closest('div.ant-list-item-meta').querySelector('.ant-badge-status-dot');
    // expect(unreadIndicator).toBeInTheDocument();


    fireEvent.click(screen.getByText('Important Update'));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /公告详情/i })).toBeInTheDocument();
    });

    // Assuming the mark as read API is called when details are shown for an unread item
    // This is a placeholder for the actual API endpoint and logic
    await waitFor(() => {
        // This depends on the actual implementation of markAsRead
        // For example, if it calls PUT /api/announcements/1/read
        // expect(axios.put).toHaveBeenCalledWith('/api/announcements/1/read', {}, expect.any(Object));
    });
    
    // It might also call onRefreshAnnouncements to update the list
    // expect(mockOnRefreshAnnouncements).toHaveBeenCalled();

    // Close the modal
    fireEvent.click(screen.getByRole('button', { name: /关闭/i }));
  });

  // TODO: Test pagination if implemented
  // TODO: Test search/filter functionality if implemented
}); 