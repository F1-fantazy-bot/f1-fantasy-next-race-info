require('dotenv').config();
const { refreshJolpicaCache } = require('./jolpicaRefresh');
const { sendTelegramMessage, ERRORS_CHANNEL_ID } = require('./telegramService');

refreshJolpicaCache({
  alert: (message) => sendTelegramMessage(message, ERRORS_CHANNEL_ID),
})
  .then(() => console.log('Jolpica cache refresh complete'))
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
