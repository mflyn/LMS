import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/contexts/AuthContext';
import { NetworkProvider, useNetwork } from '../src/contexts/NetworkContext';
import AppNavigator from './navigation/AppNavigator';

// 离线模式指示器组件
const OfflineBanner = () => {
  const { isOfflineMode } = useNetwork();
  
  if (!isOfflineMode) return null;
  
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineText}>离线模式 - 部分功能可能受限</Text>
    </View>
  );
};

// 主应用组件
const MainApp = () => {
  return (
    <AuthProvider>
      <NavigationContainer>
        <OfflineBanner />
        <AppNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </AuthProvider>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <MainApp />
      </NetworkProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: '#f8d7da',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  offlineText: {
    color: '#721c24',
    fontWeight: 'bold',
  },
});