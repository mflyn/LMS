const User = require('../../models/User');
const bcrypt = require('bcryptjs');

module.exports = async () => {
  try {
    const teachers = [
      {
        username: 'teacher1',
        password: await bcrypt.hash('teacher123', 10),
        email: 'teacher1@example.com',
        role: 'teacher',
        name: '张老师',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        username: 'teacher2',
        password: await bcrypt.hash('teacher123', 10),
        email: 'teacher2@example.com',
        role: 'teacher',
        name: '李老师',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const teacher of teachers) {
      const existingTeacher = await User.findOne({ username: teacher.username });
      if (!existingTeacher) {
        await User.create(teacher);
        console.log(`教师用户 ${teacher.name} 创建成功`);
      } else {
        console.log(`教师用户 ${teacher.name} 已存在，跳过创建`);
      }
    }
  } catch (error) {
    console.error('创建教师用户时出错：', error);
    throw error;
  }
}; 