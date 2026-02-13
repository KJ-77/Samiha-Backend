const { get } = require("http");
const { executeQuery, pool } = require("../dbConnector");

const getAllTests = async () => {
    const query = `SELECT * FROM tests`;
    return executeQuery(query);
}

const getTestById = async (id) => {
    const query = `
        select t.*, tq.*
        from tests t left join test_questions tq
        on t.id = tq.test_id where t.id = $1
        `;
    const result = await executeQuery(query, [id]);
    return result;
}

/**
 * Create a new test with questions in a transaction
 * @param {Object} testData - Test information
 * @param {string} testData.name - Test name
 * @param {string} testData.description - Test description
 * @param {Object} testData.diagnosis_mapping - Letter to diagnosis mapping
 * @param {Array} testData.questions - Array of question objects
 * @returns {Promise<Object>} Created test with questions
 */
const createTest = async (testData) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insert test
    const testQuery = `
      INSERT INTO tests (name, description, diagnosis_mapping, language)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const testParams = [
      testData.name,
      testData.description || null,
      testData.diagnosis_mapping ? JSON.stringify(testData.diagnosis_mapping) : null,
      testData.language || null
    ];

    const testResult = await client.query(testQuery, testParams);
    const test = testResult.rows[0];

    // 2. Insert questions if provided
    const questions = [];
    if (testData.questions && testData.questions.length > 0) {
      const questionQuery = `
        INSERT INTO test_questions (test_id, question, choices)
        VALUES ($1, $2, $3)
        RETURNING *
      `;

      for (const q of testData.questions) {
        const questionParams = [
          test.id,
          q.question,
          JSON.stringify(q.choices)
        ];
        const questionResult = await client.query(questionQuery, questionParams);
        questions.push(questionResult.rows[0]);
      }
    }

    await client.query('COMMIT');

    return {
      ...test,
      questions: questions
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Update an existing test (metadata only)
 * @param {number} testId - Test ID
 * @param {Object} testData - Updated test information
 * @param {string} testData.name - Test name (optional)
 * @param {string} testData.description - Test description (optional)
 * @param {Object} testData.diagnosis_mapping - Letter to diagnosis mapping (optional)
 * @returns {Promise<Object>} Updated test
 */
const updateTest = async (testId, testData) => {
  const updateFields = [];
  const updateParams = [];
  let paramIndex = 1;

  if (testData.name !== undefined) {
    updateFields.push(`name = $${paramIndex}`);
    updateParams.push(testData.name);
    paramIndex++;
  }

  if (testData.description !== undefined) {
    updateFields.push(`description = $${paramIndex}`);
    updateParams.push(testData.description);
    paramIndex++;
  }

  if (testData.diagnosis_mapping !== undefined) {
    updateFields.push(`diagnosis_mapping = $${paramIndex}`);
    updateParams.push(testData.diagnosis_mapping ? JSON.stringify(testData.diagnosis_mapping) : null);
    paramIndex++;
  }

  if (testData.language !== undefined) {
    updateFields.push(`language = $${paramIndex}`);
    updateParams.push(testData.language);
    paramIndex++;
  }

  if (updateFields.length === 0) {
    // No fields to update, just fetch the test
    const fetchQuery = 'SELECT * FROM tests WHERE id = $1';
    const result = await executeQuery(fetchQuery, [testId]);
    if (result.length === 0) {
      throw new Error('Test not found');
    }
    return result[0];
  }

  updateParams.push(testId);
  const updateQuery = `
    UPDATE tests
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await executeQuery(updateQuery, updateParams);
  if (result.length === 0) {
    throw new Error('Test not found');
  }

  return result[0];
};

/**
 * Add a question to a test
 * @param {number} testId - Test ID
 * @param {Object} questionData - Question information
 * @param {string} questionData.question - Question text
 * @param {Object} questionData.choices - Choices object
 * @returns {Promise<Object>} Created question
 */
const addQuestionToTest = async (testId, questionData) => {
  // Verify test exists
  const testQuery = 'SELECT id FROM tests WHERE id = $1';
  const testResult = await executeQuery(testQuery, [testId]);
  if (testResult.length === 0) {
    throw new Error('Test not found');
  }

  // Insert question
  const questionQuery = `
    INSERT INTO test_questions (test_id, question, choices)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const questionParams = [
    testId,
    questionData.question,
    JSON.stringify(questionData.choices)
  ];

  const result = await executeQuery(questionQuery, questionParams);
  return result[0];
};

/**
 * Update a specific question
 * @param {number} questionId - Question ID
 * @param {Object} questionData - Updated question information
 * @param {string} questionData.question - Question text (optional)
 * @param {Object} questionData.choices - Choices object (optional)
 * @returns {Promise<Object>} Updated question
 */
const updateQuestion = async (questionId, questionData) => {
  const updateFields = [];
  const updateParams = [];
  let paramIndex = 1;

  if (questionData.question !== undefined) {
    updateFields.push(`question = $${paramIndex}`);
    updateParams.push(questionData.question);
    paramIndex++;
  }

  if (questionData.choices !== undefined) {
    updateFields.push(`choices = $${paramIndex}`);
    updateParams.push(JSON.stringify(questionData.choices));
    paramIndex++;
  }

  if (updateFields.length === 0) {
    // No fields to update, just fetch the question
    const fetchQuery = 'SELECT * FROM test_questions WHERE id = $1';
    const result = await executeQuery(fetchQuery, [questionId]);
    if (result.length === 0) {
      throw new Error('Question not found');
    }
    return result[0];
  }

  updateParams.push(questionId);
  const updateQuery = `
    UPDATE test_questions
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await executeQuery(updateQuery, updateParams);
  if (result.length === 0) {
    throw new Error('Question not found');
  }

  return result[0];
};

