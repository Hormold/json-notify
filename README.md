# JSON Change Notifier & AI Summarizer

Automated monitoring of JSON endpoints with AI-powered change summaries and Telegram notifications. Built with Node.js, TypeScript, and Docker support.

## Features

*   **JSON Monitoring:** Periodically fetches JSON data from any specified public URL.
*   **Change Detection:** Intelligently compares fetched data against the last known state to identify differences.
*   **AI Summarization:** Leverages OpenAI (via Vercel AI SDK) to generate concise, human-readable summaries of detected changes.
*   **Telegram Notifications:** Delivers change summaries directly to your specified Telegram chat.
*   **Configurable Interval:** Uses standard cron syntax for flexible scheduling of checks.
*   **Custom AI Prompts:** Allows adding custom instructions to the AI summarization prompt via environment variables.
*   **State Persistence:** Stores the last known JSON state locally (configurable path).
*   **Dockerized:** Includes a multi-stage `Dockerfile` for easy deployment and containerization.

## Use Cases

This tool can be adapted for various monitoring scenarios:

1.  **API Endpoint Monitoring:** Track changes in public API responses (e.g., feature flags, status endpoints, product catalogs).
2.  **Price Tracking:** Monitor JSON feeds from e-commerce sites for price drops or availability changes.
3.  **Configuration File Monitoring:** Watch for changes in remotely hosted JSON configuration files.
4.  **Data Feed Updates:** Get notified about updates in public datasets or data feeds provided in JSON format.
5.  **Service Status Changes:** Monitor status pages that expose their state via JSON.
6.  **Release Notes Monitoring:** Track updates to release notes or changelogs published as JSON.
7.  **Cryptocurrency/Stock Data:** Monitor simple JSON APIs providing market data (note: consider rate limits and complexity for financial data).
8.  **Event Schedules:** Keep track of updates to event schedules or calendars available as JSON.
9.  **Government Data Portals:** Monitor specific datasets on open data portals that offer JSON endpoints.
10. **Competitor Monitoring:** Track changes on competitor websites if specific data points are exposed via a JSON structure (use responsibly).

## Setup

1.  Clone the repository (if you haven't already).
2.  Install dependencies: `pnpm install`
3.  Create a `.env` file by copying `.env.example`:
    ```bash
    cp .env.example .env
    ```
4.  Edit the `.env` file and fill in your specific details (see Configuration section below).
5.  Run in development mode (with hot-reloading): `pnpm dev`
6.  Build for production: `pnpm build`
7.  Run the production build: `pnpm start`

## Running with Docker

1.  **Build the Docker image:**
    ```bash
    docker build -t json-notifier .
    ```
2.  **Run the Docker container:**
    Pass environment variables using the `--env-file` flag:
    ```bash
    docker run --rm --name json-monitor --env-file .env json-notifier
    ```
    *Note:* Ensure your `.env` file is correctly populated before running.

3.  **Persistence (Storing State Outside the Container):**
    By default, the `lastState.json` file is stored inside the container and will be lost when the container stops. To persist the state:
    *   **Mount a volume:** Create a directory on your host machine (e.g., `./data`) and mount it into the container.
    *   **Set `STATE_FILE_PATH`:** Update the `STATE_FILE_PATH` in your `.env` file to point to a location *inside the container's mounted volume* (e.g., `/app/data/lastState.json`).

    Example:
    a.  Create a host directory: `mkdir data`
    b.  Set `STATE_FILE_PATH=/app/data/lastState.json` in your `.env` file.
    c.  Run the container with the volume mount:
        ```bash
        docker run --rm --name json-monitor --env-file .env -v "$(pwd)/data:/app/data" json-notifier
        ```
    Now, the `lastState.json` file will be saved in the `./data` directory on your host machine.

## Configuration

Configuration is managed via environment variables defined in the `.env` file:

*   `JSON_URL` (Required): The full URL of the JSON endpoint to monitor.
*   `OPENAI_API_KEY` (Required): Your API key from OpenAI (https://platform.openai.com/api-keys).
*   `TELEGRAM_BOT_TOKEN` (Required): The token for your Telegram bot (obtained from BotFather).
*   `TELEGRAM_CHAT_ID` (Required): The ID of the Telegram chat where notifications should be sent (you can get this from bots like `@userinfobot`).
*   `CHECK_INTERVAL_CRON` (Required): Cron string specifying how often to check for updates (e.g., `'0 * * * *'` for every hour at minute 0). See [crontab.guru](https://crontab.guru/) for help.
*   `OPENAI_MODEL_NAME` (Optional): The specific OpenAI model to use for summarization (e.g., `gpt-4`, `gpt-3.5-turbo`, `gpt-4o`). Defaults to `gpt-4o-mini` if not set.
*   `STATE_FILE_PATH` (Optional): **Path inside the application environment (container or host) where the last known JSON state should be stored.** Defaults to `./lastState.json` relative to the project root if run directly, or `/app/lastState.json` inside the default Docker setup. **Crucial for Docker persistence - set this to a path within your mounted volume (e.g., `/app/data/lastState.json`) if using one.**
*   `OPENAI_CUSTOM_PROMPT_CONTEXT` (Optional): Additional text to append to the system prompt sent to OpenAI for customizing the summary generation.
*   `TELEGRAM_NOTIFY_ON_START` (Optional): Set to `true` to send a notification to the specified Telegram chat when the application starts or restarts. Defaults to `false`.

## Credits

*   **Concept & Idea:** [hormold](https://github.com/hormold)
*   **Initial Implementation:** AI Assistant (Gemini)

## Contributions

Contributions are welcome! Please feel free to submit issues or pull requests.

## Help Wanted: CLI Configuration Utility

We are looking for contributors to add a new feature: a command-line utility for interactive monitoring setup.

**Functionality:**

1.  **Launch:** The utility is launched from the command line, accepting a URL or path to a local JSON file.
2.  **Display JSON:** Shows the user the structure of the fetched JSON.
3.  **Path Selection:** Interactively asks the user which fields or parts of the JSON object need to be monitored. The user should be able to specify the path to the desired element (e.g., `data.items[2].price`). The ability to select multiple paths is a plus.
4.  **Save Configuration:** Saves the selected paths to a configuration file (or outputs them to be added to `.env`), which will be used by the main monitoring script.
5.  **Update Monitoring Logic:** The main script (`src/index.ts`) needs to be modified to use this configuration. Instead of comparing the entire JSON, it should check for changes only at the specified paths.

**Goal:** To make the monitoring setup more flexible and allow users to track changes in specific values within large JSON files, rather than just detecting changes in the entire file.

If you are interested in implementing this feature, please create an Issue or Pull Request!

*Keywords: json monitor, change detection, api monitoring, data tracking, ai summary, openai, telegram bot, notification, nodejs, typescript, docker, automation, scheduler, cron*