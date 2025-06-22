// require('dotenv').config();
// const TelegramBot = require('node-telegram-bot-api');

// const axios = require('axios');

// // Dynamic import for node-fetch@2 to avoid ESM issues
// const fetch = (...args) =>
//   import('node-fetch').then(({ default: fetch }) => fetch(...args));

// // Function to send the pre-configured EmailJS template using REST API
// async function sendMailWithEmailJS() {
//   const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({
//       service_id: process.env.EMAILJS_SERVICE_ID,
//       template_id: process.env.EMAILJS_TEMPLATE_ID,
//       user_id: process.env.EMAILJS_PUBLIC_KEY,
//       accessToken: process.env.EMAILJS_PRIVATE_KEY, // optional if required
//       template_params: {} // empty since we're using a static/default template
//     })
//   });

//   if (!response.ok) {
//     const errText = await response.text();
//     throw new Error(`EmailJS failed: ${errText}`);
//   }
// }

// // State tracker for each Telegram user
// const userState = new Map();

// function startTelegramBot(token) {
//   const bot = new TelegramBot(token, { polling: true });

//   bot.on('message', async (msg) => {
//     const chatId = msg.chat.id;
//     const userText = msg.text?.trim();
//     const state = userState.get(chatId);

//     if (!userText) return;

//     // Step 1: Greet
//     if (userText.toLowerCase() === 'hey') {
//       userState.delete(chatId);
//       bot.sendMessage(chatId, "Hey, I'm merchant mate, how can I assist you today?", {
//         reply_markup: {
//           keyboard: [['Talk with us'], ['Issues and escalations']],
//           one_time_keyboard: true,
//           resize_keyboard: true
//         }
//       });
//       return;
//     }

//     // Step 2a: Talk with us flow
//     if (userText === 'Talk with us') {
//       userState.set(chatId, { mode: 'talk' });
//       bot.sendMessage(chatId, 'Sure, what would you like to talk about?');
//       return;
//     }

//     // Step 2b: Issue flow
//     if (userText === 'Issues and escalations') {
//       userState.set(chatId, { mode: 'issue' });
//       bot.sendMessage(chatId, 'Please describe the issue you are facing.');
//       return;
//     }

//     // // Step 3a: Talk flow (your API can go here)
//     // if (state?.mode === 'talk') {
//     //   bot.sendMessage(chatId, "Thanks! We'll get back to you shortly.");
//     //   return;
//     // }

//     // 🟢 Step 3a – Talk flow (replace the old commented block with this)
//     if (state?.mode === 'talk') {
//     try {
//         console.log('[Talk] ⇢ POST /chat', { prompt: userText });   
//         const response = await axios.post(
//         'https://hack-ai-rrcc.onrender.com/chat',
//         {
//             prompt: userText,                       // user’s message
//             google_uid: '102157665201439458654'     // fixed UID
//         }
//         );

//         console.log('[Talk] ⇠ status:', response.status);                       // ⬅️ log status
//         console.log('[Talk] ⇠ data  :', response.data); 

//         const reply =
//         response.data?.message ||
//         'Sorry, I couldn’t understand that.';
//         bot.sendMessage(chatId, reply);

//     } catch (err) {
//         console.error('Talk error:', err.message);
//         bot.sendMessage(
//         chatId,
//         '⚠️ Something went wrong while contacting our assistant service.'
//         );
//     }
//     return;
//     }


//     // Step 3b: Capture issue text
//     if (state?.mode === 'issue' && !state.issueText) {
//       userState.set(chatId, { ...state, issueText: userText });
//       bot.sendMessage(chatId, 'Where is this issue being faced?', {
//         reply_markup: {
//           inline_keyboard: [
//             [{ text: 'Swiggy', callback_data: 'swiggy' }],
//             [{ text: 'Zomato', callback_data: 'zomato' }],
//             [{ text: 'Magicpin', callback_data: 'magicpin' }]
//           ]
//         }
//       });
//       return;
//     }
//   });

//   // Step 4: Handle platform selection
//   bot.on('callback_query', async (query) => {
//     const chatId = query.message.chat.id;
//     const state = userState.get(chatId);

//     if (!state?.issueText) {
//       bot.sendMessage(chatId, 'Please describe your issue first.');
//       return;
//     }

//     try {
//       await sendMailWithEmailJS(); // Send static EmailJS template
//       bot.sendMessage(chatId, `📧 Issue escalation email has been sent successfully. We'll follow up if there's no response.`);
//     } catch (err) {
//       console.error('EmailJS error:', err.message);
//       bot.sendMessage(chatId, '⚠️ Something went wrong while sending the email. Please try again later.');
//     }

//     userState.delete(chatId); // Reset session
//   });

//   console.log('🤖 Telegram bot is running...');
// }

// module.exports = { startTelegramBot };

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios       = require('axios');

// ─── EmailJS helper (unchanged) ───────────────────────────────────────────────
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function sendMailWithEmailJS() {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      service_id     : process.env.EMAILJS_SERVICE_ID,
      template_id    : process.env.EMAILJS_TEMPLATE_ID,
      user_id        : process.env.EMAILJS_PUBLIC_KEY,
      accessToken    : process.env.EMAILJS_PRIVATE_KEY,
      template_params: {}
    })
  });

  if (!response.ok) throw new Error(`EmailJS failed: ${await response.text()}`);
}

