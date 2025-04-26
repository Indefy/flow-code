import React from 'react';
import PropTypes from 'prop-types';
import '../styles/Sidebar.css';

// Render session list with keyboard navigation and ARIA
function renderSessionsList(sessions, activeSession, onSessionSelect) {
  if (!Array.isArray(sessions)) return null;
  return (
    <ul className="sidebar__session-list" role="listbox" aria-label="Chat sessions">
      {sessions.map((s, idx) => (
        <li
          key={s.id}
          className={`sidebar__session-item${s.id === activeSession ? ' sidebar__session-item--active' : ''}`}
          onClick={() => onSessionSelect(s.id)}
          tabIndex={0}
          aria-selected={s.id === activeSession}
          role="option"
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') onSessionSelect(s.id);
          }}
        >
          {s.name || `Session ${idx + 1}`}
        </li>
      ))}
    </ul>
  );
}

// Render agent dropdown
function renderAgentDropdown(agents, activeAgent, onAgentSwitch) {
  if (!Array.isArray(agents)) return null;
  return (
    <div className="sidebar__section">
      <div className="sidebar__label">Agent</div>
      <select
        className="sidebar__agent-select"
        value={activeAgent}
        onChange={e => onAgentSwitch(e.target.value)}
        aria-label="Select agent for active session"
      >
        {agents.map(agent => (
          <option value={agent} key={agent}>{agent}</option>
        ))}
      </select>
    </div>
  );
}

// Render mode dropdown
function renderModeDropdown(modes, activeMode, onModeSwitch) {
  if (!Array.isArray(modes)) return null;
  return (
    <div className="sidebar__section">
      <div className="sidebar__label">Chat Mode</div>
      <select
        className="sidebar__agent-select" // Reuse the same styling
        value={activeMode}
        onChange={e => onModeSwitch(e.target.value)}
        aria-label="Select chat mode"
      >
        {modes.map(mode => (
          <option value={mode} key={mode}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</option>
        ))}
      </select>
    </div>
  );
}

const Sidebar = ({
  sessions = [],
  activeSession = '',
  onSessionSelect = () => {},
  onNewSession = () => {},
  agents = [],
  activeAgent = '',
  onAgentSwitch = () => {},
  modes = ['general', 'creative', 'code'], // New prop for modes
  activeMode = 'general', // New prop for active mode
  onModeSwitch = () => {} // New prop for mode switch handler
}) => (
  <nav className="sidebar" aria-label="Chat Sessions Sidebar">
    <div className="sidebar__header">
      <span>Chats</span>
      <button
        className="sidebar__btn"
        onClick={onNewSession}
        title="New Chat"
        aria-label="Create new chat session"
        role="button"
      >+
      </button>
    </div>
    {renderSessionsList(sessions, activeSession, onSessionSelect)}
    {renderAgentDropdown(agents, activeAgent, onAgentSwitch)}
    {renderModeDropdown(modes, activeMode, onModeSwitch)} {/* Add mode dropdown */}
  </nav>
);

Sidebar.propTypes = {
  sessions: PropTypes.arrayOf(PropTypes.object),
  activeSession: PropTypes.string,
  onSessionSelect: PropTypes.func,
  onNewSession: PropTypes.func,
  agents: PropTypes.arrayOf(PropTypes.string),
  activeAgent: PropTypes.string,
  onAgentSwitch: PropTypes.func,
  modes: PropTypes.arrayOf(PropTypes.string), // New prop type
  activeMode: PropTypes.string, // New prop type
  onModeSwitch: PropTypes.func // New prop type
};

export default Sidebar;