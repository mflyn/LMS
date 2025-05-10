const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const config = require('../config');

// 注册路由
router.post('/register', async (req, res) => {
  try {
    const { name, username, password, email, role, grade, class: className, studentId, teacherId, subjects, classesManaged } = req.body;

    // 检查用户名是否已存在
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: '用户名已存在' });
    }

    // 检查角色是否有效
    const validRole = await Role.findOne({ name: role });
    if (!validRole) {
      return res.status(400).json({ message: '无效的角色' });
    }

    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 创建用户对象
    const userData = {
      name,
      username,
      password: hashedPassword,
      email,
      role
    };

    // 根据角色添加特定字段
    if (role === 'student') {
      userData.grade = grade;
      userData.class = className;
      userData.studentId = studentId;
    } else if (role === 'teacher') {
      userData.teacherId = teacherId;
      userData.subjects = subjects || [];
      userData.classesManaged = classesManaged || [];
    }

    // 创建新用户
    const newUser = new User(userData);

    await newUser.save();

    res.status(201).json({ message: '用户注册成功' });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 登录路由
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 查找用户
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: '用户名或密码不正确' });
    }

    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: '用户名或密码不正确' });
    }

    // 创建JWT令牌
    const payload = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role
    };

    jwt.sign(
      payload,
      config.jwtSecret,
      { expiresIn: config.tokenExpiration },
      (err, token) => {
        if (err) throw err;
        res.json({
          success: true,
          token: token,
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role
          }
        });
      }
    );
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;