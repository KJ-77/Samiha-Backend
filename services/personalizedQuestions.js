const { executeQuery } = require("../dbConnector");

const getPersonalizedQuestions = async () => {
  const query = `
    SELECT * from personalized_questions`
    return executeQuery(query);
}

const postPersonalizedQuestion = async (question) => {
    const query = `
    INSERT INTO personalized_questions (
      user_id, question
    ) 
    VALUES ($1, $2)`;
    const params = [
        question.user_id,
        question.question,
    ];
    return executeQuery(query, params);   
};

const updatePersonalizedQuestion= async (id, responseData) => {
  // Create dynamic query based on provided fields
  const updates = [];
  const params = [];

  if (responseData.answer !== undefined) {
    updates.push(`answer = $${updates.length + 1}`);
    params.push(responseData.answer);
  }

  if (responseData.response !== undefined) {
    updates.push(`response = $${updates.length + 1}`);
    params.push(responseData.response);
  }

  // Add the ID at the end of params
  params.push(id);

  if (updates.length === 0) {
    return { message: "No updates provided" };
  }

  const query = `
    UPDATE personalized_questions 
    SET ${updates.join(", ")} 
    WHERE id = $${params.length}
  `;

  await executeQuery(query, params);
  return { message: "Personalized question updated successfully" };
};

module.exports = {
    getPersonalizedQuestions,
    postPersonalizedQuestion,
    updatePersonalizedQuestion,
}