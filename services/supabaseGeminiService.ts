import { createClient } from '@supabase/supabase-js'
import type { GroundingChunk, UploadedFile } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function* sendMessageStream(
  systemInstruction: string,
  history: any[],
  message: string,
  imageFile?: UploadedFile
): AsyncGenerator<{ text: string; groundingChunks?: GroundingChunk[] }, void, undefined> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/gemini-chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history,
        systemInstruction,
        imageFile
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No se pudo obtener el reader del stream')
    }

    const decoder = new TextDecoder()
    
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) break
      
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.done) {
              return
            }
            if (data.text) {
              yield { text: data.text }
            }
          } catch (e) {
            // Ignorar líneas que no son JSON válido
          }
        }
      }
    }
  } catch (error) {
    console.error('Error en sendMessageStream:', error)
    yield { text: `Error: ${error.message}` }
    throw error
  }
}

export const supabaseGeminiService = {
  sendMessageStream
}