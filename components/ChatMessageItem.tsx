import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { UserIcon, DocumentTextIcon } from './icons';

// Pause duration ranges (in milliseconds) - REVERTED TO PREVIOUS (FASTER) VALUES
const PAUSE_SENTENCE_END_MIN_MS = 300;
const PAUSE_SENTENCE_END_MAX_MS = 500;
const PAUSE_COMMA_MIN_MS = 200;
const PAUSE_COMMA_MAX_MS = 300;
const PAUSE_DEFAULT_MIN_MS = 50;
const PAUSE_DEFAULT_MAX_MS = 120;

// Helper to get a random duration within a range
const getRandomDelay = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

// Helper to determine delay based on the word
const getDelayForWord = (word: string): number => {
  if (!word) return getRandomDelay(PAUSE_DEFAULT_MIN_MS, PAUSE_DEFAULT_MAX_MS);
  if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) {
    return getRandomDelay(PAUSE_SENTENCE_END_MIN_MS, PAUSE_SENTENCE_END_MAX_MS);
  }
  if (word.endsWith(',')) {
    return getRandomDelay(PAUSE_COMMA_MIN_MS, PAUSE_COMMA_MAX_MS);
  }
  return getRandomDelay(PAUSE_DEFAULT_MIN_MS, PAUSE_DEFAULT_MAX_MS);
};

