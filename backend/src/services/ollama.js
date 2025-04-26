import axios from 'axios';

// Move configuration to a separate object for better management
const config = {
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'cogito'
};

/**
 * Generates system prompt based on mode.
 * @param {string} mode - The chat mode
 * @returns {string} - The system prompt
 */
function getSystemPrompt(mode) {
  switch (mode.toLowerCase()) {
    case 'creative':
      return 'You are a creative and imaginative assistant. Respond with originality and flair.';
    case 'code':
      return 'You are a helpful coding assistant. Generate and explain code clearly.';
    default:
      return '';
  }
}

/**
 * Builds the messages array for the payload.
 * @param {string} systemPrompt - The system prompt if any
 * @param {string} message - The user message
 * @returns {Array} - Array of message objects
 */
function buildMessageList(systemPrompt, message) {
  const messages = [{ role: 'user', content: message }];
  if (config.model.toLowerCase().includes('cogito')) {
    messages.unshift({ role: 'system', content: 'Enable deep thinking subroutine.' });
  } else if (systemPrompt) {
    messages.unshift({ role: 'system', content: systemPrompt });
  }
  return messages;
}

/**
 * Sends the request to Ollama server.
 * @param {Object} payload - The request payload
 * @returns {Promise} - The response from the server
 */
async function sendRequest(payload) {
  try {
    const response = await axios.post(`${config.host}/api/chat`, payload, {
      timeout: 60000,
      responseType: 'text'
    });
    console.log('Received response from Ollama:', response.data);
    return response;
  } catch (err) {
    console.error('Ollama API request failed:', {
      message: err.message,
      code: err.code,
      responseData: err.response?.data
    });
    throw err;
  }
}

/**
 * Parses the NDJSON response into structured data.
 * @param {string} ndjsonData - The raw NDJSON response data
 * @returns {Object} - Parsed response with reply and thoughts
 */
function parseResponse(ndjsonData) {
  const lines = ndjsonData.split('\n').filter(Boolean);
  let reply = '';
  const thoughts = [];

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.message && obj.message.role === 'assistant' && obj.message.content) {
        reply += obj.message.content;
      }
    } catch (e) {
      console.warn('Failed to parse Ollama response line:', line, 'Error:', e.message);
    }
  }

  // Extract thoughts if any (adjust regex as needed)
  const thoughtsRegex = /<thought>([\s\S]*?)<\/thought>/gi;
  let thoughtMatch;
  while ((thoughtMatch = thoughtsRegex.exec(reply)) !== null) {
    thoughts.push(thoughtMatch[1].trim());
  }

  // Clean reply from thought tags
  const cleanedReply = reply
    .replace(/<thought>[\s\S]*?<\/thought>/g, '')
    .replace(/\s+/g, ' ')
    .trim() || '[No response from Ollama]';

  return { reply: cleanedReply, thoughts };
}

/**
 * Sends a chat message to the local Ollama server and returns the reply.
 * @param {string} message - The user's message
 * @param {string} [mode='general'] - Optional chat mode to influence prompt
 * @returns {Promise<Object>} - The AI's reply and thoughts if any
 */
export async function chatWithOllama(message, mode = 'general') {
  try {
    if (!message || typeof message !== 'string') {
      throw new Error('Invalid message: must be a non-empty string');
    }

    const systemPrompt = getSystemPrompt(mode);
    const messages = buildMessageList(systemPrompt, message);
    const payload = { model: config.model, messages };
    console.log('Sending payload to Ollama:', JSON.stringify(payload, null, 2));

    const response = await sendRequest(payload);
    return parseResponse(response.data);
  } catch (err) {
    console.error('Chat with Ollama failed:', err.message);
    throw new Error(`Failed to chat with Ollama: ${err.message}`);
  }
}
