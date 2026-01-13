require('dotenv').config();

const userService = require("./services/userService");
const testService = require("./services/testService");
const sessionService = require("./services/sessionService");
const diagnosisService = require("./services/diagnosisService");
const questionsForSamihaService = require("./services/questionsForSamihaService");
const personalizedQuestions = require("./services/personalizedQuestions");

const createResponse = (statusCode, data) => {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // Enable CORS for browser access
      "Access-Control-Allow-Credentials": true,
    },
    body: JSON.stringify(data),
  };
};

const parseBody = (body) => {
  if (!body) return {};
  if (typeof body === "object") return body;
  try {
    return JSON.parse(body);
  } catch (err) {
    throw new Error("Invalid JSON body");
  }
};

const getPathParameter = (event, key) => (event && event.pathParameters ? event.pathParameters[key] : null);

const handleError = (err) => {
  console.error(err);
  if (err && err.code === "ER_DUP_ENTRY") return createResponse(409, { error: "Duplicate entry", message: err.message });
  return createResponse(500, { error: "Server error", message: err.message || String(err) });
};

exports.getUsers = async (event) => {
  try {
    const id = getPathParameter(event, "id");
    if (id) {
      const user = await userService.getUserById(id);
      if (!user) return createResponse(404, { message: "User not found" });
      return createResponse(200, user);
    }
    const users = await userService.getAllUsers();
    return createResponse(200, users);
  } catch (err) {
    return handleError(err);
  }
};

exports.createUser = async (event) =>{
  try{
    const body = parseBody(event.body);
    if(!body || !body.id || !body.email || !body.name){
      return createResponse(400, {message: "Missing required user fields: id, email, name"});
    }
    const userData = {
      id: body.id,
      email: body.email,
      name: body.name,
    };
    const result = await userService.createUser(userData);
    return createResponse(201, {
      message: "User created successfully", 
      userId: result.insertId
    });
  } catch (err) {
    return handleError(err);
  }
};

exports.updateUser = async (event) => {
  try {
    const id = getPathParameter(event, "id");
    const userData = parseBody(event.body);
    if (!id) {
      return createResponse(400, { message: "Missing user ID in path parameters" });
    }

    const user = await userService.getUserById(id);
    if (!user) {
      return createResponse(404, { error: "User not found" });
    }

    await userService.updateUser(id, userData);

    return createResponse(200, {
      message: "User updated successfully",
      userId: id,
    });
  } catch (error) {
    return handleError(error);
  }
}

exports.getAllTests = async (event) => {
  try {
    const id = getPathParameter(event, "id");
    if (id) {
      const test = await testService.getTestById(id);
      if (!test) return createResponse(404, { message: "Test not found" });
      return createResponse(200, test);
    }
    const tests = await testService.getAllTests();
    return createResponse(200, tests);
  } catch (err) {
    return handleError(err);
  }
};

/**
 * Create a new test with questions
 * POST /tests
 * Body: { name, description, diagnosis_mapping, questions: [{question, choices}] }
 */
exports.createTest = async (event) => {
  try {
    const body = parseBody(event.body);

    // Validate required fields
    if (!body.name) {
      return createResponse(400, {
        message: "Missing required field: name"
      });
    }

    // Validate questions if provided
    if (body.questions) {
      if (!Array.isArray(body.questions)) {
        return createResponse(400, {
          message: "questions must be an array"
        });
      }

      for (let i = 0; i < body.questions.length; i++) {
        const q = body.questions[i];
        if (!q.question || !q.choices) {
          return createResponse(400, {
            message: `Question ${i + 1} missing required fields: question, choices`
          });
        }
      }

      // Validate diagnosis mapping against questions
      if (body.diagnosis_mapping) {
        const validation = testService.validateDiagnosisMapping(
          body.diagnosis_mapping,
          body.questions
        );

        if (!validation.isValid) {
          return createResponse(400, {
            message: "Invalid diagnosis_mapping",
            errors: validation.errors
          });
        }
      }
    }

    const testData = {
      name: body.name,
      description: body.description || null,
      diagnosis_mapping: body.diagnosis_mapping || null,
      questions: body.questions || []
    };

    const test = await testService.createTest(testData);

    return createResponse(201, {
      message: "Test created successfully",
      test: test
    });

  } catch (err) {
    return handleError(err);
  }
};

/**
 * Update an existing test (metadata only)
 * PUT /tests/{id}
 * Body: { name?, description?, diagnosis_mapping? }
 */
