const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ResourceSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  subject: {
    type: String,
    required: true,
    enum: ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育', '综合']
  },
  grade: {
    type: String,
    required: true,
    enum: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级']
  },
  type: {
    type: String,
    required: true,
    enum: ['教案', '课件', '习题', '视频', '音频', '图片', '文档', '其他']
  },
  tags: [{
    type: String
  }],
  file: {
    name: { type: String },
    path: { type: String },
    type: { type: String },
    size: { type: Number }
  },
  uploader: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  downloads: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Resource', ResourceSchema);