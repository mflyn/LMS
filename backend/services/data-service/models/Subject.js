const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 学科模型
 * 用于管理学科信息和知识点体系
 */
const SubjectSchema = new Schema({
  name: {
    type: String,
    required: true,
    enum: ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育', '综合'],
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String
  },
  grade: {
    type: String,
    enum: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
    required: true
  },
  knowledgePoints: [{
    name: {
      type: String,
      required: true
    },
    code: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    parentCode: {
      type: String,
      default: null
    },
    level: {
      type: Number,
      default: 1
    },
    order: {
      type: Number,
      default: 0
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
});

// 更新时间中间件
SubjectSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 添加方法获取知识点树
SubjectSchema.methods.getKnowledgePointTree = function() {
  const points = this.knowledgePoints;
  const tree = [];
  const map = {};
  
  // 首先创建所有节点的映射
  points.forEach(point => {
    map[point.code] = {
      ...point.toObject(),
      children: []
    };
  });
  
  // 构建树结构
  points.forEach(point => {
    if (point.parentCode && map[point.parentCode]) {
      map[point.parentCode].children.push(map[point.code]);
    } else {
      tree.push(map[point.code]);
    }
  });
  
  return tree;
};

module.exports = mongoose.model('Subject', SubjectSchema);