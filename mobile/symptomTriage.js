const MEDICAL_DISCLAIMER =
  'This information is for educational purposes only and should not be considered a medical diagnosis. Please consult a qualified healthcare professional.';

export const CHAT_TRIAGE_SYSTEM_PROMPT = `You are an educational cancer-focused medical chatbot.
- Do not predict, diagnose, or suggest any cancer type when the user reports fewer than 3 relevant symptoms, unless strong risk factors are present.
- First gather context with follow-up questions about duration, progression, severity, associated symptoms, age, gender, smoking, alcohol use, family history, unexplained weight loss, and fatigue.
- Use empathetic, non-alarming, probabilistic language.
- When enough information exists, discuss only possible conditions using language like "may be associated with" or "one possibility could be".
- Never state or imply a definitive diagnosis.
- Include this disclaimer whenever discussing risk: "This information is for educational purposes only and should not be considered a medical diagnosis. Please consult a qualified healthcare professional."`;

const SYMPTOM_KEYWORDS = [
  'cough',
  'lump',
  'bleeding',
  'blood',
  'chest pain',
  'throat pain',
  'sore throat',
  'red eyes',
  'eye redness',
  'pain',
  'fatigue',
  'weight loss',
  'hoarseness',
  'fever',
  'night sweats',
  'shortness of breath',
  'swelling',
  'appetite loss',
  'nausea',
  'vomiting',
  'constipation',
  'diarrhea',
  'headache',
  'difficulty swallowing',
  'urination',
  'sputum',
];

const PAIN_AREAS = [
  'chest',
  'throat',
  'abdomen',
  'stomach',
  'back',
  'head',
  'neck',
  'breast',
  'pelvis',
  'arm',
  'leg',
  'bone',
  'joint',
];

const FIRST_PERSON_PATTERNS = [
  /\bi have\b/i,
  /\bi am having\b/i,
  /\bi feel\b/i,
  /\bi'm having\b/i,
  /\bmy\b/i,
  /\bme\b/i,
  /\bsuffering from\b/i,
];

const unique = (values) => Array.from(new Set(values));

const extractAge = (text) => {
  const match = text.match(/\b(\d{1,3})\s*(?:years?\s*old|yo|y\/o)\b/i);
  return match ? Number(match[1]) : null;
};

const detectGender = (text) => {
  if (/\b(female|woman|girl)\b/i.test(text)) return 'female';
  if (/\b(male|man|boy)\b/i.test(text)) return 'male';
  return null;
};

const hasPattern = (text, regexes) => regexes.some((regex) => regex.test(text));

const normalizeSymptom = (symptom) => {
  const map = {
    'eye redness': 'red eyes',
    'sore throat': 'throat pain',
  };
  return map[symptom] || symptom;
};

const extractPainPhrases = (text) => {
  const lower = text.toLowerCase();
  const detected = [];

  PAIN_AREAS.forEach((area) => {
    const pattern = new RegExp(`\\b(pain|ache|soreness)\\s+(in|on|at)\\s+(my\\s+)?${area}\\b`, 'i');
    if (pattern.test(lower)) {
      detected.push(`${area} pain`);
    }
  });

  return detected;
};

export const extractSymptoms = (text) => {
  const lower = text.toLowerCase();
  const keywordHits = SYMPTOM_KEYWORDS.filter((symptom) => lower.includes(symptom));
  const painPhrases = extractPainPhrases(text);

  if (/\b(red|reddish)\s+eyes?\b/i.test(lower)) {
    keywordHits.push('red eyes');
  }

  return unique([...keywordHits, ...painPhrases].map(normalizeSymptom));
};

export const isSymptomNarrative = (text) => {
  const mentionsSymptoms = extractSymptoms(text).length > 0;
  const firstPerson = hasPattern(text, FIRST_PERSON_PATTERNS);
  return mentionsSymptoms && firstPerson;
};

