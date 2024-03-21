/* 
By including this data property in your ApiError class, you provide flexibility for developers to include additional contextual information with the error object as needed.
*/
class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [], // Represents an array of additional errors or error details.
    stack = ""
  ) {
    super(message);
    this.data = null;
    this.statusCode = statusCode;
    this.errors = errors;
    this.message = message;
    this.success = false;
    // If stack is provided, use it. Otherwise, capture the stack trace.
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiError;