exports.updateTest = async (event) => {
  try {
    const testId = getPathParameter(event, "id");
    const body = parseBody(event.body);

    if (!testId) {
      return createResponse(400, {
        message: "Missing test ID in path parameters"
      });
    }

    // Validate at least one field is provided
    if (body.name === undefined && body.description === undefined && body.diagnosis_mapping === undefined) {
      return createResponse(400, {
        message: "No fields to update. Provide at least one of: name, description, diagnosis_mapping"
      });
    }

    const testData = {};
    if (body.name !== undefined) testData.name = body.name;
    if (body.description !== undefined) testData.description = body.description;
    if (body.diagnosis_mapping !== undefined) testData.diagnosis_mapping = body.diagnosis_mapping;

    const test = await testService.updateTest(testId, testData);

    return createResponse(200, {
      message: "Test updated successfully",
      test: test
    });

  } catch (err) {
    if (err.message === 'Test not found') {
      return createResponse(404, { message: "Test not found" });
    }
    return handleError(err);
  }
};

/**
 * Add a question to a test
 * POST /tests/{testId}/questions
 * Body: { question, choices }
 */
exports.addQuestionToTest = async (event) => {
  try {
    const testId = getPathParameter(event, "testId");
    const body = parseBody(event.body);

    if (!testId) {
      return createResponse(400, {
        message: "Missing test ID in path parameters"
      });
    }

    if (!body.question || !body.choices) {
      return createResponse(400, {
        message: "Missing required fields: question, choices"
      });
    }

    const questionData = {
      question: body.question,
      choices: body.choices
    };

    const question = await testService.addQuestionToTest(testId, questionData);

    return createResponse(201, {
      message: "Question added successfully",
      question: question
    });

  } catch (err) {
    if (err.message === 'Test not found') {
      return createResponse(404, { message: "Test not found" });
    }
    return handleError(err);
  }
};

/**
 * Update a specific question
 * PUT /tests/{testId}/questions/{questionId}
 * Body: { question?, choices? }
 */
exports.updateQuestion = async (event) => {
  try {
    const questionId = getPathParameter(event, "questionId");
    const body = parseBody(event.body);

    if (!questionId) {
      return createResponse(400, {
        message: "Missing question ID in path parameters"
      });
    }

    if (body.question === undefined && body.choices === undefined) {
      return createResponse(400, {
        message: "No fields to update. Provide at least one of: question, choices"
      });
    }

    const questionData = {};
    if (body.question !== undefined) questionData.question = body.question;
    if (body.choices !== undefined) questionData.choices = body.choices;

    const question = await testService.updateQuestion(questionId, questionData);

    return createResponse(200, {
      message: "Question updated successfully",
      question: question
    });

  } catch (err) {
    if (err.message === 'Question not found') {
      return createResponse(404, { message: "Question not found" });
    }
    return handleError(err);
  }
};

/**
 * Delete a question
 * DELETE /tests/{testId}/questions/{questionId}
 */
exports.deleteQuestion = async (event) => {
  try {
    const questionId = getPathParameter(event, "questionId");

    if (!questionId) {
      return createResponse(400, {
        message: "Missing question ID in path parameters"
      });
    }

    const result = await testService.deleteQuestion(questionId);

    return createResponse(200, {
      message: "Question deleted successfully",
      deleted: result.deleted
    });

  } catch (err) {
    if (err.message === 'Question not found') {
      return createResponse(404, { message: "Question not found" });
    }
    return handleError(err);
  }
};

/**
 * Create a new test session (user starts a test)
 * POST /sessions
 * Body: { user_id, test_id }
 */
exports.createSession = async (event) => {
  try {
    const body = parseBody(event.body);

    if (!body.user_id || !body.test_id) {
      return createResponse(400, {
        message: "Missing required fields: user_id, test_id"
      });
    }

    const session = await sessionService.createSession(body.user_id, body.test_id);

    return createResponse(201, {
      message: "Test session started successfully",
      session: session,
    });
  } catch (err) {
    return handleError(err);
  }
};

/**
 * Get session by ID
 * GET /sessions/{id}
 */
exports.getSession = async (event) => {
  try {
    const sessionId = getPathParameter(event, "id");

    if (!sessionId) {
      return createResponse(400, { message: "Missing session ID" });
    }

    const session = await sessionService.getSessionById(sessionId);

    if (!session) {
      return createResponse(404, { message: "Session not found" });
    }

    return createResponse(200, session);
  } catch (err) {
    return handleError(err);
  }
};

/**
 * Submit test answers (complete the test)
 * POST /sessions/{id}/submit
 * Body: { answers: { "question_id": { index, text, question }, ... } }
 */