/**
 * Delete a question
 * @param {number} questionId - Question ID
 * @returns {Promise<Object>} Deletion result
 */
const deleteQuestion = async (questionId) => {
  const deleteQuery = `
    DELETE FROM test_questions
    WHERE id = $1
    RETURNING *
  `;

  const result = await executeQuery(deleteQuery, [questionId]);
  if (result.length === 0) {
    throw new Error('Question not found');
  }

  return { success: true, deleted: result[0] };
};

/**
 * Validate diagnosis mapping against question choices
 * @param {Object} diagnosisMapping - Letter to diagnosis mapping
 * @param {Array} questions - Array of question objects with choices
 * @returns {Object} Validation result with isValid and errors array
 */
const validateDiagnosisMapping = (diagnosisMapping, questions) => {
  const errors = [];

  if (!diagnosisMapping) {
    return { isValid: true, errors: [] }; // NULL mapping is valid (uses fallback)
  }

  // Validate mapping structure
  if (typeof diagnosisMapping !== 'object' || Array.isArray(diagnosisMapping)) {
    errors.push('diagnosis_mapping must be a JSON object');
    return { isValid: false, errors };
  }

  // Get all letters used in diagnosis mapping
  const mappingLetters = Object.keys(diagnosisMapping).map(k => k.toUpperCase());

  // Validate letter format
  for (const letter of mappingLetters) {
    if (!/^[A-Z]$/.test(letter)) {
      errors.push(`Invalid letter in diagnosis_mapping: "${letter}". Must be single uppercase letter A-Z.`);
    }
  }

  // Validate value format (string or object with name and description)
  Object.entries(diagnosisMapping).forEach(([letter, value]) => {
    if (typeof value === 'string') {
      // Old format - valid
      return;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // New format - validate structure
      if (!value.name || typeof value.name !== 'string') {
        errors.push(`diagnosis_mapping["${letter}"] must have a "name" field as a string`);
      }
      if (value.description !== undefined && typeof value.description !== 'string') {
        errors.push(`diagnosis_mapping["${letter}"].description must be a string if provided`);
      }
    } else {
      errors.push(`diagnosis_mapping["${letter}"] must be either a string or object with {name, description}`);
    }
  });

  // Get all letters used in question choices
  const choiceLetters = new Set();
  questions.forEach((q, idx) => {
    if (!q.choices || typeof q.choices !== 'object') {
      errors.push(`Question ${idx + 1} has invalid choices format`);
      return;
    }

    Object.keys(q.choices).forEach(key => {
      choiceLetters.add(key.toUpperCase());
    });
  });

  // Check if diagnosis mapping covers all choice letters
  const missingLetters = Array.from(choiceLetters).filter(letter => !mappingLetters.includes(letter));
  if (missingLetters.length > 0) {
    errors.push(`diagnosis_mapping missing entries for choice letters: ${missingLetters.join(', ')}`);
  }

  // Check for extra letters in mapping (warning only, not an error)
  const extraLetters = mappingLetters.filter(letter => !choiceLetters.has(letter));
  if (extraLetters.length > 0) {
    console.warn(`Warning: diagnosis_mapping has extra letters not used in choices: ${extraLetters.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const getAllUsersPerCompletedTest = async (testId) => {
  const query = `
    select u.name, u.email, uts.answers, uts.completed_at 
    from users u left join user_test_sessions uts 
    on u.id = uts.user_id
    where uts.test_id = $1 and uts.answers is not null and uts.answers <> '{}'::jsonb
    `
    return executeQuery(query, [testId]);
}

const deleteTest = async (testId) => {
  const query = `
    DELETE FROM test_questions
    WHERE test_id = $1`;
    
  await executeQuery(query, [testId]);

  const query2 = `
    DELETE FROM tests
    WHERE id = $1
    RETURNING *
  `;
  return executeQuery(query2, [testId]);
};

const getTestsByLanguage = async (language) => {
   const query = `
    SELECT * FROM tests
    WHERE language = $1
  `;
  return executeQuery(query, [language]);
};

module.exports = {
  getAllTests,
  getTestById,
  createTest,
  updateTest,
  addQuestionToTest,
  updateQuestion,
  deleteQuestion,
  validateDiagnosisMapping,
  getAllUsersPerCompletedTest,
  deleteTest,
  getTestsByLanguage
};