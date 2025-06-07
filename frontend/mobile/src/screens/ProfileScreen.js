import React from 'react';
import { StyleSheet, View, Alert, SafeAreaView, ScrollView } from 'react-native';
import { Title, Paragraph, Button, Card, Divider, List } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { USER_ROLES } from '../../App';

const ProfileScreen = ({ navigation }) => {
  const { signOut, role, showRoleSelector, token } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      "登出",
      "您确定要登出吗？",
      [
        {
          text: "取消",
          style: "cancel"
        },
        { 
          text: "确定", 
          onPress: async () => {
            await signOut();
          }
        }
      ]
    );
  };

  const handleRoleSwitch = () => {
    Alert.alert(
      "切换身份",
      "选择您要切换到的身份模式",
      [
        {
          text: "取消",
          style: "cancel"
        },
        {
          text: "重新选择",
          onPress: () => showRoleSelector()
        }
      ]
    );
  };

  const getRoleDisplayName = (userRole) => {
    switch (userRole) {
      case USER_ROLES.PARENT:
        return '家长';
      case USER_ROLES.STUDENT:
        return '学生';
      case USER_ROLES.TEACHER:
        return '教师';
      default:
        return '游客';
    }
  };

  const getRoleIcon = (userRole) => {
    switch (userRole) {
      case USER_ROLES.PARENT:
        return 'people';
      case USER_ROLES.STUDENT:
        return 'school';
      case USER_ROLES.TEACHER:
        return 'library';
      default:
        return 'person';
    }
  };

  const getRoleColor = (userRole) => {
    switch (userRole) {
      case USER_ROLES.PARENT:
        return '#4a90e2';
      case USER_ROLES.STUDENT:
        return '#52c41a';
      case USER_ROLES.TEACHER:
        return '#fa8c16';
      default:
        return '#666';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.avatarContainer, { backgroundColor: getRoleColor(role) }]}>
            <Ionicons name={getRoleIcon(role)} size={40} color="#fff" />
          </View>
          <Title style={styles.title}>个人中心</Title>
          <Paragraph style={styles.subtitle}>
            当前身份：{getRoleDisplayName(role)}
          </Paragraph>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <List.Section>
              <List.Subheader>账户信息</List.Subheader>
              <List.Item
                title="当前身份"
                description={getRoleDisplayName(role)}
                left={() => <List.Icon icon={getRoleIcon(role)} color={getRoleColor(role)} />}
                right={() => <List.Icon icon="chevron-right" />}
                onPress={handleRoleSwitch}
              />
              <Divider />
              <List.Item
                title="账户状态"
                description={token === 'guest_token' ? '游客模式' : '已登录'}
                left={() => <List.Icon icon="account-check" />}
              />
            </List.Section>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <List.Section>
              <List.Subheader>应用设置</List.Subheader>
              <List.Item
                title="切换身份"
                description="更改使用模式"
                left={() => <List.Icon icon="account-switch" />}
                right={() => <List.Icon icon="chevron-right" />}
                onPress={handleRoleSwitch}
              />
              <Divider />
              <List.Item
                title="修改资料"
                description="编辑个人信息"
                left={() => <List.Icon icon="account-edit" />}
                right={() => <List.Icon icon="chevron-right" />}
                onPress={() => Alert.alert("功能建设中", "修改资料功能正在开发中。")}
              />
              <Divider />
              <List.Item
                title="应用设置"
                description="通知、隐私等设置"
                left={() => <List.Icon icon="cog" />}
                right={() => <List.Icon icon="chevron-right" />}
                onPress={() => Alert.alert("功能建设中", "应用设置功能正在开发中。")}
              />
            </List.Section>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <List.Section>
              <List.Subheader>帮助与支持</List.Subheader>
              <List.Item
                title="使用帮助"
                description="查看使用指南"
                left={() => <List.Icon icon="help-circle" />}
                right={() => <List.Icon icon="chevron-right" />}
                onPress={() => Alert.alert("功能建设中", "帮助功能正在开发中。")}
              />
              <Divider />
              <List.Item
                title="意见反馈"
                description="提交问题和建议"
                left={() => <List.Icon icon="message-alert" />}
                right={() => <List.Icon icon="chevron-right" />}
                onPress={() => Alert.alert("功能建设中", "反馈功能正在开发中。")}
              />
              <Divider />
              <List.Item
                title="关于我们"
                description="应用版本信息"
                left={() => <List.Icon icon="information" />}
                right={() => <List.Icon icon="chevron-right" />}
                onPress={() => Alert.alert("关于", "小学生学习追踪系统 v1.0.0")}
              />
            </List.Section>
          </Card.Content>
        </Card>

        <View style={styles.logoutContainer}>
          <Button 
            mode="contained" 
            onPress={handleLogout} 
            style={styles.logoutButton}
            icon="logout"
            buttonColor="#ff4d4f"
          >
            退出登录
          </Button>
        </View>
      </ScrollView>
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
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
  },
  logoutContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  logoutButton: {
    paddingVertical: 8,
  },
});

export default ProfileScreen; 