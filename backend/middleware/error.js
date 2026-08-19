const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
  let error = new ErrorResponse(
    err.message || 'Internal Server Error',
    err.statusCode || 500
  );

  // ── MySQL: duplicate key 
  if (err.code === 'ER_DUP_ENTRY') {
    const match = err.message.match(/key '[\w.]*?\.?(\w+)'/i);
    const field = match ? match[1] : 'field';
    error = new ErrorResponse(
      `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
      409
    );
  }

  // ── MySQL: data too long 
  if (err.code === 'ER_DATA_TOO_LONG') {
    error = new ErrorResponse('Input value exceeds the maximum allowed length', 400);
  }

  // ── MySQL: invalid enum / truncated data 
  if (err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'WARN_DATA_TRUNCATED') {
    error = new ErrorResponse('Invalid value for one of the fields', 400);
  }

  // ── MySQL: NOT NULL violation
  if (err.code === 'ER_BAD_NULL_ERROR') {
    error = new ErrorResponse('A required field is missing', 400);
  }

  // ── MySQL: foreign key violation 
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    error = new ErrorResponse('Referenced resource does not exist', 404);
  }

  // ── MySQL: pool exhausted / connection refused
  if (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR') {
    error = new ErrorResponse('Database unavailable — try again shortly', 503);
  }

  // JWT 
  if (err.name === 'JsonWebTokenError')  error = new ErrorResponse('Invalid session', 401);
  if (err.name === 'TokenExpiredError')  error = new ErrorResponse('Session expired', 401);
  if (err.name === 'NotBeforeError')     error = new ErrorResponse('Token not yet valid', 401);

  // ── Production: never leak stack traces or internal details ───
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    console.error(`🔴  [${err.code || err.name || 'Error'}] ${err.message}`);
  }

  res.status(error.statusCode).json({
    success: false,
    error:   error.message,
    ...(isDev && { code: err.code, stack: err.stack }),
  });
};

module.exports = errorHandler;
