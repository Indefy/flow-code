import React, { useState } from 'react';
import './styles/index.css';
import AgentThoughtsPanel from './components/AgentThoughtsPanel';
import Message from './components/Message';
import Sidebar from './components/Sidebar';

const DEFAULT_AGENTS = ['cogito', 'deepseek-r1:8b'];

function App() {
  // --- Desktop app state ---
  const [sessions, setSessions] = useState([
    { id: 'default', name: 'Main', messages: [], conversationId: null }
  ]);
  const [activeSession, setActiveSession] = useState('default');
  const [agents] = useState(DEFAULT_AGENTS);
  const [activeAgent, setActiveAgent] = useState(DEFAULT_AGENTS[0]);
  const [showMenu, setShowMenu] = useState(false);

  // --- Chat state ---
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [thoughts, setThoughts] = useState([]); // Agent's internal thoughts

  // --- Sidebar/menu handlers ---
  const handleSessionSelect = (id) => {
    setActiveSession(id);
    const session = sessions.find(s => s.id === id);
    setMessages(session ? session.messages : []);
    setThoughts([]);
  };
  const handleNewSession = () => {
    const id = `session-${Date.now()}`;
    const name = `Session ${sessions.length + 1}`;
    const newSession = { id, name, messages: [], conversationId: null };
    setSessions([...sessions, newSession]);
    setActiveSession(id);
    setMessages([]);
    setThoughts([]);
  };
  const handleAgentSwitch = (agent) => {
    setActiveAgent(agent);
    setMessages([]);
    setThoughts([]);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages([...messages, { role: 'user', text: input }]);
    setLoading(true);
    try {
      const currentSession = sessions.find(s => s.id === activeSession);
      const res = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input, 
          agent: activeAgent,
          mode: 'general',
          conversationId: currentSession ? currentSession.conversationId : null,
          userPrefs: { responseStyle: 'detailed' }
        })
      });
      const data = await res.json();
      setMessages((msgs) => {
        const updated = [...msgs, { role: 'ai', text: data.reply }];
        // Save to session along with conversationId
        setSessions(sessions => sessions.map(s => s.id === activeSession ? { ...s, messages: updated, conversationId: data.conversationId } : s));
        return updated;
      });
      if (data.thoughts && data.thoughts.length) {
        setThoughts((prev) => [...prev, ...data.thoughts]);
      }
    } catch (err) {
      setMessages((msgs) => [...msgs, { role: 'ai', text: 'Error: Could not reach backend.' }]);
    }
    setInput('');
    setLoading(false);
  };

  // Desktop-style top menu bar (mockup)
  const handleMenuClick = () => setShowMenu(m => !m);
  const handleMenuClose = () => setShowMenu(false);

  return (
    <div className="app-root">
      <Sidebar
        sessions={sessions}
        activeSession={activeSession}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        agents={agents}
        activeAgent={activeAgent}
        onAgentSwitch={handleAgentSwitch}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', height: '100vh', overflow: 'hidden' }}>
        {/* Desktop-style top menu bar as window header */}
        <div className="window-header">
          <span className="window-title">AI Agent Desktop</span>
          <button
            className="window-menu-btn"
            onClick={handleMenuClick}
            title="Menu"
          >☰</button>
          {showMenu && (
            <div
              className="window-menu-popup"
              onMouseLeave={handleMenuClose}
            >
              <div className="window-menu-item" onClick={handleMenuClose}>Settings (coming soon)</div>
              <div className="window-menu-item" onClick={handleMenuClose}>About</div>
              <div className="window-menu-item window-menu-close" onClick={handleMenuClose}>Close</div>
            </div>
          )}
        </div>
        {/* Chat container visually unified with header */}
        <div className="window-content">
          <div className="messages">
            {messages.map((msg, idx) => (
              <Message key={idx} role={msg.role} text={msg.text} />
            ))}
            {loading && (
              <div className="message ai">
                <span className="bubble ai">
                  <span className="ai-typing-indicator" aria-live="polite" aria-label="AI is typing">
                    <span className="dot dot1"></span>
                    <span className="dot dot2"></span>
                    <span className="dot dot3"></span>
                  </span>
                </span>
              </div>
            )}
          </div>
          <form className="input-bar" onSubmit={sendMessage} autoComplete="off">
            <textarea
              className="input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={loading}
              aria-label="Chat input field"
              role="textbox"
              rows={1}
              style={{ resize: 'vertical', minHeight: 38, maxHeight: 160 }}
            />
            <button className="send-btn" type="submit" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
        <AgentThoughtsPanel thoughts={thoughts} />
      </div>
    </div>
  );
}

export default App;
