import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import thoughtsRoutes from './src/routes/thoughtsRoutes.js';
import ollamaRoutes from './src/routes/ollamaRoutes.js';
import chatRoutes from './src/routes/chatRoutes.js';
import logRoutes from './src/routes/logRoutes.js';
import { errorHandler } from './src/middlewares/errorHandler.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(helmet());

// Rate limiters
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 }); // 60 req/min for main API
const logLimiter = rateLimit({ windowMs: 60 * 1000, max: 1000 }); // 1000 req/min for logging

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/thoughts', apiLimiter, thoughtsRoutes);
app.use('/api/ollama', apiLimiter, ollamaRoutes);
app.use('/api/chat', apiLimiter, chatRoutes);
app.use('/api/log', logLimiter, logRoutes);

app.use(errorHandler);

export default app;
