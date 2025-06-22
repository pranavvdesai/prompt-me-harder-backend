require('dotenv').config();
const express = require('express');
const cors = require('cors');

const health    = require('./routes/health');
const merchantRoute = require('./routes/merchants');
const grievanceRoute = require('./routes/grievance');
const analyticsRoute = require('./routes/analytics');

const { startTelegramBot } = require('./bot/telegram');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/health', health);
app.use('/merchant', merchantRoute);
app.use('/grievance', grievanceRoute);
app.use('/analytics', analyticsRoute);

throw new Error("🚫 Server intentionally not started for deployment/testing.");

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API up on http://localhost:${PORT}`);

  // Start the Telegram bot
  if (process.env.TELEGRAM_BOT_TOKEN) {
    startTelegramBot(process.env.TELEGRAM_BOT_TOKEN);
  } else {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN not set in .env");
  }
});