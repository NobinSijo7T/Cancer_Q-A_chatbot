import Bytez from "bytez.js";

const BYTEZ_API_KEY = "16cf973b5ca4c99c522d56d71331bc43";
const sdk = new Bytez(BYTEZ_API_KEY);

// Model instances
const summarizationModel = sdk.model("facebook/bart-large-cnn");
const qaModel = sdk.model("deepset/roberta-base-squad2");
const classificationModel = sdk.model("BAAI/bge-reranker-v2-m3");
const nerModel = sdk.model("FacebookAI/xlm-roberta-large-finetuned-conll03-english");

/**
 * Summarize medical report text
 * @param {string} reportText - The full text of the medical report
 * @returns {Promise<{summary: string, error: string|null}>}
 */
export const summarizeReport = async (reportText) => {
  try {
    console.log("Summarizing report with BART model...");
    const { error, output } = await summarizationModel.run(reportText);
    
    if (error) {
      console.error("Summarization error:", error);
      return { summary: null, error: error.message || "Summarization failed" };
    }
    
    // Extract summary from output
    const summary = Array.isArray(output) 
      ? output[0]?.summary_text || output[0] 
      : output?.summary_text || output;
    
    console.log("Summary generated successfully");
    return { summary, error: null };
  } catch (err) {
    console.error("Summarization exception:", err);
    return { summary: null, error: err.message };
  }
};

/**
 * Answer questions about the medical report
 * @param {string} reportText - The context (medical report text)
 * @param {string} question - The user's question
 * @returns {Promise<{answer: string, score: number, error: string|null}>}
 */
export const answerReportQuestion = async (reportText, question) => {
  try {
    console.log("Answering question with RoBERTa model...");
    const { error, output } = await qaModel.run({
      context: reportText,
      question: question
    });
    
    if (error) {
      console.error("QA error:", error);
      return { answer: null, score: 0, error: error.message || "Question answering failed" };
    }
    
    const answer = output?.answer || output;
    const score = output?.score || 0;
    
    console.log("Answer generated successfully");
    return { answer, score, error: null };
  } catch (err) {
    console.error("QA exception:", err);
    return { answer: null, score: 0, error: err.message };
  }
};

/**
 * Classify the report type and content
 * @param {string} reportText - The medical report text
 * @returns {Promise<{classification: object, error: string|null}>}
 */
export const classifyReport = async (reportText) => {
  try {
    console.log("Classifying report with BGE model...");
    const { error, output } = await classificationModel.run(reportText);
    
    if (error) {
      console.error("Classification error:", error);
      return { classification: null, error: error.message || "Classification failed" };
    }
    
    // Determine report type based on keywords and classification
    const reportType = detectReportType(reportText);
    const riskLevel = detectRiskLevel(reportText);
    
    console.log("Classification completed");
    return { 
      classification: {
        reportType,
        riskLevel,
        rawOutput: output
      }, 
      error: null 
    };
  } catch (err) {
    console.error("Classification exception:", err);
    return { classification: null, error: err.message };
  }
};

/**
 * Extract medical entities from the report (NER)
 * @param {string} reportText - The medical report text
 * @returns {Promise<{entities: Array, error: string|null}>}
 */
export const extractEntities = async (reportText) => {
  try {
    console.log("Extracting entities with XLM-RoBERTa model...");
    const { error, output } = await nerModel.run(reportText);
    
    if (error) {
      console.error("NER error:", error);
      return { entities: [], error: error.message || "Entity extraction failed" };
    }
    
    // Process and enhance entities with medical context
    const entities = processEntities(output, reportText);
    
    console.log("Entity extraction completed");
    return { entities, error: null };
  } catch (err) {
    console.error("NER exception:", err);
    return { entities: [], error: err.message };
  }
};

/**
 * Perform full analysis of a medical report
 * @param {string} reportText - The full medical report text
 * @returns {Promise<object>} Complete analysis results
 */
