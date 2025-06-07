import { Chat } from "@google/genai";

export type MessageSender = 'user' | 'model';

export interface UploadedFile {
  name: string;
  type: string; // MIME type
  size: number;
  dataUrl?: string; // For image previews (base64) or to send to Gemini
  // rawFile?: File; // Transient, for processing, not for storage ideally
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: MessageSender;
  timestamp: number;
  isStreaming?: boolean;
  error?: string;
  groundingChunks?: GroundingChunk[];
  file?: UploadedFile; // To store info about an attached file
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
  // geminiChatInstance is transient, not stored in localStorage directly
}

// Structure for grounding metadata from Gemini API
export interface GroundingChunkWeb {
  uri: string;
  title: string;
}
export interface GroundingChunk {
  web: GroundingChunkWeb;
}

// Keep this minimal, actual API Key is from process.env
export interface GeminiServiceConfig {
  apiKey?: string; // Optional here as it's primarily from env
}