exports.submitTestAnswers = async (event) => {
  try {
    const sessionId = getPathParameter(event, "id");
    const body = parseBody(event.body);

    if (!sessionId) {
      return createResponse(400, { message: "Missing session ID" });
    }

    if (!body.answers || typeof body.answers !== "object") {
      return createResponse(400, {
        message: "Missing or invalid answers object"
      });
    }

    // Verify session exists and is not already completed
    const session = await sessionService.getSessionById(sessionId);
    if (!session) {
      return createResponse(404, { message: "Session not found" });
    }

    if (session.completed_at) {
      return createResponse(400, {
        message: "Test already completed",
        completed_at: session.completed_at,
      });
    }

    // Submit answers
    const updatedSession = await sessionService.submitAnswers(sessionId, body.answers);

    // Get test with diagnosis mapping for diagnosis calculation
    const testResult = await testService.getTestById(session.test_id);
    const test = testResult && testResult.length > 0 ? testResult[0] : null;

    // Auto-calculate and save diagnosis based on most-chosen answer index
    let diagnosis = null;
    try {
      const diagnosisData = diagnosisService.calculateDiagnosisFromAnswers(
        updatedSession,
        test  // Pass test object with diagnosis_mapping
      );
      diagnosis = await diagnosisService.createDiagnosis(diagnosisData);
    } catch (diagnosisError) {
      console.error("Error creating diagnosis:", diagnosisError);
      // Don't fail the entire request if diagnosis creation fails
      // Just log it and continue - diagnosis can be created manually later
    }

    return createResponse(200, {
      message: "Test submitted successfully",
      session: updatedSession,
      diagnosis: diagnosis,
    });
  } catch (err) {
    return handleError(err);
  }
};

/**
 * Get user's test history
 * GET /users/{userId}/test-history
 * Optional query param: ?test_id=5
 */
exports.getUserTestHistory = async (event) => {
  try {
    const userId = getPathParameter(event, "userId");

    if (!userId) {
      return createResponse(400, { message: "Missing user ID" });
    }

    // Get optional test_id filter from query params
    const testId = event.queryStringParameters?.test_id || null;

    const history = await sessionService.getUserTestHistory(userId, testId);

    return createResponse(200, {
      user_id: userId,
      test_count: history.length,
      history,
    });
  } catch (err) {
    return handleError(err);
  }
};

/**
 * Create a diagnosis for a session
 * POST /diagnoses
 * Body: { session_id, diagnosis_text, severity_level, score, recommendations }
 */
exports.createDiagnosis = async (event) => {
  try {
    const body = parseBody(event.body);

    if (!body.session_id || !body.diagnosis_text) {
      return createResponse(400, {
        message: "Missing required fields: session_id, diagnosis_text"
      });
    }

    // Verify session exists and is completed
    const session = await sessionService.getSessionById(body.session_id);
    if (!session) {
      return createResponse(404, { message: "Session not found" });
    }

    if (!session.completed_at) {
      return createResponse(400, {
        message: "Cannot create diagnosis for incomplete test"
      });
    }

    const diagnosis = await diagnosisService.createDiagnosis(body);

    return createResponse(201, {
      message: "Diagnosis created successfully",
      diagnosis: diagnosis,
    });
  } catch (err) {
    // Handle duplicate diagnosis error (UNIQUE constraint)
    if (err.code === "23505") {
      return createResponse(409, {
        message: "Diagnosis already exists for this session"
      });
    }
    return handleError(err);
  }
};

/**
 * Get diagnosis for a session
 * GET /sessions/{id}/diagnosis
 */
exports.getSessionDiagnosis = async (event) => {
  try {
    const sessionId = getPathParameter(event, "id");

    if (!sessionId) {
      return createResponse(400, { message: "Missing session ID" });
    }

    const diagnosis = await diagnosisService.getDiagnosisBySession(sessionId);

    if (!diagnosis) {
      return createResponse(404, {
        message: "No diagnosis found for this session"
      });
    }

    return createResponse(200, diagnosis);
  } catch (err) {
    return handleError(err);
  }
};

exports.getActiveSessionsByUser = async (event) => {
  try {
    const userId = getPathParameter(event, "userId");

    if (!userId) {
      return createResponse(400, { message: "Missing user ID" });
    }

    const sessions = await sessionService.getActiveSessionsByUser(userId);

    return createResponse(200, {
      user_id: userId,
      active_session_count: sessions.length,
      sessions: sessions,
    });
  } catch (err) {
    return handleError(err);
  }
};

