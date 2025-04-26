import { getAllThoughts, createThought } from '../services/thoughtsService.js';
import { EventEmitter } from 'events';
let logger;
try {
  logger = await import('../utils/logger.js');
} catch {
  logger = console;
}


// --- Input Validation ---
const validateContent = (content) => {
  const decisionTree = [
    { condition: !content || typeof content !== 'string', error: 'Content is required' },
    { condition: content.length > 280, error: 'Message too long' },
    { condition: /profanity/i.test(content), error: 'Profane language detected' }
  ];
  for (const tree of decisionTree) {
    if (tree.condition) throw new Error(tree.error);
  }
  return true;
};

// --- Response Builder ---
const buildResponse = (status, data) => ({
  status,
  data,
  success: status === 200 || status === 201,
  timestamp: new Date().toISOString()
});

// --- Event-Driven Processing ---
class ThoughtsEmitter extends EventEmitter {
  constructor() {
    super();
    this.setupEventListeners();
  }
  setupEventListeners() {
    this.on('thoughts:created', (data) => {
      logger.info?.(`New thought created: ${JSON.stringify(data)}`);
    });
    this.on('error', (err) => {
      logger.error?.(err.message, err.stack);
    });
  }
}
const thoughtsEmitter = new ThoughtsEmitter();

// --- Controller: Get Thoughts ---
export const getThoughts = async (req, res, next) => {
  try {
    // Optional: require userId for filtering
    // if (!req.query.userId) throw new Error('User ID is required');
    const thoughts = await getAllThoughts();
    logger.info?.('Successfully fetched thoughts');
    res.status(200).json(buildResponse(200, thoughts));
  } catch (err) {
    logger.error?.(`Error fetching thoughts: ${err.message}`, err.stack);
    next(err);
  }
};

// --- Controller: Post Thought ---
export const postThought = async (req, res, next) => {
  try {
    validateContent(req.body.content);
    thoughtsEmitter.emit('thoughts:preCreate', req.body);
    const result = await createThought(req.body.sender, req.body.content);
    logger.info?.(`Successfully created thought for sender: ${req.body.sender}`);
    thoughtsEmitter.emit('thoughts:created', result);
    res.status(201).json(buildResponse(201, result));
  } catch (err) {
    logger.error?.(`Error creating thought: ${err.message}`, err.stack);
    next(err);
  }
};
