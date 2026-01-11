import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';

// Railway backend URL
const API_URL = 'https://cancer-qa-backend-production-b6b8.up.railway.app';

console.log('Using API URL:', API_URL);

export const checkBackendConnection = async () => {
  try {
    console.log('Checking backend connection to:', API_URL);
    const response = await axios.get(`${API_URL}/`, {
      timeout: 15000, // Increased timeout for cold starts
    });
    console.log('Backend connection successful');
    return true;
  } catch (error) {
    console.error('Backend connection failed:', error.message);
    return false;
  }
};

export const sendQuestion = async (question, conversationId) => {
  try {
    console.log('Sending question to:', `${API_URL}/question`);
    const response = await axios.post(`${API_URL}/question`, {
      question,
      conversation_id: conversationId,
    }, {
      timeout: 60000, // 60 seconds for AI response
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('Response received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending question:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
};

export const sendFeedback = async (conversationId, feedback) => {
  try {
    const response = await axios.post(`${API_URL}/feedback`, {
      conversation_id: conversationId,
      feedback,
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
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
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching history:', error);
    throw error;
  }
};
