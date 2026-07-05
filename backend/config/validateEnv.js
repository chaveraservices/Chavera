// Fail fast at boot if required environment variables are missing, so the app
// never silently runs with insecure defaults (e.g. a public JWT secret).
const REQUIRED = ['MONGO_URI', 'JWT_SECRET'];

export default function validateEnv() {
    const missing = REQUIRED.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.error(`FATAL: missing required environment variables: ${missing.join(', ')}`);
        console.error('Copy .env.example to .env and fill in the values.');
        process.exit(1);
    }
}
