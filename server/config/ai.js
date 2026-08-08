import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './env.js';

let genAI = null;

if (env.geminiApiKey) {
  try {
    genAI = new GoogleGenerativeAI(env.geminiApiKey);
    console.log('[AI] Google Generative AI Client Initialized');
  } catch (error) {
    console.error(`[AI ERROR] Failed to initialize Gemini API Client: ${error.message}`);
  }
} else {
  console.warn('[AI WARNING] GEMINI_API_KEY is not defined. AI functionality will run in fallback mock mode.');
}

export { genAI };
