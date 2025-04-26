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

// Streaming chat endpoint (SSE)
app.post('/api/chat/stream', async (req, res) => {
  const { message, mode, conversationId, userPrefs } = req.body;
  if (!message || typeof message !== 'string') {
    console.warn('[STREAM] Invalid message received:', message);
    return res.status(400).json({ error: 'Missing or invalid message' });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  console.log('[STREAM] Starting stream for conversationId:', conversationId, 'mode:', mode);
  try {
    let chunkCount = 0;
    for await (const chunk of chatWithOllama(message, mode, conversationId, userPrefs, true)) {
      chunkCount++;
      console.log(`[STREAM CHUNK ${chunkCount}]`, chunk);
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      if (chunk.content === '[DONE]' || chunk.error) {
        console.log('[STREAM] Stream finished due to DONE or error chunk.');
        break;
      }
    }
    res.end();
    console.log('[STREAM] Stream ended, total chunks:', chunkCount);
  } catch (err) {
    console.error('[STREAM ERROR]', err);
    res.write(`data: ${JSON.stringify({ error: 'Streaming failed', details: err.message })}\n\n`);
    res.end();
  }
});

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

app.get('/api/chat/stream', async (req, res) => {
  const { messages: messagesParam, mode } = req.query;
  if (!messagesParam) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  let messages;
  try {
    messages = JSON.parse(messagesParam);
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Invalid messages format');
    }
  } catch (err) {
    return res.status(400).json({ error: 'Invalid messages: must be a non-empty array' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    for await (const chunk of chatWithOllama(messages[messages.length - 1].content, mode, messages[messages.length - 1].conversationId)) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.end();
  } catch (err) {
    console.error('Ollama streaming error:', err);
    res.write(`data: ${JSON.stringify({ error: 'Streaming failed', details: err.message })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
