const Class = require('../../models/Class');
const User = require('../../models/User');

module.exports = async () => {
  try {
    // 检查是否已存在班级数据
    const existingClasses = await Class.countDocuments();
    if (existingClasses > 0) {
      console.log('班级数据已存在，跳过创建');
      return;
    }

    // 获取教师用户
    const teachers = await User.find({ role: 'teacher' }).limit(5);
    if (teachers.length === 0) {
      console.log('教师数据不存在，无法创建班级数据');
      return;
    }

    // 获取学生用户
    const students = await User.find({ role: 'student' }).limit(30);
    if (students.length === 0) {
      console.log('学生数据不存在，无法创建班级数据');
      return;
    }

    // 创建班级数据
    const classes = [
      {
        name: '一年级(1)班',
        grade: '一年级',
        academicYear: '2023-2024',
        headTeacher: teachers[0]._id,
        teachers: [
          { teacher: teachers[0]._id, subject: '语文' },
          { teacher: teachers[1] ? teachers[1]._id : teachers[0]._id, subject: '数学' }
        ],
        students: students.slice(0, 15).map(student => student._id),
        schedule: [
          { dayOfWeek: 1, period: 1, subject: '语文', teacher: teachers[0]._id, location: '教室101' },
          { dayOfWeek: 1, period: 2, subject: '数学', teacher: teachers[1] ? teachers[1]._id : teachers[0]._id, location: '教室101' },
          { dayOfWeek: 2, period: 1, subject: '数学', teacher: teachers[1] ? teachers[1]._id : teachers[0]._id, location: '教室101' },
          { dayOfWeek: 2, period: 2, subject: '语文', teacher: teachers[0]._id, location: '教室101' }
        ],
        description: '一年级示范班级',
        status: 'active'
      },
      {
        name: '二年级(1)班',
        grade: '二年级',
        academicYear: '2023-2024',
        headTeacher: teachers[1] ? teachers[1]._id : teachers[0]._id,
        teachers: [
          { teacher: teachers[1] ? teachers[1]._id : teachers[0]._id, subject: '数学' },
          { teacher: teachers[2] ? teachers[2]._id : teachers[0]._id, subject: '英语' }
        ],
        students: students.slice(15, 30).map(student => student._id),
        schedule: [
          { dayOfWeek: 1, period: 1, subject: '数学', teacher: teachers[1] ? teachers[1]._id : teachers[0]._id, location: '教室102' },
          { dayOfWeek: 1, period: 2, subject: '英语', teacher: teachers[2] ? teachers[2]._id : teachers[0]._id, location: '教室102' },
          { dayOfWeek: 2, period: 1, subject: '英语', teacher: teachers[2] ? teachers[2]._id : teachers[0]._id, location: '教室102' },
          { dayOfWeek: 2, period: 2, subject: '数学', teacher: teachers[1] ? teachers[1]._id : teachers[0]._id, location: '教室102' }
        ],
        description: '二年级示范班级',
        status: 'active'
      }
    ];

    for (const classData of classes) {
      const existingClass = await Class.findOne({ name: classData.name });
      if (!existingClass) {
        await Class.create(classData);
        console.log(`班级 ${classData.name} 创建成功`);
      } else {
        console.log(`班级 ${classData.name} 已存在，跳过创建`);
      }
    }
    
    console.log('班级数据创建完成');
  } catch (error) {
    console.error('创建班级数据时出错：', error);
    throw error;
  }
};