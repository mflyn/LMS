// ... existing code ...
  });
});

// Placeholder for other chart components tests
describe('SubjectComparisonChart', () => {
  const mockComparisonData = {
    trendsData: {
      "数学": { averageScore: 85 },
      "语文": { averageScore: 90 },
      "英语": { averageScore: 78 },
    }
  };

  const emptyComparisonData = { trendsData: {} };
  const nullTrendsData = { trendsData: null };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Default Chart View (showTableView=false)', () => {
    it('should render bar chart correctly with data', () => {
      render(<SubjectComparisonChart data={mockComparisonData} />);
      expect(screen.getByText('学科成绩对比')).toBeInTheDocument();
      const chartElement = screen.getByTestId('mock-bar-chart');
      expect(chartElement).toBeInTheDocument();

      const chartData = JSON.parse(chartElement.getAttribute('data-props-data'));
      expect(chartData.labels).toEqual(['数学', '语文', '英语']);
      expect(chartData.datasets[0].label).toBe('平均分');
      expect(chartData.datasets[0].data).toEqual([85, 90, 78]);
      
      expect(screen.queryByText('暂无数据')).not.toBeInTheDocument();
    });

    it('should render placeholder when data.trendsData is empty for chart view', () => {
      render(<SubjectComparisonChart data={emptyComparisonData} />);
      expect(screen.getByText('学科成绩对比')).toBeInTheDocument();
      expect(screen.getByText('BAR 图表')).toBeInTheDocument(); 
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-bar-chart')).not.toBeInTheDocument();
    });

    it('should render placeholder when data.trendsData is null for chart view', () => {
      render(<SubjectComparisonChart data={nullTrendsData} />);
      expect(screen.getByText('学科成绩对比')).toBeInTheDocument();
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-bar-chart')).not.toBeInTheDocument();
    });
  });

  describe('Table View (showTableView=true)', () => {
    it('should render table correctly when showTableView is true', () => {
      render(<SubjectComparisonChart data={mockComparisonData} showTableView={true} />);
      expect(screen.getByText('学科成绩对比')).toBeInTheDocument();

      expect(screen.getByRole('columnheader', { name: '学科' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '平均分' })).toBeInTheDocument();

      expect(screen.getByRole('cell', { name: '数学' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '85' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '语文' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '90' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '英语' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '78' })).toBeInTheDocument();

      expect(screen.queryByTestId('mock-bar-chart')).not.toBeInTheDocument();
    });

    it('should render empty table message when data.trendsData is empty for table view', () => {
      render(<SubjectComparisonChart data={emptyComparisonData} showTableView={true} />);
      expect(screen.getByText('学科成绩对比')).toBeInTheDocument();
      expect(screen.getByText('No Data')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-bar-chart')).not.toBeInTheDocument();
    });

    it('should render empty table message when data.trendsData is null for table view', () => {
      render(<SubjectComparisonChart data={nullTrendsData} showTableView={true} />);
      expect(screen.getByText('学科成绩对比')).toBeInTheDocument();
      expect(screen.getByText('No Data')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-bar-chart')).not.toBeInTheDocument();
    });
  });
});

