import { config } from './config.js';

// Define a generic type for the expected JSON structure if known,
// otherwise use `unknown` or `any` (use with caution).
// type ExpectedJsonType = { /* ... structure ... */ };
type ExpectedJsonType = unknown;

export async function fetchJsonData(): Promise<ExpectedJsonType> {
  console.log(`Fetching JSON data from ${config.jsonUrl}...`);
  try {
    // Using native fetch available in Node.js >= 18
    const response = await fetch(config.jsonUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch JSON: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as ExpectedJsonType;
    console.log('Successfully fetched JSON data.');
    return data;
  } catch (error) {
    console.error(`Error fetching JSON data from ${config.jsonUrl}:`, error);
    // Depending on requirements, you might want to retry or handle specific errors
    throw error; // Re-throw the error to be handled by the caller
  }
} 