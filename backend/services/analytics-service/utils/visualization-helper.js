/**
 * 可视化数据处理工具
 * 用于处理和转换数据以适应前端可视化需求
 */

/**
 * 生成长期趋势可视化数据
 * @param {Object} trendsData - 原始趋势数据
 * @param {String} visualType - 可视化类型 (line, bar, radar, heatmap)
 * @returns {Object} 格式化的可视化数据
 */
function generateLongTermVisualization(trendsData, visualType = 'line') {
  // 基础数据提取
  const subjects = Object.keys(trendsData);
  const result = {
    type: visualType,
    data: {}
  };

  switch (visualType) {
    case 'line':
      result.data = generateLineChartData(trendsData, subjects);
      break;
    case 'bar':
      result.data = generateBarChartData(trendsData, subjects);
      break;
    case 'radar':
      result.data = generateRadarChartData(trendsData, subjects);
      break;
    case 'heatmap':
      result.data = generateHeatmapData(trendsData, subjects);
      break;
    default:
      result.data = generateLineChartData(trendsData, subjects);
  }

  return result;
}

/**
 * 生成折线图数据
 * @param {Object} trendsData - 原始趋势数据
 * @param {Array} subjects - 学科列表
 * @returns {Object} 折线图数据
 */
function generateLineChartData(trendsData, subjects) {
  const result = {
    categories: [],
    series: []
  };

  // 提取所有时间点（学期）
  const allTimePoints = new Set();
  subjects.forEach(subject => {
    if (trendsData[subject] && trendsData[subject].semesterData) {
      trendsData[subject].semesterData.forEach(semester => {
        allTimePoints.add(`${semester.academicYear}-${semester.semester}`);
      });
    }
  });

  // 排序时间点
  result.categories = Array.from(allTimePoints).sort();

  // 为每个学科生成数据系列
  subjects.forEach(subject => {
    if (!trendsData[subject] || !trendsData[subject].semesterData) return;

    const seriesData = {
      name: subject,
      data: []
    };

    // 为每个时间点找到对应的分数
    result.categories.forEach(timePoint => {
      const [year, semester] = timePoint.split('-');
      const semesterData = trendsData[subject].semesterData.find(
        s => `${s.academicYear}-${s.semester}` === timePoint
      );

      seriesData.data.push(semesterData ? semesterData.averageScore : null);
    });

    result.series.push(seriesData);
  });

  return result;
}

/**
 * 生成柱状图数据
 * @param {Object} trendsData - 原始趋势数据
 * @param {Array} subjects - 学科列表
 * @returns {Object} 柱状图数据
 */
function generateBarChartData(trendsData, subjects) {
  // 提取年度平均分数据
  const result = {
    categories: [],
    series: []
  };

  // 提取所有学年
  const allYears = new Set();
  subjects.forEach(subject => {
    if (trendsData[subject] && trendsData[subject].yearlyAverages) {
      trendsData[subject].yearlyAverages.forEach(yearly => {
        allYears.add(yearly.academicYear);
      });
    }
  });

  // 排序学年
  result.categories = Array.from(allYears).sort();

  // 为每个学科生成数据系列
  subjects.forEach(subject => {
    if (!trendsData[subject] || !trendsData[subject].yearlyAverages) return;

    const seriesData = {
      name: subject,
      data: []
    };

    // 为每个学年找到对应的平均分
    result.categories.forEach(year => {
      const yearData = trendsData[subject].yearlyAverages.find(
        y => y.academicYear === year
      );

      seriesData.data.push(yearData ? yearData.averageScore : null);
    });

    result.series.push(seriesData);
  });

  return result;
}

/**
 * 生成雷达图数据
 * @param {Object} trendsData - 原始趋势数据
 * @param {Array} subjects - 学科列表
 * @returns {Object} 雷达图数据
 */
function generateRadarChartData(trendsData, subjects) {
  // 使用最新学期的数据生成雷达图
  const result = {
    indicators: subjects.map(subject => ({ name: subject, max: 100 })),
    series: []
  };

  // 找到最新的学期数据
  const latestData = {
    name: '最新学期',
    value: []
  };

  subjects.forEach(subject => {
    if (!trendsData[subject] || !trendsData[subject].semesterData || trendsData[subject].semesterData.length === 0) {
      latestData.value.push(0);
      return;
    }

    // 按时间排序并获取最新的学期数据
    const sortedSemesters = [...trendsData[subject].semesterData].sort((a, b) => {
      if (a.academicYear !== b.academicYear) {
        return b.academicYear.localeCompare(a.academicYear);
      }
      return b.semester.localeCompare(a.semester);
    });

    latestData.value.push(sortedSemesters[0].averageScore);
  });

  result.series.push(latestData);

  return result;
}

