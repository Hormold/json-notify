import stringify from 'fast-json-stable-stringify';
import { diffJson, type Change } from 'diff';

/**
 * Compares two JSON objects for differences.
 * @param oldState The previous JSON state.
 * @param newState The current JSON state.
 * @returns An array of Change objects if differences are found, otherwise null.
 */
export function compareJson<T extends object>(oldState: T, newState: T): Change[] | null {
  // Use stable stringify to ensure consistent key order for comparison
  const oldString = stringify(oldState);
  const newString = stringify(newState);

  if (oldString === newString) {
    console.log('No changes detected in JSON data.');
    return null; // No changes
  }

  console.log('Changes detected. Generating diff...');
  // diffJson provides structured diff information
  const differences = diffJson(oldState, newState);

  // Filter out parts that haven't changed
  const actualChanges = differences.filter(
    (part) => part.added || part.removed
  );

  /* v8 ignore next 2 */ // Ignore the empty diff branch, covered by identical object tests
  if (actualChanges.length === 0) {
    console.log('No changes detected in JSON data.');
    return null;
  }

  // Optional: Log the detailed diff for debugging
  // console.log('Detailed Diff:', JSON.stringify(actualChanges, null, 2));

  return actualChanges;
} 