export const analyzeFullReport = async (reportText) => {
  console.log("Starting full report analysis...");
  
  try {
    // Detect report type and risk level directly from text first
    const reportType = detectReportType(reportText);
    const riskLevel = detectRiskLevel(reportText);
    
    // Run all analyses in parallel for efficiency
    const [summaryResult, classificationResult, entitiesResult] = await Promise.all([
      summarizeReport(reportText),
      classifyReport(reportText),
      extractEntities(reportText)
    ]);
    
    // Build comprehensive analysis result
    const analysis = {
      report_type: reportType,
      risk_level: riskLevel,
      
      summary: summaryResult.summary || generateFallbackSummary(reportText),
      
      key_findings: extractKeyFindings(reportText, entitiesResult.entities),
      
      entities: entitiesResult.entities || [],
      
      // Generate patient-friendly explanation
      patient_explanation: generatePatientExplanation(reportText, reportType, riskLevel, entitiesResult.entities),
      
      recommendations: generateRecommendations(riskLevel, reportText),
      
      errors: {
        summarization: summaryResult.error,
        classification: classificationResult.error,
        ner: entitiesResult.error
      }
    };
    
    console.log("Full analysis completed");
    return analysis;
  } catch (err) {
    console.error("Full analysis error:", err);
    const riskLevel = detectRiskLevel(reportText);
    return {
      report_type: detectReportType(reportText),
      risk_level: riskLevel,
      key_findings: "Analysis could not be completed. Please try again.",
      summary: "Error occurred during analysis.",
      patient_explanation: "We had trouble analyzing your report. Please share this report with your doctor who can explain it to you in person.",
      recommendations: "Please consult with your healthcare provider.",
      error: err.message
    };
  }
};

// Helper functions

/**
 * Detect report type from text content
 */
function detectReportType(text) {
  const lowerText = text.toLowerCase();
  
  const reportTypes = {
    "Pathology/Biopsy Report": ["biopsy", "pathology", "histology", "specimen", "tissue sample"],
    "Blood Test Report": ["blood test", "cbc", "hemoglobin", "wbc", "rbc", "platelet", "hematology"],
    "MRI Report": ["mri", "magnetic resonance", "t1-weighted", "t2-weighted"],
    "CT Scan Report": ["ct scan", "computed tomography", "ct findings"],
    "X-Ray Report": ["x-ray", "radiograph", "chest x-ray"],
    "Mammography Report": ["mammogram", "mammography", "breast imaging", "bi-rads"],
    "Ultrasound Report": ["ultrasound", "sonography", "echo", "doppler"],
    "PET Scan Report": ["pet scan", "pet-ct", "fdg uptake"],
    "Tumor Marker Report": ["tumor marker", "ca-125", "cea", "psa", "afp"],
    "Genetic Testing Report": ["genetic", "brca", "mutation", "genomic"]
  };
  
  for (const [type, keywords] of Object.entries(reportTypes)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return type;
    }
  }
  
  return "Medical Report";
}

/**
 * Detect risk level from report content
 */
function detectRiskLevel(text) {
  const lowerText = text.toLowerCase();
  
  const highRiskTerms = [
    "malignant", "metastasis", "stage iv", "stage 4", "advanced", 
    "aggressive", "invasive carcinoma", "poorly differentiated",
    "high grade", "grade 3", "grade iii"
  ];
  
  const mediumRiskTerms = [
    "suspicious", "atypical", "stage ii", "stage 2", "stage iii", "stage 3",
    "moderate", "intermediate", "grade 2", "grade ii"
  ];
  
  const lowRiskTerms = [
    "benign", "negative", "normal", "no evidence", "stage i", "stage 1",
    "low grade", "grade 1", "grade i", "well differentiated"
  ];
  
  // Check for high risk first
  if (highRiskTerms.some(term => lowerText.includes(term))) {
    return "High Risk";
  }
  
  // Check for medium risk
  if (mediumRiskTerms.some(term => lowerText.includes(term))) {
    return "Medium Risk";
  }
  
  // Check for low risk indicators
  if (lowRiskTerms.some(term => lowerText.includes(term))) {
    return "Low Risk";
  }
  
  return "Requires Review";
}

