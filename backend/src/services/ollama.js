import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Move configuration to a separate object for better management
const config = {
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'cogito'
};

// Add memory management system using file storage
const MEMORY_FILE = path.join(process.cwd(), 'data', 'ollama_conversations.json');
const MAX_MESSAGES_PER_CONVERSATION = 50; // Limit to prevent overly long histories
const MAX_RECENT_MESSAGES = 10; // Number of recent messages to include in full for context
let conversations = [];

// Ensure data directory exists
function ensureDataDirectory() {
  const dataDir = path.dirname(MEMORY_FILE);
  if (!fs.existsSync(dataDir)) {
    console.log('Creating data directory:', dataDir);
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Data directory created successfully');
  } else {
    console.log('Data directory already exists:', dataDir);
  }
}

/**
 * Loads conversation history from a file.
 */
function loadConversations() {
  try {
    ensureDataDirectory();
    if (fs.existsSync(MEMORY_FILE)) {
      console.log('Loading conversation history from:', MEMORY_FILE);
      const data = fs.readFileSync(MEMORY_FILE, 'utf8');
      conversations = JSON.parse(data);
      console.log('Loaded', conversations.length, 'conversations');
      // Trim conversations to max messages if needed
      conversations = conversations.map(conv => ({
        ...conv,
        messages: conv.messages.slice(-MAX_MESSAGES_PER_CONVERSATION)
      }));
    } else {
      console.log('No conversation history file found at:', MEMORY_FILE, '- starting fresh');
      conversations = [];
    }
  } catch (e) {
    console.warn('Failed to load previous conversations from', MEMORY_FILE, '- starting fresh:', e.message);
    // Backup corrupted file if it exists
    if (fs.existsSync(MEMORY_FILE)) {
      const backupFile = `${MEMORY_FILE}.backup-${Date.now()}`;
      fs.renameSync(MEMORY_FILE, backupFile);
      console.log('Backed up potentially corrupted file to:', backupFile);
    }
    conversations = [];
  }
}

/**
 * Saves conversation history to a file.
 */
function saveConversations() {
  try {
    ensureDataDirectory();
    // Trim messages before saving
    const trimmedConversations = conversations.map(conv => ({
      ...conv,
      messages: conv.messages.slice(-MAX_MESSAGES_PER_CONVERSATION)
    }));
    console.log('Saving', trimmedConversations.length, 'conversations to:', MEMORY_FILE);
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(trimmedConversations, null, 2), 'utf8');
    console.log('Conversations saved successfully');
  } catch (e) {
    console.error('Failed to save conversations to file', MEMORY_FILE, ':', e.message);
    // Attempt to save a backup if write fails
    const backupFile = `${MEMORY_FILE}.backup-${Date.now()}`;
    try {
      fs.writeFileSync(backupFile, JSON.stringify(conversations, null, 2), 'utf8');
      console.log('Backup saved to:', backupFile);
    } catch (backupErr) {
      console.error('Failed to save backup to', backupFile, ':', backupErr.message);
    }
  }
}

/**
 * Finds or creates a conversation by ID.
 * @param {string|null} conversationId - The ID of the conversation to find, or null to create a new one
 * @returns {Object} - Conversation object with ID and messages
 */
function findOrCreateConversation(conversationId) {
  if (conversationId) {
    const existingConv = conversations.find(conv => conv.id === conversationId);
    if (existingConv) {
      console.log('Found existing conversation with ID:', conversationId);
      return existingConv;
    }
  }
  const newId = uuidv4();
  const newConv = { id: newId, messages: [], sentimentHistory: [] };
  conversations.push(newConv);
  console.log('Created new conversation with ID:', newId);
  return newConv;
}

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
      return 'You are a helpful coding assistant. Generate and explain code clearly. Always format code snippets in markdown code blocks with the appropriate language specified for syntax highlighting (e.g., ```javascript for JavaScript, ```python for Python).';
    default:
      return '';
  }
}

/**
 * Analyzes the sentiment of a given text.
 * @param {string} text - The text to analyze
 * @returns {Object} - Sentiment analysis result with polarity and emotion
 */
