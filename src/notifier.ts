import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';

// --- Lazy Bot Initialization ---
let botInstance: TelegramBot | null = null;
let botInitializationError: Error | null = null;
let isBotInitialized = false; // Flag to track if initialization was attempted

function getBotInstance(): TelegramBot | null {
  if (!isBotInitialized) {
    isBotInitialized = true; // Mark as attempted
    try {
      if (config.telegramBotToken && config.telegramChatId) {
        botInstance = new TelegramBot(config.telegramBotToken);
        console.log('Telegram bot initialized on first use.');
      } else {
        console.warn(
          'Telegram bot token or chat ID not provided. Telegram notifications disabled.'
        );
      }
    } catch (error: any) {
      console.error('Failed to initialize Telegram bot:', error);
      botInitializationError = error instanceof Error ? error : new Error(String(error));
      botInstance = null; // Ensure it's null on error
    }
  }
  return botInstance;
}
// ---------------------------

/**
 * Sends a message to the configured Telegram chat.
 * @param message The message text to send.
 */
export async function sendTelegramNotification(message: string): Promise<void> {
  const bot = getBotInstance(); // Get (or initialize) the bot instance

  if (!bot) {
    const reason = botInitializationError
      ? 'bot failed to initialize'
      : 'notifications are disabled';
    console.log(`Telegram ${reason}. Skipping notification.`);
    // Log the message that would have been sent
    console.log(`[Telegram Notification Skipped]:\n${message}`);
    if (botInitializationError) {
      // Log the specific initialization error as well when skipping
      console.error('Initialization error details:', botInitializationError);
    }
    return;
  }

  try {
    console.log(`Sending notification to Telegram chat ID: ${config.telegramChatId}`);
    // Send message with Markdown parsing
    await bot.sendMessage(config.telegramChatId!, message, { // Added non-null assertion for chatId, assuming bot wouldn't be created without it
      parse_mode: 'MarkdownV2',
    });
    console.log('Successfully sent notification to Telegram.');
  } catch (error: any) {
    console.error('Error sending Telegram notification:', error.message || error);
    // Log the message that failed to send
    console.error(`[Failed Telegram Message]:\n${message}`);
    // Consider more robust error handling/retry logic if needed
  }
}

// Helper function to escape MarkdownV2 characters
// Telegram requires escaping characters like ., -, _, *, etc.
export function escapeMarkdownV2(text: string): string {
  // Escape characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
  // Use negative lookbehind (?<!\\) to avoid escaping already escaped characters.
  return text.replace(/(?<!\\)([\_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
} 