const User = require('../../models/User');
const bcrypt = require('bcryptjs');

module.exports = async () => {
  try {
    // 检查是否已存在管理员用户
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('管理员用户已存在，跳过创建');
      return;
    }

    // 创建管理员用户
    const admin = new User({
      username: 'admin',
      password: await bcrypt.hash('admin123', 10),
      email: 'admin@example.com',
      role: 'admin',
      name: '系统管理员',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await admin.save();
    console.log('管理员用户创建成功');
  } catch (error) {
    console.error('创建管理员用户时出错：', error);
    throw error;
  }
}; 