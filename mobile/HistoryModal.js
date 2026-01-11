import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { getHistory } from './api';

export default function HistoryModal({ visible, onClose, onSelectConversation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const { width, height } = useWindowDimensions();
  
  const isMobile = width < 768;

  useEffect(() => {
    if (visible) {
      loadHistory();
    }
  }, [visible]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getHistory(50);
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  };

  const handleSelectConversation = (conv) => {
    onSelectConversation({
      question: conv.question,
      answer: conv.answer,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContent,
          isMobile ? styles.modalContentMobile : styles.modalContentWeb
        ]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chat History</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text style={styles.loadingText}>Loading history...</Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>
                Start chatting to see your history here
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.conversationList} contentContainerStyle={styles.conversationListContent}>
              {conversations.map((conv, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.conversationItem,
                    isMobile && styles.conversationItemMobile
                  ]}
                  onPress={() => handleSelectConversation(conv)}
                >
                  <View style={styles.conversationHeader}>
                    <Text style={styles.conversationDate}>
                      {formatDate(conv.timestamp)}
                    </Text>
                    {conv.relevance && (
                      <View
                        style={[
                          styles.relevanceBadge,
                          conv.relevance === 'RELEVANT' && styles.relevantBadge,
                          conv.relevance === 'PARTLY_RELEVANT' && styles.partlyBadge,
                        ]}
                      >
                        <Text style={styles.relevanceBadgeText}>
                          {conv.relevance === 'RELEVANT' ? '✓' : '~'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.conversationQuestion} numberOfLines={isMobile ? 2 : 3}>
                    {conv.question}
                  </Text>
                  <Text style={styles.conversationAnswer} numberOfLines={isMobile ? 2 : 4}>
                    {conv.answer}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalContentMobile: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalContentWeb: {
    maxHeight: '70%',
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    borderRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6B7280',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  conversationList: {
    flex: 1,
  },
  conversationListContent: {
    padding: 16,
  },
  conversationItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  conversationItemMobile: {
    padding: 14,
    marginBottom: 10,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conversationDate: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  relevanceBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  relevantBadge: {
    backgroundColor: '#10B981',
  },
  partlyBadge: {
    backgroundColor: '#F59E0B',
  },
  relevanceBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  conversationQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 20,
  },
  conversationAnswer: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});
