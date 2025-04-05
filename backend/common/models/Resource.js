const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * 学习资源模型
 * 用于存储系统中的学习资源信息
 */
const resourceSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['文档', '视频', '音频', '图片', '链接', '习题', '其他'],
    default: '文档'
  },
  url: {
    type: String,
    trim: true
  },
  filePath: {
    type: String,
    trim: true
  },
  fileSize: {
    type: Number,
    min: 0
  },
  format: {
    type: String,
    trim: true
  },
  duration: {
    type: Number,
    min: 0
  },
  thumbnail: {
    type: String,
    trim: true
  },
  author: {
    type: String,
    trim: true
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subjects: [{
    type: Schema.Types.ObjectId,
    ref: 'Subject'
  }],
  grade: {
    type: Number,
    min: 1,
    max: 6
  },
  knowledgePoints: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true
  }],
  difficulty: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  accessCount: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'rejected'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 创建索引
resourceSchema.index({ title: 'text', description: 'text', tags: 'text' });
resourceSchema.index({ subjects: 1 });
resourceSchema.index({ grade: 1 });
resourceSchema.index({ type: 1 });
resourceSchema.index({ uploadedBy: 1 });
resourceSchema.index({ 'rating.average': -1 });
resourceSchema.index({ accessCount: -1 });

// 添加静态方法获取特定科目的资源
resourceSchema.statics.findBySubject = function(subjectId) {
  return this.find({ subjects: subjectId });
};

// 添加静态方法获取特定年级的资源
resourceSchema.statics.findByGrade = function(grade) {
  return this.find({ grade });
};

// 添加静态方法搜索资源
resourceSchema.statics.search = function(query, filters = {}) {
  const searchQuery = {};
  
  // 添加文本搜索
  if (query && query.trim()) {
    searchQuery.$text = { $search: query };
  }
  
  // 添加过滤条件
  if (filters.type) searchQuery.type = filters.type;
  if (filters.grade) searchQuery.grade = filters.grade;
  if (filters.subject) searchQuery.subjects = filters.subject;
  if (filters.difficulty) searchQuery.difficulty = filters.difficulty;
  
  // 只返回公开的和活跃的资源
  searchQuery.isPublic = true;
  searchQuery.status = 'active';
  
  return this.find(searchQuery)
    .sort({ 'rating.average': -1, accessCount: -1 });
};

// 添加方法更新资源的访问计数
resourceSchema.methods.incrementAccessCount = async function() {
  this.accessCount += 1;
  return this.save();
};

// 添加方法更新资源的评分
resourceSchema.methods.updateRating = async function(newRating) {
  const oldTotal = this.rating.average * this.rating.count;
  this.rating.count += 1;
  this.rating.average = (oldTotal + newRating) / this.rating.count;
  return this.save();
};

const Resource = mongoose.model('Resource', resourceSchema);

module.exports = Resource;