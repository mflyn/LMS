// ... existing code ...
    const { teacherId, parentId, studentId, startDate, endDate, limit = 10, skip = 0 } = queryParams;
    let status = queryParams.status;
    const query = {};

// ... existing role-based access switch ...
        throw new AppError('无权访问会议列表', 403);
    }

    if (status) {
      if (typeof status === 'string' && status.includes(',')) {
        query.status = { $in: status.split(',').map(s => s.trim()) };
      } else {
        query.status = status;
      }
    }
    if (startDate || endDate) {
// ... rest of the getMeetings method ...
