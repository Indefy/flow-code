import express from 'express';
import { chatWithOllama } from '../services/ollama.js';

const router = express.Router();

// Streaming chat endpoint (SSE)
router.post('/stream', async (req, res) => {
  const { message, mode, conversationId, userPrefs } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid message' });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  try {
    let chunkCount = 0;
    for await (const chunk of chatWithOllama(message, mode, conversationId, userPrefs, true)) {
      chunkCount++;
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      if (chunk.content === '[DONE]' || chunk.error) {
        break;
      }
    }
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: 'Streaming failed', details: err.message })}\n\n`);
    res.end();
  }
});

// Chat endpoint: forwards user message to Ollama
router.post('/', async (req, res) => {
  const { message, mode, conversationId, userPrefs } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }
  try {
    const response = await chatWithOllama(message, mode, conversationId, userPrefs);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'Ollama error', details: err.message });
  }
});

export default router;
