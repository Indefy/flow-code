import React from 'react';
import '../styles/Message.css';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

const Message = ({ role, text }) => {
  if (!text) return null;
  if (role === 'ai') {
    try {
      return (
        <div className={`message ${role}`}>
          <span className={`bubble ${role}`}>
            <div className="markdown-body">
              <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{text}</ReactMarkdown>
            </div>
          </span>
        </div>
      );
    } catch (err) {
      // Fallback to plain text if markdown fails
      return (
        <div className={`message ${role}`}>
          <span className={`bubble ${role}`}>{text}</span>
        </div>
      );
    }
  }
  // User message (plain text)
  return (
    <div className={`message ${role}`}>
      <span className={`bubble ${role}`}>{text}</span>
    </div>
  );
};

export default Message;
