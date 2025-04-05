const User = require('../../models/User');
const bcrypt = require('bcryptjs');

module.exports = async () => {
  try {
    const parents = [
      {
        username: 'parent1',
        password: await bcrypt.hash('parent123', 10),
        email: 'parent1@example.com',
        role: 'parent',
        name: '小明爸爸',
        status: 'active',
        studentId: 'student1',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        username: 'parent2',
        password: await bcrypt.hash('parent123', 10),
        email: 'parent2@example.com',
        role: 'parent',
        name: '小红妈妈',
        status: 'active',
        studentId: 'student2',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        username: 'parent3',
        password: await bcrypt.hash('parent123', 10),
        email: 'parent3@example.com',
        role: 'parent',
        name: '小华爸爸',
        status: 'active',
        studentId: 'student3',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const parent of parents) {
      const existingParent = await User.findOne({ username: parent.username });
      if (!existingParent) {
        await User.create(parent);
        console.log(`家长用户 ${parent.name} 创建成功`);
      } else {
        console.log(`家长用户 ${parent.name} 已存在，跳过创建`);
      }
    }
  } catch (error) {
    console.error('创建家长用户时出错：', error);
    throw error;
  }
}; 