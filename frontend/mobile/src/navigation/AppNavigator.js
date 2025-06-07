import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// 导入现有页面
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

// 导入新页面
import ResourcesScreen from '../screens/ResourcesScreen';
import ResourceDetailScreen from '../screens/ResourceDetailScreen';
import InteractionScreen from '../screens/InteractionScreen';
import VideoMeetingScreen from '../screens/VideoMeetingScreen';
import MeetingListScreen from '../screens/MeetingListScreen';
import ProfileScreen from '../screens/ProfileScreen';

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
  const { token } = useAuth();
  
  return (
    <Stack.Navigator
      initialRouteName={token ? "Main" : "Login"}
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
      {token ? (
        // 已登录用户的导航栈
        <>
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
        </>
      ) : (
        // 未登录用户的导航栈
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;