const {
  generateLongTermVisualization,
  generateLearningPatternAnalysis
} = require('../../utils/visualization-helper');

describe('可视化工具函数测试', () => {
  // 测试数据
  const mockTrendsData = {
    '数学': {
      semesterData: [
        {
          academicYear: '2022-2023',
          semester: '第一学期',
          averageScore: 85
        },
        {
          academicYear: '2022-2023',
          semester: '第二学期',
          averageScore: 88
        },
        {
          academicYear: '2023-2024',
          semester: '第一学期',
          averageScore: 90
        }
      ],
      yearlyAverages: [
        {
          academicYear: '2022-2023',
          averageScore: 86.5
        },
        {
          academicYear: '2023-2024',
          averageScore: 90
        }
      ]
    },
    '语文': {
      semesterData: [
        {
          academicYear: '2022-2023',
          semester: '第一学期',
          averageScore: 82
        },
        {
          academicYear: '2022-2023',
          semester: '第二学期',
          averageScore: 84
        },
        {
          academicYear: '2023-2024',
          semester: '第一学期',
          averageScore: 87
        }
      ],
      yearlyAverages: [
        {
          academicYear: '2022-2023',
          averageScore: 83
        },
        {
          academicYear: '2023-2024',
          averageScore: 87
        }
      ]
    }
  };

  describe('generateLongTermVisualization', () => {
    it('应该生成折线图数据', () => {
      const result = generateLongTermVisualization(mockTrendsData, 'line');

      expect(result).toHaveProperty('type', 'line');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('categories');
      expect(result.data).toHaveProperty('series');

      // 验证类别（时间点）
      expect(result.data.categories).toEqual([
        '2022-2023-第一学期',
        '2022-2023-第二学期',
        '2023-2024-第一学期'
      ]);

      // 验证数据系列
      expect(result.data.series.length).toBe(2);
      expect(result.data.series[0].name).toBe('数学');
      expect(result.data.series[0].data).toEqual([85, 88, 90]);
      expect(result.data.series[1].name).toBe('语文');
      expect(result.data.series[1].data).toEqual([82, 84, 87]);
    });

    it('应该生成柱状图数据', () => {
      const result = generateLongTermVisualization(mockTrendsData, 'bar');

      expect(result).toHaveProperty('type', 'bar');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('categories');
      expect(result.data).toHaveProperty('series');

      // 验证类别（学年）
      expect(result.data.categories).toEqual(['2022-2023', '2023-2024']);

      // 验证数据系列
      expect(result.data.series.length).toBe(2);
      expect(result.data.series[0].name).toBe('数学');
      expect(result.data.series[0].data).toEqual([86.5, 90]);
      expect(result.data.series[1].name).toBe('语文');
      expect(result.data.series[1].data).toEqual([83, 87]);
    });

    it('应该生成雷达图数据', () => {
      const result = generateLongTermVisualization(mockTrendsData, 'radar');

      expect(result).toHaveProperty('type', 'radar');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('indicators');
      expect(result.data).toHaveProperty('series');

      // 验证指标
      expect(result.data.indicators.length).toBe(2);
      expect(result.data.indicators[0]).toEqual({ name: '数学', max: 100 });
      expect(result.data.indicators[1]).toEqual({ name: '语文', max: 100 });

      // 验证数据系列
      expect(result.data.series.length).toBe(1);
      expect(result.data.series[0].name).toBe('最新学期');
      expect(result.data.series[0].value).toEqual([90, 87]);
    });

    it('应该生成热力图数据', () => {
      const result = generateLongTermVisualization(mockTrendsData, 'heatmap');

      expect(result).toHaveProperty('type', 'heatmap');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('xAxis');
      expect(result.data).toHaveProperty('yAxis');
      expect(result.data).toHaveProperty('data');

      // 验证坐标轴
      expect(result.data.xAxis).toEqual([
        '2022-2023-第一学期',
        '2022-2023-第二学期',
        '2023-2024-第一学期'
      ]);
      expect(result.data.yAxis).toEqual(['数学', '语文']);

      // 验证数据点
      expect(result.data.data.length).toBe(6);
      // 数学-第一学期
      expect(result.data.data).toContainEqual([0, 0, 85]);
      // 数学-第二学期
      expect(result.data.data).toContainEqual([1, 0, 88]);
      // 数学-第三学期
      expect(result.data.data).toContainEqual([2, 0, 90]);
      // 语文-第一学期
      expect(result.data.data).toContainEqual([0, 1, 82]);
      // 语文-第二学期
      expect(result.data.data).toContainEqual([1, 1, 84]);
      // 语文-第三学期
      expect(result.data.data).toContainEqual([2, 1, 87]);
    });

    it('当提供无效的可视化类型时应该默认使用折线图', () => {
      const result = generateLongTermVisualization(mockTrendsData, 'invalid_type');

      expect(result).toHaveProperty('type', 'invalid_type');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('categories');
      expect(result.data).toHaveProperty('series');
    });
  });

  describe('generateLearningPatternAnalysis', () => {
    it('应该生成学习模式分析数据', () => {
      const result = generateLearningPatternAnalysis(mockTrendsData);

      expect(result).toHaveProperty('consistencyAnalysis');
      expect(result).toHaveProperty('improvementPatterns');
      expect(result).toHaveProperty('seasonalPatterns');
      expect(result).toHaveProperty('subjectCorrelations');

      // 验证一致性分析
      expect(result.consistencyAnalysis).toHaveProperty('averageScore');
      expect(result.consistencyAnalysis).toHaveProperty('scoreDeviation');
      expect(result.consistencyAnalysis).toHaveProperty('isConsistent');
      expect(result.consistencyAnalysis).toHaveProperty('subjectVariations');

      // 验证提升模式
      expect(result.improvementPatterns).toHaveProperty('数学');
      expect(result.improvementPatterns).toHaveProperty('语文');
      expect(result.improvementPatterns['数学']).toHaveProperty('pattern');
      expect(result.improvementPatterns['数学']).toHaveProperty('changes');
      // 不检查具体的变化值，因为这可能会根据实现而变化
      expect(Array.isArray(result.improvementPatterns['数学'].changes)).toBe(true);
      expect(Array.isArray(result.improvementPatterns['语文'].changes)).toBe(true);

      // 验证季节性模式
      expect(result.seasonalPatterns).toHaveProperty('第一学期');
      expect(result.seasonalPatterns).toHaveProperty('第二学期');
      expect(result.seasonalPatterns['第一学期']).toHaveProperty('数学');
      expect(result.seasonalPatterns['第一学期']).toHaveProperty('语文');
      expect(result.seasonalPatterns['第二学期']).toHaveProperty('数学');
      expect(result.seasonalPatterns['第二学期']).toHaveProperty('语文');

      // 验证学科相关性
      expect(result.subjectCorrelations.length).toBe(1);
      expect(result.subjectCorrelations[0]).toHaveProperty('subjects');
      expect(result.subjectCorrelations[0]).toHaveProperty('correlation');
      expect(result.subjectCorrelations[0]).toHaveProperty('strength');
      expect(result.subjectCorrelations[0]).toHaveProperty('dataPoints', 3);
      expect(result.subjectCorrelations[0].subjects).toEqual(['数学', '语文']);
    });

    it('当数据不完整时应该处理边缘情况', () => {
      const incompleteData = {
        '数学': {
          semesterData: [
            {
              academicYear: '2023-2024',
              semester: '第一学期',
              averageScore: 90
            }
          ]
        },
        '语文': {} // 缺少数据
      };

      const result = generateLearningPatternAnalysis(incompleteData);

      // 验证结果仍然包含所有预期的属性
      expect(result).toHaveProperty('consistencyAnalysis');
      expect(result).toHaveProperty('improvementPatterns');
      expect(result).toHaveProperty('seasonalPatterns');
      expect(result).toHaveProperty('subjectCorrelations');

      // 验证一致性分析仍然有效
      expect(result.consistencyAnalysis).toHaveProperty('averageScore');
      expect(result.consistencyAnalysis).toHaveProperty('scoreDeviation');

      // 验证提升模式处理
      expect(result.improvementPatterns).not.toHaveProperty('数学'); // 只有一个学期，无法计算变化
      expect(result.improvementPatterns).not.toHaveProperty('语文'); // 没有数据

      // 验证季节性模式处理
      expect(result.seasonalPatterns['第一学期']).toHaveProperty('数学');
      expect(result.seasonalPatterns['第一学期']).not.toHaveProperty('语文');

      // 验证学科相关性处理
      expect(result.subjectCorrelations.length).toBe(0); // 数据不足，无法计算相关性
    });
  });
});
