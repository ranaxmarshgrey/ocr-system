import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';

function formatZodErrors(zodError) {
  const issues = zodError.issues || zodError.errors || [];
  return issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || null;

  if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    errors = formatZodErrors(err);
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = 'Invalid ID format';
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate key conflict';
  }

  if (status >= 500) {
    console.error(err);
  }

  const body = {
    status: 'error',
    message,
  };

  if (errors) {
    body.errors = errors;
  }

  res.status(status).json(body);
}
