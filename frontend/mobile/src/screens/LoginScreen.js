import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
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
      const { token, user } = response.data;
      
      // 保存token和用户信息，包括角色
      await signIn(token, { 
        role: user?.role,
        username: user?.username,
        id: user?.id 
      });
      
      Alert.alert('登录成功', '欢迎回来!');
    } catch (error) {
      console.error('登录失败:', error);
      Alert.alert('登录失败', error.response?.data?.message || '用户名或密码错误');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    Alert.alert(
      '游客模式',
      '您将以游客身份体验应用功能，部分功能可能受限。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '继续', 
          onPress: async () => {
            await signIn('guest_token', { role: 'guest' });
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Ionicons name="school" size={60} color="#4a90e2" />
        </View>
        <Text style={styles.title}>小学生学习追踪系统</Text>
        <Text style={styles.subtitle}>让学习更有趣，让成长更精彩</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="请输入用户名"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="请输入密码"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Button 
          mode="contained" 
          onPress={handleLogin} 
          style={styles.loginButton}
          loading={loading}
          disabled={loading}
          buttonColor="#4a90e2"
        >
          {loading ? '登录中...' : '登录'}
        </Button>

        <TouchableOpacity 
          style={styles.guestButton}
          onPress={handleGuestLogin}
          disabled={loading}
        >
          <Text style={styles.guestButtonText}>游客体验</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          首次使用？请联系管理员获取账号
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
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  loginButton: {
    marginTop: 20,
    paddingVertical: 8,
    borderRadius: 12,
  },
  guestButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  guestButtonText: {
    color: '#4a90e2',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default LoginScreen;