import { getDB } from '../db/database.js';

/**
 * @typedef {Object} Thought
 * @property {number} id
 * @property {string} sender
 * @property {string} content
 * @property {string} timestamp - ISO string
 */

/**
 * Fetch all thoughts, optionally filtered by userId.
 * @param {string} [userId] - Optional user ID to filter thoughts
 * @returns {Promise<Thought[]>} Array of Thought objects if successful
 */
export async function getAllThoughts(userId) {
  try {
    const db = await getDB();
    if (userId) {
      return db.all('SELECT * FROM conversations WHERE sender = ? ORDER BY timestamp DESC', [userId]);
    }
    return db.all('SELECT * FROM conversations ORDER BY timestamp DESC');
  } catch (error) {
    console.error('Error fetching thoughts:', error);
    throw error;
  }
}

/**
 * Create a new thought in the database.
 * @param {string} sender - User who sent the thought
 * @param {string} content - Content of the thought
 * @returns {Promise<Thought>} Created Thought object with generated id
 */
export async function createThought(sender, content) {
  try {
    const db = await getDB();
    const timestamp = Date.now();
    const result = await db.run(
      'INSERT INTO conversations (sender, content, timestamp) VALUES (?, ?, ?)',
      [sender, content, timestamp]
    );
    return {
      id: result.lastID,
      sender,
      content,
      timestamp: new Date(timestamp).toISOString()
    };
  } catch (error) {
    console.error('Error creating thought:', error);
    throw error;
  }
}

