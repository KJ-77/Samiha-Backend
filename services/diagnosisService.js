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
      diagnosis_text
    )
    VALUES ($1, $2)
    RETURNING *
  `;

  const params = [
    diagnosisData.session_id,
    diagnosisData.diagnosis_text,
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



module.exports = {
  createDiagnosis,
  getDiagnosisBySession,
  getDiagnosesByUser,
  updateDiagnosis,
  deleteDiagnosis,
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