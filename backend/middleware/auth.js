import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';

export const auth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <token>

    if (!token) {
        return next(new ApiError(401, 'Access denied. No token provided.'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        next(new ApiError(403, 'Invalid or expired token.'));
    }
};
