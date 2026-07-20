import dotenv from 'dotenv';
dotenv.config();

import validateEnv from './config/validateEnv.js';
validateEnv(); // Fail fast before doing anything else.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import router from './router.js';
import connectDB from './db.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { initKeepAlive } from './utils/keepAlive.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Initialize 14-min keep-alive ping
initKeepAlive();

// Security & logging middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' })); // Parses application/json payload with higher limit for bulk imports

// Rate limit the whole API
app.use('/api', apiLimiter);

// API Routes
app.use('/api', router);

// 404 + central error handler (must be last)
app.use(notFound);
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
