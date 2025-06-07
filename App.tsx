
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import type { ChatSession, ChatMessage, UploadedFile } from './types';
import { geminiService } from './services/geminiService';
import { NEW_CHAT_ID, REEL_BOT_SYSTEM_INSTRUCTION } from './constants';
import type { Chat } from '@google/genai';
import { MenuIcon } from './components/icons';

const App: React.FC = () => {
  const [chats, setChats] = useState<Map<string, ChatSession>>(new Map());
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const transientGeminiChatsRef = useRef<Map<string, Chat>>(new Map());
  const isCancelledRef = useRef(false);

  useEffect(() => {
    const storedChats = localStorage.getItem('reelCreatorChats');
    if (storedChats) {
      try {
        const parsedChatsArray: [string, ChatSession][] = JSON.parse(storedChats);
        parsedChatsArray.forEach(([, chat]) => {
          if (!chat.messages) {
            chat.messages = [];
          }
          chat.messages.forEach(msg => {
            if (msg.file && !msg.file.dataUrl && !msg.file.type.startsWith('image/')) {
              // Potentially handle old document structures
            }
          });
        });
        setChats(new Map(parsedChatsArray));
        if (parsedChatsArray.length > 0) {
           // setActiveChatId(parsedChatsArray[0][0]); // Keep previous logic or decide default
        } else {
           setActiveChatId(NEW_CHAT_ID);
        }
      } catch (e) {
        console.error("Failed to parse chats from localStorage", e);
        localStorage.removeItem('reelCreatorChats'); 
        setActiveChatId(NEW_CHAT_ID);
      }
    } else {
        setActiveChatId(NEW_CHAT_ID);
    }
  }, []);

  useEffect(() => {
    if (chats.size > 0 || localStorage.getItem('reelCreatorChats')) { 
        const storableChatsArray = Array.from(chats.entries()).map(([id, session]) => {
            const storableMessages = session.messages.map(msg => {
                if (msg.file) {
                    const { /* rawFile, */ ...fileToStore } = msg.file; // rawFile removed from example
                    return { ...msg, file: fileToStore };
                }
                return msg;
            });
            return [id, { ...session, messages: storableMessages }];
        });
        localStorage.setItem('reelCreatorChats', JSON.stringify(storableChatsArray));
    }
  }, [chats]);
  
  const getOrCreateGeminiChatInstance = useCallback(async (chatId: string): Promise<Chat> => {
    if (transientGeminiChatsRef.current.has(chatId)) {
      return transientGeminiChatsRef.current.get(chatId)!;
    }
    const chatSession = chats.get(chatId);
    const history = chatSession 
      ? chatSession.messages
          .filter(m => !m.error) 
          .map(m => {
            let messageText = m.text;
            if (m.file) {
                // Keeping simplified logic for history
                 messageText = `${m.text} (User had attached ${m.file.type.startsWith('image/') ? 'image' : 'document'}: ${m.file.name})`;
            }
             return { 
              role: m.sender === 'user' ? 'user' : 'model', 
              parts: [{text: messageText}]
            }
          }) 
      : [];
    
    const newInstance = await geminiService.createChatSessionWithHistory(REEL_BOT_SYSTEM_INSTRUCTION, history);
    transientGeminiChatsRef.current.set(chatId, newInstance);
    return newInstance;
  }, [chats]);

  const handleStopGeneration = useCallback(() => {
    isCancelledRef.current = true;
  }, []);

  const handleSendMessage = useCallback(async (userInput: string, file?: UploadedFile, isSuggestion: boolean = false) => {
    if (!userInput.trim() && !file) return;
    
    isCancelledRef.current = false; 
    setIsLoading(true);
    setError(null);

    let currentChatId = activeChatId;
    let currentChatSession: ChatSession | undefined;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: userInput,
      sender: 'user',
      timestamp: Date.now(),
      file: file ? { name: file.name, type: file.type, size: file.size, dataUrl: file.dataUrl } : undefined,
    };

    if (currentChatId === NEW_CHAT_ID || !currentChatId || !chats.has(currentChatId)) {
      const newChatId = Date.now().toString();
      let chatName = "Nuevo Chat";
      const trimmedInput = userInput.trim();

      if (trimmedInput) {
        const words = trimmedInput.split(' ');
        chatName = words.slice(0, 5).join(' ');
        if (chatName.length > 30) {
          chatName = chatName.substring(0, 27) + "...";
        }
      } else if (file) {
        chatName = `Chat con ${file.name}`;
        if (chatName.length > 30) {
          chatName = chatName.substring(0, 27) + "...";
        }
      } else {
        chatName = `Nuevo Chat ${new Date().toLocaleTimeString()}`;
      }
      
      currentChatSession = {
        id: newChatId,
        name: chatName,
        messages: [userMessage],
        createdAt: Date.now(),
      };
      setChats(prev => new Map(prev).set(newChatId, currentChatSession!));
      setActiveChatId(newChatId);
      currentChatId = newChatId;
    } else {
      currentChatSession = chats.get(currentChatId);
      if (currentChatSession) {
        const updatedMessages = [...currentChatSession.messages, userMessage];
        setChats(prev => new Map(prev).set(currentChatId!, { ...currentChatSession!, messages: updatedMessages }));
      }
    }
    
    if (!currentChatSession || !currentChatId) {
        setError("Failed to create or find chat session.");
        setIsLoading(false);
        return;
    }

    const modelMessageId = Date.now().toString() + '_model';
    const initialModelMessage: ChatMessage = {
      id: modelMessageId,
      text: '',
      sender: 'model',
      timestamp: Date.now(),
      isStreaming: true,
    };

    setChats(prev => {
        const updatedChats = new Map(prev);
        const chat = updatedChats.get(currentChatId!);
        if (chat) {
            const updatedMessages = [...chat.messages, initialModelMessage];
            updatedChats.set(currentChatId!, { ...chat, messages: updatedMessages });
        }
        return updatedChats;
    });
    
    let accumulatedText = "";
    let groundingChunks: ChatMessage['groundingChunks'] = [];
    try {
      const geminiChat = await getOrCreateGeminiChatInstance(currentChatId);
      const imageFileToSend = (file?.type.startsWith('image/') && file.dataUrl) ? file : undefined;

      const stream = await geminiService.sendMessageStream(geminiChat, userInput, imageFileToSend);
      for await (const chunk of stream) {
        if (isCancelledRef.current) {
          console.log("Generation stopped by user.");
          break; 
        }
        accumulatedText += chunk.text;
        if (chunk.groundingChunks && chunk.groundingChunks.length > 0) {
          groundingChunks = [...(groundingChunks || []), ...chunk.groundingChunks];
        }
        
        setChats(prev => {
            const updatedChats = new Map(prev);
            const chat = updatedChats.get(currentChatId!);
            if (chat) {
                const msgIndex = chat.messages.findIndex(m => m.id === modelMessageId);
                if (msgIndex !== -1) {
                    const newMessages = [...chat.messages];
                    newMessages[msgIndex] = {
                        ...newMessages[msgIndex],
                        text: accumulatedText,
                        groundingChunks: groundingChunks.length > 0 ? groundingChunks : undefined,
                        isStreaming: true 
                    };
                    updatedChats.set(currentChatId!, { ...chat, messages: newMessages });
                }
            }
            return updatedChats;
        });
      }
      
       setChats(prev => {
            const updatedChats = new Map(prev);
            const chat = updatedChats.get(currentChatId!);
            if (chat) {
                const msgIndex = chat.messages.findIndex(m => m.id === modelMessageId);
                if (msgIndex !== -1) {
                    const newMessages = [...chat.messages];
                    newMessages[msgIndex] = {
                        ...newMessages[msgIndex],
                        text: accumulatedText, 
                        isStreaming: false, 
                        groundingChunks: groundingChunks.length > 0 ? groundingChunks : undefined
                    };
                    updatedChats.set(currentChatId!, { ...chat, messages: newMessages });
                }
            }
            return updatedChats;
        });

    } catch (e: any) {
      console.error("Error sending message to Gemini:", e);
      const errorMessage = e.message || "An error occurred with the AI service.";
      setError(errorMessage); 
      setChats(prev => {
            const updatedChats = new Map(prev);
            const chat = updatedChats.get(currentChatId!);
            if (chat) {
                const msgIndex = chat.messages.findIndex(m => m.id === modelMessageId);
                if (msgIndex !== -1) {
                    const newMessages = [...chat.messages];
                    newMessages[msgIndex] = {
                        ...newMessages[msgIndex],
                        text: accumulatedText || `Error: ${errorMessage}`,
                        isStreaming: false,
                        error: errorMessage
                    };
                    updatedChats.set(currentChatId!, { ...chat, messages: newMessages });
                } else { 
                    const errorMsgEntry: ChatMessage = {
                         id: modelMessageId, 
                         text: `Error: ${errorMessage}`,
                         sender: 'model',
                         timestamp: Date.now(),
                         isStreaming: false,
                         error: errorMessage
                    };
                    const newMessages = [...chat.messages, errorMsgEntry];
                    updatedChats.set(currentChatId!, { ...chat, messages: newMessages });
                }
            }
            return updatedChats;
        });
    } finally {
      setIsLoading(false);
    }
  }, [activeChatId, chats, getOrCreateGeminiChatInstance]);

  const handleSelectChat = useCallback((chatId: string | null) => {
    setActiveChatId(chatId);
    setIsSidebarOpen(false); // Close sidebar on chat selection (mobile)
    if (chatId && chatId !== NEW_CHAT_ID && chats.has(chatId)) {
        getOrCreateGeminiChatInstance(chatId);
    }
  }, [chats, getOrCreateGeminiChatInstance]);

  const handleCreateNewChat = useCallback(() => {
    setActiveChatId(NEW_CHAT_ID);
    setIsSidebarOpen(false); // Close sidebar on new chat (mobile)
  }, []);
  
  const activeChatSession = activeChatId === NEW_CHAT_ID || !activeChatId ? null : chats.get(activeChatId) || null;

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden md:overflow-auto">
      <Sidebar
        chats={Array.from(chats.values())}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onCreateNewChat={handleCreateNewChat}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          aria-hidden="true"
        />
      )}

      <div className="flex-1 flex flex-col h-full">
        <div className="p-3 border-b border-slate-700 md:hidden flex items-center justify-start bg-slate-900 sticky top-0 z-20">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-slate-300 hover:text-slate-100 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Open menu"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
          {/* Title text and spacer div removed here */}
        </div>

        <ChatView
          activeChatSession={activeChatSession}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          error={error}
          onStopGeneration={handleStopGeneration} 
        />
      </div>
    </div>
  );
};

export default App;
