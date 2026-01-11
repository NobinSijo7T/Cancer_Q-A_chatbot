import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Fade out and finish
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (onFinish) onFinish();
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim }
            ],
          },
        ]}
      >
        {/* Icon Circle with Gradient Effect */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircleOuter}>
            <View style={styles.iconCircleMiddle}>
              <View style={styles.iconCircleInner}>
                <Text style={styles.iconText}>🎗️</Text>
              </View>
            </View>
          </View>
        </View>

        {/* App Name */}
        <Text style={styles.appName}>Cancer QA</Text>
        <Text style={styles.subtitle}>Your Health Assistant</Text>

        {/* Loading Indicator */}
        <View style={styles.loadingContainer}>
          <View style={styles.loadingDot} />
          <View style={[styles.loadingDot, styles.loadingDotDelay1]} />
          <View style={[styles.loadingDot, styles.loadingDotDelay2]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 30,
  },
  iconCircleOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleMiddle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#E9D5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 48,
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 40,
  },
  loadingContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C3AED',
  },
  loadingDotDelay1: {
    opacity: 0.6,
  },
  loadingDotDelay2: {
    opacity: 0.3,
  },
});
