import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';

// For Android emulator use 10.0.2.2, for web use localhost
const getApiUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:5001';
  }
  return Constants.expoConfig?.extra?.apiUrl || 'http://10.0.2.2:5001';
};

const API_URL = getApiUrl();

export const checkBackendConnection = async () => {
  try {
    const response = await axios.get(`${API_URL}/`, {
      timeout: 5000,
    });
    return true;
  } catch (error) {
    console.error('Backend connection failed:', error.message);
    return false;
  }
};

export const sendQuestion = async (question, conversationId) => {
  try {
    const response = await axios.post(`${API_URL}/question`, {
      question,
      conversation_id: conversationId,
    }, {
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    console.error('Error sending question:', error);
    throw error;
  }
};

export const sendFeedback = async (conversationId, feedback) => {
  try {
    const response = await axios.post(`${API_URL}/feedback`, {
      conversation_id: conversationId,
      feedback,
    });
    return response.data;
  } catch (error) {
    console.error('Error sending feedback:', error);
    throw error;
  }
};

export const getHistory = async (limit = 50) => {
  try {
    const response = await axios.get(`${API_URL}/history`, {
      params: { limit },
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching history:', error);
    throw error;
  }
};
