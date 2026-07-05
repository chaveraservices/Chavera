// Wraps an async route handler so any thrown/rejected error is forwarded to
// the central error-handling middleware instead of crashing the request.
export const asyncHandler = (fn) => (req, res, next) => {
    console.log('[asyncHandler] typeof next:', typeof next);
    return Promise.resolve(fn(req, res, next)).catch(next);
};