/**
 * 生成热力图数据
 * @param {Object} trendsData - 原始趋势数据
 * @param {Array} subjects - 学科列表
 * @returns {Object} 热力图数据
 */
function generateHeatmapData(trendsData, subjects) {
  const result = {
    xAxis: [], // 学期
    yAxis: subjects, // 学科
    data: []
  };

  // 提取所有时间点（学期）
  const allTimePoints = new Set();
  subjects.forEach(subject => {
    if (trendsData[subject] && trendsData[subject].semesterData) {
      trendsData[subject].semesterData.forEach(semester => {
        allTimePoints.add(`${semester.academicYear}-${semester.semester}`);
      });
    }
  });

  // 排序时间点
  result.xAxis = Array.from(allTimePoints).sort();

  // 生成热力图数据
  subjects.forEach((subject, subjectIndex) => {
    if (!trendsData[subject] || !trendsData[subject].semesterData) return;

    result.xAxis.forEach((timePoint, timeIndex) => {
      const [year, semester] = timePoint.split('-');
      const semesterData = trendsData[subject].semesterData.find(
        s => `${s.academicYear}-${s.semester}` === timePoint
      );

      if (semesterData) {
        result.data.push([timeIndex, subjectIndex, semesterData.averageScore]);
      }
    });
  });

  return result;
}

/**
 * 生成学习模式分析数据
 * @param {Object} trendsData - 原始趋势数据
 * @returns {Object} 学习模式分析
 */
