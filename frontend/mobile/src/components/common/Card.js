import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * 通用卡片组件
 * @param {Object} props
 * @param {string} props.title - 卡片标题
 * @param {string} props.subtitle - 卡片副标题
 * @param {React.ReactNode} props.children - 卡片内容
 * @param {Function} props.onPress - 点击卡片回调
 * @param {string} props.icon - 图标名称
 * @param {string} props.iconColor - 图标颜色
 * @param {Object} props.style - 自定义样式
 * @param {Object} props.contentStyle - 内容区域自定义样式
 * @param {React.ReactNode} props.rightComponent - 右侧自定义组件
 * @param {boolean} props.disabled - 是否禁用点击
 */
const Card = ({
  title,
  subtitle,
  children,
  onPress,
  icon,
  iconColor = '#1890ff',
  style = {},
  contentStyle = {},
  rightComponent,
  disabled = false,
}) => {
  const CardContainer = onPress ? TouchableOpacity : View;
  
  return (
    <CardContainer 
      style={[styles.container, style]} 
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {(title || icon) && (
        <View style={styles.header}>
          {icon && (
            <Ionicons name={icon} size={20} color={iconColor} style={styles.icon} />
          )}
          <View style={styles.titleContainer}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {rightComponent}
        </View>
      )}
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>
    </CardContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  icon: {
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  content: {
    padding: 12,
  },
});

export default Card;