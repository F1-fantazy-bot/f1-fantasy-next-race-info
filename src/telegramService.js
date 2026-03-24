// Telegram service for sending log messages to a channel

const TelegramBot = require('node-telegram-bot-api');

const LOG_CHANNEL_ID = '-1002298860617';
const ERRORS_CHANNEL_ID = '-5167373779';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

let bot = null;
if (TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
} else {
  console.warn('TELEGRAM_BOT_TOKEN is not set in environment variables.');
}

/**
 * Sends a message to a Telegram chat.
 * If the chat is a channel, adds the NEXT_RACE_INFO prefix.
 * @param {string} messageText - The message to send.
 * @param {string} [chatIdOverride] - Optional chat ID to send to (defaults to LOG_CHANNEL_ID).
 * @returns {Promise<void>}
 */
async function sendTelegramMessage(
  messageText,
  chatIdOverride = LOG_CHANNEL_ID,
) {
  if (!bot) {
    console.error('Telegram bot is not initialized.');
    return;
  }
  let finalMessage = messageText;
  const isChannelMessage =
    chatIdOverride === LOG_CHANNEL_ID || chatIdOverride === ERRORS_CHANNEL_ID;
  if (isChannelMessage) {
    finalMessage = 'NEXT_RACE_INFO: ' + messageText;
  }
  try {
    await bot.sendMessage(chatIdOverride, finalMessage);
  } catch (err) {
    console.error('Failed to send Telegram message:', err.message);
  }
}

async function sendTelegramErrorMessage(messageText) {
  await sendTelegramMessage(messageText, LOG_CHANNEL_ID);
  await sendTelegramMessage(messageText, ERRORS_CHANNEL_ID);
}

module.exports = {
  sendTelegramMessage,
  sendTelegramErrorMessage,
  LOG_CHANNEL_ID,
  ERRORS_CHANNEL_ID,
};
