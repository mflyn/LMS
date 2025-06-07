import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Button } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('登录失败', '请输入用户名和密码');
      return;
    }

    setLoading(true);
    try {
      // 调用登录API
      const response = await apiService.auth.login({ username, password });
      const { token } = response.data;
      
      // 保存token并更新认证状态
      await signIn(token);
      
      // 导航到主页面
      navigation.replace('Main');
      
      Alert.alert('登录成功', '欢迎回来!');
    } catch (error) {
      console.error('登录失败:', error);
      Alert.alert('登录失败', error.response?.data?.message || '用户名或密码错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>小学生学习追踪系统</Text>
      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="用户名"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="密码"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Button 
          mode="contained" 
          onPress={handleLogin} 
          style={styles.button}
          loading={loading}
          disabled={loading}
        >
          {loading ? '登录中...' : '登录'}
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  formContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  button: {
    marginTop: 10,
    paddingVertical: 5,
  },
});

export default LoginScreen;