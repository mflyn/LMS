const mongoose = require('mongoose');
const dotenv = require('dotenv');
const app = require('./app');

// 加载环境变量
dotenv.config();

// 获取日志记录器
const logger = app.locals.logger;

// 连接到MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('MongoDB连接成功');
})
.catch((err) => {
  logger.error('MongoDB连接失败:', err.message);
});

// 以下是旧的路由处理方式，将逐步迁移到路由模块中
// 获取资源列表
app.get('/api/resources-old', async (req, res) => {
  try {
    const { subject, grade, type, keyword, limit = 20, skip = 0 } = req.query;

    const query = {};

    if (subject) query.subject = subject;
    if (grade) query.grade = grade;
    if (type) query.type = type;
    if (keyword) {
      query.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { tags: { $regex: keyword, $options: 'i' } }
      ];
    }

    const resources = await Resource.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('uploader', 'name role');

    const total = await Resource.countDocuments(query);

    res.json({
      data: resources,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      }
    });
  } catch (err) {
    logger.error('获取资源列表失败:', err);
    res.status(500).json({ message: '获取资源列表失败', error: err.message });
  }
});

// 获取单个资源
app.get('/api/resources/:id', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id)
      .populate('uploader', 'name role');

    if (!resource) {
      return res.status(404).json({ message: '资源不存在' });
    }

    res.json(resource);
  } catch (err) {
    logger.error('获取资源失败:', err);
    res.status(500).json({ message: '获取资源失败', error: err.message });
  }
});

// 上传资源
app.post('/api/resources', app.locals.upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请上传文件' });
    }

    const { title, description, subject, grade, type, tags } = req.body;

    if (!title || !subject || !grade || !type) {
      return res.status(400).json({ message: '标题、学科、年级和类型不能为空' });
    }

    const resource = new Resource({
      title,
      description,
      subject,
      grade,
      type,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      file: {
        name: req.file.originalname,
        path: `/uploads/${req.file.filename}`,
        type: req.file.mimetype,
        size: req.file.size
      },
      uploader: req.body.uploaderId,
      downloads: 0
    });

    await resource.save();

    res.status(201).json(resource);
  } catch (err) {
    logger.error('上传资源失败:', err);
    res.status(500).json({ message: '上传资源失败', error: err.message });
  }
});

