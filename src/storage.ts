import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js'; // Use .js extension for ESM

// Ensure the directory for the state file exists
async function ensureStateDirectoryExists() {
  const dir = path.dirname(config.stateFilePath);
  try {
    await fs.access(dir);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(`Creating directory for state file: ${dir}`);
      await fs.mkdir(dir, { recursive: true });
    } else {
      throw error; // Re-throw unexpected errors
    }
  }
}

export async function readLastState<T>(): Promise<T | null> {
  try {
    await ensureStateDirectoryExists();
    const data = await fs.readFile(config.stateFilePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('State file not found, assuming first run.');
      return null; // File doesn't exist, return null
    } else {
      console.error(`Error reading state file ${config.stateFilePath}:`, error);
      throw error; // Re-throw other errors
    }
  }
}

export async function writeState<T>(state: T): Promise<void> {
  try {
    await ensureStateDirectoryExists();
    const data = JSON.stringify(state, null, 2); // Pretty print for readability
    await fs.writeFile(config.stateFilePath, data, 'utf-8');
    console.log(`State successfully written to ${config.stateFilePath}`);
  } catch (error) {
    console.error(`Error writing state file ${config.stateFilePath}:`, error);
    throw error;
  }
} 