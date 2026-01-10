const { executeQuery } = require("../dbConnector");

const getQuestionsForSamiha = async () => {
  const query = `
    SELECT * from questions_for_samiha`;
  return executeQuery(query);
};

const getQuestionsForSamihaByUserId = async (id) => {
  const query = `
  SELECT * from questions_for_samiha WHERE user_id = $1
  `;
  const params = [id];
  return executeQuery(query, params);
};

const postQuestionForSamiha = async (question) => {
  const query = `
    INSERT INTO questions_for_samiha (
      user_id, question
    ) 
    VALUES ($1, $2)
  `;
  const params = [question.user_id, question.question];

  return executeQuery(query, params);
};

const updateQuestionForSamiha = async (id, respondeData) => {
  const query = `
    UPDATE questions_for_samiha
    SET  answer = $1
    WHERE id = $2
    `;
  const params = [respondeData.answer, id];

  await executeQuery(query, params);
  return { message: "Answer successfully added" };
};

module.exports = {
  getQuestionsForSamiha,
  getQuestionsForSamihaByUserId,
  postQuestionForSamiha,
  updateQuestionForSamiha,
};
