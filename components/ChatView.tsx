
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatSession, ChatMessage, UploadedFile } from '../types';
import { ChatMessageItem } from './ChatMessageItem';
import { SuggestionButton } from './SuggestionButton';
import { SendIcon, FilmIcon, PaperclipIcon, XCircleIcon as XCircleIconFile, DocumentTextIcon, StopIcon } from './icons';
import { SUGGESTION_PROMPTS, REELBOT_IMAGE_URL } from '../constants';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];

const SPINNER_CHARS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL_MS = 100;

interface ChatViewProps {
  activeChatSession: ChatSession | null;
  onSendMessage: (message: string, file?: UploadedFile, isSuggestion?: boolean) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onStopGeneration: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ activeChatSession, onSendMessage, isLoading, error, onStopGeneration }) => {
  const [userInput, setUserInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [activeChatSession?.messages]);

  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, activeChatSession]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileError(null);
    setSelectedFile(null);

    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setFileError(`El archivo es demasiado grande (máx. ${MAX_FILE_SIZE_MB}MB).`);
        return;
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setFileError('Tipo de archivo no admitido.');
        return;
      }

      const fileInfo: UploadedFile = {
        name: file.name,
        type: file.type,
        size: file.size,
      };

      if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
        const reader = new FileReader();
        reader.onloadend = () => {
          fileInfo.dataUrl = reader.result as string;
          setSelectedFile(fileInfo);
        };
        reader.onerror = () => {
          setFileError('Error al leer el archivo de imagen.');
        }
        reader.readAsDataURL(file);
      } else if (ALLOWED_DOC_TYPES.includes(file.type)) {
        setSelectedFile(fileInfo);
      }
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((userInput.trim() || selectedFile) && !isLoading) {
      onSendMessage(userInput.trim(), selectedFile || undefined);
      setUserInput('');
      clearSelectedFile();
    }
  };

  const handleSuggestionClick = (promptText: string) => {
    if (!isLoading) {
      onSendMessage(promptText, undefined, true);
      setUserInput(''); 
      clearSelectedFile();
    }
  };

  const lastMessage = activeChatSession?.messages?.[activeChatSession.messages.length - 1];
  const modelIsCurrentlyStreaming = isLoading && lastMessage?.sender === 'model' && lastMessage?.isStreaming;
  const modelIsThinking = isLoading && !modelIsCurrentlyStreaming;

  useEffect(() => {
    let intervalId: number | undefined;
    if (modelIsCurrentlyStreaming) {
      intervalId = window.setInterval(() => {
        setSpinnerFrame(prevFrame => (prevFrame + 1) % SPINNER_CHARS.length);
      }, SPINNER_INTERVAL_MS);
    } else {
      setSpinnerFrame(0); // Reset spinner when not streaming
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [modelIsCurrentlyStreaming]);

  let placeholderText = "Describe tu audiencia y el objetivo de tu Reel...";
  if (modelIsThinking) {
    placeholderText = "ReelBot está pensando...";
  } else if (modelIsCurrentlyStreaming) {
    placeholderText = `ReelBot esta escribiendo... ${SPINNER_CHARS[spinnerFrame]}`;
  } else if (selectedFile) {
    placeholderText = "Añade un comentario sobre el archivo...";
  }


  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden"> {/* Added overflow-hidden */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"> {/* Adjusted padding for consistency */}
        {!activeChatSession || activeChatSession.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 md:-translate-y-[30px]">
            <img 
              src={REELBOT_IMAGE_URL}
              alt="ReelBot Logo" 
              className="w-full max-w-[200px] sm:max-w-[300px] md:max-w-[400px] lg:max-w-[500px] h-auto mb-4 md:mb-6 shadow-lg object-contain"
            />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-cyan-400 mb-2 -mt-2.5">
              Reel Creator AI
            </h2>
            <p className="text-slate-400 mb-3 text-base sm:text-lg lg:text-xl">By Jesús Cabrera</p>
            <p className="text-slate-300 mb-6 md:mb-8 max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl text-lg sm:text-xl lg:text-2xl flex items-center justify-center">
              <FilmIcon className="w-5 h-5 mr-2 flex-shrink-0" />
              Experto en crear Reels virales que convierten visualizaciones en clientes
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
              {SUGGESTION_PROMPTS.map((prompt) => (
                <SuggestionButton
                  key={prompt.text}
                  text={prompt.text}
                  // emoji prop removed
                  onClick={() => handleSuggestionClick(prompt.text)}
                  disabled={isLoading}
                />
              ))}
            </div>
          </div>
        ) : (
          activeChatSession.messages.map((msg) => (
            <ChatMessageItem key={msg.id} message={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
        {error && <div className="text-red-400 p-2 bg-red-900/50 rounded-md text-sm">{error}</div>}
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-900"> {/* Removed sticky and z-index, handled by App.tsx structure */}
        {selectedFile && (
          <div className="mb-2 p-2 bg-slate-800 rounded-md flex items-center justify-between">
            <div className="flex items-center space-x-2 overflow-hidden">
              {selectedFile.dataUrl && ALLOWED_IMAGE_TYPES.includes(selectedFile.type) ? (
                <img src={selectedFile.dataUrl} alt="Preview" className="w-10 h-10 rounded object-cover" />
              ) : (
                <DocumentTextIcon className="w-8 h-8 text-slate-400 flex-shrink-0" />
              )}
              <span className="text-xs text-slate-300 truncate" title={selectedFile.name}>
                {selectedFile.name}
              </span>
            </div>
            <button onClick={clearSelectedFile} className="text-slate-400 hover:text-slate-200" disabled={isLoading}>
              <XCircleIconFile className="w-5 h-5" />
            </button>
          </div>
        )}
        {fileError && <p className="text-red-400 text-xs mb-2">{fileError}</p>}

        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept={ALLOWED_FILE_TYPES.join(',')}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-300 hover:text-slate-100 transition-colors duration-150 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
            aria-label="Attach file"
          >
            <PaperclipIcon className="w-5 h-5" />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={placeholderText}
            className="flex-1 p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-shadow duration-150 disabled:opacity-70"
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="p-3 bg-red-600 hover:bg-red-500 rounded-lg text-white transition-colors duration-150 focus:ring-2 focus:ring-red-400 focus:outline-none"
              aria-label="Stop generation"
            >
              <StopIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={(!userInput.trim() && !selectedFile) || isLoading}
              className="p-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-white transition-colors duration-150 focus:ring-2 focus:ring-cyan-400 focus:outline-none"
              aria-label="Send message"
            >
              <SendIcon className="w-5 h-5" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
