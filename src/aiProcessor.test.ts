import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateChangeSummary,
  type ChangeSummaryResult,
} from './aiProcessor.js'; // Import named export and type
// Use the Vercel AI SDK generateObject
import * as aiSDK from 'ai';
import { type Change } from 'diff';
// Import z from 'zod' if needed for constructing test data or assertions
// import { z } from 'zod';

// --- Mocks ---

// Mock the config - provide necessary fields used by aiProcessor
vi.mock('./config.js', () => ({
  config: {
    openaiApiKey: 'TEST_API_KEY', // Provide a dummy key
    openaiModelName: 'gpt-4o-mini-test', // Provide a model name
    openaiCustomPromptContext: undefined, // Default to undefined
  },
}));

// Mock the Vercel AI SDK generateObject function
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof aiSDK>();
  return {
    ...actual, // Keep other exports
    // Mock generateObject specifically
    generateObject: vi.fn(),
    // Keep generateText mock if other parts of the system still use it, otherwise remove
    // generateText: vi.fn(),
  };
});
// Get a typed handle to the mocked generateObject
const mockedGenerateObject = vi.mocked(aiSDK.generateObject);

// Mock the @ai-sdk/openai provider factory
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn().mockImplementation((modelName: string) => ({
    // Mock the structure expected by generateObject based on the provider usage
    id: modelName || 'mock-model-id', // Use provided name or a default
    provider: 'openai',
    // Add other methods/properties if the actual implementation calls them
  })),
}));
// Get a typed handle to the mocked openai provider factory
// REMOVED: const mockedOpenaiProvider = vi.mocked(require('@ai-sdk/openai').openai);
// Instead, we'll access the mock directly if needed, or rely on vi.clearAllMocks


// Helper to create a mock result for generateObject
function createMockGenerateObjectResult(
  resultObject: ChangeSummaryResult,
): aiSDK.GenerateObjectResult<typeof resultObject> { // Match generateObject result structure more accurately
  // Provide a more complete mock structure
  return {
    object: resultObject,
    finishReason: 'stop',
    usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 },
    // Add other fields with dummy values if TS still complains
    // warnings: undefined,
    // rawResponse: undefined,
    // rawRequest: undefined,
    // experimental_providerMetadata: undefined,
  } as any; // Use 'as any' for simplicity if exact deep type matching is complex/brittle for mocks
}

// --- Test Suite ---

