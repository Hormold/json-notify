import schedule from 'node-schedule';
import { config } from './config.js';
import { readLastState, writeState } from './storage.js';
import { fetchJsonData } from './fetcher.js';
import { compareJson } from './comparer.js';
import { generateChangeSummary, type ChangeSummaryResult } from './aiProcessor.js';
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

      // Ensure changes array exists and has content before calling AI
      const actualChanges = changes ? changes.filter(c => c.added || c.removed) : [];

      if (actualChanges.length > 0) {
        console.log('Changes detected! Requesting summary and evaluation from AI...');

        // 4. Generate summary using AI
        const aiResult: ChangeSummaryResult = await generateChangeSummary(actualChanges);

        // 5. Send notification ONLY if AI deems it worth reporting
        if (aiResult.isWorthToReport) {
          console.log('AI determined changes are worth reporting. Sending notification...');
          // Use the reportedChanges string from the AI result for the notification
          const escapedSummary = escapeMarkdownV2(aiResult.reportedChanges);
          const notificationMessage = `*JSON Update Detected*\n\n${escapedSummary}`;
          await sendTelegramNotification(notificationMessage);
        } else {
          // Log why notification wasn't sent
          console.log('AI determined changes are NOT significant enough to report based on criteria, or the summary was empty. Notification skipped.');
        }

        // 6. Update the state file - always update if compareJson found differences
        await writeState(currentState);
      } else {
        console.log('No significant changes found after comparison.');
      }
    }
  } catch (error) {
    console.error('Error during JSON update check:', error);
    // Optionally send an error notification with better formatting
    try {
      const errorMessage = String(error instanceof Error ? error.stack || error.message : error);
      // Escape sparingly for code block
      const escapedError = escapeMarkdownV2(errorMessage.substring(0, 500)); // Limit length
      await sendTelegramNotification(`*Error checking JSON updates*:\n\`\`\`\n${escapedError}${errorMessage.length > 500 ? '...[truncated]' : ''}
\`\`\``);
    } catch (notifyError) {
      console.error("Failed to send error notification:", notifyError);
    }
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

  // Send startup notification if enabled
  if (config.telegramNotifyOnStart) {
    try {
      const customPromptSet = config.openaiCustomPromptContext ? 'Yes' : 'No';
      const startupMessage = 
`*JSON Notifier Started*\n
*Monitoring:* ${escapeMarkdownV2(config.jsonUrl)}
*Schedule:* \`${escapeMarkdownV2(config.checkIntervalCron)}\`
*AI Model:* \`${escapeMarkdownV2(config.openaiModelName)}\`
*Custom Prompt:* ${customPromptSet}`;

      await sendTelegramNotification(startupMessage);
      console.log('Startup notification sent to Telegram.');
    } catch (error) {
      console.error('Failed to send startup notification:', error);
    }
  }

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