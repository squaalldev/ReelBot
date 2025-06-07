
import React from 'react';
import type { ChatSession } from '../types';
import { NEW_CHAT_ID } from '../constants';
import { XIcon } from './icons'; // Added XIcon

interface SidebarProps {
  chats: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onCreateNewChat: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ chats, activeChatId, onSelectChat, onCreateNewChat, isOpen, onClose }) => {
  const sortedChats = [...chats].sort((a, b) => b.createdAt - a.createdAt);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    if (selectedValue === NEW_CHAT_ID) {
      onCreateNewChat();
    } else {
      onSelectChat(selectedValue);
    }
  };
  
  return (
    <div 
      className={`
        fixed inset-y-0 left-0 z-40
        h-full bg-slate-800 p-4 sm:p-6 flex flex-col border-r border-slate-700 shadow-xl
        transform transition-transform duration-300 ease-in-out
        w-4/5 max-w-[280px] sm:max-w-xs
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:w-1/4 md:max-w-xs md:shadow-none
      `}
      role="navigation"
      aria-label="Chats sidebar"
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Chats</h1>
        <button
          onClick={onClose}
          className="md:hidden text-slate-400 hover:text-slate-100 p-1 rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label="Close menu"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>
      
      <div>
        <label htmlFor="chat-select" className="block text-sm font-medium text-slate-300 mb-1">
          Selecciona un chat
        </label>
        <div className="relative group">
          <select
            id="chat-select"
            value={activeChatId || NEW_CHAT_ID}
            onChange={handleChange}
            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none appearance-none cursor-pointer"
            style={{
              paddingRight: '2.5rem', 
            }}
          >
            <option value={NEW_CHAT_ID} className="bg-slate-700 text-slate-100">
              Nuevo Chat
            </option>
            {sortedChats.map((chat) => (
              <option key={chat.id} value={chat.id} className="bg-slate-700 text-slate-100">
                {chat.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 group-hover:text-cyan-400 transition-colors duration-150">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
