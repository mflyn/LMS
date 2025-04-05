const Homework = require('../../models/Homework');
const mongoose = require('mongoose');

module.exports = async () => {
  try {
    // 创建ObjectId实例用于关联
    const teacherId1 = mongoose.Types.ObjectId();
    const teacherId2 = mongoose.Types.ObjectId();
    const classId1 = mongoose.Types.ObjectId();
    const classId2 = mongoose.Types.ObjectId();
    const subjectChineseId = mongoose.Types.ObjectId();
    const subjectMathId = mongoose.Types.ObjectId();
    const subjectEnglishId = mongoose.Types.ObjectId();
    
    const homeworks = [
      {
        title: '语文阅读理解练习',
        description: '阅读课文《秋天的雨》，完成课后习题1-5',
        subject: subjectChineseId,
        class: classId1,
        assignedBy: teacherId1,
        assignedTo: [],
        dueDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // 一周后截止
        status: 'assigned',
        attachments: [
          {
            name: '秋天的雨习题.pdf',
            path: '/resources/homework/chinese/autumn-rain-exercises.pdf',
            type: 'application/pdf'
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: '数学应用题练习',
        description: '完成教材第三章应用题1-10，注意要写出计算过程',
        subject: subjectMathId,
        class: classId1,
        assignedBy: teacherId1,
        assignedTo: [],
        dueDate: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000), // 三天后截止
        status: 'assigned',
        attachments: [
          {
            name: '数学应用题.pdf',
            path: '/resources/homework/math/application-problems.pdf',
            type: 'application/pdf'
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: '英语单词听写',
        description: '复习Unit 3的单词，准备下周一的听写测试',
        subject: subjectEnglishId,
        class: classId2,
        assignedBy: teacherId2,
        assignedTo: [],
        dueDate: new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000), // 五天后截止
        status: 'assigned',
        attachments: [
          {
            name: '英语单词表.pdf',
            path: '/resources/homework/english/vocabulary-list.pdf',
            type: 'application/pdf'
          },
          {
            name: '单词发音.mp3',
            path: '/resources/homework/english/pronunciation.mp3',
            type: 'audio/mpeg'
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: '语文作文',
        description: '以"我的暑假生活"为题，写一篇不少于300字的作文',
        subject: subjectChineseId,
        class: classId1,
        assignedBy: teacherId1,
        assignedTo: [],
        dueDate: new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000), // 已过期
        status: 'overdue',
        attachments: [],
        createdAt: new Date(new Date().getTime() - 10 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      }
    ];

    for (const homework of homeworks) {
      const existingHomework = await Homework.findOne({ 
        title: homework.title,
        'class': homework.class
      });
      if (!existingHomework) {
        await Homework.create(homework);
        console.log(`作业 ${homework.title} 创建成功`);
      } else {
        console.log(`作业 ${homework.title} 已存在，跳过创建`);
      }
    }
  } catch (error) {
    console.error('创建作业数据时出错：', error);
    throw error;
  }
};