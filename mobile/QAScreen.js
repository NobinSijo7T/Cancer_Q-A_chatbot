import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Clipboard,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendQuestion } from './api';
import HistoryModal from './HistoryModal';
import { renderRichTextElements } from './formatRichText';

export default function QAScreen({ backendConnected }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [responseCache, setResponseCache] = useState({});
  const scrollViewRef = useRef();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [dockDragOffset, setDockDragOffset] = useState(0);
  const dockDragStartRef = useRef(0);

  const isLargeScreen = width > 768;

  /** Space reserved so messages clear the docked composer (absolute). */
  const dockReserveHeight = 96;

  const dockPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 3,
      onPanResponderGrant: () => {
        dockDragStartRef.current = dockDragOffset;
      },
      onPanResponderMove: (_, gestureState) => {
        const nextOffset = dockDragStartRef.current - gestureState.dy;
        setDockDragOffset(nextOffset);
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    })
  ).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const h = e.endCoordinates?.height;
      setKeyboardHeight(typeof h === 'number' ? h : 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    setConversationId(generateId());
    
    setMessages([
      {
        id: '0',
        text: 'Hello! I\'m your OncoConnect assistant. Ask me anything about cancer types, prevention, diagnosis, or treatment.',
        isUser: false,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const normalizeQuestion = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();

  const getCacheKey = (chatId, question) => {
    return `${chatId || 'local-chat'}::${normalizeQuestion(question)}`;
  };

  const cacheAnswer = (chatId, question, answer) => {
    const key = getCacheKey(chatId, question);
    setResponseCache((prev) => ({
      ...prev,
      [key]: answer,
    }));
  };

  const ACUTE_SYMPTOM_PATTERNS = [
    { name: 'persistent cough', pattern: /\b(persistent\s+)?cough\b/i },
    { name: 'blood in sputum', pattern: /\b(blood\s+in\s+sputum|bloody\s+sputum|hemoptysis)\b/i },
    { name: 'shortness of breath', pattern: /\b(shortness\s+of\s+breath|breathless(ness)?)\b/i },
    { name: 'chest pain', pattern: /\bchest\s+pain\b/i },
    { name: 'throat pain', pattern: /\b(throat\s+pain|sore\s+throat)\b/i },
    { name: 'red eyes', pattern: /\b(red\s+eyes?|eye\s+redness)\b/i },
    { name: 'persistent lump', pattern: /\b(persistent\s+)?(lump|mass|swelling)\b/i },
    { name: 'unexplained weight loss', pattern: /\b(unexplained\s+)?weight\s+loss\b/i },
    { name: 'persistent bleeding', pattern: /\b(persistent\s+)?bleeding\b/i },
    { name: 'difficulty swallowing', pattern: /\b(difficulty\s+swallowing|trouble\s+swallowing)\b/i },
    { name: 'persistent hoarseness', pattern: /\b(persistent\s+)?hoarseness\b/i },
    {
      name: 'fatigue or tiredness',
      pattern:
        /\b((severe\s+)?fatigue|(tired(ness)?)|exhaust(ed|ion)?|low\s+energy|feel(ing)?\s+tired|been\s+tired)\b/i,
    },
  ];

  const extractAcuteSymptoms = (text) => {
    const seen = new Set();
    const out = [];
    for (const item of ACUTE_SYMPTOM_PATTERNS) {
      if (item.pattern.test(text) && !seen.has(item.name)) {
        seen.add(item.name);
        out.push(item.name);
      }
    }
    return out;
  };

  const isPersonalSymptomMessage = (text) => {
    const hasFirstPerson = /\b(i|i'm|i am|my|me|suffering)\b/i.test(text);
    return hasFirstPerson && extractAcuteSymptoms(text).length > 0;
  };

  const isContextContinuation = (text) => {
    return /\b(also|as well|still|again|previous|before|same|continued)\b/i.test(text);
  };

  const shouldUseCache = (questionText) => {
    return !isPersonalSymptomMessage(questionText);
  };

  const enforceSingleSymptomSafety = (answer, questionText) => {
    const acuteSymptoms = extractAcuteSymptoms(questionText);
    if (!isPersonalSymptomMessage(questionText) || acuteSymptoms.length > 1) {
      return answer;
    }

    const hasStrongCancerClaim =
      /\b(you have|this is|it is)\b[^.\n]*\bcancer\b/i.test(answer) ||
      /\b(laringeal|laryngeal|hypopharyngeal|lung|breast|prostate|colorectal|ovarian|melanoma|lymphoma|leukemia|pancreatic|liver)\s+cancer\b/i.test(answer) ||
      /\bcancer(s)?\b[^.]{0,120}\b(including|such as|like)\b/i.test(answer) ||
      /\b(fatigue|tired)\b[^.]{0,100}\b(breast|lung|melanoma|lymphoma|leukemia)\s+cancer\b/i.test(answer);

    if (!hasStrongCancerClaim) {
      return answer;
    }

    return `Thank you for sharing this. With only one reported concern (${acuteSymptoms[0]}), it is not appropriate to tie it to specific cancer types. One symptom can have many common, non-cancer causes.\n\nTo help you more safely, please share:\n- How long this has been going on and whether it is changing\n- Any other symptoms (fever, pain, bleeding, weight change, new lumps)\n- Sleep, stress, medications, and relevant health background\n\nThis information is for educational purposes only and should not be considered a medical diagnosis. Please consult a qualified healthcare professional.`;
  };

  const buildContextAwareQuestion = (questionText) => {
    const acuteSymptoms = extractAcuteSymptoms(questionText);

    if (acuteSymptoms.length === 1 && isPersonalSymptomMessage(questionText)) {
      return `${questionText}\n\n[Safety instruction]\nThe user currently reports only one symptom (${acuteSymptoms[0]}). Do NOT diagnose or suggest any specific cancer type yet. Use cautious language, explain that one symptom is insufficient, and ask targeted follow-up questions about duration, progression, associated symptoms, and risk factors.`;
    }

    if (acuteSymptoms.length < 3) {
      return questionText;
    }

    return `${questionText}\n\n[Clinical response format request]\nThe user reports at least three acute symptoms: ${acuteSymptoms.join(', ')}.\nPlease provide:\n1. Most likely possible cancer-related causes (probabilistic, non-diagnostic) and key non-cancer alternatives.\n2. Why each possibility matches these symptoms.\n3. Urgency guidance and what to do next now (including red flags requiring urgent care).\n4. Typical diagnostic workup a clinician may consider.\n5. General treatment pathways that may be discussed if diagnosis is confirmed (educational only).\n6. A short empathetic disclaimer that this is educational, not a diagnosis.`;
  };

  const renderFormattedText = (text) =>
    renderRichTextElements(text, {
      boldText: styles.boldText,
      italicText: styles.italicText,
    });

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
      const acuteSymptoms = extractAcuteSymptoms(userMessage.text);
      const personalSymptomInput = isPersonalSymptomMessage(userMessage.text);

      if (personalSymptomInput && acuteSymptoms.length === 1) {
        const singleSymptomReply = `Thank you for sharing this. With only one concern (${acuteSymptoms[0]}), it is not appropriate to suggest specific cancer types or tie it to particular cancers. Many everyday and non-cancer issues can cause this.\n\nPlease share a bit more so the next answer can be safer and more useful:\n- How long this has been going on and whether it is getting worse\n- Any other symptoms (fever, pain, bleeding, weight change, new lumps, cough)\n- Sleep, stress, medications, and relevant health background\n\nThis information is for educational purposes only and should not be considered a medical diagnosis. Please consult a qualified healthcare professional.`;

        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            text: singleSymptomReply,
            isUser: false,
            timestamp: new Date(),
            relevance: 1,
            sources: [],
          },
        ]);
        return;
      }

      if (personalSymptomInput && acuteSymptoms.length === 2) {
        const twoSymptomReply = `Thank you for sharing this. With only two symptoms (${acuteSymptoms.join(' and ')}), it is still not possible to narrow causes safely or to discuss specific cancer types. Overlapping symptoms are common and often have non-cancer explanations.\n\nA few details would help:\n- Timeline and whether things are getting worse\n- Any other symptoms or recent illness\n- Medications, sleep, stress, and relevant history (age, smoking, family history)\n\nThis information is for educational purposes only and should not be considered a medical diagnosis. Please consult a qualified healthcare professional.`;

        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            text: twoSymptomReply,
            isUser: false,
            timestamp: new Date(),
            relevance: 1,
            sources: [],
          },
        ]);
        return;
      }

      if (shouldUseCache(userMessage.text)) {
        const cacheKey = getCacheKey(conversationId, userMessage.text);
        const cachedResponse = responseCache[cacheKey];

        if (cachedResponse) {
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              text: `I found this answer earlier in this chat:\n\n${cachedResponse}`,
              isUser: false,
              timestamp: new Date(),
              relevance: 1,
              sources: [],
            },
          ]);
          return;
        }
      }

      const includeHistory = !(
        personalSymptomInput &&
        acuteSymptoms.length >= 1 &&
        acuteSymptoms.length <= 2 &&
        !isContextContinuation(userMessage.text)
      );
      const conversationHistory = messages
        .filter(m => m.id !== '0')
        .map(m => ({
          role: m.isUser ? 'user' : 'assistant',
          content: m.text
        }));

      const outboundHistory = includeHistory ? conversationHistory : [];
      outboundHistory.push({
        role: 'user',
        content: userMessage.text,
      });

      const contextAwareQuestion = buildContextAwareQuestion(userMessage.text);
      const response = await sendQuestion(contextAwareQuestion, conversationId, outboundHistory);
      const safeAnswer = enforceSingleSymptomSafety(response.answer, userMessage.text);
      
      const botMessage = {
        id: generateId(),
        text: safeAnswer,
        isUser: false,
        timestamp: new Date(),
        conversationId: response.conversation_id,
        relevance: response.relevance,
        sources: response.sources || [],
      };

      setMessages((prev) => [...prev, botMessage]);
      if (shouldUseCache(userMessage.text)) {
        cacheAnswer(response.conversation_id || conversationId, userMessage.text, safeAnswer);
      }
      
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
      <View style={styles.screenContainer}>
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

        <View style={styles.chatContainer}>
          <View style={styles.messagesPane}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={[
                styles.messagesContent,
                {
                  paddingBottom:
                    dockReserveHeight +
                    16 +
                    Math.max(0, dockDragOffset) +
                    (keyboardHeight > 0 ? 28 : 0),
                },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={Keyboard.dismiss}
              onContentSizeChange={() =>
                scrollViewRef.current?.scrollToEnd({ animated: true })
              }
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
                    <Text
                      style={[
                        styles.messageText,
                        message.isUser ? styles.userMessageText : styles.botMessageText,
                      ]}
                    >
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
          </View>

          {/* Composer dock: `bottom` tracks IME height so the field stays above the keyboard */}
          <View
            style={[
              styles.keyboardDock,
              {
                bottom: keyboardHeight + dockDragOffset,
                paddingLeft: 16 + insets.left,
                paddingRight: 16 + insets.right,
              },
            ]}
          >
            <View style={styles.dragHandleArea} {...dockPanResponder.panHandlers}>
              <View style={styles.dragHandle} />
              <Text style={styles.dragLabel}>Drag input box</Text>
            </View>
            {keyboardHeight > 0 ? (
              <Text style={styles.dockHint}>Typing above keyboard</Text>
            ) : null}
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
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  screenContainer: {
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
    minHeight: 0,
    backgroundColor: '#F2F2F7',
    position: 'relative',
  },
  messagesPane: {
    flex: 1,
    minHeight: 0,
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
  keyboardDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 18,
    zIndex: 1000,
  },
  dragHandleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D1D6',
  },
  dragLabel: {
    marginTop: 4,
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  dockHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 24,
    paddingHorizontal: 12,
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
