require('dotenv').config();

const userService = require("./services/userService");
const testService = require("./services/testService");
const sessionService = require("./services/sessionService");
const diagnosisService = require("./services/diagnosisService");

const createResponse = (statusCode, data) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
  },
  body: JSON.stringify(data),
});

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

    // Auto-calculate and save diagnosis based on most-chosen answer index
    let diagnosis = null;
    try {
      const diagnosisData = diagnosisService.calculateDiagnosisFromAnswers(updatedSession);
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

/**
 * Get all diagnoses for a user
 * GET /users/{userId}/diagnoses
 */
exports.getUserDiagnoses = async (event) => {
  try {
    const userId = getPathParameter(event, "userId");

    if (!userId) {
      return createResponse(400, { message: "Missing user ID" });
    }

    const diagnoses = await diagnosisService.getDiagnosesByUser(userId);

    return createResponse(200, {
      user_id: userId,
      count: diagnoses.length,
      diagnoses: diagnoses,
    });
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