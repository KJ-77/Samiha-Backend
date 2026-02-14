const { executeQuery } = require("../dbConnector");

const getPersonalizedQuestions = async () => {
  const query = `
    SELECT * from personalized_questions`
    return executeQuery(query);
}

const postPersonalizedQuestion = async (question) => {
    const query = `
    INSERT INTO personalized_questions (
      question, answer, language
    ) 
    VALUES ($1, $2, $3)`;
    const params = [
        question.question,
        question.answer,
        question.language
    ];
    return executeQuery(query, params);   
};

const updatePersonalizedQuestion= async (id, responseData) => {
  // Create dynamic query based on provided fields
  const updates = [];
  const params = [];

  if (responseData.question !== undefined) {
    updates.push(`question = $${updates.length + 1}`);
    params.push(responseData.question);
  }

  if (responseData.answer !== undefined) {
    updates.push(`answer = $${updates.length + 1}`);
    params.push(responseData.answer);
  }

  if (responseData.language !== undefined) {
    updates.push(`language = $${updates.length + 1}`);
    params.push(responseData.language);
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

const deletePersonalizedQuestion = async (id) => {
  const query = `
    DELETE FROM personalized_questions
    where id = $1
  `;
  const params = [id];
  return executeQuery(query, params);
}

module.exports = {
    getPersonalizedQuestions,
    postPersonalizedQuestion,
    updatePersonalizedQuestion,
    deletePersonalizedQuestion,
}