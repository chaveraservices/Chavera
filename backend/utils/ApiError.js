// Error carrying an HTTP status code, thrown from controllers and translated
// into a JSON response by the central error handler.
export default class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}