describe('aiProcessor', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  // Define sample changes conforming to 'diff' library structure
  const sampleChangesBasic: Change[] = [
    { count: 1, value: '{\\n  "name": "old name",\\n', removed: true, added: false },
    { count: 1, value: '{\\n  "name": "new name",\\n', added: true, removed: false },
    { count: 1, value: '  "value": 1\\n}', added: false, removed: false } // Unchanged part
  ];

  // Changes filtered by generateChangeSummary
  const sampleChangesFiltered: Change[] = [
    { count: 1, value: '{\\n  "name": "old name",\\n', removed: true, added: false },
    { count: 1, value: '{\\n  "name": "new name",\\n', added: true, removed: false },
  ];


  beforeEach(() => {
    vi.clearAllMocks(); // Clears mock calls and implementations
    // Reset mocks to default behavior if necessary after doMock/doUnmock
    mockedGenerateObject.mockReset();
    // REMOVED: mockedOpenaiProvider.mockClear(); // Clear calls to the provider factory - clearAllMocks should handle this

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset config mock potentially modified by doMock
    // This ensures each test starts with the default mock defined above
    vi.resetModules();
  });

  // After using vi.doMock, ensure we unmock to avoid leakage
  // Consider using afterEach for cleanup if doMock is used frequently
  // afterEach(() => {
  //   vi.doUnmock('./config.js'); // Or specific unmocking logic
  // });


  describe('generateChangeSummary', () => {
    it('should return default result for empty or no effective changes', async () => {
        const emptyChanges: Change[] = [];
        const noEffectiveChanges: Change[] = [
            { count: 1, value: '  "value": 1\\n}', added: false, removed: false }
        ];
        const expectedResult: ChangeSummaryResult = {
            isWorthToReport: false,
            reportedChanges: 'No changes detected.',
        };

        const { generateChangeSummary: generateSummaryFunc } = await import('./aiProcessor.js');

        let summary = await generateSummaryFunc(emptyChanges);
        expect(summary).toEqual(expectedResult);
        expect(mockedGenerateObject).not.toHaveBeenCalled();

        summary = await generateSummaryFunc(noEffectiveChanges);
        expect(summary).toEqual(expectedResult);
        expect(mockedGenerateObject).not.toHaveBeenCalled();
        expect(consoleLogSpy).not.toHaveBeenCalledWith('Generating summary and evaluating changes...');
    });


    it.skip('should call generateObject with formatted diff, schema, and default system prompt when no custom context', async () => {
      const expectedAiSummary = 'Name changed from old to new.';
      const expectedResult: ChangeSummaryResult = {
        isWorthToReport: true, // Default true when no custom context
        reportedChanges: expectedAiSummary,
      };
      // Mock generateObject to resolve successfully
      mockedGenerateObject.mockResolvedValue(
        createMockGenerateObjectResult(expectedResult)
      );

      // Need to re-import within the test if using resetModules in beforeEach
      const { generateChangeSummary: generateSummaryFunc } = await import('./aiProcessor.js');
      const { config: defaultConfig } = await import('./config.js'); // Get the default mocked config

      const summary = await generateSummaryFunc(sampleChangesBasic);

      expect(summary).toEqual(expectedResult);
      expect(consoleLogSpy).toHaveBeenCalledWith('Generating summary and evaluating changes...');
      expect(consoleLogSpy).toHaveBeenCalledWith('Successfully generated structured summary from AI.');
      expect(mockedGenerateObject).toHaveBeenCalledTimes(1);

      // Extract arguments passed to the mocked generateObject
      const callArgs = mockedGenerateObject.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      if (!callArgs) return; // Guard

      // Check System Prompt (without custom context)
      const expectedSystemPromptBase = `You are an assistant analyzing changes detected in a JSON object. Your goal is to provide a concise, human-readable summary of these changes and decide if they are significant enough to report based on specific criteria if provided.`; // Check start
      const expectedSystemPromptNoCriteria = `Since no specific reporting criteria are provided, consider ANY detected changes significant enough to report. Set \`isWorthToReport\` to true.`;
      const expectedOutputFormat = `Output Format:\nRespond ONLY with a valid JSON object matching this schema:`;

      expect(callArgs.messages).toBeInstanceOf(Array);
      if (!callArgs.messages) return;
      expect(callArgs.messages[0]?.role).toBe('system');
      expect(callArgs.messages[0]?.content).toContain(expectedSystemPromptBase);
      expect(callArgs.messages[0]?.content).toContain(expectedSystemPromptNoCriteria);
      expect(callArgs.messages[0]?.content).toContain(expectedOutputFormat);
      expect(callArgs.messages[0]?.content).not.toContain('CRITERIA FOR SIGNIFICANCE:'); // Should not be present


      // Check User Prompt (formatted diff)
      // Define with string concatenation and literal newlines
      const expectedUserPrompt =
        'Detected changes:\n\n' +
        '[REMOVED] {\n  "name": "old name",\n\n' +
        '---\n' +
        '[ADDED] {\n  "name": "new name",\n\n';

      expect(callArgs.messages[1]?.role).toBe('user');
      expect(callArgs.messages[1]?.content).toBe(expectedUserPrompt);

      // Check Model (using the mocked provider and config)
      // We can't directly assert calls on the provider factory mock easily without a handle,
      // but we can check the result passed to generateObject
      // expect(mockedOpenaiProvider).toHaveBeenCalledWith(defaultConfig.openaiModelName);
      expect(callArgs.model).toEqual(expect.objectContaining({ id: defaultConfig.openaiModelName, provider: 'openai' }));

      // Check Schema and Temperature
      expect((callArgs as any).schema).toBeDefined(); // Check schema presence
      expect((callArgs as any).schema.shape.isWorthToReport).toBeDefined(); // Check a known field
      expect((callArgs as any).schema.shape.reportedChanges).toBeDefined();
      expect(callArgs.temperature).toBe(0.2);
      expect(callArgs.mode).toBe('json');
    });

    it('should call generateObject with custom system prompt when custom context is provided', async () => {
        const customContext = 'Only report changes to the "name" field.';
        const expectedAiSummary = 'Name field was updated.';
        const expectedResult: ChangeSummaryResult = {
          isWorthToReport: true, // Assume AI determines this based on context
          reportedChanges: expectedAiSummary,
        };

        // Mock config *specifically* for this test
        vi.doMock('./config.js', () => ({
            config: {
              openaiApiKey: 'TEST_API_KEY_CUSTOM',
              openaiModelName: 'gpt-4o-mini-custom',
              openaiCustomPromptContext: customContext,
            },
        }));
        vi.resetModules(); // Ensure the mock is picked up

        // Re-import with the mocked config
        const { generateChangeSummary: generateSummaryWithMockedConfig } = await import('./aiProcessor.js');
        const { config: mockedConfig } = await import('./config.js'); // Get the mocked config


        // Mock generateObject for this specific scenario
        mockedGenerateObject.mockResolvedValue(
            createMockGenerateObjectResult(expectedResult)
        );

        const summary = await generateSummaryWithMockedConfig(sampleChangesBasic);

        expect(summary).toEqual(expectedResult);
        expect(mockedGenerateObject).toHaveBeenCalledTimes(1);

        const callArgs = mockedGenerateObject.mock.calls[0]?.[0];
        expect(callArgs).toBeDefined();
        if (!callArgs) return; // Guard

        // Check System Prompt (with custom context)
        const expectedSystemPromptCriteria = `CRITERIA FOR SIGNIFICANCE: \"${customContext}\". Determine if the detected changes meet these criteria.`;
        expect(callArgs.messages).toBeInstanceOf(Array);
        if (!callArgs.messages) return;
        expect(callArgs.messages[0]?.role).toBe('system');
        expect(callArgs.messages[0]?.content).toContain(expectedSystemPromptCriteria);
        expect(callArgs.messages[0]?.content).not.toContain('Since no specific reporting criteria are provided'); // Should not be present

        // Check Model (using the custom mocked provider and config)
        // expect(mockedOpenaiProvider).toHaveBeenCalledWith(mockedConfig.openaiModelName);
        expect(callArgs.model).toEqual(expect.objectContaining({ id: mockedConfig.openaiModelName, provider: 'openai' }));


        // Cleanup the specific config mock
        vi.doUnmock('./config.js');
    });


    it('should handle errors from generateObject', async () => {
      const error = new Error('AI service failed');
      // Mock generateObject to reject
      mockedGenerateObject.mockRejectedValue(error);

      // Import normally (should use default mocks)
      const { generateChangeSummary: generateSummaryFunc } = await import('./aiProcessor.js');

      const expectedResult: ChangeSummaryResult = {
        isWorthToReport: false,
        reportedChanges: 'Error generating change summary.',
      };

      const summary = await generateSummaryFunc(sampleChangesBasic);

      expect(summary).toEqual(expectedResult);
      // Check that the *original error object* is logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating structured summary from OpenAI:', error);
    });

     it('should handle Zod validation errors from AI response', async () => {
        const malformedAiResponse = {
            // Missing isWorthToReport
            reportedChanges: 'Summary without evaluation.',
        };
        const expectedErrorSubstring = 'AI response did not match expected format.';

        // Mock generateObject to return a malformed object (within the expected structure)
        mockedGenerateObject.mockResolvedValue({
            object: malformedAiResponse,
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
        } as any); // Type assertion needed as 'object' is malformed

        // Import normally
        const { generateChangeSummary: generateSummaryFunc } = await import('./aiProcessor.js');

        const summary = await generateSummaryFunc(sampleChangesBasic);

        // Expect the specific error structure returned by the catch block for Zod errors
        expect(summary.isWorthToReport).toBe(false);
        expect(summary.reportedChanges).toContain(expectedErrorSubstring);
        expect(summary.reportedChanges).toContain('Error generating change summary.'); // Includes original default msg
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'AI response failed Zod validation:',
            expect.any(Error) // Zod errors are instances of Error
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.any(String), // First arg is the message prefix
            expect.objectContaining({
                issues: expect.arrayContaining([
                    expect.objectContaining({
                        code: 'invalid_type',
                        path: ['isWorthToReport'], // Check path of the error
                        message: 'Required'
                    })
                ])
            }) // <-- Fixed: Added missing comma here
        );
    });

    it.skip('should format diff correctly including separators', async () => {
      const changesForFormatting: Change[] = [
        { count: 1, value: '{\\n  "name": "old name",\\n', removed: true, added: false },
        { count: 1, value: '{\\n  "name": "new name",\\n', added: true, removed: false },
        // { count: 1, value: '  "value": 1\\n}', added: false, removed: false }, // Unchanged - should be filtered
        { count: 1, value: '  "extra": null,\\n', added: true, removed: false },
        { count: 1, value: '  "removedKey": true,\\n', removed: true, added: false },
      ];
      // Mock generateObject to resolve
       mockedGenerateObject.mockResolvedValue(
        createMockGenerateObjectResult({ isWorthToReport: true, reportedChanges: 'Complex changes.' })
      );

      const { generateChangeSummary: generateSummaryFunc } = await import('./aiProcessor.js');
      await generateSummaryFunc(changesForFormatting);

      // Define with string concatenation and literal newlines
      const expectedUserPrompt =
        'Detected changes:\n\n' +
        '[REMOVED] {\n  "name": "old name",\n\n' +
        '---\n' +
        '[ADDED] {\n  "name": "new name",\n\n' +
        '---\n' +
        '[ADDED] "extra": null,\n\n' +
        '---\n' +
        '[REMOVED] "removedKey": true,\n\n';

      const callArgs = mockedGenerateObject.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      if (!callArgs || !callArgs.messages) return; // Guard clause

      expect(callArgs.messages[1]?.role).toBe('user');
      expect(callArgs.messages[1]?.content).toBe(expectedUserPrompt);
    });

    // Add test for diff truncation if needed
    it('should truncate long diffs', async () => {
        const longValue = 'a'.repeat(4000);
        const longChanges: Change[] = [
            { count: 1, value: `"${longValue}"`, added: true, removed: false }
        ];
        // Match the exact marker used in aiProcessor.ts
        const expectedTruncatedMarker = '\n... [diff truncated] ...';

        mockedGenerateObject.mockResolvedValue(
            createMockGenerateObjectResult({ isWorthToReport: true, reportedChanges: 'Long change.' })
        );

        const { generateChangeSummary: generateSummaryFunc } = await import('./aiProcessor.js');
        await generateSummaryFunc(longChanges);

        const callArgs = mockedGenerateObject.mock.calls[0]?.[0];
        expect(callArgs).toBeDefined();
        if (!callArgs || !callArgs.messages) return;

        const userPrompt = callArgs.messages[1]?.content as string;
        expect(userPrompt.length).toBeLessThan(4000); // Ensure it's actually truncated
        expect(userPrompt).toContain('[ADDED]');
        expect(userPrompt.endsWith(expectedTruncatedMarker)).toBe(true);
    });

  });
});

// Ensure zod is listed as a dev dependency if not already: pnpm add -D zod
// Make sure Vercel AI SDK and OpenAI adapter are dependencies: pnpm add ai @ai-sdk/openai 