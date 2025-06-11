import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { LazyLoadErrorBoundary } from '../utils/LazyLoader';

// 导入懒加载屏幕
import {
  LazyParentDashboard,
  LazyChildrenScreen,
  LazyInteractionScreen,
  LazyParentProfileScreen,
  LazyNotificationsScreen,
  LazyHomeworkDetailScreen,
  LazyChildDetailScreen,
  LazyMeetingScreen,
} from '../screens/LazyScreens';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// 家长端主页面导航
function ParentMainNavigator() {
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
        headerShown: false,
      })}
    >
      <Tab.Screen name="学习概览" component={LazyParentDashboard} />
      <Tab.Screen name="孩子" component={LazyChildrenScreen} />
      <Tab.Screen name="家校互动" component={LazyInteractionScreen} />
      <Tab.Screen name="个人" component={LazyParentProfileScreen} />
    </Tab.Navigator>
  );
}

// 家长端根导航
export default function ParentNavigator() {
  return (
    <LazyLoadErrorBoundary>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ParentMain" component={ParentMainNavigator} />
        <Stack.Screen 
          name="Notifications" 
          component={LazyNotificationsScreen} 
          options={{ headerShown: true, title: '消息通知' }}
        />
        <Stack.Screen 
          name="HomeworkDetail" 
          component={LazyHomeworkDetailScreen} 
          options={{ headerShown: true, title: '作业详情' }}
        />
        <Stack.Screen 
          name="ChildDetail" 
          component={LazyChildDetailScreen} 
          options={{ headerShown: true, title: '孩子详情' }}
        />
        <Stack.Screen 
          name="Meeting" 
          component={LazyMeetingScreen} 
          options={{ headerShown: true, title: '家长会' }}
        />
      </Stack.Navigator>
    </LazyLoadErrorBoundary>
  );
} 