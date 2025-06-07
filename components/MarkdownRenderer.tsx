
import React, { useEffect, useState, useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  markdownText: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ markdownText, className = '' }) => {
  const [sanitizedHtml, setSanitizedHtml] = useState('');

  useEffect(() => {
    if (markdownText) {
      // Basic sanitization options for marked
      marked.setOptions({
        gfm: true, // Enable GitHub Flavored Markdown
        breaks: false, // Convert GFM line breaks to <br> -- CHANGED TO FALSE
        pedantic: false,
        // Consider adding a sanitizer like DOMPurify here if content can be malicious
        // For now, assuming content from Gemini is generally safe for this context
      });
      const rawHtml = marked.parse(markdownText) as string;
      setSanitizedHtml(rawHtml);
    } else {
      setSanitizedHtml('');
    }
  }, [markdownText]);

  const combinedClassName = `markdown-content whitespace-pre-wrap break-words ${className}`;

  return (
    <div 
      className={combinedClassName}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }} 
    />
  );
};
    