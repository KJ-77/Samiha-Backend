const { executeQuery } = require("../dbConnector");

/**
 * Create a diagnosis for a test session
 * @param {Object} diagnosisData - Diagnosis information
 * @returns {Promise<Object>} Created diagnosis
 */
const createDiagnosis = async (diagnosisData) => {
  const query = `
    INSERT INTO test_diagnoses (
      session_id,
      diagnosis_text,
      description
    )
    VALUES ($1, $2, $3)
    RETURNING *
  `;

  const params = [
    diagnosisData.session_id,
    diagnosisData.diagnosis_text,
    diagnosisData.description || null,
  ];

  const result = await executeQuery(query, params);
  return result[0];
};

/**
 * Get diagnosis by session ID
 * @param {number} sessionId - Session ID
 * @returns {Promise<Object>} Diagnosis details
 */
const getDiagnosisBySession = async (sessionId) => {
  const query = `
    SELECT
      d.*,
      s.user_id,
      s.test_id,
      s.completed_at as test_completed_at,
      t.name as test_name
    FROM test_diagnoses d
    JOIN user_test_sessions s ON d.session_id = s.id
    JOIN tests t ON s.test_id = t.id
    WHERE d.session_id = $1
  `;
  const result = await executeQuery(query, [sessionId]);
  return result[0];
};

/**
 * Get all diagnoses for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of diagnoses
 */
const getDiagnosesByUser = async (userId) => {
  const query = `
    SELECT
      d.*,
      s.test_id,
      s.completed_at as test_completed_at,
      t.name as test_name
    FROM test_diagnoses d
    JOIN user_test_sessions s ON d.session_id = s.id
    JOIN tests t ON s.test_id = t.id
    WHERE s.user_id = $1
    ORDER BY d.created_at DESC
  `;
  return executeQuery(query, [userId]);
};

/**
 * Update a diagnosis
 * @param {number} diagnosisId - Diagnosis ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated diagnosis
 */
