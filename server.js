// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');

// const health    = require('./routes/health');
// const merchantRoute = require('./routes/merchants');
// const grievanceRoute = require('./routes/grievance');
// const analyticsRoute = require('./routes/analytics');

// const { startTelegramBot } = require('./bot/telegram');

// const app = express();
// app.use(express.json());
// app.use(cors());
// app.use('/health', health);
// app.use('/merchant', merchantRoute);
// app.use('/grievance', grievanceRoute);
// app.use('/analytics', analyticsRoute);


// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`🚀 API up on http://localhost:${PORT}`);

//   // Start the Telegram bot
//   if (process.env.TELEGRAM_BOT_TOKEN) {
//     startTelegramBot(process.env.TELEGRAM_BOT_TOKEN);
//   } else {
//     console.warn("⚠️ TELEGRAM_BOT_TOKEN not set in .env");
//   }
// });

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');

const health           = require('./routes/health');
const merchantRoute    = require('./routes/merchants');
const grievanceRoute   = require('./routes/grievance');
const analyticsRoute   = require('./routes/analytics');
const {
  startTelegramBot,
  sendPromoMessageToMerchant
} = require('./bot/telegram');

const app = express();
app.use(express.json());
app.use(cors());

// ─── existing API routes ───────────────────────────────────────────────────────
app.use('/health',    health);
app.use('/merchant',  merchantRoute);
app.use('/grievance', grievanceRoute);
app.use('/analytics', analyticsRoute);

// ─── serve the static promo page (public/magicpin-promo.html) ─────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── endpoint hit by the orange button on that page ───────────────────────────
app.post('/magicpin-promo/trigger', async (_req, res) => {
  try {
    await sendPromoMessageToMerchant(
      'Magicpin just asked for rolling out 10 % extra off promotion across the restaurant on the weekend.'
    );
    res.sendStatus(204);
  } catch (err) {
    console.error('promo trigger error:', err.message);
    res.status(500).send('Failed to notify Telegram bot.');
  }
});

// ─── start everything ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API up on http://localhost:${PORT}`);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) startTelegramBot(token);
  else       console.warn('⚠️ TELEGRAM_BOT_TOKEN not set in .env');
});
