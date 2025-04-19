import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateChangeSummary } from './aiProcessor.js';
// Use the Vercel AI SDK generateText
import * as aiSDK from 'ai';
import { type Change } from 'diff';
import type {
  GenerateTextResult,
  FinishReason,
} from 'ai'; // Import minimal necessary types
// No longer need configModule import
// import * as configModule from './config.js';

// --- Mocks ---

// Mock the config (no need to mock the whole module if not dynamically changing it in tests)
// Mocking the module can interfere with vi.doMock used in specific tests.
// Just assume config is loaded correctly for most tests, override with vi.doMock when needed.
// vi.mock('./config.js', () => ({ ... })); // REMOVED

// Mock the Vercel AI SDK generateText function
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof aiSDK>();
  return {
    ...actual, // Keep other exports if any
    generateText: vi.fn(), // Mock only generateText
  };
});
// Get a typed handle to the mocked generateText
const mockedGenerateText = vi.mocked(aiSDK.generateText);

// Mock the @ai-sdk/openai provider factory (needed by generateText)
// This needs to return a structure that generateText expects
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn().mockImplementation(() => ({
    // Mock the necessary structure or methods the actual generateText call uses
    // This might need adjustment based on the actual implementation details of generateText
    // For now, returning a simple object might suffice if only model ID is accessed.
    id: 'gpt-4o-mini', // Example model ID
    provider: 'openai',
  })),
}));

// Remove the incorrect @google/generative-ai mock
// vi.mock('@google/generative-ai', () => ({ ... })); // REMOVED

// Simplified helper to create a mock result conforming to Vercel AI SDK structure
function createMockGenerateTextResult(
  text: string
): Pick<GenerateTextResult<never, unknown>, 'text' | 'finishReason' | 'usage'> {
  return {
    text,
    finishReason: 'stop' as FinishReason,
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    // Provide only essential fields to satisfy basic structure
  };
}

// --- Test Suite ---