// 下载资源
app.get('/api/resources/:id/download', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({ message: '资源不存在' });
    }

    // 更新下载次数
    resource.downloads += 1;
    await resource.save();

    // 获取文件的绝对路径
    const filePath = path.join(__dirname, resource.file.path);

    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(resource.file.name)}`);
    res.setHeader('Content-Type', resource.file.type);

    // 发送文件
    res.sendFile(filePath);
  } catch (err) {
    logger.error('下载资源失败:', err);
    res.status(500).json({ message: '下载资源失败', error: err.message });
  }
});

// 删除资源
app.delete('/api/resources/:id', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({ message: '资源不存在' });
    }

    // 删除文件
    const filePath = path.join(__dirname, resource.file.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 删除数据库记录
    await Resource.findByIdAndDelete(req.params.id);

    res.json({ message: '资源删除成功' });
  } catch (err) {
    logger.error('删除资源失败:', err);
    res.status(500).json({ message: '删除资源失败', error: err.message });
  }
});

// 获取资源评论列表
app.get('/api/resources/:resourceId/reviews', async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    const reviews = await ResourceReview.find({ resource: resourceId })
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('reviewer', 'name role');

    const total = await ResourceReview.countDocuments({ resource: resourceId });

    // 计算平均评分
    const avgRating = await ResourceReview.aggregate([
      { $match: { resource: mongoose.Types.ObjectId(resourceId) } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);

    res.json({
      data: reviews,
      stats: {
        total,
        avgRating: avgRating.length > 0 ? avgRating[0].avgRating : 0,
      },
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      }
    });
  } catch (err) {
    logger.error('获取资源评论失败:', err);
    res.status(500).json({ message: '获取资源评论失败', error: err.message });
  }
});

// 添加资源评论
app.post('/api/resources/:resourceId/reviews', async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { reviewer, rating, comment, isRecommended } = req.body;

    if (!reviewer || !rating) {
      return res.status(400).json({ message: '评论者和评分不能为空' });
    }

    // 验证评分范围
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: '评分必须在1-5之间' });
    }

    // 检查资源是否存在
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      return res.status(404).json({ message: '资源不存在' });
    }

    // 检查用户是否已经评论过该资源
    const existingReview = await ResourceReview.findOne({
      resource: resourceId,
      reviewer
    });

    if (existingReview) {
      return res.status(400).json({ message: '您已经评论过该资源' });
    }

    const review = new ResourceReview({
      resource: resourceId,
      reviewer,
      rating,
      comment: comment || '',
      isRecommended: isRecommended !== undefined ? isRecommended : true
    });

    await review.save();

    res.status(201).json(review);
  } catch (err) {
    logger.error('添加资源评论失败:', err);
    res.status(500).json({ message: '添加资源评论失败', error: err.message });
  }
});

// 更新资源评论
app.put('/api/resources/:resourceId/reviews/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment, isRecommended } = req.body;

    const updateData = {};

    if (rating) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: '评分必须在1-5之间' });
      }
      updateData.rating = rating;
    }

    if (comment !== undefined) updateData.comment = comment;
    if (isRecommended !== undefined) updateData.isRecommended = isRecommended;

    const review = await ResourceReview.findByIdAndUpdate(
      reviewId,
      updateData,
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ message: '评论不存在' });
    }

    res.json(review);
  } catch (err) {
    logger.error('更新资源评论失败:', err);
    res.status(500).json({ message: '更新资源评论失败', error: err.message });
  }
});

// 删除资源评论
app.delete('/api/resources/:resourceId/reviews/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await ResourceReview.findByIdAndDelete(reviewId);

    if (!review) {
      return res.status(404).json({ message: '评论不存在' });
    }

    res.json({ message: '评论删除成功' });
  } catch (err) {
    logger.error('删除资源评论失败:', err);
    res.status(500).json({ message: '删除资源评论失败', error: err.message });
  }
});

// 获取用户收藏的资源列表
app.get('/api/users/:userId/collections', async (req, res) => {
  try {
    const { userId } = req.params;
    const { collectionName, limit = 20, skip = 0 } = req.query;

    const query = { user: userId };
    if (collectionName) query.collectionName = collectionName;

    const collections = await ResourceCollection.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate({
        path: 'resource',
        select: 'title description subject grade type tags file uploader downloads createdAt'
      });

    const total = await ResourceCollection.countDocuments(query);

    // 获取用户的收藏夹列表
    const collectionNames = await ResourceCollection.distinct('collectionName', { user: userId });

    res.json({
      data: collections,
      collectionNames,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      }
    });
  } catch (err) {
    logger.error('获取用户收藏列表失败:', err);
    res.status(500).json({ message: '获取用户收藏列表失败', error: err.message });
  }
});

// 收藏资源
app.post('/api/resources/:resourceId/collect', async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { userId, collectionName, notes } = req.body;

    if (!userId) {
      return res.status(400).json({ message: '用户ID不能为空' });
    }

    // 检查资源是否存在
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      return res.status(404).json({ message: '资源不存在' });
    }

    // 检查是否已经收藏
    const existingCollection = await ResourceCollection.findOne({
      user: userId,
      resource: resourceId
    });

    if (existingCollection) {
      return res.status(400).json({ message: '您已经收藏过该资源' });
    }

    const collection = new ResourceCollection({
      user: userId,
      resource: resourceId,
      collectionName: collectionName || '默认收藏夹',
      notes: notes || ''
    });

    await collection.save();

    res.status(201).json(collection);
  } catch (err) {
    logger.error('收藏资源失败:', err);
    res.status(500).json({ message: '收藏资源失败', error: err.message });
  }
});

// 取消收藏
app.delete('/api/resources/:resourceId/collect', async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: '用户ID不能为空' });
    }

    const collection = await ResourceCollection.findOneAndDelete({
      user: userId,
      resource: resourceId
    });

    if (!collection) {
      return res.status(404).json({ message: '收藏记录不存在' });
    }

    res.json({ message: '取消收藏成功' });
  } catch (err) {
    logger.error('取消收藏失败:', err);
    res.status(500).json({ message: '取消收藏失败', error: err.message });
  }
});

// 更新收藏信息
app.put('/api/collections/:collectionId', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { collectionName, notes } = req.body;

    const updateData = {};
    if (collectionName) updateData.collectionName = collectionName;
    if (notes !== undefined) updateData.notes = notes;

    const collection = await ResourceCollection.findByIdAndUpdate(
      collectionId,
      updateData,
      { new: true }
    );

    if (!collection) {
      return res.status(404).json({ message: '收藏记录不存在' });
    }

    res.json(collection);
  } catch (err) {
    logger.error('更新收藏信息失败:', err);
    res.status(500).json({ message: '更新收藏信息失败', error: err.message });
  }
});

// 启动服务器
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  logger.info(`学习资源服务运行在端口 ${PORT}`);
});