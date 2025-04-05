import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * 通用进度条组件
 * @param {Object} props
 * @param {number} props.progress - 进度值(0-100)
 * @param {string} props.label - 进度标签
 * @param {string} props.color - 进度条颜色
 * @param {number} props.height - 进度条高度
 * @param {boolean} props.showPercentage - 是否显示百分比
 * @param {Object} props.style - 自定义样式
 */
const ProgressBar = ({
  progress = 0,
  label,
  color = '#1890ff',
  height = 8,
  showPercentage = true,
  style = {},
}) => {
  // 确保进度值在0-100之间
  const validProgress = Math.min(Math.max(progress, 0), 100);
  
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.progressContainer, { height }]}>
        <View 
          style={[
            styles.progressBar, 
            { width: `${validProgress}%`, backgroundColor: color }
          ]} 
        />
      </View>
      {showPercentage && (
        <Text style={styles.percentage}>{validProgress.toFixed(0)}%</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  progressContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    flex: 1,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  percentage: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
  },
});

export default ProgressBar;