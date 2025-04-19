import { openai } from '@ai-sdk/openai'; // Use the Vercel AI SDK adapter
import { CoreMessage, generateObject } from 'ai';
import { z } from 'zod'; // Added import for zod
import { type Change } from 'diff';
import { config } from './config.js';

// Zod schema for the expected AI output
const ChangeSummarySchema = z.object({
  isWorthToReport: z
    .boolean()
    .describe(
      'Whether the detected changes are significant enough to report based on the provided criteria (or always true if no criteria were provided).',
    ),
  reportedChanges: z
    .string()
    .describe(
      'A concise, human-readable summary of the key changes detected. This should be provided even if isWorthToReport is false.',
    ),
});

// Define the type for the return value based on the Zod schema
export type ChangeSummaryResult = z.infer<typeof ChangeSummarySchema>;

// Function to format the diff Change[] array into a readable string
function formatDiffForAI(changes: Change[]): string {
  let diffString = 'Detected changes:\n\n';
  const filteredChanges = changes.filter((part) => part.added || part.removed);

  filteredChanges.forEach((part, index) => {
    const prefix = part.added ? '[ADDED]' : '[REMOVED]';
    const content = part.value.trim(); // Use the trimmed raw value directly

    // Simple concatenation
    diffString += `${prefix} ${content}\n`;

    if (index < filteredChanges.length - 1) {
      diffString += '---\n'; // Separator between changes
    }
  });
  return diffString;
}

/**
 * Generates a summary of JSON changes and evaluates their significance using OpenAI.
 * @param changes The diff changes detected.
 * @returns An object containing the evaluation and the AI-generated summary.
 */
export async function generateChangeSummary(
  changes: Change[],
): Promise<ChangeSummaryResult> { // Updated return type
  // Define default results for error and no changes scenarios
  const defaultErrorResult: ChangeSummaryResult = {
    isWorthToReport: false, // Default to false on error
    reportedChanges: 'Error generating change summary.',
  };
  const defaultNoChangesResult: ChangeSummaryResult = {
    isWorthToReport: false, // No changes means nothing significant to report
    reportedChanges: 'No changes detected.',
  };

  // Filter out changes that are neither added nor removed before checking length
  const actualChanges = changes.filter(c => c.added || c.removed);
  if (!actualChanges || actualChanges.length === 0) {
    return defaultNoChangesResult;
  }

  // Use the filtered list for formatting
  const formattedDiff = formatDiffForAI(actualChanges);
  const maxDiffLength = 3000; // Limit context sent to AI (consider GPT-4.1's larger context if applicable/needed)
  const truncatedDiff =
    formattedDiff.length > maxDiffLength
      ? formattedDiff.substring(0, maxDiffLength) + '\n... [diff truncated] ...'
      : formattedDiff;

  console.log('Generating summary and evaluating changes...'); // Updated log message

  const customContext = config.openaiCustomPromptContext;

  // Updated System Prompt incorporating evaluation logic and output structure
  const systemPrompt = `You are an assistant analyzing changes detected in a JSON object. Your goal is to provide a concise, human-readable summary of these changes and decide if they are significant enough to report based on specific criteria if provided.

Input Diff Format:
The diff shows changes using [ADDED] for new content and [REMOVED] for deleted content. Sections are separated by '---'.

Tasks:
1.  Analyze the provided diff carefully.
2.  Generate a concise, human-readable summary focusing on the key changes (\`reportedChanges\`). Ensure this summary is clear and informative.
3.  Evaluate if the changes are significant enough to warrant reporting (\`isWorthToReport\`).
    ${
      customContext
        ? `CRITERIA FOR SIGNIFICANCE: "${customContext}". Determine if the detected changes meet these criteria. If they do, set \`isWorthToReport\` to true. If they do not, set it to false.`
        : `Since no specific reporting criteria are provided, consider ANY detected changes significant enough to report. Set \`isWorthToReport\` to true.`
    }

Output Format:
Respond ONLY with a valid JSON object matching this schema:
{
  "isWorthToReport": boolean, // True if changes are significant based on criteria (or always true if no criteria), false otherwise.
  "reportedChanges": string  // The concise summary of changes. Provide this summary EVEN IF isWorthToReport is false.
}
Do not include any other text, explanations, or markdown formatting outside the JSON object.`;


  /* v8 ignore next */ // Ignoring console log for coverage
  console.log(`Using System Prompt:\n${systemPrompt}`); // Log the final prompt for debugging

  const messages: CoreMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: truncatedDiff },
  ];

  try {
    // Use generateObject with the Zod schema
    const { object } = await generateObject({ // Changed from generateText
      model: openai(config.openaiModelName as any), // Use model name from config
      schema: ChangeSummarySchema, // Provide the Zod schema
      messages,
      temperature: 0.2, // Lower temperature for more deterministic summary and evaluation
      mode: 'json', // Explicitly request JSON mode
    });
    console.log('Successfully generated structured summary from AI.'); // Updated log message

    // Validate the result just in case, though generateObject should handle schema compliance
    const parsedResult = ChangeSummarySchema.safeParse(object);
    if (parsedResult.success) {
        // Additional check: if the input diff was non-empty but the AI generated an empty summary,
        // and there's no custom context, should isWorthToReport be false?
        // Current prompt logic says always true if no custom context and diff exists.
        // Let's stick to the prompt for now unless specific behavior is desired.
      return parsedResult.data;
    } else {
      console.error('AI response failed Zod validation:', parsedResult.error);
      // Return a more informative error message within the structure
       return {
        ...defaultErrorResult,
        reportedChanges: `Error: AI response did not match expected format. Details: ${parsedResult.error.message}. ${defaultErrorResult.reportedChanges}`
       } ;
    }
  } catch (error) {
    console.error('Error generating structured summary from OpenAI:', error);
    // Fallback or re-throw based on requirements
    return defaultErrorResult; // Return default error object
  }
}

// Ensure you have zod installed: pnpm add zod 