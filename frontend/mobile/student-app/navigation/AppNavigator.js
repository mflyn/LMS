import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';

// 导入学生端屏幕
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import HomeworkScreen from './screens/HomeworkScreen';
import ResourcesScreen from './screens/ResourcesScreen';
import ResourceDetailScreen from './screens/ResourceDetailScreen';
import ProfileScreen from './screens/ProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// 主页面导航
function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === '学习进度') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === '作业') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === '学习资源') {
            iconName = focused ? 'library' : 'library-outline';
          } else if (route.name === '个人') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1890ff',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="学习进度" component={DashboardScreen} />
      <Tab.Screen name="作业" component={HomeworkScreen} />
      <Tab.Screen name="学习资源" component={ResourcesScreen} />
      <Tab.Screen name="个人" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// 根导航
export default function AppNavigator() {
  const { isAuthenticated } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainNavigator} />
          <Stack.Screen 
            name="ResourceDetail" 
            component={ResourceDetailScreen} 
            options={{ headerShown: true, title: '资源详情' }}
          />
          <Stack.Screen 
            name="Notifications" 
            component={NotificationsScreen} 
            options={{ headerShown: true, title: '消息通知' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}