/**
 * Process NER entities and add medical context
 */
function processEntities(rawEntities, reportText) {
  if (!Array.isArray(rawEntities)) {
    rawEntities = rawEntities ? [rawEntities] : [];
  }
  
  // Also extract medical-specific entities using regex
  const medicalEntities = [];
  
  // Extract measurements (tumor sizes, etc.)
  const measurementPattern = /(\d+\.?\d*)\s*(mm|cm|centimeter|millimeter)/gi;
  let match;
  while ((match = measurementPattern.exec(reportText)) !== null) {
    medicalEntities.push({
      text: match[0],
      type: "MEASUREMENT",
      category: "Size/Dimension"
    });
  }
  
  // Extract staging information
  const stagingPattern = /(stage|grade)\s*(i{1,3}v?|[1-4]|[a-c])/gi;
  while ((match = stagingPattern.exec(reportText)) !== null) {
    medicalEntities.push({
      text: match[0],
      type: "STAGING",
      category: "Cancer Stage/Grade"
    });
  }
  
  // Extract biomarkers
  const biomarkers = ["HER2", "ER", "PR", "Ki-67", "PD-L1", "BRCA1", "BRCA2", "EGFR", "ALK"];
  biomarkers.forEach(marker => {
    const regex = new RegExp(`${marker}[\\s:]*([\\w+-]+)?`, "gi");
    while ((match = regex.exec(reportText)) !== null) {
      medicalEntities.push({
        text: match[0],
        type: "BIOMARKER",
        category: "Biomarker"
      });
    }
  });
  
  // Combine with NER results
  const processedEntities = rawEntities.map(entity => ({
    text: entity.word || entity.text || entity,
    type: entity.entity || entity.label || "ENTITY",
    score: entity.score || 1.0
  }));
  
  return [...processedEntities, ...medicalEntities];
}

/**
 * Extract key findings from text and entities
 */