export const assessSymptomCount = (symptoms) => {
  return symptoms.length >= 3;
};

export const createConversationState = () => ({
  stage: 'initial',
  symptoms: [],
  followUpAnswers: [],
  riskFactors: {
    age: null,
    gender: null,
    smoking: null,
    alcohol: null,
    familyHistory: null,
    unexplainedWeightLoss: null,
    fatigue: null,
    persistentLump: null,
    bleeding: null,
  },
});

const parseRiskFactors = (text, existing) => {
  const lower = text.toLowerCase();
  const age = extractAge(text) ?? existing.age;
  const gender = detectGender(text) ?? existing.gender;

  return {
    age,
    gender,
    smoking:
      /\b(smoke|smoker|smoking|tobacco)\b/i.test(lower)
        ? true
        : /\bnever smoke|non smoker\b/i.test(lower)
        ? false
        : existing.smoking,
    alcohol:
      /\b(alcohol|drinking|drink regularly)\b/i.test(lower)
        ? true
        : /\bno alcohol|do not drink\b/i.test(lower)
        ? false
        : existing.alcohol,
    familyHistory:
      /\bfamily history|runs in (my )?family\b/i.test(lower)
        ? true
        : /\bno family history\b/i.test(lower)
        ? false
        : existing.familyHistory,
    unexplainedWeightLoss:
      /\b(unexplained weight loss|lost weight|weight loss)\b/i.test(lower)
        ? true
        : existing.unexplainedWeightLoss,
    fatigue: /\b(fatigue|tired|exhausted)\b/i.test(lower) ? true : existing.fatigue,
    persistentLump: /\b(lump|mass|swelling)\b/i.test(lower) ? true : existing.persistentLump,
    bleeding:
      /\b(bleeding|blood in stool|blood in sputum|blood in urine)\b/i.test(lower)
        ? true
        : existing.bleeding,
  };
};

export const updateConversationState = (state, userInput) => {
  const nextSymptoms = unique([...state.symptoms, ...extractSymptoms(userInput)]);
  return {
    ...state,
    stage: 'gathering',
    symptoms: nextSymptoms,
    followUpAnswers: [...state.followUpAnswers, userInput].slice(-10),
    riskFactors: parseRiskFactors(userInput, state.riskFactors),
  };
};

const hasStrongRiskFactors = (riskFactors) => {
  const ageRisk = typeof riskFactors.age === 'number' && riskFactors.age >= 60;
  const flags = [
    riskFactors.smoking,
    riskFactors.familyHistory,
    riskFactors.unexplainedWeightLoss,
    riskFactors.persistentLump,
    riskFactors.bleeding,
    ageRisk,
  ].filter(Boolean).length;
  return flags >= 2;
};

export const isSufficientForSuggestion = (state) => {
  return assessSymptomCount(state.symptoms) || hasStrongRiskFactors(state.riskFactors);
};

const buildFollowUpQuestions = (state) => {
  const questions = [
    'How long have these symptoms been present?',
    'Are the symptoms improving, stable, or getting worse?',
    'How severe are the symptoms on a scale of 1 to 10?',
  ];

  if (!state.riskFactors.age || !state.riskFactors.gender) {
    questions.push('Could you share your age and gender?');
  }
  if (state.riskFactors.smoking == null) {
    questions.push('Do you smoke or have a history of smoking?');
  }
  if (state.riskFactors.alcohol == null) {
    questions.push('Do you drink alcohol regularly?');
  }
  if (state.riskFactors.familyHistory == null) {
    questions.push('Do you have a family history of cancer?');
  }
  if (!state.riskFactors.unexplainedWeightLoss) {
    questions.push('Have you noticed any unexplained weight loss or unusual fatigue?');
  }

  if (state.symptoms.includes('cough')) {
    questions.push('Have you noticed blood in sputum, chest pain, or shortness of breath?');
  }
  if (state.symptoms.includes('chest pain')) {
    questions.push('Is the chest pain persistent, and does it worsen with breathing or activity?');
  }
  if (state.symptoms.includes('throat pain')) {
    questions.push('Do you also have trouble swallowing, persistent hoarseness, or a neck lump?');
  }
  if (state.symptoms.includes('red eyes')) {
    questions.push('Are your red eyes accompanied by pain, vision changes, discharge, or fever?');
  }
  if (state.symptoms.includes('lump')) {
    questions.push('Where is the lump, and has its size changed over time?');
  }
  if (state.symptoms.includes('bleeding') || state.symptoms.includes('blood')) {
    questions.push('Where is the bleeding occurring, and is it persistent or intermittent?');
  }

  return unique(questions).slice(0, 7);
};

