// Utility to log agent events to the backend
export async function logAgentEvent(type, content, meta = {}) {
  try {
    await fetch('http://localhost:3001/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content, meta }),
    });
  } catch (e) {
    console.error('Failed to log agent event:', e.message);
    // Silent fail for production, but log for debugging
    if (process.env.NODE_ENV === 'development') {
      console.debug('Error details:', {
        type,
        errorName: e.name,
        stack: e.stack
      });
    }
    // Implement retry mechanism if needed in the future
    return { success: false, error: e.message };
  }
}
