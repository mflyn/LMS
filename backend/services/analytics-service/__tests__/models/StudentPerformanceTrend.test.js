const mongoose = require('mongoose');
const StudentPerformanceTrend = require('../../models/StudentPerformanceTrend');

describe('StudentPerformanceTrend 模型测试', () => {
  beforeEach(async () => {
    await StudentPerformanceTrend.deleteMany({});
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
});
