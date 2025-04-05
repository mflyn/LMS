const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

/**
 * 学习分析报告种子数据
 */
module.exports = async () => {
  try {
    // 获取模型
    const LearningAnalytic = mongoose.model('LearningAnalytic');
    const User = mongoose.model('User');
    const Resource = mongoose.model('Resource');
    
    // 获取学生用户
    const students = await User.find({ role: 'student' }).select('_id');
    
    if (students.length === 0) {
      console.log('缺少必要的学生数据，跳过创建学习分析报告');
      return;
    }
    
    // 获取资源ID（如果存在）
    let resources = [];
    try {
      resources = await Resource.find().select('_id').limit(5);
    } catch (error) {
      console.log('获取资源数据失败，将使用空资源列表');
    }
    
    // 准备学习分析报告数据
    const learningAnalytics = [];
    const now = new Date();
    
    // 为每个学生创建学习分析报告
    for (const student of students) {
      // 创建月报
      const monthlyReport = {
        studentId: student._id,
        generatedDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15天前
        reportType: '月报',
        period: {
          startDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), // 45天前
          endDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000) // 15天前
        },
        academicPerformance: {
          overallScore: Math.floor(Math.random() * 15) + 80, // 80-94分
          subjectScores: [
            {
              subject: '语文',
              score: Math.floor(Math.random() * 15) + 80, // 80-94分
              change: Math.floor(Math.random() * 10) - 5, // -5到4的变化
              trend: '上升'
            },
            {
              subject: '数学',
              score: Math.floor(Math.random() * 15) + 85, // 85-99分
              change: Math.floor(Math.random() * 6), // 0到5的变化
              trend: '上升'
            },
            {
              subject: '英语',
              score: Math.floor(Math.random() * 20) + 75, // 75-94分
              change: Math.floor(Math.random() * 10) - 5, // -5到4的变化
              trend: '稳定'
            }
          ],
          ranking: {
            class: Math.floor(Math.random() * 10) + 1, // 1-10名
            grade: Math.floor(Math.random() * 30) + 1, // 1-30名
            changeInClass: Math.floor(Math.random() * 6) - 3, // -3到2的变化
            changeInGrade: Math.floor(Math.random() * 10) - 5 // -5到4的变化
          }
        },
        learningBehaviors: {
          homeworkCompletion: {
            rate: Math.floor(Math.random() * 15) + 85, // 85-99%
            quality: '良好'
          },
          classParticipation: {
            rate: Math.floor(Math.random() * 20) + 80, // 80-99%
            quality: '良好'
          },
          attendance: {
            rate: Math.floor(Math.random() * 5) + 95, // 95-99%
            absences: Math.floor(Math.random() * 2), // 0-1次
            lates: Math.floor(Math.random() * 3) // 0-2次
          },
          resourceUtilization: {
            accessCount: Math.floor(Math.random() * 50) + 50, // 50-99次
            averageDuration: Math.floor(Math.random() * 30) + 15, // 15-44分钟
            mostAccessedResources: ['数学练习题', '语文阅读材料', '英语听力练习']
          }
        },
        knowledgeMastery: [
          {
            subject: '语文',
            knowledgePoints: [
              {
                name: '阅读理解',
                masteryLevel: Math.floor(Math.random() * 15) + 80, // 80-94分
                status: '已掌握'
              },
              {
                name: '写作技巧',
                masteryLevel: Math.floor(Math.random() * 20) + 75, // 75-94分
                status: '部分掌握'
              },
              {
                name: '古诗文鉴赏',
                masteryLevel: Math.floor(Math.random() * 25) + 70, // 70-94分
                status: '部分掌握'
              }
            ]
          },
          {
            subject: '数学',
            knowledgePoints: [
              {
                name: '基础计算',
                masteryLevel: Math.floor(Math.random() * 10) + 90, // 90-99分
                status: '已掌握'
              },
              {
                name: '应用题解析',
                masteryLevel: Math.floor(Math.random() * 20) + 75, // 75-94分
                status: '部分掌握'
              },
              {
                name: '几何图形',
                masteryLevel: Math.floor(Math.random() * 15) + 80, // 80-94分
                status: '已掌握'
              }
            ]
          }
        ],
        weaknessAnalysis: [
          {
            subject: '语文',
            weakPoints: [
              {
                knowledgePoint: '写作技巧',
                description: '作文结构不够清晰，表达不够流畅',
                recommendedResources: resources.length > 0 ? [resources[0]._id] : []
              }
            ]
          },
          {
            subject: '数学',
            weakPoints: [
              {
                knowledgePoint: '应用题解析',
                description: '解题思路不够清晰，缺乏系统性分析能力',
                recommendedResources: resources.length > 1 ? [resources[1]._id] : []
              }
            ]
          }
        ],
        improvementSuggestions: [
          {
            area: '语文写作',
            suggestions: [
              '多阅读优秀作文范例，学习结构和表达方式',
              '每周坚持写作练习，提高表达能力',
              '学习写作技巧，注重文章结构和逻辑性'
            ]
          },
          {
            area: '数学应用题',
            suggestions: [
              '多做应用题练习，提高分析问题能力',
              '学习应用题解题步骤和方法',
              '注重审题和分析过程，培养系统思维'
            ]
          }
        ],
        generatedBy: '系统',
        teacherComments: '本月表现良好，继续保持。需要加强语文写作和数学应用题的练习。',
        parentFeedback: {
          read: true,
          comments: '已收到报告，会督促孩子加强薄弱环节的学习。',
          readDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) // 10天前
        },
        createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15天前
        updatedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000) // 15天前
      };
      
      // 创建周报
      const weeklyReport = {
        studentId: student._id,
        generatedDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5天前
        reportType: '周报',
        period: {
          startDate: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000), // 12天前
          endDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5天前
        },
        academicPerformance: {
          overallScore: Math.floor(Math.random() * 15) + 82, // 82-96分
          subjectScores: [
            {
              subject: '语文',
              score: Math.floor(Math.random() * 15) + 82, // 82-96分
              change: Math.floor(Math.random() * 6) - 2, // -2到3的变化
              trend: '稳定'
            },
            {
              subject: '数学',
              score: Math.floor(Math.random() * 15) + 85, // 85-99分
              change: Math.floor(Math.random() * 4), // 0到3的变化
              trend: '上升'
            },
            {
              subject: '英语',
              score: Math.floor(Math.random() * 15) + 80, // 80-94分
              change: Math.floor(Math.random() * 6) - 3, // -3到2的变化
              trend: '稳定'
            }
          ],
          ranking: {
            class: Math.floor(Math.random() * 10) + 1, // 1-10名
            grade: Math.floor(Math.random() * 30) + 1, // 1-30名
            changeInClass: Math.floor(Math.random() * 4) - 2, // -2到1的变化
            changeInGrade: Math.floor(Math.random() * 6) - 3 // -3到2的变化
          }
        },
        learningBehaviors: {
          homeworkCompletion: {
            rate: Math.floor(Math.random() * 10) + 90, // 90-99%
            quality: '良好'
          },
          classParticipation: {
            rate: Math.floor(Math.random() * 15) + 85, // 85-99%
            quality: '良好'
          },
          attendance: {
            rate: 100, // 100%
            absences: 0,
            lates: 0
          },
          resourceUtilization: {
            accessCount: Math.floor(Math.random() * 20) + 10, // 10-29次
            averageDuration: Math.floor(Math.random() * 20) + 10, // 10-29分钟
            mostAccessedResources: ['数学练习题', '语文阅读材料']
          }
        },
        knowledgeMastery: [
          {
            subject: '语文',
            knowledgePoints: [
              {
                name: '本周重点知识点',
                masteryLevel: Math.floor(Math.random() * 15) + 80, // 80-94分
                status: '已掌握'
              }
            ]
          },
          {
            subject: '数学',
            knowledgePoints: [
              {
                name: '本周重点知识点',
                masteryLevel: Math.floor(Math.random() * 15) + 85, // 85-99分
                status: '已掌握'
              }
            ]
          }
        ],
        weaknessAnalysis: [
          {
            subject: '语文',
            weakPoints: [
              {
                knowledgePoint: '本周新学知识点',
                description: '需要加强巩固',
                recommendedResources: resources.length > 0 ? [resources[0]._id] : []
              }
            ]
          }
        ],
        improvementSuggestions: [
          {
            area: '本周学习',
            suggestions: [
              '及时复习本周所学知识点',
              '完成相关练习巩固学习成果'
            ]
          }
        ],
        generatedBy: '系统',
        teacherComments: '本周表现良好，继续保持。',
        parentFeedback: {
          read: true,
          comments: '已收到报告，谢谢老师。',
          readDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // 3天前
        },
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5天前
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5天前
      };
      
      learningAnalytics.push(monthlyReport, weeklyReport);
    }
    
    // 批量插入数据
    const existingCount = await LearningAnalytic.countDocuments();
    if (existingCount === 0) {
      await LearningAnalytic.insertMany(learningAnalytics);
      console.log(`成功创建 ${learningAnalytics.length} 条学习分析报告`);
    } else {
      console.log('学习分析报告数据已存在，跳过创建');
    }
  } catch (error) {
    console.error('创建学习分析报告种子数据时出错：', error);
    throw error;
  }
};