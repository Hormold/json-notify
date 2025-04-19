import { openai } from '@ai-sdk/openai'; // Use the Vercel AI SDK adapter
import { CoreMessage, generateText } from 'ai';
import { type Change } from 'diff';
import { config } from './config.js';

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
 * Generates a summary of JSON changes using OpenAI.
 * @param changes The diff changes detected.
 * @returns A string containing the AI-generated summary.
 */
export async function generateChangeSummary(changes: Change[]): Promise<string> {
  if (!changes || changes.length === 0) {
    return 'No changes detected.';
  }

  const formattedDiff = formatDiffForAI(changes);
  const maxDiffLength = 3000; // Limit context sent to AI
  const truncatedDiff = formattedDiff.length > maxDiffLength
      ? formattedDiff.substring(0, maxDiffLength) + '\n... [diff truncated] ...'
      : formattedDiff;

  console.log('Generating summary for changes...');

  const baseSystemPrompt = `You are an assistant that summarizes changes detected in a JSON object. Provide a concise, human-readable summary of the differences presented below. Focus on the key changes. The diff format shows [ADDED] sections for new content and [REMOVED] sections for deleted content. Respond only with the summary.`;

  // Append custom context if provided
  const customContext = config.openaiCustomPromptContext;
  const systemPrompt = customContext
    ? `${baseSystemPrompt}\n\nAdditional Instructions: ${customContext}`
    : baseSystemPrompt;

  /* v8 ignore next */ // Ignoring console log for coverage
  console.log(`Using System Prompt:\n${systemPrompt}`); // Log the final prompt for debugging

  const messages: CoreMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: truncatedDiff },
  ];

  try {
    const { text } = await generateText({
      model: openai(config.openaiModelName as any), // Use model name from config
      messages,
      temperature: 0.3, // Lower temperature for more deterministic summary
    });
    console.log('Successfully generated summary from AI.');
    return text;
  } catch (error) {
    console.error('Error generating summary from OpenAI:', error);
    // Fallback or re-throw based on requirements
    return 'Error generating change summary.';
  }
} 