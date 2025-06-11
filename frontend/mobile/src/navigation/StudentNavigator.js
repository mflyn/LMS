import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { LazyLoadErrorBoundary } from '../utils/LazyLoader';

// 导入懒加载屏幕
import {
  LazyStudentDashboard,
  LazyHomeworkScreen,
  LazyResourcesScreen,
  LazyResourceDetailScreen,
  LazyStudentProfileScreen,
  LazyStudentNotificationsScreen,
} from '../screens/LazyScreens';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// 学生端主页面导航
function StudentMainNavigator() {
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
        headerShown: false,
      })}
    >
      <Tab.Screen name="学习进度" component={LazyStudentDashboard} />
      <Tab.Screen name="作业" component={LazyHomeworkScreen} />
      <Tab.Screen name="学习资源" component={LazyResourcesScreen} />
      <Tab.Screen name="个人" component={LazyStudentProfileScreen} />
    </Tab.Navigator>
  );
}

// 学生端根导航
export default function StudentNavigator() {
  return (
    <LazyLoadErrorBoundary>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="StudentMain" component={StudentMainNavigator} />
        <Stack.Screen 
          name="ResourceDetail" 
          component={LazyResourceDetailScreen} 
          options={{ headerShown: true, title: '资源详情' }}
        />
        <Stack.Screen 
          name="Notifications" 
          component={LazyStudentNotificationsScreen} 
          options={{ headerShown: true, title: '消息通知' }}
        />
      </Stack.Navigator>
    </LazyLoadErrorBoundary>
  );
} 