const formatSymptomSummary = (symptoms) => {
  if (symptoms.length === 0) return '';
  if (symptoms.length === 1) return symptoms[0];
  if (symptoms.length === 2) return `${symptoms[0]} and ${symptoms[1]}`;
  return `${symptoms.slice(0, -1).join(', ')}, and ${symptoms[symptoms.length - 1]}`;
};

export const requestMoreInformation = (symptoms, state) => {
  const symptomCount = symptoms.length;
  const symptomSummary = formatSymptomSummary(symptoms);
  const intro =
    symptomCount <= 2
      ? 'Thank you for sharing this information. With just one or two symptoms, it is not possible to determine whether this is related to cancer.'
      : 'I still need a bit more clinical context before discussing possible causes.';
  const contextLead = symptomSummary
    ? `I understand you mentioned ${symptomSummary}.`
    : 'I understand your concern.';

  const followUps = buildFollowUpQuestions(state)
    .map((q) => `- ${q}`)
    .join('\n');

  return `${contextLead} ${intro} Could you please provide a few more details?\n\n${followUps}\n\n${MEDICAL_DISCLAIMER}`;
};

const inferPossibleCancers = (state) => {
  const symptoms = state.symptoms;
  const risks = state.riskFactors;
  const possibilities = [];

  if (
    symptoms.includes('cough') &&
    (symptoms.includes('blood') || symptoms.includes('shortness of breath') || risks.smoking)
  ) {
    possibilities.push('lung cancer');
  }

  if (symptoms.includes('lump') && risks.gender === 'female') {
    possibilities.push('breast cancer');
  }

  if (
    (symptoms.includes('bleeding') || symptoms.includes('blood')) &&
    (symptoms.includes('weight loss') || symptoms.includes('fatigue'))
  ) {
    possibilities.push('colorectal cancer');
  }

  if (
    symptoms.includes('urination') &&
    risks.gender === 'male' &&
    typeof risks.age === 'number' &&
    risks.age >= 50
  ) {
    possibilities.push('prostate cancer');
  }

  return unique(possibilities);
};

export const generateCancerSuggestion = (state) => {
  if (!isSufficientForSuggestion(state)) {
    return requestMoreInformation(state.symptoms, state);
  }

  const possibilities = inferPossibleCancers(state);
  const possibilityLine =
    possibilities.length > 0
      ? `Based on the information you provided, one of the possibilities could be ${possibilities.join(', ')}.`
      : 'These symptoms may be associated with several conditions, including non-cancerous causes, but they warrant further medical evaluation.';

  const careGuidance =
    '- Please seek prompt medical attention if symptoms are persistent, worsening, or include bleeding, unexplained weight loss, or a persistent lump.\n' +
    '- Arrange an in-person evaluation with a qualified clinician for proper examination and testing.';

  return `${possibilityLine} However, this is not a diagnosis, and many benign conditions can present with similar symptoms.\n\n${careGuidance}\n\n${MEDICAL_DISCLAIMER}`;
};

export const shouldRunSymptomTriage = (userInput, state) => {
  if (state.stage !== 'initial') {
    return true;
  }
  return isSymptomNarrative(userInput);
};

export { MEDICAL_DISCLAIMER };