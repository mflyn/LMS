import React, { useEffect } from 'react';
import { Card, Table } from 'antd';
import { Line, Bar, Radar, Pie } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement, 
  RadialLinearScale, 
  ArcElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// 模拟图表组件
const ChartPlaceholder = ({ type, title, height }) => {
  const getColorByType = () => {
    switch (type) {
      case 'line': return '#1890ff';
      case 'bar': return '#52c41a';
      case 'radar': return '#722ed1';
      case 'pie': return '#fa8c16';
      default: return '#1890ff';
    }
  };

  return (
    <div 
      style={{ 
        height: height || 300, 
        background: '#f0f2f5', 
        borderRadius: 8, 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        padding: 16,
        border: `1px dashed ${getColorByType()}`
      }}
    >
      <div style={{ fontSize: 24, color: getColorByType(), marginBottom: 16 }}>
        {type.toUpperCase()} 图表
      </div>
      <div style={{ textAlign: 'center' }}>
        <div>{title}</div>
        <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
          (此处将显示{type}图表，需要安装chart.js和react-chartjs-2)
        </div>
      </div>
    </div>
  );
};

/**
 * 学习趋势图表 (线图)
 * @param {object} props - 组件属性
 * @param {object} props.data - 图表数据源
 * @param {object} props.data.trendsData - 趋势数据，键为学科名称，值为该学科的数据对象。
 *   例如: { "数学": { scores: [{date: "2023-01-01", score: 80}, ...], averageScore: 85 }, ... }
 * @param {Array<object>} props.data.trendsData[subject].scores - 包含日期和分数的对象数组。
 * @param {string} [props.subject] - 可选，如果提供，则只显示该学科的趋势。否则显示所有学科。
 * @param {number} [props.height=300] - 图表高度。
 * @param {boolean} [props.showTableView=false] - 是否显示表格视图。
 */
export const ScoreTrendChart = ({ data, subject, height = 300, showTableView = false }) => {
  const title = subject ? `${subject}学习趋势` : '学习趋势分析';
  
  // 处理数据
  const chartData = {
    labels: [],
    datasets: []
  };
  
  let tableColumns = [];
  let tableDataSource = [];

  if (data && data.trendsData) {
    const allDates = new Set();
    Object.values(data.trendsData).forEach(subjectData => {
      if (subjectData.scores) {
        subjectData.scores.forEach(score => allDates.add(score.date));
      }
    });
    const sortedDates = Array.from(allDates).sort();

    if (subject && data.trendsData[subject]) {
      // Single subject view
      tableColumns = [
        { title: '日期', dataIndex: 'date', key: 'date' },
        { title: subject, dataIndex: subject, key: subject },
      ];
      const subjectData = data.trendsData[subject];
      if (subjectData.scores) {
        tableDataSource = sortedDates.map(date => {
          const scoreEntry = subjectData.scores.find(s => s.date === date);
          return {
            key: date,
            date: date,
            [subject]: scoreEntry ? scoreEntry.score : '-',
          };
        });
      }
    } else {
      // All subjects view
      tableColumns = [{ title: '日期', dataIndex: 'date', key: 'date' }];
      const subjectNames = Object.keys(data.trendsData);
      subjectNames.forEach(subjName => {
        tableColumns.push({ title: subjName, dataIndex: subjName, key: subjName });
      });

      tableDataSource = sortedDates.map(date => {
        const row = { key: date, date: date };
        subjectNames.forEach(subjName => {
          const subjectData = data.trendsData[subjName];
          const scoreEntry = subjectData.scores ? subjectData.scores.find(s => s.date === date) : null;
          row[subjName] = scoreEntry ? scoreEntry.score : '-';
        });
        return row;
      });
    }

    // 如果指定了学科，只显示该学科的数据
    if (subject && data.trendsData[subject]) {
      const subjectData = data.trendsData[subject];
      if (subjectData.scores && subjectData.scores.length > 0) {
        chartData.labels = subjectData.scores.map(score => score.date);
        chartData.datasets = [{
          label: subject,
          data: subjectData.scores.map(score => score.score),
          borderColor: '#1890ff',
          backgroundColor: 'rgba(24, 144, 255, 0.2)',
          tension: 0.1
        }];
      }
    } 
    // 否则显示所有学科的数据
    else {
      // 获取所有日期
      const allDates = new Set();
      Object.values(data.trendsData).forEach(subjectData => {
        if (subjectData.scores) {
          subjectData.scores.forEach(score => allDates.add(score.date));
        }
      });
      
      // 排序日期
      chartData.labels = Array.from(allDates).sort();
      
      // 为每个学科创建一个数据集
      const colors = ['#1890ff', '#52c41a', '#722ed1', '#fa8c16', '#eb2f96'];
      let colorIndex = 0;
      
      Object.entries(data.trendsData).forEach(([subject, subjectData]) => {
        if (subjectData.scores && subjectData.scores.length > 0) {
          // 创建一个映射，以便快速查找每个日期的分数
          const scoreMap = {};
          subjectData.scores.forEach(score => {
            scoreMap[score.date] = score.score;
          });
          
          // 为每个日期找到对应的分数，如果没有则为null
          const dataPoints = chartData.labels.map(date => scoreMap[date] || null);
          
          chartData.datasets.push({
            label: subject,
            data: dataPoints,
            borderColor: colors[colorIndex % colors.length],
            backgroundColor: `rgba(${parseInt(colors[colorIndex % colors.length].slice(1, 3), 16)}, ${parseInt(colors[colorIndex % colors.length].slice(3, 5), 16)}, ${parseInt(colors[colorIndex % colors.length].slice(5, 7), 16)}, 0.2)`,
            tension: 0.1
          });
          
          colorIndex++;
        }
      });
    }
  }
  
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: title
      }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        title: {
          display: true,
          text: '分数'
        }
      },
      x: {
        title: {
          display: true,
          text: '日期'
        }
      }
    }
  };
  
  return (
    <Card title={title} bordered={false}>
      {showTableView ? (
        <Table dataSource={tableDataSource} columns={tableColumns} pagination={false} />
      ) : chartData.datasets.length > 0 ? (
        <Line data={chartData} options={options} height={height} />
      ) : (
        <ChartPlaceholder type="line" title="暂无数据" height={height} />
      )}
    </Card>
  );
};

