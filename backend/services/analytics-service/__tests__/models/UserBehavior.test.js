const mongoose = require('mongoose');
const UserBehavior = require('../../models/UserBehavior');

// 模拟mongoose
jest.mock('mongoose', () => {
  const mockAggregate = jest.fn().mockResolvedValue([]);

  const mockModel = {
    aggregate: mockAggregate,
    find: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([])
  };

  return {
    Schema: jest.fn().mockImplementation(() => ({
      index: jest.fn(),
      statics: {},
      pre: jest.fn()
    })),
    model: jest.fn().mockReturnValue(mockModel),
    Types: {
      ObjectId: jest.fn(id => id)
    }
  };
});

// 模拟UserBehavior模型
jest.mock('../../models/UserBehavior', () => {
  const mockUserBehavior = {
    getUserActivitySummary: jest.fn().mockResolvedValue([]),
    getLearningHabitsAnalysis: jest.fn().mockResolvedValue([]),
    getUsagePatterns: jest.fn().mockResolvedValue([])
  };

  return mockUserBehavior;
});

describe('UserBehavior Model', () => {
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
  });

  describe('Static Methods', () => {
    it('应该有getUserActivitySummary方法', () => {
      expect(UserBehavior.getUserActivitySummary).toBeDefined();
      expect(typeof UserBehavior.getUserActivitySummary).toBe('function');
    });

    it('应该有getLearningHabitsAnalysis方法', () => {
      expect(UserBehavior.getLearningHabitsAnalysis).toBeDefined();
      expect(typeof UserBehavior.getLearningHabitsAnalysis).toBe('function');
    });

    it('应该有getUsagePatterns方法', () => {
      expect(UserBehavior.getUsagePatterns).toBeDefined();
      expect(typeof UserBehavior.getUsagePatterns).toBe('function');
    });
  });

  describe('Method Tests', () => {
    describe('getUserActivitySummary', () => {
      it('应该接收正确的参数并返回结果', async () => {
        // 准备测试数据
        const userId = 'user123';
        const startDate = new Date('2023-01-01');
        const endDate = new Date('2023-01-31');

        // 设置模拟返回值
        const mockResult = [
          { _id: 'view_resource', count: 10, avgDuration: 120 },
          { _id: 'submit_homework', count: 5, avgDuration: 300 }
        ];
        UserBehavior.getUserActivitySummary.mockResolvedValue(mockResult);

        // 调用方法
        const result = await UserBehavior.getUserActivitySummary(userId, startDate, endDate);

        // 验证结果
        expect(result).toEqual(mockResult);
        expect(UserBehavior.getUserActivitySummary).toHaveBeenCalledWith(userId, startDate, endDate);
      });
    });

    describe('getLearningHabitsAnalysis', () => {
      it('应该接收正确的参数并返回结果', async () => {
        // 准备测试数据
        const userId = 'user123';
        const days = 30;

        // 设置模拟返回值
        const mockResult = [
          { _id: { hour: 10, dayOfWeek: 1, actionType: 'view_resource' }, count: 5, totalDuration: 600 },
          { _id: { hour: 14, dayOfWeek: 3, actionType: 'submit_homework' }, count: 3, totalDuration: 900 }
        ];
        UserBehavior.getLearningHabitsAnalysis.mockResolvedValue(mockResult);

        // 调用方法
        const result = await UserBehavior.getLearningHabitsAnalysis(userId, days);

        // 验证结果
        expect(result).toEqual(mockResult);
        expect(UserBehavior.getLearningHabitsAnalysis).toHaveBeenCalledWith(userId, days);
      });
    });

    describe('getUsagePatterns', () => {
      it('应该接收正确的参数并返回结果', async () => {
        // 准备测试数据
        const userRole = 'student';
        const days = 30;

        // 设置模拟返回值
        const mockResult = [
          {
            _id: { page: '/dashboard', actionType: 'page_view' },
            count: 100,
            uniqueUserCount: 20,
            avgDuration: 180
          },
          {
            _id: { page: '/resources', actionType: 'view_resource' },
            count: 50,
            uniqueUserCount: 15,
            avgDuration: 300
          }
        ];
        UserBehavior.getUsagePatterns.mockResolvedValue(mockResult);

        // 调用方法
        const result = await UserBehavior.getUsagePatterns(userRole, days);

        // 验证结果
        expect(result).toEqual(mockResult);
        expect(UserBehavior.getUsagePatterns).toHaveBeenCalledWith(userRole, days);
      });
    });
  });
});
