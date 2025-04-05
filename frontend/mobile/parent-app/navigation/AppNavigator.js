import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';

// 导入家长端屏幕
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import ChildrenScreen from './screens/ChildrenScreen';
import InteractionScreen from './screens/InteractionScreen';
import MeetingScreen from './screens/MeetingScreen';
import ProfileScreen from './screens/ProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import HomeworkDetailScreen from './screens/HomeworkDetailScreen';
import ChildDetailScreen from './screens/ChildDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// 主页面导航
function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === '学习概览') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === '孩子') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === '家校互动') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === '个人') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1890ff',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="学习概览" component={DashboardScreen} />
      <Tab.Screen name="孩子" component={ChildrenScreen} />
      <Tab.Screen name="家校互动" component={InteractionScreen} />
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
            name="Notifications" 
            component={NotificationsScreen} 
            options={{ headerShown: true, title: '消息通知' }}
          />
          <Stack.Screen 
            name="HomeworkDetail" 
            component={HomeworkDetailScreen} 
            options={{ headerShown: true, title: '作业详情' }}
          />
          <Stack.Screen 
            name="ChildDetail" 
            component={ChildDetailScreen} 
            options={{ headerShown: true, title: '孩子详情' }}
          />
          <Stack.Screen 
            name="Meeting" 
            component={MeetingScreen} 
            options={{ headerShown: true, title: '家长会' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}