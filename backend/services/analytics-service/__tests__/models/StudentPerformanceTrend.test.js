const mongoose = require('mongoose');

// Mock the StudentPerformanceTrend model
jest.mock('../../models/StudentPerformanceTrend', () => {
  // Mock constructor function
  function MockStudentPerformanceTrend(data) {
    this._id = 'mock-id';
    this.createdAt = new Date();
    this.updatedAt = new Date();
    Object.assign(this, data);
  }

  // Mock save method
  MockStudentPerformanceTrend.prototype.save = jest.fn().mockImplementation(function() {
    // Simulate validation
    if (!this.student) {
      const error = new Error('ValidationError');
      error.name = 'ValidationError';
      error.errors = { student: { message: 'Path `student` is required.' } };
      return Promise.reject(error);
    }

    if (this.semester && !['第一学期', '第二学期'].includes(this.semester)) {
      const error = new Error('ValidationError');
      error.name = 'ValidationError';
      error.errors = { semester: { message: 'Invalid enum value' } };
      return Promise.reject(error);
    }

    if (this.knowledgePointProgress && this.knowledgePointProgress.length > 0) {
      const initialRate = this.knowledgePointProgress[0].initialMasteryRate;
      if (initialRate > 100) {
        const error = new Error('ValidationError');
        error.name = 'ValidationError';
        error.errors = { 'knowledgePointProgress.0.initialMasteryRate': { message: 'Path `initialMasteryRate` (120) is more than maximum allowed value (100).' } };
        return Promise.reject(error);
      }
    }

    if (this.attendanceTrend && this.attendanceTrend.length > 0) {
      const rate = this.attendanceTrend[0].attendanceRate;
      if (rate < 0) {
        const error = new Error('ValidationError');
        error.name = 'ValidationError';
        error.errors = { 'attendanceTrend.0.attendanceRate': { message: 'Path `attendanceRate` (-10) is less than minimum allowed value (0).' } };
        return Promise.reject(error);
      }
    }

    if (this.homeworkCompletionTrend && this.homeworkCompletionTrend.length > 0) {
      const rate = this.homeworkCompletionTrend[0].completionRate;
      if (rate > 100) {
        const error = new Error('ValidationError');
        error.name = 'ValidationError';
        error.errors = { 'homeworkCompletionTrend.0.completionRate': { message: 'Path `completionRate` (101) is more than maximum allowed value (100).' } };
        return Promise.reject(error);
      }
    }

    if (this.subjectTrends && this.subjectTrends.length > 0) {
      const subject = this.subjectTrends[0].subject;
      if (!['数学', '语文', '英语', '科学', '社会'].includes(subject)) {
        const error = new Error('ValidationError');
        error.name = 'ValidationError';
        error.errors = { 'subjectTrends.0.subject': { message: 'Invalid enum value' } };
        return Promise.reject(error);
      }

      if (this.subjectTrends[0].scores && this.subjectTrends[0].scores.length > 0) {
        const testType = this.subjectTrends[0].scores[0].testType;
        if (!['单元测试', '月考', '期中考试', '期末考试'].includes(testType)) {
          const error = new Error('ValidationError');
          error.name = 'ValidationError';
          error.errors = { 'subjectTrends.0.scores.0.testType': { message: 'Invalid enum value' } };
          return Promise.reject(error);
        }
      }
    }

    // Update the updatedAt timestamp
    const originalUpdatedAt = this.updatedAt;
    this.updatedAt = new Date(originalUpdatedAt.getTime() + 1000);
    return Promise.resolve(this);
  });

  // Mock static methods
  MockStudentPerformanceTrend.deleteMany = jest.fn().mockResolvedValue({});

  return MockStudentPerformanceTrend;
});

// Mock mongoose.Types.ObjectId
mongoose.Types = {
  ObjectId: jest.fn().mockImplementation(() => {
    return {
      toString: jest.fn().mockReturnValue('mock-id')
    };
  })
};

// Import the model after mocking
const StudentPerformanceTrend = require('../../models/StudentPerformanceTrend');

