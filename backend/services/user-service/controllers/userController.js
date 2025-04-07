const { logger } = require('../../../common/config/logger');
const UserService = require('../services/userService');

class UserController {
  async register(req, res, next) {
    try {
      logger.info('开始用户注册', {
        email: req.body.email,
        username: req.body.username
      });

      const user = await UserService.createUser(req.body);
      
      logger.info('用户注册成功', {
        userId: user.id,
        email: user.email
      });

      res.status(201).json(user);
    } catch (error) {
      logger.error('用户注册失败', {
        error: error.message,
        stack: error.stack,
        body: req.body
      });
      res.status(500).json({
        code: 500,
        message: '服务器错误',
        data: null
      });
    }
  }

  async login(req, res, next) {
    try {
      const startTime = Date.now();
      logger.info('用户登录尝试', {
        email: req.body.email
      });

      const { token, user } = await UserService.login(req.body);

      const duration = Date.now() - startTime;
      logger.info('用户登录成功', {
        userId: user.id,
        email: user.email,
        duration: `${duration}ms`
      });

      res.json({
        code: 200,
        message: 'success',
        data: { token, user }
      });
    } catch (error) {
      logger.error('用户登录失败', {
        error: error.message,
        email: req.body.email
      });
      
      res.status(500).json({
        code: 500,
        message: '服务器错误',
        data: null
      });
    }
  }

  async updateProfile(req, res, next) {
    try {
      logger.info('开始更新用户资料', {
        userId: req.user.id,
        updates: req.body
      });

      const user = await UserService.updateUser(req.user.id, req.body);

      logger.info('用户资料更新成功', {
        userId: user.id,
        updatedFields: Object.keys(req.body)
      });

      res.json({
        code: 200,
        message: 'success',
        data: user
      });
    } catch (error) {
      logger.error('用户资料更新失败', {
        userId: req.user.id,
        error: error.message,
        updates: req.body
      });
      res.status(500).json({
        code: 500,
        message: '服务器错误',
        data: null
      });
    }
  }

  async getProfile(req, res, next) {
    try {
      const startTime = Date.now();
      
      const user = await UserService.getUserById(req.user.id);
      
      const duration = Date.now() - startTime;
      if (duration > 500) { // 如果查询时间超过 500ms，记录性能警告
        logger.warn('用户资料查询性能警告', {
          userId: req.user.id,
          duration: `${duration}ms`
        });
      }

      logger.info('用户资料获取成功', {
        userId: user.id,
        duration: `${duration}ms`
      });

      res.json({
        code: 200,
        message: 'success',
        data: user
      });
    } catch (error) {
      logger.error('用户资料获取失败', {
        userId: req.user.id,
        error: error.message
      });
      res.status(500).json({
        code: 500,
        message: '服务器错误',
        data: null
      });
    }
  }

  async deleteAccount(req, res, next) {
    try {
      logger.warn('用户请求删除账号', {
        userId: req.user.id,
        reason: req.body.reason
      });

      await UserService.deleteUser(req.user.id);

      logger.info('用户账号删除成功', {
        userId: req.user.id
      });

      res.status(204).send();
    } catch (error) {
      logger.error('用户账号删除失败', {
        userId: req.user.id,
        error: error.message
      });
      res.status(500).json({
        code: 500,
        message: '服务器错误',
        data: null
      });
    }
  }
}

module.exports = new UserController();