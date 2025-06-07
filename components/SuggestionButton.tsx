
import React from 'react';

interface SuggestionButtonProps {
  text: string;
  // emoji prop removed
  onClick: () => void;
  disabled?: boolean;
}

export const SuggestionButton: React.FC<SuggestionButtonProps> = ({ text, onClick, disabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center justify-center text-left w-full 
        p-3 bg-slate-800 hover:bg-slate-700 
        border border-slate-700 hover:border-cyan-600 
        rounded-lg text-slate-200 hover:text-cyan-300 
        transition-all duration-200 ease-in-out 
        focus:ring-2 focus:ring-cyan-500 focus:outline-none 
        disabled:opacity-60 disabled:cursor-not-allowed 
        hover:scale-[1.02] transform hover:shadow-lg hover:shadow-cyan-500/20
      `}
    >
      {/* Emoji span removed */}
      <span className="text-sm font-medium">{text}</span>
    </button>
  );
};
