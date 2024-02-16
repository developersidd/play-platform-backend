/* 
By including this data property in your ApiError class, you provide flexibility for developers to include additional contextual information with the error object as needed.
*/
class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [],
    stack = ""
  ) {
    super(message);
    this.data = null;
    this.statusCode = statusCode;
    this.errors = errors;
    this.message = message;
    this.success = false;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiError;
