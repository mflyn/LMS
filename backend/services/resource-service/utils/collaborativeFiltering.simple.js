/**
 * 计算两个用户评分的相似度（皮尔逊相关系数）
 * @param {Object} user1Ratings - 用户1的评分，格式: {resourceId: rating}
 * @param {Object} user2Ratings - 用户2的评分，格式: {resourceId: rating}
 * @returns {number} 相似度，范围[-1, 1]
 */
function calculateSimilarity(user1Ratings, user2Ratings) {
  // 找出两个用户共同评价的资源
  const commonResources = Object.keys(user1Ratings).filter(resourceId => 
    user2Ratings.hasOwnProperty(resourceId)
  );
  
  // 如果没有共同评价的资源，相似度为0
  if (commonResources.length === 0) {
    return 0;
  }
  
  // 计算评分均值
  const sum1 = commonResources.reduce((sum, resourceId) => sum + user1Ratings[resourceId], 0);
  const sum2 = commonResources.reduce((sum, resourceId) => sum + user2Ratings[resourceId], 0);
  const avg1 = sum1 / commonResources.length;
  const avg2 = sum2 / commonResources.length;
  
  // 计算皮尔逊相关系数
  let numerator = 0;
  let denominator1 = 0;
  let denominator2 = 0;
  
  commonResources.forEach(resourceId => {
    const diff1 = user1Ratings[resourceId] - avg1;
    const diff2 = user2Ratings[resourceId] - avg2;
    
    numerator += diff1 * diff2;
    denominator1 += diff1 * diff1;
    denominator2 += diff2 * diff2;
  });
  
  // 避免除以0
  if (denominator1 === 0 || denominator2 === 0) {
    return 0;
  }
  
  return numerator / Math.sqrt(denominator1 * denominator2);
}

/**
 * 为用户生成推荐
 * @param {Object} userRatings - 所有用户的评分，格式: {userId: {resourceId: rating}}
 * @param {string} targetUser - 目标用户ID
 * @returns {Array} 推荐资源列表，按预测评分降序排序
 */
function getRecommendations(userRatings, targetUser) {
  // 如果目标用户不存在，返回空数组
  if (!userRatings[targetUser]) {
    return [];
  }
  
  // 计算目标用户与其他用户的相似度
  const similarities = {};
  const targetUserRatings = userRatings[targetUser];
  
  for (const userId in userRatings) {
    if (userId !== targetUser) {
      similarities[userId] = calculateSimilarity(targetUserRatings, userRatings[userId]);
    }
  }
  
  // 获取目标用户未评分的资源
  const unratedResources = new Set();
  
  for (const userId in userRatings) {
    if (userId !== targetUser) {
      for (const resourceId in userRatings[userId]) {
        if (!targetUserRatings.hasOwnProperty(resourceId)) {
          unratedResources.add(resourceId);
        }
      }
    }
  }
  
  // 计算预测评分
  const predictions = [];
  
  unratedResources.forEach(resourceId => {
    let weightedSum = 0;
    let similaritySum = 0;
    
    for (const userId in userRatings) {
      if (userId !== targetUser && userRatings[userId].hasOwnProperty(resourceId)) {
        const similarity = similarities[userId];
        
        // 只考虑正相关的用户
        if (similarity > 0) {
          weightedSum += userRatings[userId][resourceId] * similarity;
          similaritySum += similarity;
        }
      }
    }
    
    // 如果有足够的相似用户，计算预测评分
    if (similaritySum > 0) {
      predictions.push({
        resource: resourceId,
        score: weightedSum / similaritySum
      });
    }
  });
  
  // 按预测评分降序排序
  return predictions.sort((a, b) => b.score - a.score);
}

module.exports = {
  calculateSimilarity,
  getRecommendations
};
