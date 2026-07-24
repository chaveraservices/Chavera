import ApiError from '../utils/ApiError.js';

/**
 * Route guard for role-restricted endpoints. Must sit AFTER `auth`, which is
 * what populates req.user from the JWT.
 *
 *   router.post('/contact/delete', auth, requireRole('admin'), ...)
 *
 * Tokens issued before roles existed carry no `role` claim; those are treated
 * as admin, matching the User model's default, so an upgrade never locks the
 * existing owner out of their own data.
 */
export const requireRole = (...allowed) => (req, res, next) => {
    const role = req.user?.role || 'admin';
    if (!allowed.includes(role)) {
        return next(new ApiError(403, 'You do not have permission to perform this action.'));
    }
    next();
};
