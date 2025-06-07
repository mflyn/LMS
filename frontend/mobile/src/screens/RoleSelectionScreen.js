import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { USER_ROLES } from '../../App';

const { width, height } = Dimensions.get('window');

const RoleSelectionScreen = () => {
  const { switchRole, token } = useAuth();

  const handleRoleSelection = async (role) => {
    await switchRole(role);
  };

  const roleOptions = [
    {
      role: USER_ROLES.PARENT,
      title: '家长端',
      subtitle: '监督孩子学习进度',
      icon: 'people-outline',
      color: '#4a90e2',
      description: '查看孩子学习报告、与老师沟通、参与家校互动',
    },
    {
      role: USER_ROLES.STUDENT,
      title: '学生端',
      subtitle: '开始我的学习之旅',
      icon: 'school-outline',
      color: '#52c41a',
      description: '完成作业、查看学习资源、参与课堂互动',
    },
    {
      role: USER_ROLES.TEACHER,
      title: '教师端',
      subtitle: '管理班级和学生',
      icon: 'library-outline',
      color: '#fa8c16',
      description: '发布作业、管理学生、查看学习分析',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>选择您的身份</Text>
        <Text style={styles.subtitle}>请选择您要使用的功能模式</Text>
      </View>

      <View style={styles.rolesContainer}>
        {roleOptions.map((option) => (
          <TouchableOpacity
            key={option.role}
            style={[styles.roleCard, { borderColor: option.color }]}
            onPress={() => handleRoleSelection(option.role)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, { backgroundColor: option.color }]}>
              <Ionicons name={option.icon} size={40} color="#fff" />
            </View>
            
            <View style={styles.roleInfo}>
              <Text style={styles.roleTitle}>{option.title}</Text>
              <Text style={styles.roleSubtitle}>{option.subtitle}</Text>
              <Text style={styles.roleDescription}>{option.description}</Text>
            </View>

            <View style={styles.arrowContainer}>
              <Ionicons name="chevron-forward" size={24} color="#ccc" />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          您可以随时在设置中切换身份模式
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  rolesContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  roleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  roleSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  roleDescription: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
  },
  arrowContainer: {
    marginLeft: 10,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default RoleSelectionScreen; 