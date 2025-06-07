import { GoogleGenAI, Chat, HarmCategory, HarmBlockThreshold, GenerateContentResponse, Part, Content } from "@google/genai";
import { MODEL_NAME } from '../constants';
import type { GroundingChunk, UploadedFile } from '../types';

// Intenta obtener la API key de diferentes fuentes
let API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

// ⚠️ SOLO PARA PRUEBAS: Si no hay variable de entorno, intenta cargar desde config
if (!API_KEY) {
  try {
    const { API_CONFIG } = await import('../config/api.js');
    API_KEY = API_CONFIG.GEMINI_API_KEY;
    console.warn('⚠️ Usando API key desde archivo de configuración. Esto NO es seguro para producción.');
  } catch (error) {
    console.error("❌ No se encontró API_KEY. Configura la variable de entorno API_KEY o GEMINI_API_KEY.");
  }
}

if (!API_KEY) {
  console.error("❌ API_KEY para Gemini no está configurada. La aplicación no funcionará correctamente.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const generationConfigValues = {
  temperature: 0.7,
  topK: 1,
  topP: 1,
  maxOutputTokens: 4096, 
};

const safetySettingsList = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

async function createChatSessionWithHistory(systemInstructionText: string, history: Content[]): Promise<Chat> {
  const filteredHistory = history.filter(content => content.role !== "system");
  
  return ai.chats.create({
    model: MODEL_NAME,
    history: filteredHistory,
    config: {
      systemInstruction: systemInstructionText,
      temperature: generationConfigValues.temperature,
      topK: generationConfigValues.topK,
      topP: generationConfigValues.topP,
      maxOutputTokens: generationConfigValues.maxOutputTokens,
      safetySettings: safetySettingsList,
      tools: [{ googleSearch: {} }],
    }
  });
}

async function* sendMessageStream(
  chat: Chat, 
  messageText: string,
  imageFile?: UploadedFile 
): AsyncGenerator<{ text: string; groundingChunks?: GroundingChunk[] }, void, undefined> {
  try {
    const parts: Part[] = [];
    const userProvidedText = messageText.trim();

    if (imageFile) {
        if (imageFile.dataUrl && imageFile.type.startsWith('image/')) { 
            const base64Data = imageFile.dataUrl.split(',')[1];
            if (base64Data) {
                if (!userProvidedText) {
                    parts.push({ text: "Describe this image" }); 
                } else {
                    parts.push({ text: userProvidedText }); 
                }
                parts.push({ 
                    inlineData: {
                        mimeType: imageFile.type,
                        data: base64Data,
                    },
                });
            }
        } else { 
            const docInfo = `(User uploaded a document: ${imageFile.name})`;
            if (userProvidedText) {
                parts.push({ text: `${userProvidedText}\n${docInfo}` });
            } else {
                parts.push({ text: docInfo });
            }
        }
    } else { 
        if (userProvidedText) {
            parts.push({ text: userProvidedText });
        }
    }

    if (parts.length === 0) {
         parts.push({ text: " " }); 
    }
    
    const result = await chat.sendMessageStream({ message: parts }); 
    for await (const chunk of result) { 
      const text = chunk.text; 
      const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
      let groundingChunks: GroundingChunk[] | undefined = undefined;
      if (groundingMetadata?.groundingChunks && groundingMetadata.groundingChunks.length > 0) {
          groundingChunks = groundingMetadata.groundingChunks
              .filter(gc => gc.web?.uri && gc.web?.title) 
              .map(gc => ({ web: { uri: gc.web!.uri, title: gc.web!.title } }));
      }
      yield { text, groundingChunks };
    }
  } catch (error) {
    console.error("Error in sendMessageStream:", error);
    if (error instanceof Error) {
        yield { text: `\n\n[AI Error: ${error.message}]` };
    } else {
        yield { text: `\n\n[An unexpected AI error occurred]` };
    }
    throw error;
  }
}

export const geminiService = {
  createChatSessionWithHistory,
  sendMessageStream,
};