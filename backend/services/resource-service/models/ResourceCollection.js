const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ResourceCollectionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resource: {
    type: Schema.Types.ObjectId,
    ref: 'Resource',
    required: true
  },
  collectionName: {
    type: String,
    default: '默认收藏夹'
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 创建复合索引确保用户不会重复收藏同一资源
ResourceCollectionSchema.index({ user: 1, resource: 1 }, { unique: true });

module.exports = mongoose.model('ResourceCollection', ResourceCollectionSchema);