const updateDiagnosis = async (diagnosisId, updates) => {
  const fields = [];
  const params = [];
  let paramIndex = 1;

  if (updates.diagnosis_text !== undefined) {
    fields.push(`diagnosis_text = $${paramIndex}`);
    params.push(updates.diagnosis_text);
    paramIndex++;
  }

  if (fields.length === 0) {
    throw new Error("No fields to update");
  }

  params.push(diagnosisId);

  const query = `
    UPDATE test_diagnoses
    SET ${fields.join(", ")}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await executeQuery(query, params);
  return result[0];
};

/**
 * Delete a diagnosis
 * @param {number} diagnosisId - Diagnosis ID
 * @returns {Promise<void>}
 */
const deleteDiagnosis = async (diagnosisId) => {
  const query = `DELETE FROM test_diagnoses WHERE id = $1`;
  await executeQuery(query, [diagnosisId]);
};

/**
 * Calculate diagnosis based on which answer letter was chosen most frequently
 * @param {Object} session - Session object with answers JSONB
 * @param {Object} test - Test object with diagnosis_mapping JSONB (optional)
 * @returns {Object} Calculated diagnosis data with session_id and diagnosis_text
 */
const calculateDiagnosisFromAnswers = (session, test = null) => {
  // Fallback mapping if test doesn't have diagnosis_mapping configured
  const FALLBACK_LETTER_TO_DIAGNOSIS = {
    'A': "Depression",
    'B': "Anxiety",
    'C': "Stress",
    'D': "Burnout"
  };

  const answers = session.answers || {};
  const questionIds = Object.keys(answers);

  if (questionIds.length === 0) {
    throw new Error("No answers found in session");
  }

  // Get diagnosis mapping from test or use fallback
  const diagnosisMapping = (test && test.diagnosis_mapping)
    ? test.diagnosis_mapping
    : FALLBACK_LETTER_TO_DIAGNOSIS;

  // Get all valid letters from the mapping
  const validLetters = Object.keys(diagnosisMapping);

  // Initialize letter counts for all valid letters
  const letterCounts = {};
  validLetters.forEach(letter => {
    letterCounts[letter] = 0;
  });

  // Count frequency of each letter in answers
  questionIds.forEach(qId => {
    const answer = answers[qId];
    if (answer && answer.index) {
      const letter = answer.index.toUpperCase();
      // Ensure letter is valid for this test's mapping
      if (letterCounts.hasOwnProperty(letter)) {
        letterCounts[letter]++;
      } else {
        console.warn(`Answer contains invalid letter "${letter}" not in diagnosis mapping. Skipping.`);
      }
    }
  });

  // Find the letter with the highest count
  let mostChosenLetter = validLetters[0];
  let maxCount = letterCounts[mostChosenLetter];

  validLetters.slice(1).forEach(letter => {
    if (letterCounts[letter] > maxCount) {
      maxCount = letterCounts[letter];
      mostChosenLetter = letter;
    }
  });

  // Extract name and description from diagnosis mapping (handle both formats)
  const diagnosisValue = diagnosisMapping[mostChosenLetter];
  let diagnosisName, diagnosisDescription;

  if (typeof diagnosisValue === 'string') {
    // Old format: simple string
    diagnosisName = diagnosisValue;
    diagnosisDescription = null;
  } else if (typeof diagnosisValue === 'object' && diagnosisValue !== null) {
    // New format: object with name and description
    diagnosisName = diagnosisValue.name;
    diagnosisDescription = diagnosisValue.description || null;
  } else {
    // Fallback in case of unexpected format
    diagnosisName = String(diagnosisValue);
    diagnosisDescription = null;
  }

  // Build detailed diagnosis result
  const totalAnswers = questionIds.length;
  const percentage = ((maxCount / totalAnswers) * 100).toFixed(1);

  return {
    session_id: session.id,
    diagnosis_text: `${diagnosisName} (${maxCount}/${totalAnswers} responses, ${percentage}%)`,
    description: diagnosisDescription,  // NEW: Include description
    // Additional metadata for debugging/analytics (not saved to DB currently)
    _metadata: {
      most_chosen_letter: mostChosenLetter,
      count: maxCount,
      total_answers: totalAnswers,
      percentage: percentage,
      all_counts: letterCounts,
      used_fallback_mapping: !(test && test.diagnosis_mapping)
    }
  };
};

module.exports = {
  createDiagnosis,
  getDiagnosisBySession,
  getDiagnosesByUser,
  updateDiagnosis,
  deleteDiagnosis,
  calculateDiagnosisFromAnswers,
};







// /**
//  * Calculate diagnosis based on answers (placeholder - implement your scoring logic)
//  * @param {Object} session - Session object with answers
//  * @returns {Object} Calculated diagnosis data
//  */
// const calculateDiagnosisFromAnswers = (session) => {
//   // TODO: Implement your actual scoring algorithm here
//   // This is a placeholder example

//   const answers = session.answers || {};
//   const questionIds = Object.keys(answers);

//   if (questionIds.length === 0) {
//     throw new Error("No answers found in session");
//   }

//   // Example: Simple scoring based on answer indices
//   let totalScore = 0;
//   let maxScore = questionIds.length * 3; // Assuming max index is 3

//   questionIds.forEach(qId => {
//     const answer = answers[qId];
//     totalScore += answer.index || 0;
//   });

//   const percentageScore = (totalScore / maxScore) * 100;

//   // Determine severity based on percentage
//   let severity_level;
//   let diagnosis_text;
//   let recommendations;

//   if (percentageScore < 25) {
//     severity_level = "minimal";
//     diagnosis_text = "Minimal or no symptoms detected";
//     recommendations = "Continue maintaining healthy habits and regular self-care.";
//   } else if (percentageScore < 50) {
//     severity_level = "mild";
//     diagnosis_text = "Mild symptoms detected";
//     recommendations = "Consider lifestyle changes, stress management techniques, and monitor symptoms.";
//   } else if (percentageScore < 75) {
//     severity_level = "moderate";
//     diagnosis_text = "Moderate symptoms detected";
//     recommendations = "Recommend consultation with a mental health professional for evaluation and potential treatment.";
//   } else {
//     severity_level = "severe";
//     diagnosis_text = "Severe symptoms detected";
//     recommendations = "Strongly recommend immediate consultation with a mental health professional or psychiatrist.";
//   }

//   return {
//     session_id: session.id,
//     diagnosis_text,
//     severity_level,
//     score: percentageScore.toFixed(2),
//     recommendations,
//     created_by: "system", // or null if you want manual review
//   };
// };