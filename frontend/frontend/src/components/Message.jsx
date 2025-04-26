import React, { useRef, useEffect } from 'react';
// If you use MUI, uncomment the following line:
import styled from '@emotion/styled';
import '../styles/Message.css';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

// MUI styled components
const StyledMessage = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
}));

const MESSAGE_TYPES = {
  USER: 'user',
  AI: 'ai',
};

const CodeBlock = ({ children, className }) => {
  const language = className ? className.replace('language-', '') : '';
  return (
    <code
      className={className || ''}
      style={{ fontFamily: 'Source Code Pro, monospace', padding: '0.2em', borderRadius: 3 }}
      aria-label={language ? `Code block in ${language}` : 'Code block'}
    >
      {children}
    </code>
  );
};

const AnchorLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

export default function Message({ role, text }) {
  const messageRef = useRef(null);
  const isAI = role === MESSAGE_TYPES.AI;

  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.setAttribute(
        'aria-label',
        isAI ? 'Assistant Message' : 'User Message'
      );
    }
  }, [role, isAI]);

  if (!text || typeof text !== 'string') return null;

  const markdownRenderer = () => (
    <ReactMarkdown
      rehypePlugins={[rehypeHighlight]}
      components={{
        code: CodeBlock,
        a: AnchorLink,
      }}
    >
      {text}
    </ReactMarkdown>
  );

  try {
    return (
      // Use StyledMessage if using MUI, otherwise just div
      <div
        ref={messageRef}
        className={`message ${role}`}
        // style={isAI ? { alignItems: 'flex-start' } : { alignItems: 'flex-end' }}
      >
        <span className={`bubble ${role}`}>
          <div className="markdown-body">{markdownRenderer()}</div>
        </span>
      </div>
    );
  } catch (err) {
    console.error('Markdown rendering error:', err);
    return (
      <div className="message fallback">
        <span className="bubble fallback" role="alert">
          Error: Could not render message.
        </span>
      </div>
    );
  }
}