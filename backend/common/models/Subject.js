const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * 学科模型
 * 用于存储系统中的学科信息
 */
const subjectSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  grade: {
    type: Number,
    required: true,
    min: 1,
    max: 6
  },
  semester: {
    type: String,
    enum: ['第一学期', '第二学期', '全年'],
    default: '全年'
  },
  creditHours: {
    type: Number,
    default: 0
  },
  isRequired: {
    type: Boolean,
    default: true
  },
  knowledgePoints: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    difficulty: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    parentPoint: {
      type: Schema.Types.ObjectId,
      ref: 'KnowledgePoint'
    }
  }],
  textbooks: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    author: {
      type: String,
      trim: true
    },
    publisher: {
      type: String,
      trim: true
    },
    isbn: {
      type: String,
      trim: true
    },
    isRequired: {
      type: Boolean,
      default: true
    }
  }],
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
subjectSchema.index({ name: 1 }, { unique: true });
subjectSchema.index({ code: 1 }, { unique: true });
subjectSchema.index({ grade: 1 });

// 添加静态方法获取特定年级的所有学科
subjectSchema.statics.findByGrade = function(grade) {
  return this.find({ grade });
};

// 添加静态方法获取学科的知识点树
subjectSchema.statics.getKnowledgePointTree = async function(subjectId) {
  const subject = await this.findById(subjectId);
  if (!subject) return null;
  
  // 构建知识点树
  const points = subject.knowledgePoints;
  const rootPoints = points.filter(p => !p.parentPoint);
  
  const buildTree = (point) => {
    const children = points.filter(p => p.parentPoint && p.parentPoint.toString() === point._id.toString());
    return {
      ...point.toObject(),
      children: children.map(buildTree)
    };
  };
  
  return rootPoints.map(buildTree);
};

const Subject = mongoose.model('Subject', subjectSchema);

module.exports = Subject;