function generateLearningPatternAnalysis(trendsData) {
  const subjects = Object.keys(trendsData);
  const result = {
    consistencyAnalysis: {},
    improvementPatterns: {},
    seasonalPatterns: {},
    subjectCorrelations: []
  };

  // 一致性分析 - 检查学生在各学科的表现是否一致
  const latestScores = {};
  const scoreVariations = {};

  subjects.forEach(subject => {
    if (!trendsData[subject] || !trendsData[subject].semesterData || trendsData[subject].semesterData.length === 0) return;

    // 获取最新分数
    const sortedSemesters = [...trendsData[subject].semesterData].sort((a, b) => {
      if (a.academicYear !== b.academicYear) {
        return b.academicYear.localeCompare(a.academicYear);
      }
      return b.semester.localeCompare(a.semester);
    });

    latestScores[subject] = sortedSemesters[0].averageScore;

    // 计算分数变化
    if (trendsData[subject].semesterData.length > 1) {
      const scores = trendsData[subject].semesterData.map(s => s.averageScore);
      const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
      const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / scores.length;
      scoreVariations[subject] = Math.sqrt(variance); // 标准差
    } else {
      scoreVariations[subject] = 0;
    }
  });

  // 计算学科间的一致性
  const scoreValues = Object.values(latestScores);
  if (scoreValues.length > 0) {
    const avgScore = scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length;
    const scoreDeviation = Math.sqrt(
      scoreValues.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scoreValues.length
    );

    result.consistencyAnalysis = {
      averageScore: avgScore,
      scoreDeviation: scoreDeviation,
      isConsistent: scoreDeviation < 10, // 假设标准差小于10分表示一致
      subjectVariations: scoreVariations
    };
  }

  // 提升模式分析
  const improvementPatterns = {};
  subjects.forEach(subject => {
    if (!trendsData[subject] || !trendsData[subject].semesterData || trendsData[subject].semesterData.length < 2) return;

    const sortedSemesters = [...trendsData[subject].semesterData].sort((a, b) => {
      if (a.academicYear !== b.academicYear) {
        return a.academicYear.localeCompare(b.academicYear);
      }
      return a.semester.localeCompare(b.semester);
    });

    const scoreChanges = [];
    for (let i = 1; i < sortedSemesters.length; i++) {
      scoreChanges.push(sortedSemesters[i].averageScore - sortedSemesters[i-1].averageScore);
    }

    // 判断提升模式
    let pattern = 'irregular';
    const positiveChanges = scoreChanges.filter(change => change > 0).length;
    const negativeChanges = scoreChanges.filter(change => change < 0).length;

    if (positiveChanges === scoreChanges.length) {
      pattern = 'steady_improvement';
    } else if (negativeChanges === scoreChanges.length) {
      pattern = 'steady_decline';
    } else if (positiveChanges > negativeChanges && positiveChanges / scoreChanges.length >= 0.7) {
      pattern = 'overall_improvement';
    } else if (negativeChanges > positiveChanges && negativeChanges / scoreChanges.length >= 0.7) {
      pattern = 'overall_decline';
    } else {
      // 检查是否有明显的波动模式
      let hasPattern = true;
      for (let i = 1; i < scoreChanges.length; i++) {
        if ((scoreChanges[i] > 0 && scoreChanges[i-1] > 0) || 
            (scoreChanges[i] < 0 && scoreChanges[i-1] < 0)) {
          hasPattern = false;
          break;
        }
      }
      if (hasPattern && scoreChanges.length > 1) {
        pattern = 'fluctuating';
      }
    }

    improvementPatterns[subject] = {
      pattern,
      changes: scoreChanges
    };
  });

  result.improvementPatterns = improvementPatterns;

  // 季节性模式分析 - 检查是否在特定学期表现更好
  const semesterPerformance = {
    '第一学期': {},
    '第二学期': {}
  };

  subjects.forEach(subject => {
    if (!trendsData[subject] || !trendsData[subject].semesterData) return;

    // 按学期分组
    trendsData[subject].semesterData.forEach(semester => {
      if (!semesterPerformance[semester.semester][subject]) {
        semesterPerformance[semester.semester][subject] = [];
      }
      semesterPerformance[semester.semester][subject].push(semester.averageScore);
    });
  });

  // 计算每个学期的平均分
  Object.keys(semesterPerformance).forEach(semester => {
    const semesterData = {};
    
    Object.keys(semesterPerformance[semester]).forEach(subject => {
      const scores = semesterPerformance[semester][subject];
      if (scores.length > 0) {
        semesterData[subject] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      }
    });

    result.seasonalPatterns[semester] = semesterData;
  });

  // 学科相关性分析
  if (subjects.length > 1) {
    // 为每对学科计算相关性
    for (let i = 0; i < subjects.length; i++) {
      for (let j = i + 1; j < subjects.length; j++) {
        const subject1 = subjects[i];
        const subject2 = subjects[j];

        if (!trendsData[subject1] || !trendsData[subject1].semesterData || 
            !trendsData[subject2] || !trendsData[subject2].semesterData) continue;

        // 找到两个学科共同的学期
        const commonSemesters = new Map();
        
        trendsData[subject1].semesterData.forEach(semester => {
          const key = `${semester.academicYear}-${semester.semester}`;
          if (!commonSemesters.has(key)) {
            commonSemesters.set(key, { [subject1]: semester.averageScore });
          } else {
            commonSemesters.get(key)[subject1] = semester.averageScore;
          }
        });

        trendsData[subject2].semesterData.forEach(semester => {
          const key = `${semester.academicYear}-${semester.semester}`;
          if (commonSemesters.has(key)) {
            commonSemesters.get(key)[subject2] = semester.averageScore;
          }
        });

        // 提取共同学期的分数对
        const pairs = [];
        commonSemesters.forEach(data => {
          if (data[subject1] !== undefined && data[subject2] !== undefined) {
            pairs.push([data[subject1], data[subject2]]);
          }
        });

        // 至少需要3个数据点才能计算相关性
        if (pairs.length >= 3) {
          // 计算皮尔逊相关系数
          const correlation = calculateCorrelation(pairs);
          
          result.subjectCorrelations.push({
            subjects: [subject1, subject2],
            correlation: correlation,
            strength: getCorrelationStrength(correlation),
            dataPoints: pairs.length
          });
        }
      }
    }
  }

  return result;
}

/**
 * 计算皮尔逊相关系数
 * @param {Array} pairs - 数据点对数组 [[x1,y1], [x2,y2], ...]
 * @returns {Number} 相关系数
 */
function calculateCorrelation(pairs) {
  const n = pairs.length;
  if (n === 0) return 0;

  // 计算均值
  let sumX = 0, sumY = 0;
  for (const [x, y] of pairs) {
    sumX += x;
    sumY += y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  // 计算协方差和标准差
  let covXY = 0, varX = 0, varY = 0;
  for (const [x, y] of pairs) {
    const dX = x - meanX;
    const dY = y - meanY;
    covXY += dX * dY;
    varX += dX * dX;
    varY += dY * dY;
  }

  // 计算相关系数
  if (varX === 0 || varY === 0) return 0;
  return covXY / Math.sqrt(varX * varY);
}

/**
 * 获取相关性强度描述
 * @param {Number} correlation - 相关系数
 * @returns {String} 相关性强度描述
 */
function getCorrelationStrength(correlation) {
  const absCorr = Math.abs(correlation);
  if (absCorr >= 0.7) return correlation > 0 ? '强正相关' : '强负相关';
  if (absCorr >= 0.4) return correlation > 0 ? '中等正相关' : '中等负相关';
  if (absCorr >= 0.2) return correlation > 0 ? '弱正相关' : '弱负相关';
  return '几乎无相关';
}

module.exports = {
  generateLongTermVisualization,
  generateLearningPatternAnalysis
};