import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * 通用空状态组件
 * @param {Object} props
 * @param {string} props.icon - 图标名称
 * @param {string} props.title - 标题文本
 * @param {string} props.message - 描述文本
 * @param {string} props.buttonText - 按钮文本
 * @param {Function} props.onButtonPress - 按钮点击回调
 * @param {string} props.iconColor - 图标颜色
 * @param {Object} props.style - 自定义样式
 */
const EmptyState = ({
  icon = 'document-outline',
  title = '暂无数据',
  message = '没有找到相关数据',
  buttonText,
  onButtonPress,
  iconColor = '#ccc',
  style = {},
}) => {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name={icon} size={60} color={iconColor} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {buttonText && onButtonPress && (
        <TouchableOpacity style={styles.button} onPress={onButtonPress}>
          <Text style={styles.buttonText}>{buttonText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#1890ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default EmptyState;