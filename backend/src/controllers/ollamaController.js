import { chatWithOllama } from '../services/ollama.js';

export const postOllama = async (req, res, next) => {
  try {
    const { message, mode, conversationId, userPrefs } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid message' });
    }
    const response = await chatWithOllama(message, mode, conversationId, userPrefs);
    res.json(response);
  } catch (err) {
    next(err);
  }
};