function analyzeSentiment(text) {
  // Basic sentiment analysis using keyword matching (could be enhanced with NLP libraries)
  const positiveKeywords = ['great', 'good', 'awesome', 'happy', 'excellent', 'wonderful', 'love', 'fantastic'];
  const negativeKeywords = ['bad', 'terrible', 'awful', 'sad', 'horrible', 'hate', 'disappointing', 'poor'];
  const textLower = text.toLowerCase();
  let polarity = 0;
  let emotion = 'neutral';

  positiveKeywords.forEach(word => {
    if (textLower.includes(word)) polarity += 0.2;
  });
  negativeKeywords.forEach(word => {
    if (textLower.includes(word)) polarity -= 0.2;
  });

  if (polarity > 0.3) emotion = 'positive';
  else if (polarity < -0.3) emotion = 'negative';

  return { polarity, emotion };
}

/**
 * Summarizes a list of messages into a concise text.
 * @param {Array} messages - Array of message objects to summarize
 * @returns {string} - A summarized string of the conversation
 */
function summarizeMessages(messages) {
  if (messages.length === 0) return 'No prior conversation context.';
  
  let summary = 'Summary of prior conversation: ';
  const userMessages = messages.filter(m => m.role === 'user');
  const aiMessages = messages.filter(m => m.role === 'assistant');
  
  if (userMessages.length > 0) {
    summary += `The user discussed topics like ${userMessages.map(m => m.content.substring(0, 20) + (m.content.length > 20 ? '...' : '')).join(', ')}. `;
  }
  if (aiMessages.length > 0) {
    summary += `The assistant provided information on ${aiMessages.map(m => m.content.substring(0, 20) + (m.content.length > 20 ? '...' : '')).join(', ')}.`;
  }
  
  return summary;
}

/**
 * Builds the message payload for Ollama, including system prompt and conversation history.
 * @param {string} mode - Chat mode
 * @param {string} userMessage - Current user message
 * @param {Object} conversation - Conversation object with messages
 * @param {Object} userPrefs - User preferences
 * @returns {Array} - Array of message objects for Ollama
 */
function buildMessagePayload(mode, userMessage, conversation, userPrefs = {}) {
  let systemPrompt = getSystemPrompt(mode);
  if (userPrefs.responseStyle) {
    systemPrompt += ` Respond in a ${userPrefs.responseStyle} style.`;
  }
  
  const sentiment = analyzeSentiment(userMessage);
  if (sentiment.emotion === 'negative') {
    systemPrompt += ' The user seems frustrated or upset. Be extra empathetic and supportive.';
  } else if (sentiment.emotion === 'positive') {
    systemPrompt += ' The user seems happy or positive. Match their enthusiasm.';
  }
  
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  // Summarize older messages if conversation is long
  if (conversation.messages.length > MAX_RECENT_MESSAGES) {
    const olderMessages = conversation.messages.slice(0, conversation.messages.length - MAX_RECENT_MESSAGES);
    const recentMessages = conversation.messages.slice(-MAX_RECENT_MESSAGES);
    const summary = summarizeMessages(olderMessages);
    messages.push({ role: 'system', content: `Conversation history summary: ${summary}` });
    messages.push(...recentMessages);
  } else {
    messages.push(...conversation.messages);
  }
  
  messages.push({ role: 'user', content: userMessage });
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
    // Parse the response as JSON before returning
    const parsed = JSON.parse(response.data);
    console.log('Received response from Ollama:', parsed);
    return { data: parsed };
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
// --- Advanced Pattern Recognition ---
class PatternRecognizer {
  constructor() {
    this.patterns = {};
    this.loadPatterns();
  }
  loadPatterns() {
    // Load patterns from config or DB (stub)
    this.patterns = {};
  }
  analyzeText(text, context) {
    const patterns = this.patterns[text?.toLowerCase?.()] || [];
    if (patterns && patterns.length > 0) {
      return this.rankAndSelectBestPattern(patterns, context);
    }
    return null;
  }
  rankAndSelectBestPattern(patterns, context) {
    // Implement ranking algorithm here
    return patterns[0]; // Simplified
  }
}

// --- Enhanced Contextual Understanding ---
class ContextAnalyzer {
  constructor() {
    this.contextHistory = [];
    this.maxContextDepth = 5;
  }
  analyzeContext(response, conversationState) {
    const analysisResult = {
      topic: extractTopic(response),
      intent: this.determineIntent(response, conversationState),
      emotionalTone: analyzeEmotionalTone(response)
    };
    this.contextHistory.push({
      timestamp: new Date().toISOString(),
      data: analysisResult,
      state: conversationState
    });
    return analysisResult;
  }
  determineIntent(message, conversationState) {
    // Implement intent determination logic here
    return null;
  }
}

// --- Improved Sentiment Analysis ---
class SentimentAnalyzer {
  constructor() {
    this.sentimentModel = { analyzeText: analyzeSentiment };
  }
  analyzeSentiment(text) {
    const sentimentScore = this.sentimentModel.analyzeText(text);
    return {
      score: sentimentScore,
      emotions: this.extractEmotionsFromSentiment(sentimentScore),
      confidence: this.calculateConfidence(sentimentScore)
    };
  }
  extractEmotionsFromSentiment(sentimentScore) {
    // Map sentiment scores to emotions (stub)
    return null;
  }
  calculateConfidence(sentimentScore) {
    return 1.0; // Stub
  }
}

// --- Utility Stubs ---
function extractTopic(response) {
  // Extract topic from response (stub)
  return null;
}
function analyzeEmotionalTone(response) {
  // Analyze emotional tone (stub)
  return null;
}
function enhanceWithContext(content, context, pattern) {
  // Optionally enhance response based on context/pattern (stub)
  return content;
}
function getRelevantContext(contextStack) {
  // Return the last N context entries
  return contextStack.slice(-5);
}

// --- Main Enhanced Parsing Function ---
function parseResponse(ndjsonData) {
  const lines = ndjsonData.split('\n').filter(Boolean);
  let reply = '';
  const thoughts = [];

  // Initialize pattern recognizer and context analyzer
  const patternRecognizer = new PatternRecognizer();
  const contextAnalyzer = new ContextAnalyzer();
  const sentimentAnalyzer = new SentimentAnalyzer();

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.message && obj.message.role === 'assistant') {
        // Analyze and process message with enhanced capabilities
        const analysisResult = contextAnalyzer.analyzeContext(obj, reply);
        reply += enhanceWithContext(
          obj.message.content,
          analysisResult.context,
          patternRecognizer.analyzeText(obj.message.content, analysisResult.context)
        );
      }
    } catch (e) {
      console.warn('Failed to parse response line:', line, 'Error:', e.message);
    }
  }

  // Enhanced thought processing with contextual awareness
  const enhancedThoughts = thoughts.map(thought => {
    return sentimentAnalyzer.analyzeSentiment(thought).emotions;
  });

  // Clean reply from thought tags and enhance readability
  const cleanedReply = reply
    .replace(/<thought>[\s\S]*?<\/thought>/g, '')
    .replace(/\s+/g, ' ')
    .trim() || '[No response from Ollama]';

  return { 
    reply: cleanedReply,
    thoughts: enhancedThoughts
  };
}


