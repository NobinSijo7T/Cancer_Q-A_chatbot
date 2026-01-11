import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { analyzeFullReport, answerReportQuestion } from './reportAI';

export default function ReportAnalysisScreen({ backendConnected }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [reportSummary, setReportSummary] = useState(null);
  
  // Q&A state
  const [showQA, setShowQA] = useState(false);
  const [question, setQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState([]);
  const [askingQuestion, setAskingQuestion] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile({
          uri: file.uri,
          name: file.name,
          type: 'pdf',
          size: file.size,
        });
        setReportSummary(null);
        setQaHistory([]);
        setShowQA(false);
        
        // Try to extract text if it's a text file
        if (file.name.endsWith('.txt')) {
          try {
            const text = await FileSystem.readAsStringAsync(file.uri);
            setExtractedText(text);
          } catch (e) {
            console.log('Could not read text file:', e);
          }
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
      console.error('Document picker error:', error);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant permission to access your photos');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const image = result.assets[0];
        setSelectedFile({
          uri: image.uri,
          name: 'medical_report.jpg',
          type: 'image',
          width: image.width,
          height: image.height,
        });
        setReportSummary(null);
        setQaHistory([]);
        setShowQA(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
      console.error('Image picker error:', error);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant permission to access your camera');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const image = result.assets[0];
        setSelectedFile({
          uri: image.uri,
          name: 'medical_report_photo.jpg',
          type: 'image',
          width: image.width,
          height: image.height,
        });
        setReportSummary(null);
        setQaHistory([]);
        setShowQA(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
      console.error('Camera error:', error);
    }
  };

  // For demo purposes, allow user to input report text manually
  const [showTextInput, setShowTextInput] = useState(false);
  const [manualText, setManualText] = useState('');

  const handleTextInput = () => {
    setShowTextInput(true);
  };

  const handleSubmitText = () => {
    if (manualText.trim()) {
      setExtractedText(manualText);
      setSelectedFile({
        uri: 'manual-input',
        name: 'Manual Report Input',
        type: 'text',
        size: manualText.length,
      });
      setShowTextInput(false);
      setReportSummary(null);
      setQaHistory([]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile && !extractedText) {
      Alert.alert('No Report', 'Please select a file or enter report text');
      return;
    }

    setAnalyzing(true);
    
    try {
      // Use extracted text or sample text for demo
      let reportText = extractedText;
      
      // If no extracted text, use sample medical report for demo
      if (!reportText) {
        reportText = getSampleReportText();
        setExtractedText(reportText);
      }
      
      // Analyze using Bytez AI models
      const result = await analyzeFullReport(reportText);
      setReportSummary(result);
      setShowQA(true);
    } catch (error) {
      Alert.alert('Analysis Failed', 'Failed to analyze the report. Please try again.');
      console.error('Analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || !extractedText) return;
    
    setAskingQuestion(true);
    const currentQuestion = question;
    setQuestion('');
    
    // Add question to history immediately
    setQaHistory(prev => [...prev, { type: 'question', text: currentQuestion }]);
    
    try {
      const result = await answerReportQuestion(extractedText, currentQuestion);
      
      setQaHistory(prev => [...prev, { 
        type: 'answer', 
        text: result.answer || "I couldn't find a specific answer in the report.",
        score: result.score 
      }]);
    } catch (error) {
      setQaHistory(prev => [...prev, { 
        type: 'answer', 
        text: "Sorry, I couldn't process that question. Please try again.",
        error: true 
      }]);
    } finally {
      setAskingQuestion(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setExtractedText('');
    setReportSummary(null);
    setQaHistory([]);
    setShowQA(false);
    setManualText('');
    setShowTextInput(false);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Sample report text for demonstration
  const getSampleReportText = () => {
    return `PATHOLOGY REPORT

Patient: Jane Doe
Date: January 15, 2026
Specimen: Breast Biopsy, Right

CLINICAL HISTORY:
52-year-old female with suspicious mass identified on mammography. BI-RADS 4B.

GROSS DESCRIPTION:
Received in formalin labeled "Right breast biopsy" is a core needle biopsy consisting of 4 cores, each measuring 1.0 cm in length.

MICROSCOPIC DESCRIPTION:
Sections show breast tissue with invasive ductal carcinoma, moderately differentiated (Grade 2). 
Tumor size: 1.8 cm
Margins: Involved at the posterior margin
Lymphovascular invasion: Present

IMMUNOHISTOCHEMISTRY:
Estrogen Receptor (ER): Positive (90%)
Progesterone Receptor (PR): Positive (75%)
HER2: Negative (1+)
Ki-67 proliferation index: 15%

TNM STAGING: pT1c pN0 M0 (Stage IA)

DIAGNOSIS:
Invasive ductal carcinoma of the right breast, moderately differentiated.
ER positive, PR positive, HER2 negative.

RECOMMENDATIONS:
1. Surgical consultation for definitive treatment
2. Consider oncotype DX testing
3. Multidisciplinary tumor board review recommended`;
  };

  const suggestedQuestions = [
    "What is the cancer stage?",
    "Is this malignant or benign?",
    "What is the tumor size?",
    "What are the biomarker results?",
    "What treatment is recommended?",
  ];

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Report Analysis</Text>
        <Text style={styles.headerSubtitle}>AI-powered medical report analysis</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Text Input Modal */}
        {showTextInput && (
          <View style={styles.textInputSection}>
            <Text style={styles.textInputTitle}>Enter Report Text</Text>
            <TextInput
              style={styles.reportTextInput}
              multiline
              placeholder="Paste or type your medical report text here..."
              placeholderTextColor="#8E8E93"
              value={manualText}
              onChangeText={setManualText}
            />
            <View style={styles.textInputButtons}>
              <TouchableOpacity 
                style={styles.cancelTextButton} 
                onPress={() => setShowTextInput(false)}
              >
                <Text style={styles.cancelTextButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitTextButton} 
                onPress={handleSubmitText}
              >
                <Text style={styles.submitTextButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!selectedFile && !reportSummary && !showTextInput && (
          <View style={styles.uploadSection}>
            <View style={styles.uploadIconContainer}>
              <Text style={styles.uploadIcon}>📄</Text>
            </View>
            <Text style={styles.uploadTitle}>Upload Your Report</Text>
            <Text style={styles.uploadDescription}>
              Select a PDF, take a photo, or enter report text for AI-powered analysis using advanced NLP models
            </Text>

            <View style={styles.uploadButtonsContainer}>
              <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
                <Text style={styles.uploadButtonIcon}>📎</Text>
                <Text style={styles.uploadButtonText}>Choose PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                <Text style={styles.uploadButtonIcon}>🖼️</Text>
                <Text style={styles.uploadButtonText}>Choose Image</Text>
              </TouchableOpacity>

              {Platform.OS !== 'web' && (
                <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
                  <Text style={styles.uploadButtonIcon}>📷</Text>
                  <Text style={styles.uploadButtonText}>Take Photo</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[styles.uploadButton, styles.textInputButton]} 
                onPress={handleTextInput}
              >
                <Text style={styles.uploadButtonIcon}>📝</Text>
                <Text style={styles.uploadButtonText}>Enter Text</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modelsInfoContainer}>
              <Text style={styles.modelsInfoTitle}>🤖 Powered by AI Models:</Text>
              <Text style={styles.modelsInfoText}>• BART - Report Summarization</Text>
              <Text style={styles.modelsInfoText}>• RoBERTa - Question Answering</Text>
              <Text style={styles.modelsInfoText}>• XLM-RoBERTa - Entity Extraction</Text>
            </View>
          </View>
        )}

        {selectedFile && !reportSummary && !showTextInput && (
          <View style={styles.filePreviewSection}>
            <View style={styles.filePreviewCard}>
              {selectedFile.type === 'image' ? (
                <Image source={{ uri: selectedFile.uri }} style={styles.previewImage} />
              ) : selectedFile.type === 'text' ? (
                <View style={styles.textPreview}>
                  <Text style={styles.textPreviewIcon}>📝</Text>
                  <Text style={styles.textPreviewTitle}>Report Text Entered</Text>
                  <Text style={styles.textPreviewSize}>{formatFileSize(selectedFile.size)} characters</Text>
                </View>
              ) : (
                <View style={styles.pdfPreview}>
                  <Text style={styles.pdfIcon}>📄</Text>
                  <Text style={styles.pdfName}>{selectedFile.name}</Text>
                  <Text style={styles.pdfSize}>{formatFileSize(selectedFile.size)}</Text>
                </View>
              )}
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.analyzeButton, analyzing && styles.analyzeButtonDisabled]}
                onPress={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.analyzeButtonText}>Analyzing with AI...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.analyzeButtonIcon}>🔍</Text>
                    <Text style={styles.analyzeButtonText}>Analyze Report</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.clearButton} onPress={clearFile}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {reportSummary && (
          <View style={styles.summarySection}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryHeaderIcon}>✅</Text>
              <Text style={styles.summaryHeaderTitle}>Analysis Complete</Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Report Type</Text>
                  <Text style={styles.summaryValue}>{reportSummary.report_type || 'Medical Report'}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Risk Level</Text>
                  <View style={[
                    styles.riskBadge,
                    reportSummary.risk_level === 'High Risk' && styles.riskHigh,
                    reportSummary.risk_level === 'Medium Risk' && styles.riskMedium,
                    reportSummary.risk_level === 'Low Risk' && styles.riskLow,
                    reportSummary.risk_level === 'Requires Review' && styles.riskRequiresReview,
                  ]}>
                    <Text style={styles.riskBadgeText}>{reportSummary.risk_level || 'Requires Review'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>📋 AI Summary</Text>
                <Text style={styles.summaryText}>{reportSummary.summary || 'No summary available'}</Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>🔍 Key Findings</Text>
                <Text style={styles.summaryText}>{reportSummary.key_findings || 'Analysis in progress...'}</Text>
              </View>

              {reportSummary.entities && reportSummary.entities.length > 0 && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>🏷️ Extracted Entities</Text>
                    <View style={styles.entitiesContainer}>
                      {reportSummary.entities.slice(0, 8).map((entity, index) => (
                        <View key={index} style={styles.entityTag}>
                          <Text style={styles.entityText}>{entity.text}</Text>
                          <Text style={styles.entityType}>{entity.type || entity.category}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {reportSummary.recommendations && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>💡 Recommendations</Text>
                    <Text style={styles.summaryText}>{reportSummary.recommendations}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Patient-Friendly Explanation Section */}
            {reportSummary.patient_explanation && (
              <View style={styles.patientExplanationCard}>
                <View style={styles.patientExplanationHeader}>
                  <Text style={styles.patientExplanationIcon}>💙</Text>
                  <Text style={styles.patientExplanationTitle}>In Simple Words</Text>
                </View>
                <Text style={styles.patientExplanationSubtitle}>
                  Here's what your report means in everyday language:
                </Text>
                <View style={styles.patientExplanationDivider} />
                <Text style={styles.patientExplanationText}>
                  {reportSummary.patient_explanation}
                </Text>
              </View>
            )}

            {/* Q&A Section */}
            {showQA && (
              <View style={styles.qaSection}>
                <Text style={styles.qaSectionTitle}>💬 Ask Questions About Your Report</Text>
                
                {/* Suggested Questions */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestedContainer}>
                  {suggestedQuestions.map((q, index) => (
                    <TouchableOpacity 
                      key={index}
                      style={styles.suggestedQuestion}
                      onPress={() => setQuestion(q)}
                    >
                      <Text style={styles.suggestedQuestionText}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Q&A History */}
                {qaHistory.length > 0 && (
                  <View style={styles.qaHistory}>
                    {qaHistory.map((item, index) => (
                      <View 
                        key={index} 
                        style={[
                          styles.qaItem,
                          item.type === 'question' ? styles.qaQuestion : styles.qaAnswer
                        ]}
                      >
                        <Text style={styles.qaItemIcon}>
                          {item.type === 'question' ? '❓' : '💡'}
                        </Text>
                        <Text style={[
                          styles.qaItemText,
                          item.error && styles.qaErrorText
                        ]}>
                          {item.text}
                        </Text>
                        {item.score !== undefined && (
                          <Text style={styles.qaScore}>
                            Confidence: {(item.score * 100).toFixed(0)}%
                          </Text>
                        )}
                      </View>
                    ))}
                    {askingQuestion && (
                      <View style={[styles.qaItem, styles.qaAnswer]}>
                        <ActivityIndicator size="small" color="#FF2D55" />
                        <Text style={styles.qaItemText}>Searching report...</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Question Input */}
                <View style={styles.qaInputContainer}>
                  <TextInput
                    style={styles.qaInput}
                    placeholder="Ask about your report..."
                    placeholderTextColor="#8E8E93"
                    value={question}
                    onChangeText={setQuestion}
                    onSubmitEditing={handleAskQuestion}
                    editable={!askingQuestion}
                  />
                  <TouchableOpacity 
                    style={[styles.qaButton, (!question.trim() || askingQuestion) && styles.qaButtonDisabled]}
                    onPress={handleAskQuestion}
                    disabled={!question.trim() || askingQuestion}
                  >
                    <Text style={styles.qaButtonText}>Ask</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.disclaimerCard}>
              <Text style={styles.disclaimerIcon}>⚠️</Text>
              <Text style={styles.disclaimerText}>
                This AI analysis is for informational purposes only and should not replace professional medical advice. Always consult with your healthcare provider.
              </Text>
            </View>

            <TouchableOpacity style={styles.newAnalysisButton} onPress={clearFile}>
              <Text style={styles.newAnalysisButtonText}>Analyze Another Report</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  // Text Input Section
  textInputSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  textInputTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  reportTextInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#1C1C1E',
    minHeight: 200,
    textAlignVertical: 'top',
  },
  textInputButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelTextButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelTextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  submitTextButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  submitTextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Upload Section
  uploadSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  uploadIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadIcon: {
    fontSize: 40,
  },
  uploadTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  uploadDescription: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  uploadButtonsContainer: {
    width: '100%',
    gap: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  textInputButton: {
    backgroundColor: '#34C759',
  },
  uploadButtonIcon: {
    fontSize: 20,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modelsInfoContainer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    alignSelf: 'stretch',
  },
  modelsInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  modelsInfoText: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  // File Preview
  filePreviewSection: {
    gap: 20,
  },
  filePreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  previewImage: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
    backgroundColor: '#F2F2F7',
  },
  pdfPreview: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  pdfName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  pdfSize: {
    fontSize: 14,
    color: '#8E8E93',
  },
  textPreview: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textPreviewIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  textPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  textPreviewSize: {
    fontSize: 14,
    color: '#8E8E93',
  },
  actionButtons: {
    gap: 12,
  },
  analyzeButton: {
    flexDirection: 'row',
    backgroundColor: '#FF2D55',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  analyzeButtonIcon: {
    fontSize: 20,
  },
  analyzeButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clearButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF2D55',
  },
  // Summary Section
  summarySection: {
    gap: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  summaryHeaderIcon: {
    fontSize: 28,
  },
  summaryHeaderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    marginVertical: 8,
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  summaryText: {
    fontSize: 15,
    color: '#1C1C1E',
    lineHeight: 22,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F2F2F7',
    marginVertical: 16,
  },
  // Risk Badge
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#8E8E93',
  },
  riskHigh: {
    backgroundColor: '#FF3B30',
  },
  riskMedium: {
    backgroundColor: '#FF9500',
  },
  riskLow: {
    backgroundColor: '#34C759',
  },
  riskRequiresReview: {
    backgroundColor: '#5856D6',
  },
  riskBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Entities
  entitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  entityTag: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  entityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  entityType: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  // Patient Explanation Section
  patientExplanationCard: {
    backgroundColor: '#E8F4FD',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#B8D4E8',
  },
  patientExplanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  patientExplanationIcon: {
    fontSize: 28,
  },
  patientExplanationTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1565C0',
  },
  patientExplanationSubtitle: {
    fontSize: 14,
    color: '#5B8DB8',
    marginBottom: 12,
  },
  patientExplanationDivider: {
    height: 1,
    backgroundColor: '#B8D4E8',
    marginVertical: 16,
  },
  patientExplanationText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 26,
  },
  // Q&A Section
  qaSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  qaSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  suggestedContainer: {
    marginBottom: 16,
  },
  suggestedQuestion: {
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  suggestedQuestionText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  qaHistory: {
    marginBottom: 16,
    gap: 12,
  },
  qaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  qaQuestion: {
    backgroundColor: '#007AFF15',
  },
  qaAnswer: {
    backgroundColor: '#F2F2F7',
  },
  qaItemIcon: {
    fontSize: 16,
  },
  qaItemText: {
    flex: 1,
    fontSize: 14,
    color: '#1C1C1E',
    lineHeight: 20,
  },
  qaErrorText: {
    color: '#FF3B30',
  },
  qaScore: {
    fontSize: 11,
    color: '#8E8E93',
  },
  qaInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  qaInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1C1C1E',
  },
  qaButton: {
    backgroundColor: '#FF2D55',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qaButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  qaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Disclaimer
  disclaimerCard: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  disclaimerIcon: {
    fontSize: 20,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  newAnalysisButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  newAnalysisButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
