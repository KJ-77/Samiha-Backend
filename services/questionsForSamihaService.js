const { executeQuery } = require("../dbConnector");

const getQuestionsForSamiha = async () => {
  const query = `
    SELECT * from questions_for_samiha`;
    return executeQuery(query);
}

const postQuestionForSamiha = async (question) => {
    const query = `
    INSERT INTO questions_for_samiha (
      user_id, question
    ) 
    VALUES ($1, $2)
  `;
  const params = [
    question.user_id,
    question.question,
  ];

    return executeQuery(query, params);
}


module.exports = {
  getQuestionsForSamiha,
  postQuestionForSamiha,
};