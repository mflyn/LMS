const studentController = require('../../controllers/studentController');
const User = require('../../models/User');

// 模拟依赖
jest.mock('../../models/User');
jest.mock('../../../../common/config/logger', () => {
  const mockLoggerInstance = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  };

  return {
    createLogger: jest.fn(() => mockLoggerInstance)
  };
});

const { createLogger } = require('../../../../common/config/logger');

describe('StudentController', () => {
  let req;
  let res;
  let mockLogger;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    mockLogger = createLogger();

    // 模拟请求对象
    req = {
      query: {},
      params: {},
      body: {},
      app: { locals: { logger: mockLogger } }
    };

    // 模拟响应对象
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('getStudents', () => {
    it('应该成功获取学生列表', async () => {
      // 准备测试数据
      req.query = {
        page: '1',
        limit: '10'
      };

      const mockStudents = [
        {
          _id: 'student1',
          name: '张三',
          class: '1班',
          grade: '三年级',
          studentId: '20230001'
        },
        {
          _id: 'student2',
          name: '李四',
          class: '2班',
          grade: '三年级',
          studentId: '20230002'
        }
      ];

      // 模拟User.find的返回值
      const mockFind = {
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockStudents)
      };
      User.find.mockReturnValue(mockFind);
      User.countDocuments.mockResolvedValue(2);

      // 调用控制器方法
      await studentController.getStudents(req, res);

      // 验证结果
      expect(User.find).toHaveBeenCalledWith({ role: 'student' });
      expect(mockFind.select).toHaveBeenCalledWith('_id name class grade studentId');
      expect(mockFind.skip).toHaveBeenCalledWith(0);
      expect(mockFind.limit).toHaveBeenCalledWith(10);
      expect(mockFind.sort).toHaveBeenCalledWith({ name: 1 });
      expect(User.countDocuments).toHaveBeenCalledWith({ role: 'student' });
      expect(mockLogger.info).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: 'success',
        data: {
          items: [
            {
              id: 'student1',
              name: '张三',
              class: '1班',
              grade: '三年级'
            },
            {
              id: 'student2',
              name: '李四',
              class: '2班',
              grade: '三年级'
            }
          ],
          total: 2,
          page: 1,
          limit: 10
        }
      });
    });

    it('应该支持搜索功能', async () => {
      // 准备测试数据
      req.query = {
        search: '张三',
        page: '1',
        limit: '10'
      };

      const mockStudents = [
        {
          _id: 'student1',
          name: '张三',
          class: '1班',
          grade: '三年级',
          studentId: '20230001'
        }
      ];

      // 模拟User.find的返回值
      const mockFind = {
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockStudents)
      };
      User.find.mockReturnValue(mockFind);
      User.countDocuments.mockResolvedValue(1);

      // 调用控制器方法
      await studentController.getStudents(req, res);

      // 验证结果
      expect(User.find).toHaveBeenCalledWith({
        role: 'student',
        $or: [
          { name: { $regex: '张三', $options: 'i' } },
          { username: { $regex: '张三', $options: 'i' } },
          { studentId: { $regex: '张三', $options: 'i' } }
        ]
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.items).toHaveLength(1);
      expect(res.json.mock.calls[0][0].data.items[0].name).toBe('张三');
    });

    it('应该支持班级筛选', async () => {
      // 准备测试数据
      req.query = {
        class: '1班',
        page: '1',
        limit: '10'
      };

      const mockStudents = [
        {
          _id: 'student1',
          name: '张三',
          class: '1班',
          grade: '三年级',
          studentId: '20230001'
        }
      ];

      // 模拟User.find的返回值
      const mockFind = {
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockStudents)
      };
      User.find.mockReturnValue(mockFind);
      User.countDocuments.mockResolvedValue(1);

      // 调用控制器方法
      await studentController.getStudents(req, res);

      // 验证结果
      expect(User.find).toHaveBeenCalledWith({
        role: 'student',
        class: '1班'
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.items).toHaveLength(1);
      expect(res.json.mock.calls[0][0].data.items[0].class).toBe('1班');
    });

    it('应该处理获取学生列表过程中的错误', async () => {
      // 模拟User.find抛出错误
      const error = new Error('数据库错误');
      User.find.mockImplementation(() => {
        throw error;
      });

      // 调用控制器方法
      await studentController.getStudents(req, res);

      // 验证结果
      expect(mockLogger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        code: 500,
        message: '服务器错误',
        data: null
      });
    });
  });

  describe('getStudentById', () => {
    it('应该成功获取学生详情', async () => {
      // 准备测试数据
      req.params = {
        id: 'student1'
      };

      const mockStudent = {
        _id: 'student1',
        name: '张三',
        class: '1班',
        grade: '三年级',
        studentId: '20230001'
      };

      // 模拟User.findOne的返回值
      const mockFindOne = {
        select: jest.fn().mockResolvedValue(mockStudent)
      };
      User.findOne.mockReturnValue(mockFindOne);

      // 调用控制器方法
      await studentController.getStudentById(req, res);

      // 验证结果
      expect(User.findOne).toHaveBeenCalledWith({ _id: 'student1', role: 'student' });
      expect(mockFindOne.select).toHaveBeenCalledWith('_id name class grade studentId');
      expect(mockLogger.info).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: 'success',
        data: {
          id: 'student1',
          name: '张三',
          class: '1班',
          grade: '三年级',
          scores: []
        }
      });
    });

    it('应该处理学生不存在的情况', async () => {
      // 准备测试数据
      req.params = {
        id: 'nonexistent'
      };

      // 模拟User.findOne的返回值
      const mockFindOne = {
        select: jest.fn().mockResolvedValue(null)
      };
      User.findOne.mockReturnValue(mockFindOne);

      // 调用控制器方法
      await studentController.getStudentById(req, res);

      // 验证结果
      expect(User.findOne).toHaveBeenCalledWith({ _id: 'nonexistent', role: 'student' });
      expect(mockFindOne.select).toHaveBeenCalledWith('_id name class grade studentId');
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        code: 404,
        message: '学生不存在',
        data: null
      });
    });

    it('应该处理获取学生详情过程中的错误', async () => {
      // 准备测试数据
      req.params = {
        id: 'student1'
      };

      // 模拟User.findOne抛出错误
      const error = new Error('数据库错误');
      User.findOne.mockImplementation(() => {
        throw error;
      });

      // 调用控制器方法
      await studentController.getStudentById(req, res);

      // 验证结果
      expect(mockLogger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        code: 500,
        message: '服务器错误',
        data: null
      });
    });
  });
});