export const ChatMessageItem: React.FC<{ message: ChatMessage }> = React.memo(({ message }) => {
  const isUser = message.sender === 'user';

  const [displayedText, setDisplayedText] = useState<string>(() => {
    if (isUser || !message.isStreaming) {
      // If user message, or if model message is NOT streaming (i.e., it's complete)
      return message.text;
    }
    // Model message is streaming
    return message.text ? message.text + '▌' : '▌'; // Start with current text and cursor, or just cursor if empty
  });
  
  const timeoutIdRef = useRef<number | null>(null);
  const wordIndexRef = useRef<number>(0); 
  const currentTargetTextForAnimationRef = useRef<string>(message.text); // Stores the full message.text for the current animation cycle


  useEffect(() => {
    // Always clear previous animation timers on new message or state change
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    timeoutIdRef.current = null;

    if (isUser || !message.isStreaming) {
      // For user messages or non-streaming (complete) model messages, display text directly
      setDisplayedText(message.text);
      wordIndexRef.current = message.text.split(' ').filter(Boolean).length; // Update word count to full
      currentTargetTextForAnimationRef.current = message.text;
      return; // No animation needed
    }

    // --- Logic for streaming model messages ---
    const newWordsForStream = message.text.split(' ').filter(w => w.length > 0);
    // Use currentTargetTextForAnimationRef to get the text basis of the previous animation step
    const prevWordsForStream = currentTargetTextForAnimationRef.current.split(' ').filter(w => w.length > 0);

    let commonPrefixCount = 0;
    while(
      commonPrefixCount < newWordsForStream.length &&
      commonPrefixCount < prevWordsForStream.length &&
      newWordsForStream[commonPrefixCount] === prevWordsForStream[commonPrefixCount]
    ) {
      commonPrefixCount++;
    }
    
    // If the new text is not just an append, or if animation was ahead of new text
    // (e.g., text got shorter or changed in middle), reset wordIndex to common point
    if (wordIndexRef.current > newWordsForStream.length || wordIndexRef.current > commonPrefixCount) {
       wordIndexRef.current = commonPrefixCount;
    }
    
    // Update the text that the animation is targeting for this cycle
    currentTargetTextForAnimationRef.current = message.text;

    const typeNextWord = () => {
      if (wordIndexRef.current < newWordsForStream.length) {
        const currentWordToAnimate = newWordsForStream[wordIndexRef.current];
        wordIndexRef.current++;
        
        const wordsToShowArray = newWordsForStream.slice(0, wordIndexRef.current);
        const textSegment = wordsToShowArray.join(' ');
        
        setDisplayedText(textSegment + (textSegment ? ' ' : '') + '▌');

        const delay = getDelayForWord(currentWordToAnimate);
        timeoutIdRef.current = setTimeout(typeNextWord, delay);
      } else {
        // All words of the current text chunk (currentTargetTextForAnimationRef.current) are displayed
        // If still streaming (message.isStreaming might be true if more chunks are expected), keep cursor.
        // Otherwise, remove it.
        setDisplayedText(currentTargetTextForAnimationRef.current + (message.isStreaming ? (currentTargetTextForAnimationRef.current ? ' ' : '') + '▌' : ''));
      }
    };
    
    // Set initial display for the current streaming chunk based on where wordIndexRef is
    const initialWordsToDisplayArray = newWordsForStream.slice(0, wordIndexRef.current);
    const initialTextSegment = initialWordsToDisplayArray.join(' ');

    setDisplayedText(
        initialTextSegment +
        // Add a space if there's initial text AND more words are coming in this chunk
        (initialTextSegment && wordIndexRef.current < newWordsForStream.length ? ' ' : '') + 
        // Add cursor if there are more words to animate in this chunk OR if the message is generally still streaming
        (wordIndexRef.current < newWordsForStream.length || message.isStreaming ? '▌' : '')
    );

    if (wordIndexRef.current < newWordsForStream.length) {
      // If there are words in the current newWordsForStream yet to be typed
      const delay = getDelayForWord(newWordsForStream[wordIndexRef.current] || ''); // Default delay if somehow undefined
      timeoutIdRef.current = setTimeout(typeNextWord, delay);
    } else if (!message.isStreaming) { 
        // All words typed for this chunk, AND message is no longer streaming (it was the last chunk)
        // Ensure cursor is removed.
        setDisplayedText(currentTargetTextForAnimationRef.current);
    }
    // If wordIndexRef.current >= newWordsForStream.length AND message.isStreaming is still true,
    // it means this chunk is fully typed, but more chunks might arrive. Cursor is handled by typeNextWord's else or initial setDisplayedText.

    return () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    };
  }, [message.text, message.isStreaming, isUser]);


  const shouldDisplaySources = () => {
    // For model messages, use currentTargetTextForAnimationRef as it reflects the full intended text.
    // For user messages, directly use message.text.
    const textToSearch = isUser ? message.text : currentTargetTextForAnimationRef.current;
    if (message.sender === 'model' && message.groundingChunks && message.groundingChunks.length > 0) {
      const lowerText = textToSearch.toLowerCase();
      return lowerText.includes("sources:") || lowerText.includes("source:") || lowerText.includes("fuentes:") || lowerText.includes("fuente:");
    }
    return false;
  };

  const isImageFile = message.file && message.file.dataUrl && message.file.type.startsWith('image/');
  const isDocumentFile = message.file && !isImageFile && (message.file.type.includes('pdf') || message.file.type.includes('word') || message.file.type.includes('document'));

  const renderMessageContent = () => {
    if (isUser) {
      return <p className="whitespace-pre-wrap break-words">{message.text}</p>;
    }
    // For model messages, use MarkdownRenderer with the (potentially animated) displayedText
    return displayedText ? <MarkdownRenderer markdownText={displayedText} /> : null;
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-xl lg:max-w-2xl px-4 py-3 rounded-xl shadow ${
          isUser 
            ? 'bg-cyan-600 text-white rounded-br-none' 
            : 'bg-slate-700 text-slate-100 rounded-bl-none'
        }`}
      >
        <div className="flex items-center space-x-2 mb-1">
          {isUser ? (
            <UserIcon className="w-5 h-5 text-cyan-200 mt-0.5"/> 
          ) : (
            <span role="img" aria-label="ReelBot avatar" className="text-xl self-center">🤖</span>
          )}
          <span className="font-semibold text-sm self-center">{isUser ? 'Tú' : 'ReelBot'}</span>
        </div>

        {message.file && (
          <div className="mb-2 p-2 border border-slate-500/50 rounded-md">
            {isImageFile ? (
              <img 
                src={message.file.dataUrl} 
                alt={message.file.name} 
                className="max-w-xs max-h-48 rounded object-contain" 
              />
            ) : isDocumentFile ? (
              <div className="flex items-center space-x-2">
                <DocumentTextIcon className="w-6 h-6 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-300 truncate" title={message.file.name}>
                  {message.file.name}
                </span>
              </div>
            ) : null }
          </div>
        )}
        
        {renderMessageContent()}

        {message.error && <p className="text-red-300 text-xs mt-1">Error: {message.error}</p>}
        
        {shouldDisplaySources() && (
            <div className="mt-3 pt-2 border-t border-slate-600">
                <h4 className="text-xs font-semibold text-slate-400 mb-1">Sources:</h4>
                <ul className="list-disc list-inside space-y-1">
                    {message.groundingChunks!.map((chunk, index) => (
                        <li key={index} className="text-xs">
                            <a 
                                href={chunk.web.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 hover:underline truncate block"
                                title={chunk.web.uri}
                            >
                                {chunk.web.title || chunk.web.uri}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        )}
      </div>
    </div>
  );
});
