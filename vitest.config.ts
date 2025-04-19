import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Optional: Use Vitest globals like describe, it, expect
    environment: 'node', // Specify the test environment
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html', 'lcov'], // Output formats
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.config.js', // Exclude config files by pattern
        '**/*.config.ts',
        '**/src/config.ts', // Explicitly exclude src/config.ts
        '**/coverage/**',
        '**/.{git,cache,temp}/**',
        '**/.eslintrc.cjs',
        '**/types.ts', // Exclude type definitions if any
        // 'src/notifier.test.ts', // Re-enable notifier tests
        // Add other patterns to exclude if needed
      ],
      all: true, // Include all files in the report, even those without tests
      include: ['src/**/*.ts'], // Specify files to include for coverage calculation
      thresholds: { // Optional: Enforce coverage thresholds
        lines: 0, // Start with 0, we'll increase this
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
}); 