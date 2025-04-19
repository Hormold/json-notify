import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readLastState, writeState } from './storage.js';
import * as configModule from './config.js'; // Import like this for mocking
import fs from 'fs/promises';
import path from 'path';

// --- Mocks ---

// Define the path here, but use it *inside* the mock factory
const MOCK_STATE_FILE_PATH = '/tmp/test-lastState.json';

vi.mock('./config.js', () => ({
  config: {
    // Use the actual value directly in the factory
    stateFilePath: '/tmp/test-lastState.json',
    // Other config values aren't needed by storage.ts
  },
}));

// Mock fs/promises, providing a default export
vi.mock('fs/promises', () => ({
  // Add the default export containing the mocks
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
  },
  // Also export named functions if needed by other imports (not strictly necessary here, but good practice)
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
}));

// --- Test Suite ---

describe('storage', () => {
  // Access mocks via the default export
  const mockedReadFile = vi.mocked(fs.readFile);
  const mockedWriteFile = vi.mocked(fs.writeFile);
  const mockedAccess = vi.mocked(fs.access);
  const mockedMkdir = vi.mocked(fs.mkdir);

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Assume directory exists by default
    mockedAccess.mockResolvedValue(undefined);
  });

  describe('readLastState', () => {
    it('should read and parse the state file if it exists', async () => {
      const mockData = { key: 'value', count: 123 };
      const mockJsonString = JSON.stringify(mockData);
      mockedReadFile.mockResolvedValue(mockJsonString);

      const state = await readLastState<typeof mockData>();

      expect(mockedAccess).toHaveBeenCalledWith(path.dirname(MOCK_STATE_FILE_PATH));
      expect(mockedReadFile).toHaveBeenCalledWith(MOCK_STATE_FILE_PATH, 'utf-8');
      expect(state).toEqual(mockData);
      expect(mockedMkdir).not.toHaveBeenCalled();
    });

    it('should return null if the state file does not exist (ENOENT)', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockedReadFile.mockRejectedValue(error);

      const state = await readLastState();

      expect(mockedAccess).toHaveBeenCalledWith(path.dirname(MOCK_STATE_FILE_PATH));
      expect(mockedReadFile).toHaveBeenCalledWith(MOCK_STATE_FILE_PATH, 'utf-8');
      expect(state).toBeNull();
      expect(mockedMkdir).not.toHaveBeenCalled(); // mkdir called by ensureStateDirectoryExists
    });

    it('should create the directory if it does not exist', async () => {
      const dirError = new Error('Dir not found') as NodeJS.ErrnoException;
      dirError.code = 'ENOENT';
      mockedAccess.mockRejectedValue(dirError);

      // Simulate file not existing as well to test full ensure path
      const fileError = new Error('File not found') as NodeJS.ErrnoException;
      fileError.code = 'ENOENT';
      mockedReadFile.mockRejectedValue(fileError);

      await readLastState();

      expect(mockedAccess).toHaveBeenCalledWith(path.dirname(MOCK_STATE_FILE_PATH));
      expect(mockedMkdir).toHaveBeenCalledWith(path.dirname(MOCK_STATE_FILE_PATH), { recursive: true });
      expect(mockedReadFile).toHaveBeenCalledWith(MOCK_STATE_FILE_PATH, 'utf-8');
    });

    it('should re-throw other readFile errors', async () => {
      const error = new Error('Read permission denied');
      mockedReadFile.mockRejectedValue(error);

      await expect(readLastState()).rejects.toThrow('Read permission denied');
      expect(mockedAccess).toHaveBeenCalled();
      expect(mockedReadFile).toHaveBeenCalled();
      expect(mockedMkdir).not.toHaveBeenCalled();
    });

     it('should re-throw other access errors', async () => {
      const error = new Error('Access permission denied');
      mockedAccess.mockRejectedValue(error);

      // We expect the error from access to propagate
      await expect(readLastState()).rejects.toThrow('Access permission denied');
      expect(mockedAccess).toHaveBeenCalled();
      expect(mockedMkdir).not.toHaveBeenCalled();
      expect(mockedReadFile).not.toHaveBeenCalled();
    });
  });

  describe('writeState', () => {
    it('should stringify and write the state to the file', async () => {
      const stateToWrite = { success: true, data: [1, 2] };
      const expectedJsonString = JSON.stringify(stateToWrite, null, 2);

      await writeState(stateToWrite);

      expect(mockedAccess).toHaveBeenCalledWith(path.dirname(MOCK_STATE_FILE_PATH));
      expect(mockedWriteFile).toHaveBeenCalledWith(
        MOCK_STATE_FILE_PATH,
        expectedJsonString,
        'utf-8'
      );
      expect(mockedMkdir).not.toHaveBeenCalled();
    });

    it('should create the directory if it does not exist before writing', async () => {
       const dirError = new Error('Dir not found') as NodeJS.ErrnoException;
      dirError.code = 'ENOENT';
      mockedAccess.mockRejectedValue(dirError);

      const stateToWrite = { id: 'test' };
      await writeState(stateToWrite);

      expect(mockedAccess).toHaveBeenCalledWith(path.dirname(MOCK_STATE_FILE_PATH));
      expect(mockedMkdir).toHaveBeenCalledWith(path.dirname(MOCK_STATE_FILE_PATH), { recursive: true });
      expect(mockedWriteFile).toHaveBeenCalled();
    });

    it('should re-throw writeFile errors', async () => {
      const error = new Error('Write permission denied');
      mockedWriteFile.mockRejectedValue(error);
      const stateToWrite = { error: 'test' };

      await expect(writeState(stateToWrite)).rejects.toThrow('Write permission denied');
      expect(mockedAccess).toHaveBeenCalled();
      expect(mockedWriteFile).toHaveBeenCalled();
      expect(mockedMkdir).not.toHaveBeenCalled();
    });

      it('should re-throw other access errors during write', async () => {
      const error = new Error('Access permission denied');
      mockedAccess.mockRejectedValue(error);

      const stateToWrite = { error: 'test' };
      await expect(writeState(stateToWrite)).rejects.toThrow('Access permission denied');
      expect(mockedAccess).toHaveBeenCalled();
      expect(mockedMkdir).not.toHaveBeenCalled();
      expect(mockedWriteFile).not.toHaveBeenCalled();
    });
  });
}); 