// ─── state holders ────────────────────────────────────────────────────────────
const userState       = new Map();
let   merchantChatId  = null;   // will store the restaurant owner’s chat id
let   bot;                      // telegram-bot instance

// ─── PUBLIC helper so server.js can push promo questions into Telegram ────────
async function sendPromoMessageToMerchant(text) {
  if (!bot)               throw new Error('Bot not initialised yet.');
  if (!merchantChatId)    throw new Error('Merchant has not started the bot.');
  return bot.sendMessage(merchantChatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Opt-in ✅',  callback_data: 'promo_opt_in'  }],
        [{ text: 'Opt-out ❌', callback_data: 'promo_opt_out' }]
      ]
    }
  });
}

// ─── main initialiser ─────────────────────────────────────────────────────────
function startTelegramBot(token) {
  bot = new TelegramBot(token, { polling: true });

  // ── message handler ────────────────────────────────────────────────────────
  bot.on('message', async (msg) => {
    const chatId  = msg.chat.id;
    const userTxt = msg.text?.trim();
    const state   = userState.get(chatId);
    if (!userTxt) return;

    // 1️⃣ greet & remember merchant chat id
    if (userTxt.toLowerCase() === 'hey') {
      merchantChatId = chatId;
      userState.delete(chatId);
      bot.sendMessage(chatId, "Hey, I'm merchant mate, how can I assist you today?", {
        reply_markup: {
          keyboard: [['Talk with us'], ['Issues and escalations']],
          one_time_keyboard: true,
          resize_keyboard  : true
        }
      });
      return;
    }

    // 2️⃣ menu choices
    if (userTxt === 'Talk with us') {
      userState.set(chatId, { mode: 'talk' });
      bot.sendMessage(chatId, 'Sure, what would you like to talk about?');
      return;
    }
    if (userTxt === 'Issues and escalations') {
      userState.set(chatId, { mode: 'issue' });
      bot.sendMessage(chatId, 'Please describe the issue you are facing.');
      return;
    }

    // 3️⃣ talk flow → POST to your external API
    if (state?.mode === 'talk') {
      try {
        console.log('[Talk] ⇢ POST /chat', { prompt: userTxt });

        const resp = await axios.post(
          'https://hack-ai-rrcc.onrender.com/chat',
          {
            prompt    : userTxt,
            google_uid: '102157665201439458654'
          }
        );

        console.log('[Talk] ⇠ status', resp.status);
        console.log('[Talk] ⇠ data  ', resp.data);

        const reply = resp.data?.message || 'Sorry, I couldn’t understand that.';
        bot.sendMessage(chatId, reply);

      } catch (err) {
        console.error('[Talk] error', err.message);
        bot.sendMessage(chatId, '⚠️ Something went wrong while contacting our assistant service.');
      }
      return;
    }

    // 4️⃣ issue flow → capture description, then ask for platform
    if (state?.mode === 'issue' && !state.issueText) {
      userState.set(chatId, { ...state, issueText: userTxt });
      bot.sendMessage(chatId, 'Where is this issue being faced?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Swiggy',   callback_data: 'swiggy'   }],
            [{ text: 'Zomato',   callback_data: 'zomato'   }],
            [{ text: 'Magicpin', callback_data: 'magicpin' }]
          ]
        }
      });
      return;
    }
  });

  // ── callback_query handler (inline buttons) ────────────────────────────────
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data   = query.data;                // promo_opt_in, promo_opt_out, swiggy, …
    const state  = userState.get(chatId);

    // A. promotion opt-in / opt-out
    if (data === 'promo_opt_in' || data === 'promo_opt_out') {
      await bot.answerCallbackQuery(query.id);
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id   : chatId,
        message_id: query.message.message_id
      });

      if (data === 'promo_opt_out') {
        bot.sendMessage(chatId, '👍 No problem — the promotion was cancelled.');
        return;
      }

      // Opt-in selected → fire Render API
      try {
        console.log('[Promo] ⇢ POST /chat – apply 10% promo');

        const resp = await axios.post(
          'https://hack-ai-rrcc.onrender.com/chat',
          {
            prompt:
              'Increase the promotion by 10 percent on all the dishes. ' +
              'table name is promos and column to be updated is discount_value',
            google_uid: '102157665201439458654'
          }
        );

        console.log('[Promo] ⇠ status', resp.status);
        bot.sendMessage(chatId, '✅ Promotion request sent, we’ll notify you when it’s live.');

      } catch (err) {
        console.error('[Promo] error', err.message);
        bot.sendMessage(chatId, '⚠️ Failed to apply the promotion. Please try again later.');
      }
      return;
    }

    // B. issue escalation (after platform chosen)
    if (state?.mode === 'issue' && state.issueText) {
      try {
        await sendMailWithEmailJS();
        bot.sendMessage(chatId, '📧 Issue escalation email has been sent successfully. We’ll follow up if there’s no response.');
      } catch (err) {
        console.error('EmailJS error:', err.message);
        bot.sendMessage(chatId, '⚠️ Something went wrong while sending the email. Please try again later.');
      }
      userState.delete(chatId);
    }
  });

  console.log('🤖 Telegram bot is running…');
}

// ─── exports ──────────────────────────────────────────────────────────────────
module.exports = { startTelegramBot, sendPromoMessageToMerchant };
