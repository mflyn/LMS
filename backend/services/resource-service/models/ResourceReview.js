const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ResourceReviewSchema = new Schema({
  resource: {
    type: Schema.Types.ObjectId,
    ref: 'Resource',
    required: true
  },
  reviewer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  comment: {
    type: String,
    default: ''
  },
  isRecommended: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 更新时间中间件和计算平均评分
ResourceReviewSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  try {
    // 获取资源ID
    const resourceId = this.resource;
    
    // 查找该资源的所有评论
    const Resource = mongoose.model('Resource');
    const allReviews = await mongoose.model('ResourceReview').find({ resource: resourceId });
    
    // 如果是新评论，需要加上当前评论
    let reviews = allReviews;
    if (this.isNew) {
      reviews = [...allReviews, this];
    } else {
      // 如果是更新评论，需要用当前评论替换旧评论
      reviews = allReviews.map(review => 
        review._id.equals(this._id) ? this : review
      );
    }
    
    // 计算平均评分
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
    
    // 更新资源的平均评分和评论数
    await Resource.findByIdAndUpdate(resourceId, {
      averageRating: parseFloat(averageRating.toFixed(1)),
      reviewCount: reviews.length
    });
  } catch (err) {
    console.error('更新资源平均评分失败:', err);
  }
  
  next();
});

// 删除评论时更新平均评分
ResourceReviewSchema.post('remove', async function() {
  try {
    // 获取资源ID
    const resourceId = this.resource;
    
    // 查找该资源的所有评论
    const Resource = mongoose.model('Resource');
    const reviews = await mongoose.model('ResourceReview').find({ resource: resourceId });
    
    // 计算平均评分
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
    
    // 更新资源的平均评分和评论数
    await Resource.findByIdAndUpdate(resourceId, {
      averageRating: parseFloat(averageRating.toFixed(1)),
      reviewCount: reviews.length
    });
  } catch (err) {
    console.error('删除评论后更新资源平均评分失败:', err);
  }
});

module.exports = mongoose.model('ResourceReview', ResourceReviewSchema);