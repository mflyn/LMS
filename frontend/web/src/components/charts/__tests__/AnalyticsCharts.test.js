import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { 
  SubjectComparisonChart, 
  LearningAbilityChart, 
  LearningProgressChart 
} from '../AnalyticsCharts';

// Mock Chart.js components
jest.mock('react-chartjs-2', () => ({
  Bar: ({ data, ...props }) => (
    <div data-testid="mock-bar-chart" data-props-data={JSON.stringify(data)} {...props}>
      Bar Chart
    </div>
  ),
  Radar: ({ data, ...props }) => (
    <div data-testid="mock-radar-chart" data-props-data={JSON.stringify(data)} {...props}>
      Radar Chart
    </div>
  ),
  Doughnut: ({ data, ...props }) => (
    <div data-testid="mock-doughnut-chart" data-props-data={JSON.stringify(data)} {...props}>
      Doughnut Chart
    </div>
  ),
}));

// Mock Chart.js
jest.mock('chart.js', () => ({
  Chart: {
    register: jest.fn(),
  },
  CategoryScale: jest.fn(),
  LinearScale: jest.fn(),
  BarElement: jest.fn(),
  Title: jest.fn(),
  Tooltip: jest.fn(),
  Legend: jest.fn(),
  RadialLinearScale: jest.fn(),
  PointElement: jest.fn(),
  LineElement: jest.fn(),
  Filler: jest.fn(),
  ArcElement: jest.fn(),
}));

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
      render(<LearningAbilityChart data={emptyAbilityData} showTableView={true} />); 
      expect(screen.getByText('学习能力分析')).toBeInTheDocument();
      
      Object.keys(ABILITY_MAP).forEach(key => {
        expect(screen.getByRole('cell', { name: ABILITY_MAP[key] })).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: "0" })).toBeInTheDocument();
      });
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render progress chart correctly', () => {
    render(<LearningProgressChart data={mockOverallData} />);
    expect(screen.getByText('学习进度')).toBeInTheDocument();
  });

  it('should handle zero progress', () => {
    render(<LearningProgressChart data={mockZeroData} />);
    expect(screen.getByText('学习进度')).toBeInTheDocument();
  });

  it('should handle full progress', () => {
    render(<LearningProgressChart data={mockFullData} />);
    expect(screen.getByText('学习进度')).toBeInTheDocument();
  });
}); 