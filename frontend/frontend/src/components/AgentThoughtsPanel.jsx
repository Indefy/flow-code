import React from 'react';
import '../styles/AgentThoughtsPanel.css';

const AgentThoughtsPanel = ({ thoughts }) => (
  thoughts.length > 0 ? (
    <aside className="agent-thoughts-panel" aria-label="Agent Thoughts Debug Panel">
      <div className="panel-title">Agent Thoughts (debug)</div>
      <ol className="thoughts-list">
        {thoughts.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
    </aside>
  ) : null
);

export default AgentThoughtsPanel;
