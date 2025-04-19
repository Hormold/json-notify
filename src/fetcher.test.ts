import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define mockUrl for reference in tests
const mockUrl = 'http://fake.url/data.json';

// Mock config before importing fetcher
// Hardcode the URL again to avoid hoisting issues
vi.mock('./config.js', () => ({
  config: {
    jsonUrl: 'http://fake.url/data.json', // Hardcoded URL
  },
}));

// --- Mock global fetch ---
const mockFetch = vi.fn();
// Stub will happen in beforeEach
// -------------------------

// Import the function to test AFTER mocks are set up
import { fetchJsonData } from './fetcher.js';

describe('fetchJsonData', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // No need to resetModules if config mock is static (hardcoded)
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // Test cases using mockUrl variable for clarity in assertions
  it('should fetch and return JSON data successfully', async () => {
    const mockData = { key: 'value', count: 1 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
      status: 200,
      statusText: 'OK',
    });
    const data = await fetchJsonData();
    expect(data).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(mockUrl); // Check against variable
    expect(consoleLogSpy).toHaveBeenCalledWith(`Fetching JSON data from ${mockUrl}...`);
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully fetched JSON data.');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should throw an error if the fetch response is not ok', async () => {
    const status = 404;
    const statusText = 'Not Found';
    const mockResponse = { ok: false, json: async () => ({}), status, statusText };
    mockFetch.mockResolvedValueOnce(mockResponse);
    const internalError = new Error(`Failed to fetch JSON: ${status} ${statusText}`);
    await expect(fetchJsonData()).rejects.toThrow(internalError.message);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Error fetching JSON data from ${mockUrl}:`,
      expect.objectContaining({ message: internalError.message })
    );
    expect(mockFetch).toHaveBeenCalledWith(mockUrl);
  });

  it('should throw an error if fetch itself fails (network error)', async () => {
    // Match the error type stubGlobal seems to produce on rejection
    const networkError = new TypeError('fetch failed');
    mockFetch.mockRejectedValueOnce(networkError);
    await expect(fetchJsonData()).rejects.toThrow(networkError.message);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Error fetching JSON data from ${mockUrl}:`,
      expect.objectContaining({ message: networkError.message })
    );
     expect(mockFetch).toHaveBeenCalledWith(mockUrl);
  });

  it('should throw an error if response.json() fails', async () => {
    const jsonError = new SyntaxError('Unexpected token < in JSON at position 0');
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockRejectedValueOnce(jsonError),
        status: 200,
        statusText: 'OK'
    });
    await expect(fetchJsonData()).rejects.toThrow(jsonError.message);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Error fetching JSON data from ${mockUrl}:`,
      expect.objectContaining({ message: jsonError.message })
    );
     expect(mockFetch).toHaveBeenCalledWith(mockUrl);
  });
}); 