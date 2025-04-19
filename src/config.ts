import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

function getEnvVar(key: string, required = true): string {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || '';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..'); // Assumes config.ts is in src/

export const config = {
  jsonUrl: getEnvVar('JSON_URL'),
  openaiApiKey: getEnvVar('OPENAI_API_KEY'),
  openaiModelName: getEnvVar('OPENAI_MODEL_NAME', false) || 'gpt-4o-mini',
  openaiCustomPromptContext: getEnvVar('OPENAI_CUSTOM_PROMPT_CONTEXT', false),
  telegramBotToken: getEnvVar('TELEGRAM_BOT_TOKEN'),
  telegramChatId: getEnvVar('TELEGRAM_CHAT_ID'),
  checkIntervalCron: getEnvVar('CHECK_INTERVAL_CRON'),
  telegramNotifyOnStart: getEnvVar('TELEGRAM_NOTIFY_ON_START', false).toLowerCase() === 'true',
  stateFilePath: path.resolve(
    projectRoot,
    getEnvVar('STATE_FILE_PATH', false) || './lastState.json'
  ),
} as const;

console.log('Configuration loaded:');
console.log(`- JSON URL: ${config.jsonUrl}`);
console.log(`- Check Interval: ${config.checkIntervalCron}`);
console.log(`- State File Path: ${config.stateFilePath}`);
console.log(`- OpenAI Model: ${config.openaiModelName}`);
console.log(`- Notify on Start: ${config.telegramNotifyOnStart}`);
// Avoid logging sensitive keys like API keys 

// Define the schema for environment variables
export const configSchema = z.object({
  JSON_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  // ... existing code ...
}); 