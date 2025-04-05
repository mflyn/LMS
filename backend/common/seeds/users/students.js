const User = require('../../models/User');
const bcrypt = require('bcryptjs');

module.exports = async () => {
  try {
    const students = [
      {
        username: 'student1',
        password: await bcrypt.hash('student123', 10),
        email: 'student1@example.com',
        role: 'student',
        name: '小明',
        status: 'active',
        grade: '一年级',
        class: '一班',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        username: 'student2',
        password: await bcrypt.hash('student123', 10),
        email: 'student2@example.com',
        role: 'student',
        name: '小红',
        status: 'active',
        grade: '一年级',
        class: '一班',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        username: 'student3',
        password: await bcrypt.hash('student123', 10),
        email: 'student3@example.com',
        role: 'student',
        name: '小华',
        status: 'active',
        grade: '二年级',
        class: '二班',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const student of students) {
      const existingStudent = await User.findOne({ username: student.username });
      if (!existingStudent) {
        await User.create(student);
        console.log(`学生用户 ${student.name} 创建成功`);
      } else {
        console.log(`学生用户 ${student.name} 已存在，跳过创建`);
      }
    }
  } catch (error) {
    console.error('创建学生用户时出错：', error);
    throw error;
  }
}; 