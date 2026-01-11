import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { checkBackendConnection } from './api';
import SplashScreen from './SplashScreen';
import QAScreen from './QAScreen';
import ReportAnalysisScreen from './ReportAnalysisScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [backendConnected, setBackendConnected] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    checkBackendConnection().then(connected => {
      setBackendConnected(connected);
      if (!connected) {
        Alert.alert(
          'Backend Unavailable',
          'Cannot connect to the Cancer QA backend. Please make sure the server is running.',
          [{ text: 'OK' }]
        );
      }
    });
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Cancer Q&A</Text>
            <Text style={styles.headerSubtitle}>Your Health Assistant</Text>
          </View>
          <View style={[styles.statusIndicator, backendConnected ? styles.statusConnected : styles.statusDisconnected]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{backendConnected ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        {/* Tab Navigator */}
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#FF2D55',
            tabBarInactiveTintColor: '#8E8E93',
            tabBarStyle: {
              backgroundColor: '#FFFFFF',
              borderTopWidth: 0.5,
              borderTopColor: 'rgba(0,0,0,0.1)',
              paddingTop: 8,
              paddingBottom: 8,
              height: 60,
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '600',
              marginTop: 4,
            },
          }}
        >
          <Tab.Screen
            name="Q&A"
            options={{
              tabBarIcon: ({ color, size }) => (
                <Text style={{ fontSize: 24 }}>💬</Text>
              ),
            }}
          >
            {() => <QAScreen backendConnected={backendConnected} />}
          </Tab.Screen>
          
          <Tab.Screen
            name="Report Analysis"
            options={{
              tabBarIcon: ({ color, size }) => (
                <Text style={{ fontSize: 24 }}>📊</Text>
              ),
            }}
          >
            {() => <ReportAnalysisScreen backendConnected={backendConnected} />}
          </Tab.Screen>
        </Tab.Navigator>
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    marginTop: 2,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusConnected: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  statusDisconnected: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#34C759',
  },
});

