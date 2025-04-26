import express from 'express';
import rateLimit from 'express-rate-limit'; // Add this import
import fs from 'fs';
import path from 'path';

const router = express.Router();
const logFile = path.resolve('data/agent.log');

// Create a limiter that allows 100 requests per hour
const limiter = rateLimit({
  windowMs: 3600000,
  max: 100,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyRejection: false,
  handler: (req, res) => {
    const retryAfter = Math.floor(res.get('Retry-After') / 1000);
    return res.status(429).json({
      error: `Rate limit exceeded. Retry after ${retryAfter} seconds`
    });
  }
});

router.use(limiter);

router.post('/', (req, res) => {
  const { type, content, meta } = req.body;
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    content,
    meta,
  };

  fs.appendFile(logFile, JSON.stringify(logEntry) + '\n', err => {
    if (err) return res.status(500).json({ error: 'Failed to write log' });
    res.json({ status: 'logged' });
  });
});

export default router;