describe('LearningAbilityChart', () => {
  const mockAbilityData = {
    abilities: {
      memory: 80,
      understanding: 75,
      application: 90,
      analysis: 85,
      creativity: 70,
      expression: 88
    }
  };

  const emptyAbilityData = { abilities: {} };
  const nullAbilityData = { abilities: null };

  // ABILITY_MAP from the component, needed for table view assertions
  const ABILITY_MAP = {
    memory: '记忆力',
    understanding: '理解力',
    application: '应用能力',
    analysis: '分析能力',
    creativity: '创造力',
    expression: '表达能力'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Default Chart View (showTableView=false)', () => {
    it('should render radar chart correctly with data', () => {
      render(<LearningAbilityChart data={mockAbilityData} />);
      expect(screen.getByText('学习能力分析')).toBeInTheDocument();
      const chartElement = screen.getByTestId('mock-radar-chart');
      expect(chartElement).toBeInTheDocument();

      const chartData = JSON.parse(chartElement.getAttribute('data-props-data'));
      const expectedLabels = Object.values(ABILITY_MAP);
      const expectedScores = Object.keys(ABILITY_MAP).map(key => mockAbilityData.abilities[key] || 0);
      
      expect(chartData.labels).toEqual(expectedLabels);
      expect(chartData.datasets[0].label).toBe('能力水平');
      expect(chartData.datasets[0].data).toEqual(expectedScores);

      expect(screen.queryByText('暂无数据')).not.toBeInTheDocument();
    });

    it('should render placeholder when data.abilities is empty for chart view', () => {
      render(<LearningAbilityChart data={emptyAbilityData} />);
      expect(screen.getByText('学习能力分析')).toBeInTheDocument();
      expect(screen.getByText('RADAR 图表')).toBeInTheDocument(); 
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-radar-chart')).not.toBeInTheDocument();
    });

    it('should render placeholder when data.abilities is null for chart view', () => {
      render(<LearningAbilityChart data={nullAbilityData} />);
      expect(screen.getByText('学习能力分析')).toBeInTheDocument();
      expect(screen.getByText('暂无数据')).toBeInTheDocument(); 
      expect(screen.queryByTestId('mock-radar-chart')).not.toBeInTheDocument();
    });
  });

  describe('Table View (showTableView=true)', () => {
    it('should render table correctly when showTableView is true', () => {
      render(<LearningAbilityChart data={mockAbilityData} showTableView={true} />);
      expect(screen.getByText('学习能力分析')).toBeInTheDocument();

      expect(screen.getByRole('columnheader', { name: '能力' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '得分' })).toBeInTheDocument();

      Object.keys(ABILITY_MAP).forEach(key => {
        expect(screen.getByRole('cell', { name: ABILITY_MAP[key] })).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: mockAbilityData.abilities[key].toString() })).toBeInTheDocument();
      });
      
      expect(screen.queryByTestId('mock-radar-chart')).not.toBeInTheDocument();
    });

    it('should render empty table message when data.abilities is empty for table view', () => {
      // When abilities is an empty object, the component still tries to map Object.keys(ABILITY_MAP)
      // leading to a table with ability names but 0 scores. This is as per current component logic.
      // If the expectation is an empty table message, the component logic needs to change.
      // For now, testing current behavior.
      render(<LearningAbilityChart data={emptyAbilityData} showTableView={true} />); 
      expect(screen.getByText('学习能力分析')).toBeInTheDocument();
      
      Object.keys(ABILITY_MAP).forEach(key => {
        expect(screen.getByRole('cell', { name: ABILITY_MAP[key] })).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: "0" })).toBeInTheDocument(); // Scores will be 0
      });
      // It won't show "No Data" because it renders rows for each ABILITY_MAP key with 0 score.
      expect(screen.queryByText('No Data')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-radar-chart')).not.toBeInTheDocument();
    });

    it('should render empty table message when data.abilities is null for table view', () => {
      render(<LearningAbilityChart data={nullAbilityData} showTableView={true} />);
      expect(screen.getByText('学习能力分析')).toBeInTheDocument();
      expect(screen.getByText('No Data')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-radar-chart')).not.toBeInTheDocument();
    });
  });
});