/**
 * 学科成绩对比图表 (柱状图)
 * @param {object} props - 组件属性
 * @param {object} props.data - 图表数据源
 * @param {object} props.data.trendsData - 各学科的数据，键为学科名称。
 *   每个学科对象应包含 averageScore 属性。
 *   例如: { "数学": { averageScore: 85 }, "语文": { averageScore: 90 }, ... }
 * @param {number} props.data.trendsData[subject].averageScore - 该学科的平均分。
 * @param {number} [props.height=300] - 图表高度。
 * @param {boolean} [props.showTableView=false] - 是否显示表格视图。
 */
export const SubjectComparisonChart = ({ data, height = 300, showTableView = false }) => {
  // 处理数据
  const chartData = {
    labels: [],
    datasets: [{
      label: '平均分',
      data: [],
      backgroundColor: 'rgba(24, 144, 255, 0.6)',
      borderColor: '#1890ff',
      borderWidth: 1
    }]
  };
  
  let tableColumns = [];
  let tableDataSource = [];

  if (data && data.trendsData) {
    chartData.labels = Object.keys(data.trendsData);
    chartData.datasets[0].data = Object.values(data.trendsData).map(subject => subject.averageScore);

    tableColumns = [
      { title: '学科', dataIndex: 'subject', key: 'subject' },
      { title: '平均分', dataIndex: 'averageScore', key: 'averageScore' },
    ];
    tableDataSource = Object.entries(data.trendsData).map(([subject, details]) => ({
      key: subject,
      subject: subject,
      averageScore: details.averageScore,
    }));
  }
  
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '学科成绩对比'
      }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        title: {
          display: true,
          text: '平均分'
        }
      }
    }
  };
  
  return (
    <Card title="学科成绩对比" bordered={false}>
      {showTableView ? (
        <Table dataSource={tableDataSource} columns={tableColumns} pagination={false} />
      ) : chartData.labels.length > 0 ? (
        <Bar data={chartData} options={options} height={height} />
      ) : (
        <ChartPlaceholder type="bar" title="暂无数据" height={height} />
      )}
    </Card>
  );
};

