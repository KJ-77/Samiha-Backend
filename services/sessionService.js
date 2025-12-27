const { executeQuery, pool } = require("../dbConnector");

/**
 * Create a new test session (user starts a test)
 * @param {string} userId - User ID
 * @param {number} testId - Test ID
 * @returns {Promise<Object>} Created session
 */
const createSession = async (userId, testId) => {
  const query = `
    INSERT INTO user_test_sessions (user_id, test_id, started_at, answers)
    VALUES ($1, $2, CURRENT_TIMESTAMP, '{}'::jsonb)
    RETURNING id, user_id, test_id, started_at, created_at
  `;
  const result = await executeQuery(query, [userId, testId]);
  return result[0];
};

/**
 * Get session by ID
 * @param {number} sessionId - Session ID
 * @returns {Promise<Object>} Session details
 */
const getSessionById = async (sessionId) => {
  const query = `
    SELECT
      s.*,
      t.name as test_name,
      t.description as test_description
    FROM user_test_sessions s
    JOIN tests t ON s.test_id = t.id
    WHERE s.id = $1
  `;
  const result = await executeQuery(query, [sessionId]);
  return result[0];
};

/**
 * Submit test answers (all at once)
 * @param {number} sessionId - Session ID
 * @param {Object} answers - JSONB answers object
 * @returns {Promise<Object>} Updated session
 */
const submitAnswers = async (sessionId, answers) => {
  const query = `
    UPDATE user_test_sessions
    SET
      answers = $1::jsonb,
      completed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const result = await executeQuery(query, [JSON.stringify(answers), sessionId]);
  return result[0];
};

/**
 * Get user's test history (all sessions)
 * @param {string} userId - User ID
 * @param {number} testId - Optional: filter by specific test
 * @returns {Promise<Array>} Array of sessions with test info
 */
const getUserTestHistory = async (userId, testId = null) => {
  let query = `
    SELECT
      s.id,
      s.test_id,
      s.started_at,
      s.completed_at,
      t.name as test_name,
      t.description as test_description,
      d.diagnosis_text
    FROM user_test_sessions s
    JOIN tests t ON s.test_id = t.id
    LEFT JOIN test_diagnoses d ON s.id = d.session_id
    WHERE s.user_id = $1
      AND s.completed_at IS NOT NULL
  `;

  const params = [userId];

  if (testId) {
    query += ` AND s.test_id = $2`;
    params.push(testId);
  }

  query += ` ORDER BY s.completed_at DESC`;

  return executeQuery(query, params);
};

/**
 * Get all sessions for a test (for admin/analytics)
 * @param {number} testId - Test ID
 * @returns {Promise<Array>} Array of sessions
 */
const getSessionsByTest = async (testId) => {
  const query = `
    SELECT
      s.*,
      u.name as user_name,
      u.email as user_email
    FROM user_test_sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.test_id = $1
      AND s.completed_at IS NOT NULL
    ORDER BY s.completed_at DESC
  `;
  return executeQuery(query, [testId]);
};

const getActiveSessionsByUser = async (userId) => {
  const query = `
    select 
      s.*, u.*
      from user_test_sessions s
      join users u
      on s.user_id = u.id 
      where u.id = $1
      and s.completed_at is null
  `;
  return executeQuery(query, [userId]);
}

/**
 * Delete a session (for cleanup/testing)
 * @param {number} sessionId - Session ID
 * @returns {Promise<void>}
 */
const deleteSession = async (sessionId) => {
  const query = `DELETE FROM user_test_sessions WHERE id = $1`;
  await executeQuery(query, [sessionId]);
};

module.exports = {
  createSession,
  getSessionById,
  submitAnswers,
  getUserTestHistory,
  getSessionsByTest,
  deleteSession,
  getActiveSessionsByUser,
};