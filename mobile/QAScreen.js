import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Clipboard,
} from 'react-native';
import { sendQuestion, sendFeedback } from './api';
import HistoryModal from './HistoryModal';

export default function QAScreen({ backendConnected }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const scrollViewRef = useRef();
  const { width } = useWindowDimensions();
  
  const isLargeScreen = width > 768;

  useEffect(() => {
    setConversationId(generateId());
    
    setMessages([
      {
        id: '0',
        text: 'Hello! I\'m your Cancer Q&A assistant. Ask me anything about cancer types, prevention, diagnosis, or treatment.',
        isUser: false,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const renderFormattedText = (text) => {
    const parts = [];
    let currentIndex = 0;
    
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > currentIndex) {
        parts.push({
          text: text.substring(currentIndex, match.index),
          style: 'normal'
        });
      }
      
      const matchedText = match[0];
      if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
        parts.push({
          text: matchedText.slice(2, -2),
          style: 'bold'
        });
      } else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
        parts.push({
          text: matchedText.slice(1, -1),
          style: 'italic'
        });
      }
      
      currentIndex = match.index + matchedText.length;
    }
    
    if (currentIndex < text.length) {
      parts.push({
        text: text.substring(currentIndex),
        style: 'normal'
      });
    }
    
    return parts.map((part, index) => (
      <Text
        key={index}
        style={[
          part.style === 'bold' && styles.boldText,
          part.style === 'italic' && styles.italicText,
        ]}
      >
        {part.text}
      </Text>
    ));
  };

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage = {
      id: generateId(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const conversationHistory = messages
        .filter(m => m.id !== '0')
        .map(m => ({
          role: m.isUser ? 'user' : 'assistant',
          content: m.text
        }));
      
      conversationHistory.push({
        role: 'user',
        content: userMessage.text
      });

      const response = await sendQuestion(userMessage.text, conversationId, conversationHistory);
      
      const botMessage = {
        id: generateId(),
        text: response.answer,
        isUser: false,
        timestamp: new Date(),
        conversationId: response.conversation_id,
        relevance: response.relevance,
        sources: response.sources || [],
      };

      setMessages((prev) => [...prev, botMessage]);
      
      if (response.conversation_id && !conversationId) {
        setConversationId(response.conversation_id);
      }
    } catch (error) {
      Alert.alert(
        'Connection Error',
        'Failed to connect to the server. Please make sure the Flask backend is running.',
        [{ text: 'OK' }]
      );
      
      const errorMessage = {
        id: generateId(),
        text: 'Sorry, I couldn\'t process your request. Please check your connection and try again.',
        isUser: false,
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    Clipboard.setString(text);
    Alert.alert('Copied!', 'Text copied to clipboard');
  };

  const handleSelectConversation = (conversation) => {
    const userMsg = {
      id: generateId(),
      text: conversation.question,
      isUser: true,
      timestamp: new Date(),
    };
    
    const botMsg = {
      id: generateId(),
      text: conversation.answer,
      isUser: false,
      timestamp: new Date(),
    };
    
    setMessages([...messages, userMsg, botMsg]);
  };

  return (
    <View style={styles.container}>
      <HistoryModal
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        onSelectConversation={handleSelectConversation}
      />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ask Questions</Text>
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => setShowHistory(true)}
        >
          <Text style={styles.historyIcon}>📋</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageRow,
                message.isUser ? styles.userMessageRow : styles.botMessageRow,
              ]}
            >
              {!message.isUser && (
                <View style={styles.avatarContainer}>
                  <View style={styles.botAvatar}>
                    <Text style={styles.avatarEmoji}>🩺</Text>
                  </View>
                </View>
              )}
              
              <View
                style={[
                  styles.messageBubble,
                  message.isUser ? styles.userMessage : styles.botMessage,
                  message.isError && styles.errorMessage,
                ]}
              >
                <Text style={[
                  styles.messageText,
                  message.isUser ? styles.userMessageText : styles.botMessageText
                ]}>
                  {message.isUser ? message.text : renderFormattedText(message.text)}
                </Text>
                
                {!message.isUser && !message.isError && (
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => copyToClipboard(message.text)}
                  >
                    <Text style={styles.copyButtonText}>Copy</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {message.isUser && (
                <View style={styles.avatarContainer}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.avatarEmoji}>👤</Text>
                  </View>
                </View>
              )}
            </View>
          ))}
          
          {loading && (
            <View style={[styles.messageRow, styles.botMessageRow]}>
              <View style={styles.avatarContainer}>
                <View style={styles.botAvatar}>
                  <Text style={styles.avatarEmoji}>🩺</Text>
                </View>
              </View>
              <View style={[styles.messageBubble, styles.botMessage, styles.loadingBubble]}>
                <ActivityIndicator size="small" color="#FF2D55" />
                <Text style={styles.loadingText}>Analyzing...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about cancer..."
              placeholderTextColor="#8E8E93"
              multiline
              maxLength={500}
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || loading}
            >
              <Text style={styles.sendIcon}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  historyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyIcon: {
    fontSize: 16,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  botMessageRow: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginHorizontal: 8,
  },
  botAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF2D55',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 20,
    padding: 14,
    paddingHorizontal: 16,
  },
  userMessage: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 6,
  },
  botMessage: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  errorMessage: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  botMessageText: {
    color: '#1C1C1E',
  },
  boldText: {
    fontWeight: '600',
    color: '#FF2D55',
  },
  italicText: {
    fontStyle: 'italic',
    color: '#8E8E93',
  },
  copyButton: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  copyButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  inputWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    minHeight: 48,
  },
  input: {
    flex: 1,
    color: '#1C1C1E',
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
    letterSpacing: -0.2,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF2D55',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  sendIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