// 学习能力雷达图
const ABILITY_MAP = {
  memory: '记忆力',
  understanding: '理解力',
  application: '应用能力',
  analysis: '分析能力',
  creativity: '创造力',
  expression: '表达能力'
};

/**
 * 学习能力雷达图
 * @param {object} props - 组件属性
 * @param {object} props.data - 图表数据源
 * @param {object} props.data.abilityData - 学生的能力数据。键为能力代码 (如 'memory', 'understanding')，
 *   值为对应的能力分数。能力代码和名称的映射见组件内部 ABILITY_MAP。
 *   例如: { memory: 80, understanding: 75, ... }
 * @param {number} [props.height=300] - 图表高度。
 * @param {boolean} [props.showTableView=false] - 是否显示表格视图。
 */
export const LearningAbilityChart = ({ data, height = 300, showTableView = false }) => {
  const chartData = {
    labels: [], // 将动态生成
    datasets: [{
      label: '能力水平',
      data: [],   // 将动态生成
      backgroundColor: 'rgba(114, 46, 209, 0.2)',
      borderColor: '#722ed1',
      borderWidth: 1
    }]
  };

  let tableColumns = [];
  let tableDataSource = [];

  if (data && data.abilities) {
    const abilityKeys = Object.keys(ABILITY_MAP);
    chartData.labels = abilityKeys.map(key => ABILITY_MAP[key]);
    chartData.datasets[0].data = abilityKeys.map(key => data.abilities[key] || 0);

    tableColumns = [
      { title: '能力', dataIndex: 'ability', key: 'ability' },
      { title: '得分', dataIndex: 'score', key: 'score' },
    ];
    tableDataSource = abilityKeys.map(key => ({
      key: key,
      ability: ABILITY_MAP[key],
      score: data.abilities[key] || 0,
    }));
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '学习能力评估'
      }
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20
        }
      }
    }
  };
  
  return (
    <Card title="学习能力分析" bordered={false}>
      {showTableView && data && data.abilities ? (
        <Table dataSource={tableDataSource} columns={tableColumns} pagination={false} />
      ) : data && data.abilities ? (
        <Radar data={chartData} options={options} height={height} />
      ) : (
        <ChartPlaceholder type="radar" title="暂无数据" height={height} />
      )}
    </Card>
  );
};

/**
 * 学习进度饼图
 * @param {object} props - 组件属性
 * @param {object} props.data - 图表数据源
 * @param {object} [props.data.progressData] - 各学科的进度数据。如果提供了 subject prop，则从此对象中查找。
 * @param {object} props.data.progressData[subject] - 特定学科的进度对象。
 * @param {number} props.data.progressData[subject].completionRate - 特定学科的完成百分比 (0-100)。
 * @param {number} [props.data.overallProgress] - 整体学习进度百分比 (0-100)。如果未提供 subject prop，则使用此值。
 * @param {string} [props.subject] - 可选的学科名称。如果提供，则显示该学科的进度；否则显示整体进度。
 * @param {number} [props.height=300] - 图表高度。
 * @param {boolean} [props.showTableView=false] - 是否显示表格视图。
 */
