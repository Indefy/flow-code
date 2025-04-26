import React, { useState, useRef } from 'react';
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
  const [mode, setMode] = useState('general'); // State for mode
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
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    setLoading(true);
    let aiText = '';
    let newThoughts = [];
    try {
      const currentSession = sessions.find(s => s.id === activeSession);
      const res = await fetch('http://localhost:3001/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          agent: activeAgent,
          mode: mode,
          conversationId: currentSession ? currentSession.conversationId : null,
          userPrefs: { responseStyle: 'detailed' }
        })
      });
      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      let done = false;
      let buffer = '';
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          buffer += new TextDecoder().decode(value);
          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            if (chunk.startsWith('data: ')) {
              const payload = chunk.slice(6);
              try {
                const data = JSON.parse(payload);
                if (data.error) {
                  setMessages(msgs => [...msgs, { role: 'ai', text: 'Error: ' + data.error }]);
                  break;
                }
                if (data.content && data.content !== '[DONE]') {
                  aiText += data.content;
                  setMessages(msgs => {
                    // Replace last AI message or add new
                    const last = msgs[msgs.length - 1];
                    if (last && last.role === 'ai') {
                      return [...msgs.slice(0, -1), { ...last, text: aiText }];
                    }
                    return [...msgs, { role: 'ai', text: aiText }];
                  });
                }
                if (data.thoughts && data.thoughts.length) {
                  newThoughts = [...newThoughts, ...data.thoughts];
                  setThoughts(prev => [...prev, ...data.thoughts]);
                }
                if (data.content === '[DONE]') {
                  // Save session and conversationId
                  setSessions(sessions => sessions.map(s => s.id === activeSession ? { ...s, messages: [...messages, { role: 'user', text: input }, { role: 'ai', text: aiText }], conversationId: data.conversationId } : s));
                  break;
                }
              } catch {}
            }
          }
        }
      }
    } catch (err) {
      setMessages(msgs => [...msgs, { role: 'ai', text: 'Error: Could not reach backend.' }]);
    }
    setInput('');
    setLoading(false);
  };


  // Ref for scrolling to bottom of messages
  const messagesEndRef = useRef(null);

  // Desktop-style top menu bar (mockup)
  const handleMenuClick = () => setShowMenu(m => !m);
  const handleMenuClose = () => setShowMenu(false);
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
      fontFamily: 'sans-serif',
      overflow: 'hidden'
    }}>
      <Sidebar
        activeMode={mode}
        onModeSwitch={setMode}
        sessions={sessions}
        activeSession={activeSession}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        agents={agents}
        activeAgent={activeAgent}
        onAgentSwitch={handleAgentSwitch}
      />
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        minWidth: 0,
        padding: 0,
        margin: 0
      }}>
        <div style={{
          background: '#222',
          borderRadius: 0,
          boxShadow: 'none',
          padding: '32px 32px 16px 32px',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0
        }}>
          <h2 style={{ color: '#fff', marginBottom: 16 }}>Local AI Agent Chat</h2>
          <div style={{
            flex: 1,
            background: '#18191c',
            borderRadius: 8,
            padding: 16,
            overflowY: 'auto',
            marginBottom: 16,
            color: '#fff',
            minHeight: 0,
            maxHeight: 'calc(100vh - 180px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            {messages.map((msg, idx) => (
              <Message key={idx} role={msg.role} text={msg.text} />
            ))}
            {loading && <div><i>AI is typing...</i></div>}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 6,
                border: 'none',
                outline: 'none',
                background: '#2a2b2e',
                color: '#fff'
              }}
              placeholder="Type your message..."
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: '#3a8bfd',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '0 20px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Send
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default App;
