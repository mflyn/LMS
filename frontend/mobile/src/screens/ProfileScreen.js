import React from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { Title, Paragraph, Button } from 'react-native-paper';
// import { useAuth } from '../contexts/AuthContext'; // 引入AuthContext用于登出

const ProfileScreen = ({ navigation }) => {
  // const { logout } = useAuth(); // 获取登出函数

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
          onPress: () => {
            // 在实际应用中，这里会调用 logout()
            // await logout(); 
            // 导航到登录页，使用 replace 防止用户返回到认证后的页面
            navigation.replace('Login'); 
            console.log("用户已登出");
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Title style={styles.title}>个人资料</Title>
      <Paragraph style={styles.paragraph}>
        这里将显示用户的详细信息和设置选项。
      </Paragraph>
      
      {/* 示例：用户信息展示 */}
      {/* 
      <View style={styles.userInfoSection}>
        <Paragraph>用户名: John Doe</Paragraph>
        <Paragraph>邮箱: john.doe@example.com</Paragraph>
        <Paragraph>角色: 学生</Paragraph>
      </View> 
      */}

      <Button 
        mode="contained" 
        onPress={handleLogout} 
        style={styles.button}
        icon="logout"
      >
        登出
      </Button>

      <Button 
        mode="outlined" 
        onPress={() => Alert.alert("功能建设中", "修改资料功能正在开发中。")} 
        style={styles.button}
      >
        修改资料
      </Button>

      <Button 
        mode="outlined" 
        onPress={() => Alert.alert("功能建设中", "应用设置功能正在开发中。")} 
        style={styles.button}
      >
        应用设置
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  paragraph: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  userInfoSection: {
    marginBottom: 30,
    alignItems: 'flex-start',
    width: '100%',
  },
  button: {
    marginTop: 15,
    width: '80%',
  },
});

export default ProfileScreen; 