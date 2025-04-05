import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// 导入现有页面
import LoginScreen from '../components/LoginScreen';
import DashboardScreen from '../components/DashboardScreen';
import NotificationsScreen from '../components/NotificationsScreen';

// 导入新页面
import ResourcesScreen from '../components/ResourcesScreen';
import ResourceDetailScreen from '../components/ResourceDetailScreen';
import InteractionScreen from '../components/InteractionScreen';
import VideoMeetingScreen from '../components/VideoMeetingScreen';
import MeetingListScreen from '../components/MeetingListScreen';
import ProfileScreen from '../components/ProfileScreen';

// 创建导航器
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// 主页面底部标签导航
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#4a90e2',
        tabBarInactiveTintColor: 'gray',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = 'home-outline';
          } else if (route.name === 'Resources') {
            iconName = 'book-outline';
          } else if (route.name === 'Interaction') {
            iconName = 'chatbubbles-outline';
          } else if (route.name === 'Notifications') {
            iconName = 'notifications-outline';
          } else if (route.name === 'Profile') {
            iconName = 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{ tabBarLabel: '首页', headerShown: false }}
      />
      <Tab.Screen 
        name="Resources" 
        component={ResourcesScreen} 
        options={{ tabBarLabel: '资源', headerShown: false }}
      />
      <Tab.Screen 
        name="Interaction" 
        component={InteractionScreen} 
        options={{ tabBarLabel: '互动', headerShown: false }}
      />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ tabBarLabel: '通知', headerShown: false }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ tabBarLabel: '我的', headerShown: false }}
      />
    </Tab.Navigator>
  );
};

// 主导航栈
const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#4a90e2',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Main" 
        component={MainTabNavigator} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ResourceDetail" 
        component={ResourceDetailScreen} 
        options={{ title: '资源详情' }}
      />
      <Stack.Screen 
        name="VideoMeeting" 
        component={VideoMeetingScreen} 
        options={{ title: '视频会议' }}
      />
      <Stack.Screen 
        name="MeetingList" 
        component={MeetingListScreen} 
        options={{ title: '会议列表' }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;