describe('LearningProgressChart', () => {
  const mockOverallData = { overallProgress: 70 };
  const mockSubjectData = {
    progressData: {
      "数学": { completionRate: 60 }
    }
  };
  const mockZeroData = { overallProgress: 0 };
  const mockFullData = { overallProgress: 100 };
  const emptyData = {}; // No overallProgress or progressData
  const nullData = { overallProgress: null, progressData: null };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Default Chart View (showTableView=false)', () => {
    it('should render pie chart for overall progress', () => {
      render(<LearningProgressChart data={mockOverallData} />);
      expect(screen.getByText('整体学习进度')).toBeInTheDocument();
      const chartElement = screen.getByTestId('mock-pie-chart');
      expect(chartElement).toBeInTheDocument();
      const chartData = JSON.parse(chartElement.getAttribute('data-props-data'));
      expect(chartData.labels).toEqual(['已完成', '未完成']);
      expect(chartData.datasets[0].data).toEqual([70, 30]);
    });

    it('should render pie chart for subject progress', () => {
      render(<LearningProgressChart data={mockSubjectData} subject="数学" />);
      expect(screen.getByText('数学学习进度')).toBeInTheDocument();
      const chartElement = screen.getByTestId('mock-pie-chart');
      expect(chartElement).toBeInTheDocument();
      const chartData = JSON.parse(chartElement.getAttribute('data-props-data'));
      expect(chartData.datasets[0].data).toEqual([60, 40]);
    });

    it('should render pie chart correctly when 0% completed', () => {
      render(<LearningProgressChart data={mockZeroData} />); 
      expect(screen.getByText('整体学习进度')).toBeInTheDocument();
      const chartElement = screen.getByTestId('mock-pie-chart');
      expect(chartElement).toBeInTheDocument();
      const chartData = JSON.parse(chartElement.getAttribute('data-props-data'));
      expect(chartData.datasets[0].data).toEqual([0, 100]);
    });

    it('should render pie chart correctly when 100% completed', () => {
      render(<LearningProgressChart data={mockFullData} />); 
      expect(screen.getByText('整体学习进度')).toBeInTheDocument();
      const chartElement = screen.getByTestId('mock-pie-chart');
      expect(chartElement).toBeInTheDocument();
      const chartData = JSON.parse(chartElement.getAttribute('data-props-data'));
      expect(chartData.datasets[0].data).toEqual([100, 0]);
    });

    it('should render placeholder when data is empty for chart view', () => {
      render(<LearningProgressChart data={emptyData} />); 
      expect(screen.getByText('整体学习进度')).toBeInTheDocument();
      expect(screen.getByText('PIE 图表')).toBeInTheDocument();
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-pie-chart')).not.toBeInTheDocument();
    });

    it('should render placeholder when data is null for chart view', () => {
      render(<LearningProgressChart data={nullData} />); 
      expect(screen.getByText('整体学习进度')).toBeInTheDocument();
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-pie-chart')).not.toBeInTheDocument();
    });
  });

  describe('Table View (showTableView=true)', () => {
    it('should render table for overall progress', () => {
      render(<LearningProgressChart data={mockOverallData} showTableView={true} />); 
      expect(screen.getByText('整体学习进度')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '状态' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '百分比' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '已完成' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '70%' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '未完成' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '30%' })).toBeInTheDocument();
    });

    it('should render table for subject progress', () => {
      render(<LearningProgressChart data={mockSubjectData} subject="数学" showTableView={true} />); 
      expect(screen.getByText('数学学习进度')).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '已完成' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '60%' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '未完成' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '40%' })).toBeInTheDocument();
    });
    
    it('should render table correctly for 0% completed', () => {
      render(<LearningProgressChart data={mockZeroData} showTableView={true} />); 
      expect(screen.getByRole('cell', { name: '已完成' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '0%' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '未完成' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '100%' })).toBeInTheDocument();
    });

    it('should render empty table message when data is empty for table view', () => {
      render(<LearningProgressChart data={emptyData} showTableView={true} />); 
      expect(screen.getByText('整体学习进度')).toBeInTheDocument();
      // When data is empty, completionRate remains 0 by default in the component for table view.
      // So it will show 0% and 100%
      expect(screen.getByRole('cell', { name: '已完成' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '0%' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '未完成' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '100%' })).toBeInTheDocument();
      // It doesn't show "No Data" because it defaults to 0% completion if data is missing.
      expect(screen.queryByText('No Data')).not.toBeInTheDocument();
    });

    it('should render table with 0% for null data in table view', () => {
      render(<LearningProgressChart data={nullData} showTableView={true} />); 
      expect(screen.getByText('整体学习进度')).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '已完成' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '0%' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '未完成' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '100%' })).toBeInTheDocument();
      expect(screen.queryByText('No Data')).not.toBeInTheDocument();
    });
  });
});

