const Subject = require('../../models/Subject');

module.exports = async () => {
  try {
    // 检查是否已存在学科数据
    const existingSubjects = await Subject.countDocuments();
    if (existingSubjects > 0) {
      console.log('学科数据已存在，跳过创建');
      return;
    }

    // 小学语文学科知识点
    const chineseSubject = new Subject({
      name: '语文',
      code: 'chinese',
      description: '小学语文课程',
      grade: '一年级',
      knowledgePoints: [
        {
          name: '拼音',
          code: 'pinyin',
          description: '汉语拼音基础',
          level: 1,
          order: 1
        },
        {
          name: '声母',
          code: 'pinyin-shengmu',
          description: '声母的发音和书写',
          parentCode: 'pinyin',
          level: 2,
          order: 1
        },
        {
          name: '韵母',
          code: 'pinyin-yunmu',
          description: '韵母的发音和书写',
          parentCode: 'pinyin',
          level: 2,
          order: 2
        },
        {
          name: '阅读理解',
          code: 'reading',
          description: '阅读理解能力培养',
          level: 1,
          order: 2
        },
        {
          name: '写作',
          code: 'writing',
          description: '写作能力培养',
          level: 1,
          order: 3
        }
      ]
    });

    // 小学数学学科知识点
    const mathSubject = new Subject({
      name: '数学',
      code: 'math',
      description: '小学数学课程',
      grade: '一年级',
      knowledgePoints: [
        {
          name: '数与代数',
          code: 'numbers',
          description: '数的认识和运算',
          level: 1,
          order: 1
        },
        {
          name: '10以内的数',
          code: 'numbers-within-10',
          description: '10以内数的认识和加减法',
          parentCode: 'numbers',
          level: 2,
          order: 1
        },
        {
          name: '20以内的数',
          code: 'numbers-within-20',
          description: '20以内数的认识和加减法',
          parentCode: 'numbers',
          level: 2,
          order: 2
        },
        {
          name: '图形与几何',
          code: 'geometry',
          description: '图形的认识和基本几何知识',
          level: 1,
          order: 2
        },
        {
          name: '统计与概率',
          code: 'statistics',
          description: '简单的数据收集和分析',
          level: 1,
          order: 3
        }
      ]
    });

    // 小学英语学科知识点
    const englishSubject = new Subject({
      name: '英语',
      code: 'english',
      description: '小学英语课程',
      grade: '三年级',
      knowledgePoints: [
        {
          name: '字母',
          code: 'alphabet',
          description: '英文字母的认识和书写',
          level: 1,
          order: 1
        },
        {
          name: '单词',
          code: 'vocabulary',
          description: '基础词汇的学习',
          level: 1,
          order: 2
        },
        {
          name: '句型',
          code: 'sentences',
          description: '基本句型的学习和运用',
          level: 1,
          order: 3
        }
      ]
    });

    await chineseSubject.save();
    await mathSubject.save();
    await englishSubject.save();

    console.log('学科数据创建成功');
  } catch (error) {
    console.error('创建学科数据时出错：', error);
    throw error;
  }
};