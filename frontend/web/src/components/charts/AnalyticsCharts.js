import React, { useEffect } from 'react';
import { Card } from 'antd';
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

// 学习趋势图表
export const ScoreTrendChart = ({ data, subject }) => {
  const title = subject ? `${subject}学习趋势` : '学习趋势分析';
  
  // 处理数据
  const chartData = {
    labels: [],
    datasets: []
  };
  
  if (data && data.trendsData) {
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
      {chartData.datasets.length > 0 ? (
        <Line data={chartData} options={options} height={300} />
      ) : (
        <ChartPlaceholder type="line" title="暂无数据" />
      )}
    </Card>
  );
};

// 学科成绩对比图表
export const SubjectComparisonChart = ({ data }) => {
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
  
  if (data && data.trendsData) {
    chartData.labels = Object.keys(data.trendsData);
    chartData.datasets[0].data = Object.values(data.trendsData).map(subject => subject.averageScore);
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
      {chartData.labels.length > 0 ? (
        <Bar data={chartData} options={options} height={300} />
      ) : (
        <ChartPlaceholder type="bar" title="暂无数据" />
      )}
    </Card>
  );
};

// 学习能力雷达图
export const LearningAbilityChart = ({ data }) => {
  // 处理数据
  const chartData = {
    labels: ['记忆力', '理解力', '应用能力', '分析能力', '创造力', '表达能力'],
    datasets: [{
      label: '能力水平',
      data: [0, 0, 0, 0, 0, 0],
      backgroundColor: 'rgba(114, 46, 209, 0.2)',
      borderColor: '#722ed1',
      borderWidth: 1
    }]
  };
  
  if (data && data.abilities) {
    chartData.datasets[0].data = [
      data.abilities.memory || 0,
      data.abilities.understanding || 0,
      data.abilities.application || 0,
      data.abilities.analysis || 0,
      data.abilities.creativity || 0,
      data.abilities.expression || 0
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
        text: '学习能力分析'
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
      {data && data.abilities ? (
        <Radar data={chartData} options={options} height={300} />
      ) : (
        <ChartPlaceholder type="radar" title="暂无数据" />
      )}
    </Card>
  );
};

// 学习进度饼图
export const LearningProgressChart = ({ data, subject }) => {
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
  
  if (data && data.progressData) {
    if (subject && data.progressData[subject]) {
      const completionRate = data.progressData[subject].completionRate || 0;
      chartData.datasets[0].data = [completionRate, 100 - completionRate];
    } else if (!subject && data.overallProgress) {
      chartData.datasets[0].data = [data.overallProgress, 100 - data.overallProgress];
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
    }
  };
  
  return (
    <Card title={title} bordered={false}>
      {chartData.datasets[0].data[0] > 0 ? (
        <Pie data={chartData} options={options} height={300} />
      ) : (
        <ChartPlaceholder type="pie" title="暂无数据" />
      )}
    </Card>
  );
};

// 班级成绩分布图
export const ClassScoreDistributionChart = ({ data, subject }) => {
  const title = subject ? `${subject}成绩分布` : '班级成绩分布';
  
  // 处理数据
  const chartData = {
    labels: ['90-100', '80-89', '70-79', '60-69', '0-59'],
    datasets: [{
      label: '学生人数',
      data: [0, 0, 0, 0, 0],
      backgroundColor: [
        'rgba(82, 196, 26, 0.6)',
        'rgba(24, 144, 255, 0.6)',
        'rgba(250, 140, 22, 0.6)',
        'rgba(250, 173, 20, 0.6)',
        'rgba(245, 34, 45, 0.6)'
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
  
  if (data && data.trendData && data.trendData.length > 0) {
    // 获取最新的测试数据
    const latestTest = data.trendData[data.trendData.length - 1];
    if (latestTest.scoreDistribution) {
      chartData.datasets[0].data = [
        latestTest.scoreDistribution['90-100'] || 0,
        latestTest.scoreDistribution['80-89'] || 0,
        latestTest.scoreDistribution['70-79'] || 0,
        latestTest.scoreDistribution['60-69'] || 0,
        latestTest.scoreDistribution['0-59'] || 0
      ];
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
      {chartData.datasets[0].data.some(value => value > 0) ? (
        <Bar data={chartData} options={options} height={300} />
      ) : (
        <ChartPlaceholder type="bar" title="暂无数据" />
      )}
    </Card>
  );
};

// 学习时间分配图
export const LearningTimeAllocationChart = ({ data }) => {
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
  
  if (data && data.timeAllocation) {
    chartData.labels = Object.keys(data.timeAllocation);
    chartData.datasets[0].data = Object.values(data.timeAllocation);
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
      {chartData.labels.length > 0 ? (
        <Pie data={chartData} options={options} height={300} />
      ) : (
        <ChartPlaceholder type="pie" title="暂无数据" />
      )}
    </Card>
  );
};

// 作业完成率图表
export const HomeworkCompletionChart = ({ data, period }) => {
  // 处理数据
  const chartData = {
    labels: [],
    datasets: [{
      label: '作业数量',
      data: [0, 0, 0, 0],
      backgroundColor: [
        'rgba(82, 196, 26, 0.6)',
        'rgba(24, 144, 255, 0.6)',
        'rgba(250, 173, 20, 0.6)',
        'rgba(245, 34, 45, 0.6)'
      ],
      borderColor: [
        '#52c41a',
        '#1890ff',
        '#faad14',
        '#f5222d'
      ],
      borderWidth: 1
    }]
  };
  
  if (data && data.homeworkStats) {
    chartData.datasets[0].data = [
      data.homeworkStats.completed || 0,
      data.homeworkStats.inProgress || 0,
      data.homeworkStats.notStarted || 0,
      data.homeworkStats.overdue || 0
    ];
  }
  
  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: '作业完成情况'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: '作业数量'
        }
      }
    }
  };
  
  return (
    <Card title={`作业完成率 (${period || '本学期'})`} bordered={false}>
      {chartData.datasets[0].data.some(value => value > 0) ? (
        <Bar data={chartData} options={options} height={300} />
      ) : (
        <ChartPlaceholder type="bar" title="暂无数据" />
      )}
    </Card>
  );
};

// 出勤率图表
export const AttendanceRateChart = ({ data, period }) => {
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
  
  if (data && data.attendanceData && data.attendanceData.length > 0) {
    chartData.labels = data.attendanceData.map(item => item.date);
    chartData.datasets[0].data = data.attendanceData.map(item => item.rate);
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
      {chartData.labels.length > 0 ? (
        <Line data={chartData} options={options} height={300} />
      ) : (
        <ChartPlaceholder type="line" title="暂无数据" />
      )}
    </Card>
  );
};