/**
 * Sends a user message to Ollama and returns the response.
 * @param {string} message - User message
 * @param {string} mode - Chat mode (general, creative, code)
 * @param {string|null} conversationId - ID of ongoing conversation
 * @param {Object} userPrefs - User preferences for response style
 * @returns {Promise<Object>} - Response object with reply and thoughts
 */
export async function chatWithOllama(message, mode = 'general', conversationId = null, userPrefs = {}) {
  console.log('Sending message to Ollama with mode:', mode, 'conversationId:', conversationId);

  // Find or create conversation
  const conversation = findOrCreateConversation(conversationId);
  
  // Analyze sentiment
  const sentiment = analyzeSentiment(message);
  console.log('User sentiment:', sentiment);
  
  // Build message payload with history
  const messages = buildMessagePayload(mode, message, conversation, userPrefs);

  // Send to Ollama
  try {
    const payload = {
      model: config.model,
      messages,
      stream: false,
      temperature: mode === 'creative' ? 0.9 : mode === 'code' ? 0.2 : 0.7,
    };
    console.log('Sending request to Ollama at', config.host);
    const res = await sendRequest(payload);
  
    console.log('Received response from Ollama');
    // Add user message and assistant reply to conversation history
    conversation.messages.push({ role: 'user', content: message });
    if (res.data && res.data.message && res.data.message.content) {
      conversation.messages.push({ role: 'assistant', content: res.data.message.content });
    }
    // Only return the message content (markdown string) for correct frontend rendering
    const reply = res.data.message?.content || '';
    return {
      reply,
      thoughts: [],
      conversationId: conversation.id,
      sentiment
    };
  } catch (err) {
    console.error('Failed to chat with Ollama:', err.message);
    throw new Error(`Failed to chat with Ollama: ${err.message}`);
  }
}