function extractKeyFindings(reportText, entities) {
  const findings = [];
  
  // Look for impression/conclusion sections
  const impressionMatch = reportText.match(/(?:impression|conclusion|findings|diagnosis)[:\s]*([\s\S]*?)(?:\n\n|$)/i);
  if (impressionMatch) {
    findings.push(impressionMatch[1].trim().substring(0, 200));
  }
  
  // Add entity-based findings
  const importantEntities = entities
    .filter(e => ["STAGING", "BIOMARKER", "MEASUREMENT"].includes(e.type))
    .slice(0, 5)
    .map(e => e.text);
  
  if (importantEntities.length > 0) {
    findings.push(`Key markers identified: ${importantEntities.join(", ")}`);
  }
  
  // If no findings extracted, provide generic summary
  if (findings.length === 0) {
    const preview = reportText.substring(0, 300).trim();
    findings.push(preview + (reportText.length > 300 ? "..." : ""));
  }
  
  return findings.join("\n\n");
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(riskLevel, reportText) {
  const baseRecommendations = [
    "Discuss these results with your healthcare provider.",
    "Keep a copy of this report for your medical records."
  ];
  
  switch (riskLevel) {
    case "High Risk":
      return [
        "⚠️ URGENT: Schedule an appointment with your oncologist immediately.",
        "Consider seeking a second opinion from a specialized cancer center.",
        "Discuss treatment options and timeline with your care team.",
        ...baseRecommendations
      ].join("\n");
      
    case "Medium Risk":
      return [
        "Schedule a follow-up appointment with your doctor within 1-2 weeks.",
        "Additional diagnostic tests may be recommended.",
        "Monitor for any new symptoms and report them promptly.",
        ...baseRecommendations
      ].join("\n");
      
    case "Low Risk":
      return [
        "Continue with routine screening as recommended by your doctor.",
        "Maintain a healthy lifestyle with regular exercise and balanced diet.",
        "Schedule your next routine check-up as advised.",
        ...baseRecommendations
      ].join("\n");
      
    default:
      return [
        "Schedule a follow-up appointment to discuss these results.",
        "Your healthcare provider can explain the findings in detail.",
        ...baseRecommendations
      ].join("\n");
  }
}

/**
 * Generate fallback summary if AI summarization fails
 */
function generateFallbackSummary(reportText) {
  const sentences = reportText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const keyPhrases = sentences.slice(0, 3).join(". ");
  return keyPhrases.length > 0 
    ? keyPhrases + "." 
    : "Report content processed. Please review the key findings above.";
}

/**
 * Generate patient-friendly explanation in simple English
 */
function generatePatientExplanation(reportText, reportType, riskLevel, entities) {
  const lowerText = reportText.toLowerCase();
  let explanation = [];
  
  // Start with what type of test this is
  explanation.push(`📋 What is this report?\nThis is a ${reportType.toLowerCase()}. It's a medical test that doctors use to understand what's happening in your body.`);
  
  // Explain the main finding based on content
  if (lowerText.includes("carcinoma") || lowerText.includes("cancer") || lowerText.includes("malignant")) {
    explanation.push(`\n\n🔬 What did they find?\nThe test found cancer cells. This means some cells in your body are growing in a way they shouldn't. The good news is that finding it means doctors can now make a plan to treat it.`);
    
    // Explain the type if mentioned
    if (lowerText.includes("invasive ductal carcinoma")) {
      explanation.push(`\n\nThe specific type found is called "invasive ductal carcinoma" - this is the most common type of breast cancer. "Invasive" means the cancer cells have started to spread from where they first appeared.`);
    } else if (lowerText.includes("invasive")) {
      explanation.push(`\n\nThe word "invasive" in your report means the abnormal cells have spread beyond where they first started. Your doctor will explain what this means for your treatment.`);
    }
  } else if (lowerText.includes("benign")) {
    explanation.push(`\n\n🔬 What did they find?\nGood news! The test found that the growth is "benign" - this means it is NOT cancer. Benign growths are usually not dangerous, but your doctor may still want to monitor it.`);
  } else if (lowerText.includes("negative") || lowerText.includes("normal") || lowerText.includes("no evidence")) {
    explanation.push(`\n\n🔬 What did they find?\nGood news! The test results appear normal or negative, which usually means no major problems were found. Your doctor will confirm this with you.`);
  } else if (lowerText.includes("suspicious") || lowerText.includes("atypical")) {
    explanation.push(`\n\n🔬 What did they find?\nThe test found some cells that look unusual. This doesn't definitely mean cancer, but your doctor will likely want to do more tests to be sure. Try not to worry - many suspicious findings turn out to be harmless.`);
  }
  
  // Explain staging if present
  const stageMatch = lowerText.match(/stage\s*(i{1,3}v?a?b?|[1-4][a-c]?)/i);
  if (stageMatch) {
    const stage = stageMatch[1].toUpperCase();
    explanation.push(`\n\n📊 What does the stage mean?\nYour report mentions "Stage ${stage}".`);
    
    if (stage.includes("I") && !stage.includes("II") && !stage.includes("IV")) {
      explanation.push(` This is an early stage, which is good news! Early stage usually means the cancer is small and hasn't spread far, making it easier to treat.`);
    } else if (stage.includes("II")) {
      explanation.push(` This is an intermediate stage. The cancer may be a bit larger or may have started to spread to nearby areas, but there are still many good treatment options.`);
    } else if (stage.includes("III")) {
      explanation.push(` This is a more advanced stage, meaning the cancer has grown larger or spread to nearby lymph nodes. Treatment is still possible, and your medical team will create a plan for you.`);
    } else if (stage.includes("IV") || stage.includes("4")) {
      explanation.push(` This is an advanced stage, meaning the cancer has spread to other parts of the body. While this is serious, there are still treatments available that can help manage the disease and maintain quality of life.`);
    }
  }
  
  // Explain grade if present
  const gradeMatch = lowerText.match(/grade\s*([1-3]|i{1,3})/i);
  if (gradeMatch) {
    const grade = gradeMatch[1];
    explanation.push(`\n\n📈 What does the grade mean?\nThe "grade" tells doctors how different the cancer cells look compared to normal cells.`);
    
    if (grade === "1" || grade.toLowerCase() === "i") {
      explanation.push(` Grade 1 (low grade) means the cells look almost normal and usually grow slowly. This is generally favorable.`);
    } else if (grade === "2" || grade.toLowerCase() === "ii") {
      explanation.push(` Grade 2 (moderate/intermediate) means the cells look somewhat different from normal and grow at a moderate pace.`);
    } else if (grade === "3" || grade.toLowerCase() === "iii") {
      explanation.push(` Grade 3 (high grade) means the cells look very different from normal cells. These may grow faster, but modern treatments can still be very effective.`);
    }
  }
  
  // Explain biomarkers in simple terms
  if (lowerText.includes("er positive") || lowerText.includes("er:") || lowerText.includes("estrogen receptor")) {
    explanation.push(`\n\n💊 About hormone receptors:\nYour report mentions "ER" (Estrogen Receptor). When it's "positive," it means the cancer cells respond to the hormone estrogen. This is actually helpful because there are medications that can block estrogen and slow down the cancer.`);
  }
  
  if (lowerText.includes("her2")) {
    if (lowerText.includes("her2 negative") || lowerText.includes("her2: negative") || lowerText.includes("her2: 1+") || lowerText.includes("her2: 0")) {
      explanation.push(`\n\nThe report shows "HER2 negative." HER2 is a protein that can make cancer grow faster. Being negative means this protein is not fueling the cancer, which can be a good thing for treatment planning.`);
    } else if (lowerText.includes("her2 positive") || lowerText.includes("her2: 3+") || lowerText.includes("her2: positive")) {
      explanation.push(`\n\nThe report shows "HER2 positive." HER2 is a protein that can make cancer grow faster. There are specific targeted drugs that work very well against HER2-positive cancers.`);
    }
  }
  
  // Add risk level explanation
  explanation.push(`\n\n⚠️ Overall Assessment:`);
  switch (riskLevel) {
    case "High Risk":
      explanation.push(` Based on the findings, this report indicates a situation that needs prompt medical attention. Please don't panic - "high risk" means your doctors will prioritize your care and develop a treatment plan quickly. Many people with similar findings respond well to treatment.`);
      break;
    case "Medium Risk":
      explanation.push(` The findings suggest some concerns that your doctor will want to discuss with you. You may need additional tests or monitoring. This is a common situation, and your healthcare team will guide you through the next steps.`);
      break;
    case "Low Risk":
      explanation.push(` The findings suggest lower concern. This is reassuring, but your doctor will still want to discuss the results and may recommend routine follow-up to make sure everything stays healthy.`);
      break;
    default:
      explanation.push(` Your doctor will review these results with you and explain what they mean for your specific situation. Every person is different, and your medical team knows your health history best.`);
  }
  
  // Closing reassurance
  explanation.push(`\n\n💙 Remember:\nThis explanation is meant to help you understand your report better, but it's not a substitute for talking to your doctor. Write down any questions you have and bring them to your next appointment. You're not alone in this - your healthcare team is there to support you.`);
  
  return explanation.join("");
}

export default {
  summarizeReport,
  answerReportQuestion,
  classifyReport,
  extractEntities,
  analyzeFullReport
};