export const LearningProgressChart = ({ data, subject, height = 300, showTableView = false }) => {
  const title = subject ? `${subject}学习进度` : '整体学习进度';
  
  // 处理数据
  const chartData = {
    labels: ['已完成', '未完成'],
    datasets: [{
      data: [0, 100],
      backgroundColor: ['#52c41a', '#f5f5f5'],
      borderColor: ['#52c41a', '#e8e8e8'],
      borderWidth: 1
    }]
  };
  
  let tableColumns = [];
  let tableDataSource = [];
  let completionRate = 0;

  if (data) {
    if (subject && data.progressData && data.progressData[subject]) {
      completionRate = data.progressData[subject].completionRate || 0;
    } else if (!subject && typeof data.overallProgress === 'number') {
      completionRate = data.overallProgress;
    }
    chartData.datasets[0].data = [completionRate, 100 - completionRate];

    tableColumns = [
      { title: '状态', dataIndex: 'status', key: 'status' },
      { title: '百分比', dataIndex: 'percentage', key: 'percentage' },
    ];
    tableDataSource = [
      { key: 'completed', status: '已完成', percentage: `${completionRate}%` },
      { key: 'remaining', status: '未完成', percentage: `${100 - completionRate}%` },
    ];
  }
  
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: title
      }
    }
  };
  
  return (
    <Card title={title} bordered={false}>
      {showTableView && data ? (
        <Table dataSource={tableDataSource} columns={tableColumns} pagination={false} />
      ) : chartData.datasets[0].data[0] > 0 || (chartData.datasets[0].data[0] === 0 && chartData.datasets[0].data[1] === 100) ? ( // Also show if 0% completed
        <Pie data={chartData} options={options} height={height} />
      ) : (
        <ChartPlaceholder type="pie" title="暂无数据" height={height} />
      )}
    </Card>
  );
};

// 定义分数段常量
const SCORE_RANGES = [
  { label: '90-100', key: '90-100' },
  { label: '80-89', key: '80-89' },
  { label: '70-79', key: '70-79' },
  { label: '60-69', key: '60-69' },
  { label: '0-59', key: '0-59' },
];

/**
 * 班级成绩分布图表
 * @param {object} props - 组件属性
 * @param {object} props.data - 图表数据源
 * @param {Array<object>} props.data.trendData - 包含历次测试数据的数组。
 *   每个对象应代表一次测试，并包含一个 scoreDistribution 对象。
 *   图表将使用 trendData 数组中的最后一个元素的 scoreDistribution。
 * @param {object} props.data.trendData[].scoreDistribution - 分数分布对象，键为分数段 (如 '90-100')，值为该分数段的人数。
 *   例如: { '90-100': 10, '80-89': 15, ... }
 *   分数段定义见组件内部的 SCORE_RANGES 常量。
 * @param {string} [props.subject] - 可选的学科名称，用于图表标题
 * @param {number} [props.height=300] - 图表高度
 * @param {boolean} [props.showTableView=false] - 是否显示表格视图
 */
export const ClassScoreDistributionChart = ({ data, subject, height = 300, showTableView = false }) => {
  const title = subject ? `${subject}成绩分布` : '班级成绩分布';
  
  const chartData = {
    labels: SCORE_RANGES.map(r => r.label),
    datasets: [{
      label: '学生人数',
      data: Array(SCORE_RANGES.length).fill(0),
      backgroundColor: [
        'rgba(82, 196, 26, 0.6)', // 90-100
        'rgba(24, 144, 255, 0.6)', // 80-89
        'rgba(250, 140, 22, 0.6)', // 70-79
        'rgba(250, 173, 20, 0.6)', // 60-69
        'rgba(245, 34, 45, 0.6)'  // 0-59
      ],
      borderColor: [
        '#52c41a',
        '#1890ff',
        '#fa8c16',
        '#faad14',
        '#f5222d'
      ],
      borderWidth: 1
    }]
  };
  
  let tableColumns = [];
  let tableDataSource = [];

  if (data && data.trendData && data.trendData.length > 0) {
    const latestTest = data.trendData[data.trendData.length - 1];
    if (latestTest && latestTest.scoreDistribution) {
      chartData.datasets[0].data = SCORE_RANGES.map(
        range => latestTest.scoreDistribution[range.key] || 0
      );

      tableColumns = [
        { title: '分数段', dataIndex: 'range', key: 'range' },
        { title: '学生人数', dataIndex: 'count', key: 'count' },
      ];
      tableDataSource = SCORE_RANGES.map(range => ({
        key: range.key,
        range: range.label,
        count: latestTest.scoreDistribution[range.key] || 0,
      }));
    }
  }
  
  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: title
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: '学生人数'
        }
      },
      x: {
        title: {
          display: true,
          text: '分数段'
        }
      }
    }
  };
  
  return (
    <Card title={title} bordered={false}>
      {showTableView && tableDataSource.length > 0 ? (
        <Table dataSource={tableDataSource} columns={tableColumns} pagination={false} />
      ) : chartData.datasets[0].data.some(value => value > 0) ? (
        <Bar data={chartData} options={options} height={height} />
      ) : (
        <ChartPlaceholder type="bar" title="暂无数据" height={height} />
      )}
    </Card>
  );
};

