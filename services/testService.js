const { get } = require("http");
const { executeQuery } = require("../dbConnector");

const getAllTests = async () => {
    const query = `SELECT * FROM tests`;
    return executeQuery(query);
}

const getTestById = async (id) => {
    const query = `
        select t.*, tq.*
        from tests t left join test_questions tq
        on t.id = tq.test_id where t.id = $1`;
    const result = await executeQuery(query, [id]);
    return result;
}

module.exports = {
  getAllTests,
  getTestById,
};