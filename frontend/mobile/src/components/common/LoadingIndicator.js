import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

/**
 * 通用加载指示器组件
 * @param {Object} props
 * @param {boolean} props.loading - 是否显示加载状态
 * @param {string} props.size - 加载图标大小 ('small' 或 'large')
 * @param {string} props.color - 加载图标颜色
 * @param {string} props.text - 加载文本
 * @param {Object} props.style - 自定义样式
 */
const LoadingIndicator = ({ 
  loading = true, 
  size = 'large', 
  color = '#1890ff', 
  text = '加载中...', 
  style = {} 
}) => {
  if (!loading) return null;
  
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={color} />
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

export default LoadingIndicator;