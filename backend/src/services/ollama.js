import axios from 'axios';
import {
  ThoughtManager,
  SelfReflectionEngine,
  ThoughtLearningSystem,
  EnhancedResponseGenerator,
  SelfReviewSystem
} from './thoughts.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import Sentiment from 'sentiment';

// Configuration
const config = {
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'cogito:latest' // Ensure this matches your Ollama server's model
};

// Memory management setup
const MEMORY_FILE = path.join(process.cwd(), 'data', 'ollama_conversations.json');
const MAX_MESSAGES_PER_CONVERSATION = 50;
const MAX_RECENT_MESSAGES = 10;
let conversations = [];

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.dirname(MEMORY_FILE);
  try {
    await fs.mkdir(dataDir, { recursive: true });
    console.log('Data directory ensured:', dataDir);
  } catch (e) {
    console.error('Failed to create data directory:', e.message);
  }
}

// Load conversation history
async function loadConversations() {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(MEMORY_FILE, 'utf8');
    conversations = JSON.parse(data);
    console.log('Loaded', conversations.length, 'conversations');
    conversations = conversations.map(conv => ({
      ...conv,
      messages: conv.messages.slice(-MAX_MESSAGES_PER_CONVERSATION)
    }));
  } catch (e) {
    console.warn('Failed to load conversations from', MEMORY_FILE, '- starting fresh:', e.message);
    if (e.code !== 'ENOENT') {
      const backupFile = `${MEMORY_FILE}.backup-${Date.now()}`;
      try {
        await fs.rename(MEMORY_FILE, backupFile);
        console.log('Backed up potentially corrupted file to:', backupFile);
      } catch (backupErr) {
        console.error('Failed to backup corrupted file:', backupErr.message);
      }
    }
    conversations = [];
  }
}

// Save conversation history
async function saveConversations() {
  try {
    await ensureDataDirectory();
    const trimmedConversations = conversations.map(conv => ({
      ...conv,
      messages: conv.messages.slice(-MAX_MESSAGES_PER_CONVERSATION)
    }));
    await fs.writeFile(MEMORY_FILE, JSON.stringify(trimmedConversations, null, 2), 'utf8');
    console.log('Conversations saved successfully');
  } catch (e) {
    console.error('Failed to save conversations to', MEMORY_FILE, ':', e.message);
    const backupFile = `${MEMORY_FILE}.backup-${Date.now()}`;
    try {
      await fs.writeFile(backupFile, JSON.stringify(conversations, null, 2), 'utf8');
      console.log('Backup saved to:', backupFile);
    } catch (backupErr) {
      console.error('Failed to save backup to', backupFile, ':', backupErr.message);
    }
  }
}

// Find or create a conversation
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

// Generate system prompt based on mode and thoughts/reflections
function getSystemPrompt(mode, sentiment, thoughts, reflections) {
  let prompt = '';
  switch (mode.toLowerCase()) {
    case 'creative':
      prompt = 'You are a creative and imaginative assistant. Respond with originality and flair.';
      break;
    case 'code':
      prompt = 'You are a helpful coding assistant. Generate and explain code clearly. Always format code snippets in markdown code blocks with the appropriate language specified (e.g., ```javascript).';
      break;
    default:
      prompt = 'You are a helpful assistant. Provide clear and concise answers.';
  }

  if (sentiment.emotion === 'negative') {
    prompt += ' The user seems frustrated or upset. Be extra empathetic and supportive.';
  } else if (sentiment.emotion === 'positive') {
    prompt += ' The user seems happy or positive. Match their enthusiasm.';
  }

  if (thoughts.length > 0 || reflections.length > 0) {
    prompt += '\n\n[AI Self-Examination]';
    if (thoughts.length > 0) {
      prompt += '\nThoughts:\n' + thoughts.map(t => `- ${t.content}`).join('\n');
    }
    if (reflections.length > 0) {
      prompt += '\nReflections:\n' + reflections.map(r => `- ${r.content}`).join('\n');
    }
  }

  return prompt;
}

// Sentiment analysis using the Sentiment library
function analyzeSentiment(text) {
  const sentimentAnalyzer = new Sentiment();
  const result = sentimentAnalyzer.analyze(text);
  return {
    polarity: result.score,
    emotion: result.score > 0 ? 'positive' : result.score < 0 ? 'negative' : 'neutral',
    confidence: Math.abs(result.score) / 5 // Normalize to 0-1 range
  };
}