/**
 * 学习时间分配图 (饼图)
 * @param {object} props - 组件属性
 * @param {object} props.data - 图表数据源
 * @param {object} props.data.timeAllocation - 时间分配数据。键为活动/学科名称，值为所占时间或百分比。
 *   例如: { "数学": 40, "语文": 30, "自主学习": 30 }
 * @param {number} [props.height=300] - 图表高度。
 * @param {boolean} [props.showTableView=false] - 是否显示表格视图。
 */
export const LearningTimeAllocationChart = ({ data, height = 300, showTableView = false }) => {
  // 处理数据
  const chartData = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [
        'rgba(24, 144, 255, 0.6)',
        'rgba(82, 196, 26, 0.6)',
        'rgba(114, 46, 209, 0.6)',
        'rgba(250, 140, 22, 0.6)',
        'rgba(245, 34, 45, 0.6)',
        'rgba(19, 194, 194, 0.6)'
      ],
      borderColor: [
        '#1890ff',
        '#52c41a',
        '#722ed1',
        '#fa8c16',
        '#f5222d',
        '#13c2c2'
      ],
      borderWidth: 1
    }]
  };
  
  let tableColumns = [];
  let tableDataSource = [];

  if (data && data.timeAllocation) {
    chartData.labels = Object.keys(data.timeAllocation);
    chartData.datasets[0].data = Object.values(data.timeAllocation);

    tableColumns = [
      { title: '活动/学科', dataIndex: 'activity', key: 'activity' },
      { title: '时间/占比', dataIndex: 'value', key: 'value' },
    ];
    tableDataSource = Object.entries(data.timeAllocation).map(([key, value]) => ({
      key: key,
      activity: key,
      value: value,
    }));
  }
  
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: '学习时间分配'
      }
    }
  };
  
  return (
    <Card title="学习时间分配" bordered={false}>
      {showTableView && tableDataSource.length > 0 ? (
        <Table dataSource={tableDataSource} columns={tableColumns} pagination={false} />
      ) : chartData.labels.length > 0 ? (
        <Pie data={chartData} options={options} height={height} />
      ) : (
        <ChartPlaceholder type="pie" title="暂无数据" height={height} />
      )}
    </Card>
  );
};

/**
 * 作业完成状态图表 (饼图)
 * @param {object} props - 组件属性
 * @param {object} props.data - 图表数据源
 * @param {object} props.data.homeworkCompletion - 作业完成数据。
 *   应包含 completed, pending, overdue 三个数字类型的属性。
 *   例如: { completed: 10, pending: 5, overdue: 2 }
 * @param {string} [props.period] - 可选的时间段描述，用于图表标题 (如 "本周", "本月")。
 * @param {number} [props.height=300] - 图表高度。
 * @param {boolean} [props.showTableView=false] - 是否显示表格视图。
 */
