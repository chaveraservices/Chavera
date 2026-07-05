import ApiError from '../utils/ApiError.js';
import fs from 'fs';

// 404 handler for unmatched routes.
export const notFound = (req, res, next) => {
    next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// Central error handler — converts thrown errors into a uniform JSON envelope.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
    let status = err.status || 500;
    let message = err.message || 'Internal Server Error';

    // Mongoose validation errors -> 400
    if (err.name === 'ValidationError') {
        status = 400;
        message = Object.values(err.errors).map(e => e.message).join(', ');
    }
    // Mongoose duplicate key error -> 409
    if (err.code === 11000) {
        status = 409;
        message = `Duplicate value for: ${Object.keys(err.keyValue).join(', ')}`;
    }
    // Invalid ObjectId -> 400
    if (err.name === 'CastError') {
        status = 400;
        message = `Invalid ${err.path}`;
    }

    // Express middleware errors (express.json)
    if (err.type === 'entity.parse.failed') {
        status = 400;
        message = 'Invalid JSON payload format';
    }
    if (err.type === 'entity.too.large') {
        status = 413;
        message = 'Payload too large. Please reduce the size of your request.';
    }

    fs.appendFileSync('error.log', JSON.stringify({ status, msg: err.message, stack: err.stack }) + '\n');
    
    if (status >= 500) console.error('FULL ERROR:', err);

    res.status(status).json({ success: false, message: err.message || message });
};