// Summarize messages for context
function summarizeMessages(messages) {
  if (messages.length === 0) return 'No prior conversation context.';
  let summary = 'Summary of prior conversation: ';
  const userMessages = messages.filter(m => m.role === 'user');
  const aiMessages = messages.filter(m => m.role === 'assistant');
  if (userMessages.length > 0) {
    summary += `The user discussed topics like ${userMessages
      .map(m => m.content.substring(0, 20) + (m.content.length > 20 ? '...' : ''))
      .join(', ')}. `;
  }
  if (aiMessages.length > 0) {
    summary += `The assistant provided information on ${aiMessages
      .map(m => m.content.substring(0, 20) + (m.content.length > 20 ? '...' : ''))
      .join(', ')}.`;
  }
  return summary;
}

// Build message payload
async function buildMessagePayload(mode, userMessage, conversation, sentiment, thoughts, reflections, userPrefs = {}) {
  const systemPrompt = getSystemPrompt(mode, sentiment, thoughts, reflections);

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

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
 * Sends a user message to Ollama and yields the response as a stream.
 * @param {string} message - User message
 * @param {string} mode - Chat mode (general, creative, code)
 * @param {string|null} conversationId - ID of ongoing conversation
 * @param {Object} userPrefs - User preferences for response style
 * @param {boolean} stream - Whether to stream the response
 * @returns {AsyncGenerator} - Yields response chunks
 */
export async function* chatWithOllama(message, mode = 'general', conversationId = null, userPrefs = {}, stream = true) {
  if (conversations.length === 0) {
    await loadConversations();
  }

  const conversation = findOrCreateConversation(conversationId);
  const sentiment = analyzeSentiment(message);
  console.log('User sentiment:', sentiment);

  const thoughtManager = new ThoughtManager();
  const selfReflectionEngine = new SelfReflectionEngine({ reflectionFrequency: 2, maxReflections: 3 });
  const thoughtLearningSystem = new ThoughtLearningSystem();
  const selfReviewSystem = new SelfReviewSystem(2);

  const aiContext = { lastMessage: message, history: conversation.messages };
  const thoughts = await thoughtManager.generateThoughts(aiContext);
  const reflections = await selfReflectionEngine.reflectOnConversations([
    { messages: conversation.messages, context: aiContext }
  ]);

  for (const thought of thoughts) {
    await thoughtLearningSystem.learnFromThought(thought);
    await selfReviewSystem.reviewThought(thought);
  }

  const messages = await buildMessagePayload(mode, message, conversation, sentiment, thoughts, reflections, userPrefs);

  conversation.messages.push({ role: 'user', content: message });
  conversation.sentimentHistory.push(sentiment);

  try {
    const payload = {
      model: config.model,
      messages,
      stream: stream,
      temperature: mode === 'creative' ? 0.9 : mode === 'code' ? 0.2 : 0.7
    };

    const response = await axios.post(`${config.host}/api/chat`, payload, {
      responseType: stream ? 'stream' : 'json'
    });

    if (stream) {
      let aiText = '';
      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj.message && obj.message.role === 'assistant' && obj.message.content) {
              aiText += obj.message.content;
              yield {
                content: obj.message.content,
                thoughts: thoughts.map(t => t.content),
                conversationId: conversation.id
              };
            }
            if (obj.done) {
              conversation.messages.push({ role: 'assistant', content: aiText });
              await saveConversations();
              yield { content: '[DONE]', thoughts: [], conversationId: conversation.id, sentiment };
              break;
            }
          } catch (e) {
            console.warn('Failed to parse Ollama stream chunk:', line);
          }
        }
      }
    } else {
      const reply = response.data.message?.content || '';
      conversation.messages.push({ role: 'assistant', content: reply });
      await saveConversations();
      yield {
        content: reply,
        thoughts: thoughts.map(t => t.content),
        conversationId: conversation.id,
        sentiment
      };
    }
  } catch (err) {
    console.error('Failed to chat with Ollama:', err.message);
    yield { error: `Failed to chat with Ollama: ${err.message}` };
  }
}