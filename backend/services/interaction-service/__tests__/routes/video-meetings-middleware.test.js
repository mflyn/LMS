/**
 * 视频会议路由中间件测试
 */

const express = require('express');
const { authenticateToken, checkRole } = require('../../routes/video-meetings');

describe('视频会议路由中间件测试', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('authenticateToken 中间件', () => {
    it('应该在用户已认证时调用 next', () => {
      // 模拟已认证用户
      req.user = { id: 'user123', role: 'teacher' };
      
      authenticateToken(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('应该在缺少用户信息时返回401', () => {
      // 模拟未认证请求
      req.headers = {};
      
      authenticateToken(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: '未认证' });
    });

    it('应该从请求头获取用户信息', () => {
      // 模拟请求头中的用户信息
      req.headers = {
        'x-user-id': 'user123',
        'x-user-role': 'teacher'
      };
      
      authenticateToken(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual({
        id: 'user123',
        role: 'teacher'
      });
    });
  });

  describe('checkRole 中间件', () => {
    it('应该在用户角色匹配时调用 next', () => {
      // 模拟已认证用户
      req.user = { id: 'user123', role: 'teacher' };
      
      const middleware = checkRole(['teacher', 'admin']);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('应该在用户未认证时返回401', () => {
      // 模拟未认证请求
      req.user = null;
      
      const middleware = checkRole(['teacher', 'admin']);
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: '未认证' });
    });

    it('应该在用户角色不匹配时返回403', () => {
      // 模拟角色不匹配的用户
      req.user = { id: 'user123', role: 'student' };
      
      const middleware = checkRole(['teacher', 'admin']);
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: '权限不足' });
    });
  });
});
