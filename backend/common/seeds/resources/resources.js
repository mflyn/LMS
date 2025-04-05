const Resource = require('../../models/Resource');

module.exports = async () => {
  try {
    const resources = [
      {
        title: '一年级语文教材',
        type: 'textbook',
        courseId: '语文',
        grade: '一年级',
        description: '小学一年级语文教材电子版',
        url: '/resources/textbooks/chinese-grade1.pdf',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: '一年级数学练习题',
        type: 'exercise',
        courseId: '数学',
        grade: '一年级',
        description: '小学一年级数学练习题集',
        url: '/resources/exercises/math-grade1.pdf',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: '二年级英语视频课程',
        type: 'video',
        courseId: '英语',
        grade: '二年级',
        description: '小学二年级英语视频教学课程',
        url: '/resources/videos/english-grade2.mp4',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const resource of resources) {
      const existingResource = await Resource.findOne({ 
        title: resource.title,
        courseId: resource.courseId
      });
      if (!existingResource) {
        await Resource.create(resource);
        console.log(`学习资源 ${resource.title} 创建成功`);
      } else {
        console.log(`学习资源 ${resource.title} 已存在，跳过创建`);
      }
    }
  } catch (error) {
    console.error('创建学习资源数据时出错：', error);
    throw error;
  }
}; 