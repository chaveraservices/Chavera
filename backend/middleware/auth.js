import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';
import User from '../models/User.js';

// Records "last activity" without a DB write on every request: at most one
// update per user per interval, tracked in-process. Fire-and-forget so it never
// slows the request or fails it if the write errors.
const lastTouched = new Map();
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const touchActivity = (userId) => {
    const now = Date.now();
    if (now - (lastTouched.get(userId) || 0) < TOUCH_INTERVAL_MS) return;
    lastTouched.set(userId, now);
    User.updateOne({ _id: userId }, { lastActivityAt: new Date() }).catch(() => {});
};

export const auth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <token>

    if (!token) {
        return next(new ApiError(401, 'Access denied. No token provided.'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        // 401 (not 403) for a bad/expired token: the client auto-logs-out on
        // 401 only, so a role-denied 403 elsewhere never ends the session.
        if (decoded?.id) touchActivity(decoded.id);
        next();
    } catch {
        next(new ApiError(401, 'Invalid or expired token.'));
    }
};
