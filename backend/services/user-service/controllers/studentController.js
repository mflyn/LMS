const User = require('../models/User');
const { logger } = require('../../../common/config/logger');

class StudentController {
  /**
   * 获取学生列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getStudents(req, res) {
    try {
      const { page = 1, limit = 10, search = '', class: className = '' } = req.query;
      
      // 构建查询条件
      const query = { role: 'student' };
      
      // 添加搜索条件
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { studentId: { $regex: search, $options: 'i' } }
        ];
      }
      
      // 添加班级筛选
      if (className) {
        query.class = className;
      }
      
      // 计算分页
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // 查询学生列表
      const students = await User.find(query)
        .select('_id name class grade studentId')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ name: 1 });
      
      // 获取总数
      const total = await User.countDocuments(query);
      
      logger.info('获取学生列表成功', {
        count: students.length,
        total,
        page,
        limit
      });
      
      // 返回统一格式的响应
      return res.status(200).json({
        code: 200,
        message: 'success',
        data: {
          items: students.map(student => ({
            id: student._id,
            name: student.name,
            class: student.class,
            grade: student.grade
          })),
          total,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      logger.error('获取学生列表失败', {
        error: error.message,
        stack: error.stack
      });
      
      return res.status(500).json({
        code: 500,
        message: '服务器错误',
        data: null
      });
    }
  }

  /**
   * 获取学生详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getStudentById(req, res) {
    try {
      const { id } = req.params;
      
      // 查询学生信息
      const student = await User.findOne({ _id: id, role: 'student' })
        .select('_id name class grade studentId');
      
      if (!student) {
        logger.warn('学生不存在', { studentId: id });
        return res.status(404).json({
          code: 404,
          message: '学生不存在',
          data: null
        });
      }
      
      // 这里可以添加获取学生成绩的逻辑，可能需要调用成绩服务
      // 简化版本，返回空成绩数组
      const scores = [];
      
      logger.info('获取学生详情成功', { studentId: id });
      
      // 返回统一格式的响应
      return res.status(200).json({
        code: 200,
        message: 'success',
        data: {
          id: student._id,
          name: student.name,
          class: student.class,
          grade: student.grade,
          scores
        }
      });
    } catch (error) {
      logger.error('获取学生详情失败', {
        error: error.message,
        stack: error.stack,
        studentId: req.params.id
      });
      
      return res.status(500).json({
        code: 500,
        message: '服务器错误',
        data: null
      });
    }
  }
}

module.exports = new StudentController();