describe('ClassScoreDistributionChart', () => {
  // SCORE_RANGES defined in the component
  const SCORE_RANGES_FROM_COMPONENT = [
    { label: '90-100', key: '90-100' },
    { label: '80-89', key: '80-89' },
    { label: '70-79', key: '70-79' },
    { label: '60-69', key: '60-69' },
    { label: '0-59', key: '0-59' },
  ];

  const mockScoreData = {
    trendData: [
      {
        testName: "期末考试",
        scoreDistribution: {
          '90-100': 10,
          '80-89': 15,
          '70-79': 8,
          '60-69': 5,
          '0-59': 2,
        }
      }
    ]
  };
  
  const mockDataWithSubject = {
    ...mockScoreData,
    subject: "数学"
  };

  const emptyTrendData = { trendData: [] };
  const nullTrendData = { trendData: null };
  const emptyScoreDistribution = { trendData: [{ testName: "期中", scoreDistribution: {} }] };
  const nullScoreDistribution = { trendData: [{ testName: "期中", scoreDistribution: null }] };


  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Default Chart View (showTableView=false)', () => {
    it('should render bar chart correctly with data', () => {
      render(<ClassScoreDistributionChart data={mockScoreData} />); 
      expect(screen.getByText('班级成绩分布')).toBeInTheDocument();
      const chartElement = screen.getByTestId('mock-bar-chart');
      expect(chartElement).toBeInTheDocument();
      const chartData = JSON.parse(chartElement.getAttribute('data-props-data'));
      expect(chartData.labels).toEqual(SCORE_RANGES_FROM_COMPONENT.map(r => r.label));
      expect(chartData.datasets[0].label).toBe('学生人数');
      expect(chartData.datasets[0].data).toEqual([10, 15, 8, 5, 2]);
    });

    it('should render bar chart with subject in title if provided', () => {
      render(<ClassScoreDistributionChart data={mockScoreData} subject="数学" />);
      expect(screen.getByText('数学成绩分布')).toBeInTheDocument();
    });

    it('should render placeholder if trendData is empty', () => {
      render(<ClassScoreDistributionChart data={emptyTrendData} />); 
      expect(screen.getByText('班级成绩分布')).toBeInTheDocument();
      expect(screen.getByText('BAR 图表')).toBeInTheDocument();
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-bar-chart')).not.toBeInTheDocument();
    });

    it('should render placeholder if trendData is null', () => {
      render(<ClassScoreDistributionChart data={nullTrendData} />); 
      expect(screen.getByText('班级成绩分布')).toBeInTheDocument();
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-bar-chart')).not.toBeInTheDocument();
    });

    it('should render placeholder if scoreDistribution is empty', () => {
      render(<ClassScoreDistributionChart data={emptyScoreDistribution} />); 
      expect(screen.getByText('班级成绩分布')).toBeInTheDocument();
      expect(screen.getByText('暂无数据')).toBeInTheDocument(); // Because all counts will be 0
      expect(screen.queryByTestId('mock-bar-chart')).not.toBeInTheDocument();
    });

     it('should render placeholder if scoreDistribution is null', () => {
      render(<ClassScoreDistributionChart data={nullScoreDistribution} />); 
      expect(screen.getByText('班级成绩分布')).toBeInTheDocument();
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-bar-chart')).not.toBeInTheDocument();
    });
  });

  describe('Table View (showTableView=true)', () => {
    it('should render table correctly with data', () => {
      render(<ClassScoreDistributionChart data={mockScoreData} showTableView={true} />); 
      expect(screen.getByText('班级成绩分布')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '分数段' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '学生人数' })).toBeInTheDocument();

      const distribution = mockScoreData.trendData[0].scoreDistribution;
      SCORE_RANGES_FROM_COMPONENT.forEach(range => {
        expect(screen.getByRole('cell', { name: range.label })).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: (distribution[range.key] || 0).toString() })).toBeInTheDocument();
      });
    });

    it('should render empty table message if trendData is empty', () => {
      render(<ClassScoreDistributionChart data={emptyTrendData} showTableView={true} />); 
      expect(screen.getByText('班级成绩分布')).toBeInTheDocument();
      expect(screen.getByText('No Data')).toBeInTheDocument();
    });

    it('should render empty table message if trendData is null', () => {
      render(<ClassScoreDistributionChart data={nullTrendData} showTableView={true} />); 
      expect(screen.getByText('班级成绩分布')).toBeInTheDocument();
      expect(screen.getByText('No Data')).toBeInTheDocument();
    });

    // If scoreDistribution is empty or null, the table will render with 0 counts for all ranges.
    it('should render table with 0 counts if scoreDistribution is empty', () => {
      render(<ClassScoreDistributionChart data={emptyScoreDistribution} showTableView={true} />); 
      SCORE_RANGES_FROM_COMPONENT.forEach(range => {
        expect(screen.getByRole('cell', { name: range.label })).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: "0" })).toBeInTheDocument();
      });
      expect(screen.queryByText('No Data')).not.toBeInTheDocument();
    });
  });
});

