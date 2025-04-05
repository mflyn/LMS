const Course = require('../../models/Course');

module.exports = async () => {
  try {
    const courses = [
      {
        name: '语文',
        grade: '一年级',
        teacherId: 'teacher1',
        description: '小学一年级语文课程',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: '数学',
        grade: '一年级',
        teacherId: 'teacher1',
        description: '小学一年级数学课程',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: '英语',
        grade: '二年级',
        teacherId: 'teacher2',
        description: '小学二年级英语课程',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const course of courses) {
      const existingCourse = await Course.findOne({ 
        name: course.name,
        grade: course.grade
      });
      if (!existingCourse) {
        await Course.create(course);
        console.log(`课程 ${course.name}(${course.grade}) 创建成功`);
      } else {
        console.log(`课程 ${course.name}(${course.grade}) 已存在，跳过创建`);
      }
    }
  } catch (error) {
    console.error('创建课程数据时出错：', error);
    throw error;
  }
}; 