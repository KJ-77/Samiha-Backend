require('dotenv').config();

const userService = require("./services/userService");
const testService = require("./services/testService");

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