export const HomeworkCompletionChart = ({ data, period, height = 300, showTableView = false }) => {
  const cardTitle = period ? `${period}作业状态分布` : '作业状态分布';

  // 处理数据
  const chartData = {
    labels: [], // 初始化为空数组
    datasets: [{
      label: '作业数量', // 修改 dataset 标签
      data: [], // 初始化为空数组
      backgroundColor: ['#52c41a', '#faad14', '#ff4d4f'], // 对应 已完成, 待提交, 已逾期
      hoverBackgroundColor: ['#73d13d', '#ffc53d', '#ff7875']
    }]
  };

  let tableColumns = [];
  let tableDataSource = [];

  // 假设 data.homeworkCompletion 的结构是: { completed: number, pending: number, overdue: number }
  if (data && data.homeworkCompletion) {
    const { completed, pending, overdue } = data.homeworkCompletion;
    
    // 只有当这些值都存在且为数字时才处理
    if (typeof completed === 'number' && typeof pending === 'number' && typeof overdue === 'number') {
      chartData.labels = ['已完成', '待提交', '已逾期'];
      chartData.datasets[0].data = [completed, pending, overdue];

      tableColumns = [
        { title: '状态', dataIndex: 'status', key: 'status' },
        { title: '作业数量', dataIndex: 'count', key: 'count' },
      ];
      tableDataSource = [
        { key: 'completed', status: '已完成', count: completed },
        { key: 'pending', status: '待提交', count: pending },
        { key: 'overdue', status: '已逾期', count: overdue },
      ];

    } else {
      console.warn('HomeworkCompletionChart: data.homeworkCompletion structure is not as expected or contains non-numeric values.', data.homeworkCompletion);
    }
  } else if (data && !data.homeworkCompletion) {
    console.warn('HomeworkCompletionChart: data object was provided, but data.homeworkCompletion is missing.');
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: cardTitle // 使用 cardTitle 作为图表内部标题
      }
    },
    // Pie chart does not use scales typically, so removing y-axis scale config
    // scales: {
    //   y: {
    //     beginAtZero: true,
    //     title: {
    //       display: true,
    //       text: '完成率 (%)' // This was incorrect for counts
    //     }
    //   }
    // }
  };
  
  return (
    <Card title={cardTitle} bordered={false}>
      {showTableView && tableDataSource.length > 0 ? (
        <Table dataSource={tableDataSource} columns={tableColumns} pagination={false} />
      ) : chartData.labels.length > 0 && chartData.datasets[0].data.length > 0 && chartData.datasets[0].data.some(d => d > 0) ? (
        <Pie data={chartData} options={options} height={height} /> // 使用 height prop
      ) : (
        <ChartPlaceholder type="pie" title="暂无作业数据" height={height}/> // 修改占位符标题, 使用 height prop
      )}
    </Card>
  );
};

/**
 * 出勤率图表 (线图)
 * @param {object} props - 组件属性
 * @param {object} props.data - 图表数据源
 * @param {Array<object>} props.data.attendanceData - 出勤率数据数组。
 *   每个对象应包含 date (字符串) 和 rate (数字, 0-100) 属性。
 *   例如: [{ date: "2023-08-01", rate: 95 }, { date: "2023-08-02", rate: 98 }, ...]
 * @param {string} [props.period] - 可选的时间段描述，用于卡片标题 (如 "本学期")。
 * @param {number} [props.height=300] - 图表高度。
 * @param {boolean} [props.showTableView=false] - 是否显示表格视图。
 */
export const AttendanceRateChart = ({ data, period, height = 300, showTableView = false }) => {
  // 处理数据
  const chartData = {
    labels: [],
    datasets: [{
      label: '出勤率',
      data: [],
      borderColor: '#1890ff',
      backgroundColor: 'rgba(24, 144, 255, 0.2)',
      tension: 0.1,
      fill: true
    }]
  };
  
  let tableColumns = [];
  let tableDataSource = [];
  
  if (data && data.attendanceData && data.attendanceData.length > 0) {
    chartData.labels = data.attendanceData.map(item => item.date);
    chartData.datasets[0].data = data.attendanceData.map(item => item.rate);

    tableColumns = [
      { title: '日期', dataIndex: 'date', key: 'date' },
      { title: '出勤率 (%)', dataIndex: 'rate', key: 'rate' },
    ];
    tableDataSource = data.attendanceData.map((item, index) => ({
      key: index, // 使用索引作为key
      date: item.date,
      rate: item.rate,
    }));
  }
  
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '出勤率统计'
      }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        title: {
          display: true,
          text: '出勤率 (%)'
        }
      },
      x: {
        title: {
          display: true,
          text: '日期'
        }
      }
    }
  };
  
  return (
    <Card title={`出勤率 (${period || '本学期'})`} bordered={false}>
      {showTableView && tableDataSource.length > 0 ? (
        <Table dataSource={tableDataSource} columns={tableColumns} pagination={false} />
      ) : chartData.labels.length > 0 ? (
        <Line data={chartData} options={options} height={height} />
      ) : (
        <ChartPlaceholder type="line" title="暂无数据" height={height} />
      )}
    </Card>
  );
};