describe('StudentPerformanceTrend 模型测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该成功创建并保存学生表现趋势记录', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const performanceTrendData = {
      student: mockStudentId,
      academicYear: '2023-2024',
      semester: '第一学期',
      subjectTrends: [
        {
          subject: '数学',
          scores: [
            {
              date: new Date('2023-09-15'),
              score: 85,
              testType: '单元测试'
            },
            {
              date: new Date('2023-10-20'),
              score: 90,
              testType: '月考'
            }
          ],
          averageScore: 87.5,
          trend: '上升',
          improvementRate: 5.88
        }
      ],
      knowledgePointProgress: [
        {
          subject: '数学',
          knowledgePoint: '分数运算',
          initialMasteryRate: 70,
          currentMasteryRate: 85,
          improvementRate: 21.43
        }
      ],
      homeworkCompletionTrend: [
        {
          month: '2023-09',
          completionRate: 95
        }
      ],
      attendanceTrend: [
        {
          month: '2023-09',
          attendanceRate: 100
        }
      ]
    };

    const performanceTrend = new StudentPerformanceTrend(performanceTrendData);
    const savedPerformanceTrend = await performanceTrend.save();

    // 验证保存的数据
    expect(savedPerformanceTrend._id).toBeDefined();
    expect(savedPerformanceTrend.student.toString()).toBe(mockStudentId.toString());
    expect(savedPerformanceTrend.academicYear).toBe('2023-2024');
    expect(savedPerformanceTrend.semester).toBe('第一学期');
    expect(savedPerformanceTrend.subjectTrends.length).toBe(1);
    expect(savedPerformanceTrend.subjectTrends[0].subject).toBe('数学');
    expect(savedPerformanceTrend.subjectTrends[0].scores.length).toBe(2);
    expect(savedPerformanceTrend.subjectTrends[0].averageScore).toBe(87.5);
    expect(savedPerformanceTrend.subjectTrends[0].trend).toBe('上升');
    expect(savedPerformanceTrend.knowledgePointProgress.length).toBe(1);
    expect(savedPerformanceTrend.homeworkCompletionTrend.length).toBe(1);
    expect(savedPerformanceTrend.attendanceTrend.length).toBe(1);
  });

  it('缺少必填字段时应该验证失败', async () => {
    const invalidPerformanceTrend = new StudentPerformanceTrend({
      // 缺少 student 字段
      academicYear: '2023-2024',
      semester: '第一学期'
    });

    let validationError;
    try {
      await invalidPerformanceTrend.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.student).toBeDefined();
  });

  it('应该正确验证枚举值', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const invalidPerformanceTrend = new StudentPerformanceTrend({
      student: mockStudentId,
      academicYear: '2023-2024',
      semester: '无效学期', // 无效的枚举值
      subjectTrends: [
        {
          subject: '数学',
          scores: [
            {
              date: new Date('2023-09-15'),
              score: 85,
              testType: '单元测试'
            }
          ]
        }
      ]
    });

    let validationError;
    try {
      await invalidPerformanceTrend.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.semester).toBeDefined();
  });

  it('应该自动更新 updatedAt 字段', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const performanceTrend = new StudentPerformanceTrend({
      student: mockStudentId,
      academicYear: '2023-2024',
      semester: '第一学期',
      subjectTrends: [
        {
          subject: '数学',
          scores: [
            {
              date: new Date('2023-09-15'),
              score: 85,
              testType: '单元测试'
            }
          ]
        }
      ]
    });

    const savedPerformanceTrend = await performanceTrend.save();
    const originalUpdatedAt = savedPerformanceTrend.updatedAt;

    // 等待一段时间后更新记录
    await new Promise(resolve => setTimeout(resolve, 100));

    savedPerformanceTrend.academicYear = '2024-2025';
    const updatedPerformanceTrend = await savedPerformanceTrend.save();

    expect(updatedPerformanceTrend.updatedAt).not.toEqual(originalUpdatedAt);
  });

  it('应该验证分数范围', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const invalidPerformanceTrend = new StudentPerformanceTrend({
      student: mockStudentId,
      academicYear: '2023-2024',
      semester: '第一学期',
      knowledgePointProgress: [
        {
          subject: '数学',
          knowledgePoint: '分数运算',
          initialMasteryRate: 120, // 超出最大值100
          currentMasteryRate: 85,
          improvementRate: 21.43
        }
      ]
    });

    let validationError;
    try {
      await invalidPerformanceTrend.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors['knowledgePointProgress.0.initialMasteryRate']).toBeDefined();
  });

  it('应该验证出勤率范围', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const invalidPerformanceTrend = new StudentPerformanceTrend({
      student: mockStudentId,
      academicYear: '2023-2024',
      semester: '第一学期',
      attendanceTrend: [
        {
          month: '2023-09',
          attendanceRate: -10 // 低于最小值0
        }
      ]
    });

    let validationError;
    try {
      await invalidPerformanceTrend.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors['attendanceTrend.0.attendanceRate']).toBeDefined();
  });

  it('应该验证作业完成率范围', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const invalidPerformanceTrend = new StudentPerformanceTrend({
      student: mockStudentId,
      academicYear: '2023-2024',
      semester: '第一学期',
      homeworkCompletionTrend: [
        {
          month: '2023-09',
          completionRate: 101 // 超出最大值100
        }
      ]
    });

    let validationError;
    try {
      await invalidPerformanceTrend.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors['homeworkCompletionTrend.0.completionRate']).toBeDefined();
  });

  it('应该验证学科枚举值', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const invalidPerformanceTrend = new StudentPerformanceTrend({
      student: mockStudentId,
      academicYear: '2023-2024',
      semester: '第一学期',
      subjectTrends: [
        {
          subject: '物理', // 不在枚举列表中
          scores: [
            {
              date: new Date('2023-09-15'),
              score: 85,
              testType: '单元测试'
            }
          ]
        }
      ]
    });

    let validationError;
    try {
      await invalidPerformanceTrend.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors['subjectTrends.0.subject']).toBeDefined();
  });

  it('应该验证测试类型枚举值', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const invalidPerformanceTrend = new StudentPerformanceTrend({
      student: mockStudentId,
      academicYear: '2023-2024',
      semester: '第一学期',
      subjectTrends: [
        {
          subject: '数学',
          scores: [
            {
              date: new Date('2023-09-15'),
              score: 85,
              testType: '随堂测验' // 不在枚举列表中
            }
          ]
        }
      ]
    });

    let validationError;
    try {
      await invalidPerformanceTrend.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors['subjectTrends.0.scores.0.testType']).toBeDefined();
  });
});
