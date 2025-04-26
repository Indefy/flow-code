/**
 * Configuration for Ollama service
 */
const config = {
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'cogito'
};

export default config;