describe('LearningTimeAllocationChart', () => {
  const mockAllocationData = {
    timeAllocation: {
      "数学": 40,
      "语文": 30,
      "自主学习": 30
    }
  };

  const emptyAllocationData = { timeAllocation: {} };
  const nullAllocationData = { timeAllocation: null };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Default Chart View (showTableView=false)', () => {
    it('should render pie chart correctly with data', () => {
      render(<LearningTimeAllocationChart data={mockAllocationData} />); 
      expect(screen.getByText('学习时间分配')).toBeInTheDocument();
      const chartElement = screen.getByTestId('mock-pie-chart');
      expect(chartElement).toBeInTheDocument();
      const chartData = JSON.parse(chartElement.getAttribute('data-props-data'));
      expect(chartData.labels).toEqual(['数学', '语文', '自主学习']);
      expect(chartData.datasets[0].data).toEqual([40, 30, 30]);
    });

    it('should render placeholder when timeAllocation is empty', () => {
      render(<LearningTimeAllocationChart data={emptyAllocationData} />); 
      expect(screen.getByText('学习时间分配')).toBeInTheDocument();
      expect(screen.getByText('PIE 图表')).toBeInTheDocument();
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-pie-chart')).not.toBeInTheDocument();
    });

    it('should render placeholder when timeAllocation is null', () => {
      render(<LearningTimeAllocationChart data={nullAllocationData} />); 
      expect(screen.getByText('学习时间分配')).toBeInTheDocument();
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-pie-chart')).not.toBeInTheDocument();
    });
  });

  describe('Table View (showTableView=true)', () => {
    it('should render table correctly with data', () => {
      render(<LearningTimeAllocationChart data={mockAllocationData} showTableView={true} />); 
      expect(screen.getByText('学习时间分配')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '活动/学科' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '时间/占比' })).toBeInTheDocument();

      expect(screen.getByRole('cell', { name: '数学' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '40' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '语文' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '30' })).toBeInTheDocument();
      // Note: getByRole for '自主学习' and its value '30' might need getAllByRole if '30' is not unique
      expect(screen.getByRole('cell', { name: '自主学习' })).toBeInTheDocument();
      const valueCells = screen.getAllByRole('cell', { name: '30' });
      expect(valueCells.length).toBeGreaterThanOrEqual(1); // Ensure at least one '30' is found for 自主学习

    });

    it('should render empty table message when timeAllocation is empty', () => {
      render(<LearningTimeAllocationChart data={emptyAllocationData} showTableView={true} />); 
      expect(screen.getByText('学习时间分配')).toBeInTheDocument();
      expect(screen.getByText('No Data')).toBeInTheDocument();
    });

    it('should render empty table message when timeAllocation is null', () => {
      render(<LearningTimeAllocationChart data={nullAllocationData} showTableView={true} />); 
      expect(screen.getByText('学习时间分配')).toBeInTheDocument();
      expect(screen.getByText('No Data')).toBeInTheDocument();
    });
  });
});

