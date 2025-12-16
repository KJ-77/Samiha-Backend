const { get } = require("http");
const { executeQuery } = require("../dbConnector");

/**
 * Get all users from the database
 * @returns {Promise<Array>} List of users
 */
const getAllUsers = async () => {
  const query = `SELECT * FROM public.users`;
  return executeQuery(query);
};

const getUserById = async (id) => {
  const query = `SELECT * FROM public.users WHERE id = $1`;
  const result = await executeQuery(query, [id]);
  return result[0]; // Close the connection
  // Return the first (and should be only) result
};

const createUser = async (user) => {
  const query = `
    INSERT INTO users (
      id, email, name
    ) 
    VALUES ($1, $2, $3)
  `;
  const params = [
    user.id,
    user.email,
    user.name,
  ];

  return executeQuery(query, params);
};

const updateUser = async (id, user) => {
  const updates = [];
  const params = [];
  if (user.email !== undefined) {
    updates.push(`email = $${updates.length + 1}`);
    params.push(user.email);
  }
  if (user.name !== undefined) {
    updates.push(`name = $${updates.length + 1}`);
    params.push(user.name);
  }

  params.push(id);

  const query = `
      UPDATE users 
      SET ${updates.join(", ")}
      where id = $${params.length}
      `
  return executeQuery(query, params);
}
  


module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
};

