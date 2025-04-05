const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

/**
 * 学生能力评估种子数据
 */
module.exports = async () => {
  try {
    // 获取模型
    const StudentAbility = mongoose.model('StudentAbility');
    const User = mongoose.model('User');
    
    // 获取学生和教师用户
    const students = await User.find({ role: 'student' }).select('_id');
    const teachers = await User.find({ role: 'teacher' }).select('_id');
    
    if (students.length === 0 || teachers.length === 0) {
      console.log('缺少必要的用户数据，跳过创建学生能力评估数据');
      return;
    }
    
    // 准备学生能力评估数据
    const studentAbilities = [];
    const currentYear = new Date().getFullYear();
    
    // 为每个学生创建能力评估记录
    for (const student of students) {
      // 创建第一学期的能力评估
      studentAbilities.push({
        studentId: student._id,
        academicYear: `${currentYear}-${currentYear + 1}`,
        semester: '第一学期',
        subjectAbilities: [
          {
            subject: '语文',
            abilities: [
              {
                name: '阅读理解能力',
                score: Math.floor(Math.random() * 20) + 80, // 80-99分
                level: '良好',
                description: '能够理解文章主旨，把握文章结构'
              },
              {
                name: '写作能力',
                score: Math.floor(Math.random() * 20) + 75, // 75-94分
                level: '良好',
                description: '能够进行基本的文章写作，表达较为流畅'
              },
              {
                name: '口语表达能力',
                score: Math.floor(Math.random() * 25) + 70, // 70-94分
                level: '中等',
                description: '能够进行基本的口头表达，需要提高逻辑性'
              }
            ],
            overallScore: 85,
            overallLevel: '良好'
          },
          {
            subject: '数学',
            abilities: [
              {
                name: '计算能力',
                score: Math.floor(Math.random() * 15) + 85, // 85-99分
                level: '优秀',
                description: '计算准确，速度快'
              },
              {
                name: '逻辑推理能力',
                score: Math.floor(Math.random() * 20) + 80, // 80-99分
                level: '良好',
                description: '能够进行基本的逻辑推理，解决简单问题'
              },
              {
                name: '空间想象能力',
                score: Math.floor(Math.random() * 25) + 75, // 75-99分
                level: '良好',
                description: '具备基本的空间想象能力'
              }
            ],
            overallScore: 88,
            overallLevel: '良好'
          },
          {
            subject: '英语',
            abilities: [
              {
                name: '听力理解能力',
                score: Math.floor(Math.random() * 20) + 75, // 75-94分
                level: '良好',
                description: '能够理解基本的英语对话'
              },
              {
                name: '阅读能力',
                score: Math.floor(Math.random() * 20) + 80, // 80-99分
                level: '良好',
                description: '能够理解基本的英语文章'
              },
              {
                name: '口语表达能力',
                score: Math.floor(Math.random() * 25) + 70, // 70-94分
                level: '中等',
                description: '能够进行简单的英语对话'
              }
            ],
            overallScore: 82,
            overallLevel: '良好'
          }
        ],
        generalAbilities: [
          {
            name: '自主学习能力',
            score: Math.floor(Math.random() * 20) + 75, // 75-94分
            level: '良好',
            description: '能够独立完成作业，有一定的自主学习能力'
          },
          {
            name: '创新思维能力',
            score: Math.floor(Math.random() * 25) + 70, // 70-94分
            level: '中等',
            description: '有一定的创新意识，需要进一步培养'
          },
          {
            name: '合作交流能力',
            score: Math.floor(Math.random() * 20) + 80, // 80-99分
            level: '良好',
            description: '能够与同学合作完成任务，交流顺畅'
          },
          {
            name: '问题解决能力',
            score: Math.floor(Math.random() * 20) + 75, // 75-94分
            level: '良好',
            description: '能够分析并解决一般性问题'
          }
        ],
        evaluatedBy: teachers[0]._id,
        evaluationDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60天前
        comments: '总体表现良好，需要加强自主学习能力和创新思维能力的培养',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // 批量插入数据
    const existingCount = await StudentAbility.countDocuments();
    if (existingCount === 0) {
      await StudentAbility.insertMany(studentAbilities);
      console.log(`成功创建 ${studentAbilities.length} 条学生能力评估记录`);
    } else {
      console.log('学生能力评估数据已存在，跳过创建');
    }
  } catch (error) {
    console.error('创建学生能力评估种子数据时出错：', error);
    throw error;
  }
};