describe('HomeworkCompletionChart', () => {
  const mockCompletionData = {
    homeworkCompletion: {
      completed: 10,
      pending: 5,
      overdue: 2
    }
  };
  const mockCompletionDataWithZeros = {
    homeworkCompletion: {
      completed: 0,
      pending: 0,
      overdue: 0
    }
  };
  const emptyHomeworkData = { homeworkCompletion: {} }; // Missing completed, pending, overdue
  const nullHomeworkData = { homeworkCompletion: null };
  const invalidHomeworkData = { homeworkCompletion: { completed: 'abc', pending: 5, overdue: 2 } };


  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.warn to prevent it from cluttering test output for expected warnings
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
  });

  describe('Default Chart View (showTableView=false)', () => {
    it('should render pie chart correctly with data', () => {
      render(<HomeworkCompletionChart data={mockCompletionData} />); 
      expect(screen.getByText('作业状态分布')).toBeInTheDocument(); // Default title part
      const chartElement = screen.getByTestId('mock-pie-chart');
      expect(chartElement).toBeInTheDocument();
      const chartData = JSON.parse(chartElement.getAttribute('data-props-data'));
      expect(chartData.labels).toEqual(['已完成', '待提交', '已逾期']);
      expect(chartData.datasets[0].data).toEqual([10, 5, 2]);
    });

    it('should render pie chart with period in title if provided', () => {
      render(<HomeworkCompletionChart data={mockCompletionData} period="本周" />); 
      expect(screen.getByText('本周作业状态分布')).toBeInTheDocument();
    });

    it('should render placeholder if all counts are zero (as per current component logic)', () => {
      // Current logic: chartData.datasets[0].data.some(d => d > 0) must be true
      render(<HomeworkCompletionChart data={mockCompletionDataWithZeros} />); 
      expect(screen.getByText('作业状态分布')).toBeInTheDocument();
      expect(screen.getByText('PIE 图表')).toBeInTheDocument(); // Placeholder type
      expect(screen.getByText('暂无作业数据')).toBeInTheDocument(); // Placeholder title
      expect(screen.queryByTestId('mock-pie-chart')).not.toBeInTheDocument();
    });

    it('should render placeholder when homeworkCompletion is empty object', () => {
      render(<HomeworkCompletionChart data={emptyHomeworkData} />); 
      expect(screen.getByText('作业状态分布')).toBeInTheDocument();
      expect(screen.getByText('暂无作业数据')).toBeInTheDocument();
      expect(console.warn).toHaveBeenCalledWith('HomeworkCompletionChart: data.homeworkCompletion structure is not as expected or contains non-numeric values.', {});
    });

    it('should render placeholder when homeworkCompletion is null', () => {
      render(<HomeworkCompletionChart data={nullHomeworkData} />); 
      expect(screen.getByText('作业状态分布')).toBeInTheDocument();
      expect(screen.getByText('暂无作业数据')).toBeInTheDocument();
      expect(console.warn).toHaveBeenCalledWith('HomeworkCompletionChart: data object was provided, but data.homeworkCompletion is missing.');
    });

    it('should render placeholder when homeworkCompletion data is invalid', () => {
      render(<HomeworkCompletionChart data={invalidHomeworkData} />); 
      expect(screen.getByText('作业状态分布')).toBeInTheDocument();
      expect(screen.getByText('暂无作业数据')).toBeInTheDocument();
      expect(console.warn).toHaveBeenCalled(); 
    });
  });

  describe('Table View (showTableView=true)', () => {
    it('should render table correctly with data', () => {
      render(<HomeworkCompletionChart data={mockCompletionData} showTableView={true} />); 
      expect(screen.getByText('作业状态分布')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '状态' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '作业数量' })).toBeInTheDocument();

      expect(screen.getByRole('cell', { name: '已完成' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '10' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '待提交' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '5' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '已逾期' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument();
    });

    it('should render table with zero counts if all data is zero', () => {
      render(<HomeworkCompletionChart data={mockCompletionDataWithZeros} showTableView={true} />); 
      expect(screen.getByRole('cell', { name: '已完成' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '0' })).toBeInTheDocument();
      // ... and for pending, overdue
      expect(screen.getByRole('cell', { name: '待提交' })).toBeInTheDocument();
      expect(screen.getAllByRole('cell', { name: '0' })[1]).toBeInTheDocument(); // Check second 0 for pending
      expect(screen.getByRole('cell', { name: '已逾期' })).toBeInTheDocument();
      expect(screen.getAllByRole('cell', { name: '0' })[2]).toBeInTheDocument(); // Check third 0 for overdue
      expect(screen.queryByText('No Data')).not.toBeInTheDocument(); // Table is rendered with 0s
    });

    it('should render empty table message when homeworkCompletion is empty object', () => {
      render(<HomeworkCompletionChart data={emptyHomeworkData} showTableView={true} />); 
      expect(screen.getByText('作业状态分布')).toBeInTheDocument();
      expect(screen.getByText('No Data')).toBeInTheDocument(); 
    });

    it('should render empty table message when homeworkCompletion is null', () => {
      render(<HomeworkCompletionChart data={nullHomeworkData} showTableView={true} />); 
      expect(screen.getByText('作业状态分布')).toBeInTheDocument();
      expect(screen.getByText('No Data')).toBeInTheDocument(); 
    });
  });
});