describe('aiProcessor', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Reset generateText mock behavior if needed, or set default
    mockedGenerateText.mockReset(); // Reset calls and implementations
  });

  describe('generateChangeSummary', () => {
    // Define sample changes conforming to 'diff' library structure
    const sampleChanges: Change[] = [
      { count: 1, value: '{\n  "name": "old name",\n', removed: true, added: false },
      { count: 1, value: '{\n  "name": "new name",\n', added: true, removed: false },
      { count: 1, value: '  "value": 1\n}', added: false, removed: false }
    ];

    it('should call generateText with formatted diff and system prompt', async () => {
      const expectedSummary = 'Name changed from old to new.';
      // Mock generateText to resolve successfully for this test
      mockedGenerateText.mockResolvedValue(
        createMockGenerateTextResult(expectedSummary) as any
      );

      // Mock config *specifically* for this test to add custom context
      vi.doMock('./config.js', () => ({
        config: { openaiCustomPromptContext: 'Translate summary to Klingon.', openaiApiKey: 'DUMMY' },
      }));
      vi.resetModules(); // Ensure the mock is picked up
      const { generateChangeSummary: generateSummaryWithMockedConfig } = await import('./aiProcessor.js');

      const summary = await generateSummaryWithMockedConfig(sampleChanges);

      expect(summary).toBe(expectedSummary);
      expect(consoleLogSpy).toHaveBeenCalledWith('Generating summary for changes...');
      expect(consoleLogSpy).toHaveBeenCalledWith('Successfully generated summary from AI.');
      expect(mockedGenerateText).toHaveBeenCalledTimes(1);

      // Extract arguments passed to the mocked generateText
      const callArgs = mockedGenerateText.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      if (!callArgs) return; // Guard

      const expectedSystemPrompt = `You are an assistant that summarizes changes detected in a JSON object. Provide a concise, human-readable summary of the differences presented below. Focus on the key changes. The diff format shows [ADDED] sections for new content and [REMOVED] sections for deleted content. Respond only with the summary.\n\nAdditional Instructions: Translate summary to Klingon.`;
      const expectedContentFragments = [
        'Detected changes:',
        '[REMOVED]',
        '"name": "old name"', // Check for the key value pair
        '---',
        '[ADDED]',
        '"name": "new name",' // <--- Comma needed here
      ];

      // Check messages array
      expect(callArgs.messages).toBeInstanceOf(Array);
      if (!callArgs.messages) return;
      expect(callArgs.messages[0]?.role).toBe('system');
      expect(callArgs.messages[0]?.content).toBe(expectedSystemPrompt);
      expect(callArgs.messages[1]?.role).toBe('user');

      // Check if the user prompt contains all expected fragments
      const userPrompt = callArgs.messages[1]?.content as string;
      expectedContentFragments.forEach(fragment => {
        expect(userPrompt).toContain(fragment);
      });

      // Check model and temperature
      // Note: The exact model object might be complex due to the mock, checking provider/id is safer
      expect(callArgs.model).toEqual(expect.objectContaining({ id: 'gpt-4o-mini', provider: 'openai' }));
      expect(callArgs.temperature).toBe(0.3);

      // Cleanup the specific config mock
      vi.doUnmock('./config.js');
    });

    it('should handle errors from generateText', async () => {
      const error = new Error('AI service failed');
      // Mock generateText to reject for this test
      mockedGenerateText.mockRejectedValue(error);

      // Import generateChangeSummary normally (should use default mocks unless overridden by doMock)
      const { generateChangeSummary } = await import('./aiProcessor.js');

      const summary = await generateChangeSummary(sampleChanges);

      expect(summary).toBe('Error generating change summary.');
      // Check that the *original error object* is logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating summary from OpenAI:', error);
    });

    // THIS IS THE NEW TEST BEING ADDED/FIXED
    it('should log the error *message* if generateText fails', async () => {
      const error = new Error('AI Service Unavailable');
      // Mock generateText to reject
      mockedGenerateText.mockRejectedValue(error);

      // Import normally
      const { generateChangeSummary } = await import('./aiProcessor.js');
      await expect(generateChangeSummary(sampleChanges)).resolves.toBe('Error generating change summary.');

      // Assert that console.error was called with the correct prefix and the *message* property
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating summary from OpenAI:', error);
    });

    it('should format diff correctly', async () => {
      const changes: Change[] = [
        { count: 1, value: '{\n  "name": "old name",\n', removed: true, added: false },
        { count: 1, value: '{\n  "name": "new name",\n', added: true, removed: false },
        { count: 1, value: '  "value": 1\n}', added: false, removed: false },
        { count: 1, value: '  "extra": null,\n', added: true, removed: false },
      ];
      // Mock generateText to resolve
      mockedGenerateText.mockResolvedValue(
        createMockGenerateTextResult('Some summary') as any
      );

      const { generateChangeSummary } = await import('./aiProcessor.js');
      await generateChangeSummary(changes);

      const expectedSystemPrompt = `You are an assistant that summarizes changes detected in a JSON object. Provide a concise, human-readable summary of the differences presented below. Focus on the key changes. The diff format shows [ADDED] sections for new content and [REMOVED] sections for deleted content. Respond only with the summary.\n\nAdditional Instructions: Translate summary to Klingon.`;
      const expectedContentFragments = [
        'Detected changes:',
        '[REMOVED]',
        '"name": "old name"', // Check key value
        '---',
        '[ADDED]',
        '"name": "new name"', // Check key value
        '---',
        '[ADDED]',
        '"extra": null,' // <--- Comma needed here
      ];

      const callArgs = mockedGenerateText.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      if (!callArgs) return; // Guard clause

      // Check the user prompt within the messages array
      expect(callArgs.messages).toBeInstanceOf(Array);
      if (!callArgs.messages) return;
      expect(callArgs.messages[1]?.role).toBe('user');

      // Check if the user prompt contains all expected fragments
      const userPrompt = callArgs.messages[1]?.content as string;
      expectedContentFragments.forEach(fragment => {
        expect(userPrompt).toContain(fragment);
      });
    });

  });
}); 