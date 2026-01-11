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
  Dimensions,
  useWindowDimensions,
  Image,
  Linking,
  Clipboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { sendQuestion, sendFeedback, checkBackendConnection } from './api';
import SplashScreen from './SplashScreen';
import HistoryModal from './HistoryModal';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const scrollViewRef = useRef();
  const { width } = useWindowDimensions();
  
  // Determine if we're on a large screen (web/tablet)
  const isLargeScreen = width > 768;

  useEffect(() => {
    // Generate a unique conversation ID when the app starts
    setConversationId(generateId());
    
    // Check backend connection
    checkBackendConnection().then(connected => {
      setBackendConnected(connected);
      if (!connected) {
        Alert.alert(
          'Backend Unavailable',
          'Cannot connect to the Cancer QA backend. Please make sure the Flask server is running on port 5001.',
          [{ text: 'OK' }]
        );
      }
    });
    
    // Add welcome message
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

  const getInitials = (name) => {
    return name ? name.substring(0, 2).toUpperCase() : 'AI';
  };

  const renderFormattedText = (text) => {
    // Split text by markdown patterns for bold and italic
    const parts = [];
    let currentIndex = 0;
    
    // Regex to match **bold** and *italic*
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        parts.push({
          text: text.substring(currentIndex, match.index),
          style: 'normal'
        });
      }
      
      // Add the matched text with appropriate style
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
    
    // Add remaining text
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

  const openLink = (url) => {
    Linking.openURL(url).catch(err => {
      Alert.alert('Error', 'Could not open link');
    });
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
      const response = await sendQuestion(userMessage.text, conversationId);
      
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

  const handleFeedback = async (messageId, isPositive) => {
    try {
      const message = messages.find((m) => m.id === messageId);
      if (message && message.conversationId) {
        await sendFeedback(message.conversationId, isPositive ? 1 : -1);
        Alert.alert('Thank you!', 'Your feedback has been recorded.');
      }
    } catch (error) {
      console.error('Feedback error:', error);
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

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <HistoryModal
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        onSelectConversation={handleSelectConversation}
      />
      
      <View style={[styles.appWrapper, isLargeScreen && styles.webContainer]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Cancer QA</Text>
            <View style={styles.headerRight}>
              <View style={[styles.statusDot, backendConnected ? styles.statusConnected : styles.statusDisconnected]} />
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => setShowHistory(true)}
              >
                <Text style={styles.settingsIcon}>⚙️</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Chat Messages */}
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
                      <View style={styles.botAvatarInner} />
                    </View>
                  </View>
                )}
                
                <View
                  style={[
                    styles.messageBubble,
                    message.isUser ? styles.userMessage : styles.botMessage,
                  ]}
                >
                  <Text style={[
                    styles.messageText,
                    message.isUser ? styles.userMessageText : styles.botMessageText
                  ]}>
                    {message.isUser ? message.text : renderFormattedText(message.text)}
                  </Text>
                  
                  {/* Copy Button for Bot Messages */}
                  {!message.isUser && !message.isError && (
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={() => copyToClipboard(message.text)}
                    >
                      <Text style={styles.copyButtonText}>📋 Copy</Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* Sources Section */}
                  {!message.isUser && message.sources && message.sources.length > 0 && (
                    <View style={styles.sourcesContainer}>
                      <Text style={styles.sourcesTitle}>Sources:</Text>
                      {message.sources.map((source, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={styles.sourceItem}
                          onPress={() => openLink(source.link)}
                        >
                          <Text style={styles.sourceNumber}>{idx + 1}.</Text>
                          <View style={styles.sourceContent}>
                            <Text style={styles.sourceTitle} numberOfLines={2}>
                              {source.title}
                            </Text>
                            <Text style={styles.sourceLink} numberOfLines={1}>
                              {source.link}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                
                {message.isUser && (
                  <View style={styles.avatarContainer}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.avatarText}>👤</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
            
            {loading && (
              <View style={[styles.messageRow, styles.botMessageRow]}>
                <View style={styles.avatarContainer}>
                  <View style={styles.botAvatar}>
                    <View style={styles.botAvatarInner} />
                  </View>
                </View>
                <View style={[styles.messageBubble, styles.botMessage]}>
                  <ActivityIndicator size="small" color="#7C3AED" />
                  <Text style={styles.loadingText}>Thinking...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input Area */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Send a message"
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={500}
                editable={!loading}
              />
            </View>
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
              disabled={!inputText.trim() || loading}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  appWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webContainer: {
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'web' ? 20 : 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 18,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusConnected: {
    backgroundColor: '#10B981',
  },
  statusDisconnected: {
    backgroundColor: '#EF4444',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FDF2F8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F9A8D4',
  },
  botAvatarInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EC4899',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
  },
  messageBubble: {
    maxWidth: '70%',
    borderRadius: 20,
    padding: 16,
  },
  userMessage: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  botMessage: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#111827',
  },
  botMessageText: {
    color: '#374151',
  },
  boldText: {
    fontWeight: '700',
  },
  italicText: {
    fontStyle: 'italic',
  },
  copyButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  copyButtonText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  sourcesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sourcesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  sourceItem: {
    flexDirection: 'row',
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sourceNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
    marginRight: 8,
    marginTop: 2,
  },
  sourceContent: {
    flex: 1,
  },
  sourceTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  sourceLink: {
    fontSize: 11,
    color: '#7C3AED',
    textDecorationLine: 'underline',
  },
  messageActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 16,
  },
  loadingText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 10,
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    alignItems: 'center',
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputIconButton: {
    marginRight: 8,
  },
  inputIcon: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    maxHeight: 100,
    outlineStyle: 'none',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    fontSize: 20,
  },
});