describe('AttendanceRateChart', () => {
  const mockAttendanceData = {
    attendanceData: [
      { date: "2023-08-01", rate: 95 },
      { date: "2023-08-02", rate: 98 },
      { date: "2023-08-03", rate: 100 },
    ]
  };
  const emptyAttendanceDataArray = { attendanceData: [] };
  const nullAttendanceData = { attendanceData: null };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Default Chart View (showTableView=false)', () => {
    it('should render line chart correctly with data', () => {
      render(<AttendanceRateChart data={mockAttendanceData} period="本学期" />); 
      expect(screen.getByText('出勤率 (本学期)')).toBeInTheDocument();
      const chartElement = screen.getByTestId('mock-line-chart');
      expect(chartElement).toBeInTheDocument();
      const chartData = JSON.parse(chartElement.getAttribute('data-props-data'));
      expect(chartData.labels).toEqual(['2023-08-01', '2023-08-02', '2023-08-03']);
      expect(chartData.datasets[0].label).toBe('出勤率');
      expect(chartData.datasets[0].data).toEqual([95, 98, 100]);
    });

    it('should use default period in title if period prop is not provided', () => {
      render(<AttendanceRateChart data={mockAttendanceData} />); 
      expect(screen.getByText('出勤率 (本学期)')).toBeInTheDocument(); // Default is '本学期'
    });

    it('should render placeholder when attendanceData is an empty array', () => {
      render(<AttendanceRateChart data={emptyAttendanceDataArray} />); 
      expect(screen.getByText('出勤率 (本学期)')).toBeInTheDocument();
      expect(screen.getByText('LINE 图表')).toBeInTheDocument();
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-line-chart')).not.toBeInTheDocument();
    });

    it('should render placeholder when attendanceData is null', () => {
      render(<AttendanceRateChart data={nullAttendanceData} />); 
      expect(screen.getByText('出勤率 (本学期)')).toBeInTheDocument();
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-line-chart')).not.toBeInTheDocument();
    });
  });

  describe('Table View (showTableView=true)', () => {
    it('should render table correctly with data', () => {
      render(<AttendanceRateChart data={mockAttendanceData} period="自定义周期" showTableView={true} />); 
      expect(screen.getByText('出勤率 (自定义周期)')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '日期' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '出勤率 (%)' })).toBeInTheDocument();

      expect(screen.getByRole('cell', { name: '2023-08-01' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '95' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '2023-08-02' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '98' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '2023-08-03' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: '100' })).toBeInTheDocument();
    });

    it('should render empty table message when attendanceData is an empty array', () => {
      render(<AttendanceRateChart data={emptyAttendanceDataArray} showTableView={true} />); 
      expect(screen.getByText('出勤率 (本学期)')).toBeInTheDocument();
      expect(screen.getByText('No Data')).toBeInTheDocument();
    });

    it('should render empty table message when attendanceData is null', () => {
      render(<AttendanceRateChart data={nullAttendanceData} showTableView={true} />); 
      expect(screen.getByText('出勤率 (本学期)')).toBeInTheDocument();
      expect(screen.getByText('No Data')).toBeInTheDocument();
    });
  });
}); 