import schedule from 'node-schedule';
import { config } from './config.js';
import { readLastState, writeState } from './storage.js';
import { fetchJsonData } from './fetcher.js';
import { compareJson } from './comparer.js';
import { generateChangeSummary } from './aiProcessor.js';
import { sendTelegramNotification, escapeMarkdownV2 } from './notifier.js';

// Define a type for the state, assuming it's an object
type JsonState = object;

let isJobRunning = false; // Simple lock to prevent concurrent runs

/**
 * The main function to check for JSON updates.
 */
async function checkJsonUpdates() {
  if (isJobRunning) {
    console.log('Previous check is still running. Skipping this run.');
    return;
  }
  isJobRunning = true;
  console.log(`\n[${new Date().toISOString()}] Running JSON update check...`);

  try {
    // 1. Fetch current JSON data
    const currentState = (await fetchJsonData()) as JsonState;
    if (typeof currentState !== 'object' || currentState === null) {
        throw new Error('Fetched data is not a valid JSON object.');
    }

    // 2. Read the last known state
    const lastState = await readLastState<JsonState>();

    // 3. Compare states
    if (lastState === null) {
      console.log('No previous state found. Storing current state.');
      await writeState(currentState);
    } else {
      const changes = compareJson(lastState, currentState);

      if (changes) {
        console.log('Changes detected!');

        // 4. Generate summary using AI (if changes detected)
        const summary = await generateChangeSummary(changes);

        // 5. Send notification
        const escapedSummary = escapeMarkdownV2(summary);
        const notificationMessage = `*JSON Update Detected*\n\n${escapedSummary}`;
        await sendTelegramNotification(notificationMessage);

        // 6. Update the state file
        await writeState(currentState);
      } else {
        console.log('No significant changes found.');
      }
    }
  } catch (error) {
    console.error('Error during JSON update check:', error);
    // Optionally send an error notification
    // await sendTelegramNotification(`*Error checking JSON updates*\n\n${escapeMarkdownV2(String(error))}`);
  } finally {
    isJobRunning = false;
    console.log('JSON update check finished.');
  }
}

/**
 * Initializes the application.
 */
async function main() {
  console.log('Starting JSON Notifier...');

  // Perform an initial check immediately on startup
  await checkJsonUpdates();

  // Schedule the job based on the cron interval from config
  console.log(`Scheduling check with interval: ${config.checkIntervalCron}`);
  const job = schedule.scheduleJob(config.checkIntervalCron, () => {
    checkJsonUpdates();
  });

  console.log(
    `Scheduler started. Next run at: ${job.nextInvocation()?.toISOString() ?? 'N/A'}`
  );

  // Keep the process running
  process.on('SIGINT', () => {
    console.log('\nGracefully shutting down scheduler...');
    schedule.gracefulShutdown().then(() => process.exit(0));
  });
}

// Run the main function
main().catch((err) => {
  console.error('Unhandled error during initialization:', err);
  process.exit(1);
}); 