exports.getDiagnosesByUser = async (event) => {
  try {
    const userId = getPathParameter(event, "userId");

    if (!userId) {
      return createResponse(400, { message: "Missing user ID" });
    }

    const diagnoses = await diagnosisService.getDiagnosesByUser(userId);

    return createResponse(200, {
      user_id: userId,
      diagnosis_count: diagnoses.length,
      diagnoses: diagnoses,
    });
  } catch (err) {
    return handleError(err);
  }
};

exports.getQuestionsForSamiha = async (event) => {
  try {
    const questions = await questionsForSamihaService.getQuestionsForSamiha();
    return createResponse(200, {
      question_count: questions.length,
      questions: questions,
    });
  } catch (err) {
    return handleError(err);
  }
};

exports.postQuestionForSamiha = async (event) => {
  try {
    const body = parseBody(event.body);
    if(!body || !body.user_id || !body.question) return createResponse(400, {message: "Missing required fields: user_id, question"})
    const questionData = {
      user_id: body.user_id,
      question: body.question,
    };
    const result = await questionsForSamihaService.postQuestionForSamiha(questionData);
    return createResponse(201, {
      message: "Question posted successfully",
      questionId: result.insertId,
    });
  } catch (err) {
    return handleError(err);
    }
};

exports.getPersonalizedQuestions = async (event) => {
  try {
    const questions = await personalizedQuestions.getPersonalizedQuestions();
    return createResponse(200, {
      question_count: questions.length,
      questions: questions,
      });
    } catch (err) {
    return handleError(err);
    }
};

exports.postPersonalizedQuestion = async (event) => {
  try {
    const body = parseBody(event.body);
    if(!body || !body.question || !body.answer) return createResponse(400, {message: "Missing required fields: question, answer"})
    const questionData = {
      question: body.question,
      answer: body.answer,
    };
    const result = await personalizedQuestions.postPersonalizedQuestion(questionData);
    return createResponse(201, {
      message: "Personalized question posted successfully",
      questionId: result.insertId,
    });
  } catch (err) {
    return handleError(err);
  }
};

exports.updatePersonalizedQuestion = async (event) => {
  try {
    const id = getPathParameter(event, "questionId");
    const responseData = parseBody(event.body);
    if (!id) return createResponse(400, { message: "Missing question ID in path parameters"});
    await personalizedQuestions.updatePersonalizedQuestion(id, responseData);
    return createResponse(200, {
      message: "Personalized question updated successfully",
      questionId: id,
    });
  } catch (err) {
    return handleError(err);
  }
};

exports.getQuestionsForSamihaByUserId = async (event) => {
  try{
    const userId = getPathParameter(event, "userId");
    if(!userId) return createResponse(400, {message: "Missing user ID"});
    const user = await userService.getUserById(userId);

    if(!user) return createResponse(404, {message: "User not found"});
    const questions = await questionsForSamihaService.getQuestionsForSamihaByUserId(userId);
    return createResponse(200, {
      question_count: questions.length,
      name: user.name,
      questions: questions,
    });
  } catch (err) {
    return handleError(err);
  }
};

exports.updateQuestionForSamiha = async (event) => {
  try {
    const id = getPathParameter(event, "questionId");
    const responseData = parseBody(event.body);
    if (!id || !responseData.answer) return createResponse(400, { message: "Missing question ID in path parameters or answer in body"});
    await questionsForSamihaService.updateQuestionForSamiha(id, responseData);
    return createResponse(200, {
      message: "Answer successfully added",
      questionId: id,
    });
  } catch (err) {
    return handleError(err);
  }
};
/**
 * Auto-calculate and create diagnosis for a session
 * POST /sessions/{id}/calculate-diagnosis
 */
// exports.calculateSessionDiagnosis = async (event) => {
//   try {
//     const sessionId = getPathParameter(event, "id");

//     if (!sessionId) {
//       return createResponse(400, { message: "Missing session ID" });
//     }

//     // Get session with answers
//     const session = await sessionService.getSessionById(sessionId);
//     if (!session) {
//       return createResponse(404, { message: "Session not found" });
//     }

//     if (!session.completed_at) {
//       return createResponse(400, {
//         message: "Cannot calculate diagnosis for incomplete test"
//       });
//     }

//     // Calculate diagnosis
//     const diagnosisData = diagnosisService.calculateDiagnosisFromAnswers(session);

//     // Save diagnosis
//     const diagnosis = await diagnosisService.createDiagnosis(diagnosisData);

//     return createResponse(201, {
//       message: "Diagnosis calculated and saved successfully",
//       diagnosis,
//     });
//   } catch (err) {
//     if (err.code === "23505") {
//       return createResponse(409, {
//         message: "Diagnosis already exists for this session"
//       });
//     }
//     return handleError(err);
//   }
// };