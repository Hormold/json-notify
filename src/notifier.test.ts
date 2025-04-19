import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// --- Mocks ---
// MOVED TO TOP: Mock node-telegram-bot-api FIRST to potentially fix hoisting issues
// Define mockSendMessage first
const mockSendMessage = vi.fn();
// Define the mock constructor at the top level
const mockConstructor = vi.fn(() => ({
  sendMessage: mockSendMessage,
}));
// Mock the module using the top-level constructor
vi.mock('node-telegram-bot-api', () => ({
  default: mockConstructor,
}));

// Other imports AFTER the primary mock
import type TelegramBot from 'node-telegram-bot-api';
import * as configModule from './config.js'; // Import for spying

// Mock config - Simpler version, define static mock values
vi.mock('./config.js', () => ({
    config: {
      jsonUrl: 'dummy_url',
      openaiApiKey: 'dummy_key',
      telegramBotToken: 'MOCK_TOKEN', // Ensure this matches TEST_CONFIG_VALUES
      telegramChatId: 'MOCK_CHAT_ID',   // Ensure this matches TEST_CONFIG_VALUES
      checkIntervalCron: 'dummy_cron',
      stateFilePath: 'dummy_path',
      openaiCustomPromptContext: '',
      // Add other required config fields with dummy values
      openaiModelName: 'gpt-dummy',
      telegramNotifyOnStart: false,
    },
    // If other exports from config.js are used, mock them here too
}));

// Import AFTER mocks are defined
import { escapeMarkdownV2, sendTelegramNotification } from './notifier.js';

// --- Test Suite ---
describe('sendTelegramNotification', () => {
  const TEST_CONFIG_VALUES = {
    telegramBotToken: 'MOCK_TOKEN',
    telegramChatId: 'MOCK_CHAT_ID',
  };

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();

    // Ensure the constructor mock has the default implementation
    mockConstructor.mockImplementation(() => ({ sendMessage: mockSendMessage }));

    // Spy on console - Use ReturnType for better type safety
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console spies
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    // Restore any spied-on objects (like config)
    vi.restoreAllMocks();
  });

  it('should send a message successfully when bot is initialized by default', async () => {
    const message = 'Test message';
    mockSendMessage.mockResolvedValueOnce({});
    await sendTelegramNotification(message);

    expect(mockConstructor).toHaveBeenCalledWith(TEST_CONFIG_VALUES.telegramBotToken);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith(TEST_CONFIG_VALUES.telegramChatId, message, { parse_mode: 'MarkdownV2' });
    expect(consoleLogSpy).toHaveBeenCalledWith(`Sending notification to Telegram chat ID: ${TEST_CONFIG_VALUES.telegramChatId}`);
  });

  it('should log an error and the message if sendMessage fails (default init)', async () => {
    const message = 'Another test message.';
    const sendError = new Error('Telegram API error');
    mockSendMessage.mockRejectedValueOnce(sendError);
    await sendTelegramNotification(message);

    expect(mockConstructor).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending Telegram notification:', sendError.message);
    expect(consoleErrorSpy).toHaveBeenCalledWith(`[Failed Telegram Message]:\n${message}`);
  });

  it('should log a skip message if bot is not initialized (missing config)', async () => {
    const message = 'This should be skipped.';

    // Temporarily override the config for this specific test
    // We need to re-import config or access the mocked module
    vi.doMock('./config.js', () => ({
        config: {
            jsonUrl: 'dummy_url',
            openaiApiKey: 'dummy_key',
            telegramBotToken: '', // Use empty string for missing
            telegramChatId: '',   // Use empty string for missing
            checkIntervalCron: 'dummy_cron',
            stateFilePath: 'dummy_path',
            openaiCustomPromptContext: '',
            openaiModelName: 'gpt-dummy',
            telegramNotifyOnStart: false,
        },
    }));
    vi.resetModules(); // Force re-import with the doMock

    // Re-import the notifier function to pick up the new mock
    const { sendTelegramNotification: sendNotificationWithMockedConfig } = await import('./notifier.js');

    await sendNotificationWithMockedConfig(message);

    // Bot constructor should NOT be called because config check fails
    expect(mockConstructor).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith('Telegram bot token or chat ID not provided. Telegram notifications disabled.');
    expect(consoleLogSpy).toHaveBeenCalledWith('Telegram notifications are disabled. Skipping notification.');
    expect(consoleLogSpy).toHaveBeenCalledWith(`[Telegram Notification Skipped]:\n${message}`);

    // Clean up the specific mock
    vi.doUnmock('./config.js');
  });

  it('should handle errors during bot initialization and disable sending', async () => {
    const message = 'This should also be skipped due to init error.';
    const initError = new Error('Invalid bot token');

    // Override the mock constructor's implementation *for this test*
    mockConstructor.mockImplementationOnce(() => { throw initError; });

    // Config is valid (uses default mock), so initialization will be attempted
    await sendTelegramNotification(message);

    expect(mockConstructor).toHaveBeenCalledWith(TEST_CONFIG_VALUES.telegramBotToken);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize Telegram bot:', initError);
    expect(consoleLogSpy).toHaveBeenCalledWith('Telegram bot failed to initialize. Skipping notification.');
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Initialization error details:', initError);
  });

  it('should handle non-Error object during bot initialization', async () => {
    const message = 'Should skip on non-Error init failure.';
    const initErrorString = 'Initialization failed unexpectedly';
    mockConstructor.mockImplementationOnce(() => { throw initErrorString; });

    await sendTelegramNotification(message);

    expect(mockConstructor).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize Telegram bot:', initErrorString);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Initialization error details:', expect.any(Error));
    expect(consoleLogSpy).toHaveBeenCalledWith('Telegram bot failed to initialize. Skipping notification.');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should handle non-Error object when sendMessage fails', async () => {
    const message = 'Test with non-error rejection.';
    const sendErrorObject = { code: 'ETIMEOUT', custom: 'data' };
    mockSendMessage.mockRejectedValueOnce(sendErrorObject);

    await sendTelegramNotification(message);

    expect(mockConstructor).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error sending Telegram notification:',
      JSON.stringify(sendErrorObject)
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(`[Failed Telegram Message]:\n${message}`);
  });

});

// --- Test Suite for escapeMarkdownV2 ---
describe('escapeMarkdownV2', () => {
  it('should escape all required MarkdownV2 characters', () => {
    const text = '_*[]()~`>#+-=|{}.!';
    const expected = '\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!';
    expect(escapeMarkdownV2(text)).toBe(expected);
  });

  it('should not escape characters that do not require escaping', () => {
    const text = 'Hello world 123 ABC abc /:?,@';
    expect(escapeMarkdownV2(text)).toBe(text);
  });

  it('should handle empty string', () => {
    expect(escapeMarkdownV2('')).toBe('');
  });

  it('should handle text with already escaped characters (no double escaping)', () => {
    const text = 'This is \\_already\\_ escaped\.\\!';
    // The new regex with negative lookbehind should leave this unchanged.
    expect(escapeMarkdownV2(text)).toBe(text);
  });

  it('should handle multiple occurrences of special characters', () => {
    const text = '#hash-tag and another #hash-tag!';
    const expected = '\\#hash\\-tag and another \\#hash\\-tag\\!';
    expect(escapeMarkdownV2(text)).toBe(expected);
  });
}); 