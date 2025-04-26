import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

import { chatWithOllama } from './services/ollama.js';

// Chat endpoint: forwards user message to Ollama
app.post('/api/chat', async (req, res) => {
  const { message, mode, conversationId, userPrefs } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }
  try {
    const response = await chatWithOllama(message, mode, conversationId, userPrefs);
    res.json({ 
      reply: response.reply, 
      thoughts: response.thoughts,
      conversationId: response.conversationId,
      sentiment: response.sentiment
    });
  } catch (err) {
    console.error('Ollama error:', {
      message: err.message,
      code: err.code,
      responseData: err.response?.data,
      stack: err.stack,
    });
    res.status(500).json({ error: 'Failed to communicate with Ollama', details: err.response?.data || err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
