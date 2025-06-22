

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios       = require('axios');
const {
  buildAirdropList,
  deployToken,
  disburseTokens
} = require('../services/airdrop');


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

const userState       = new Map();
let   merchantChatId  = null;   
let   bot;                     

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
let botInstance = null;

async function startTelegramBot(token) {
  if (botInstance) {
    console.log('⚠️  Bot is already running – reuse the instance');
    return botInstance;
  }
 const bot = new TelegramBot(token, { polling: true });
  botInstance = bot;

  // graceful stop when the platform sends SIGTERM / SIGINT
  const stop = async () => {
    if (botInstance) {
      console.log('🛑  Stopping Telegram polling …');
      await botInstance.stopPolling();
      botInstance = null;
    }
    // Render kills the process right after, no need for process.exit()
  };
  process.once('SIGINT',  stop);
  process.once('SIGTERM', stop);

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

        /* ────────────────────────────────────────────────
+       0️⃣  OWNER-ONLY “exit” COMMAND
+       type  exit   ⇒ bot stops polling & terminates
+       ──────────────────────────────────────────────── */
    if (userTxt.toLowerCase() === 'exit' && chatId === merchantChatId) {
      await bot.sendMessage(chatId, '👋 Shutting down…');
      console.log('🛑  Exit command received from owner, stopping polling');

      await bot.stopPolling();
      process.exit(0);
      return;                              
   }

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

     if (/crypto|web3|airdrop|loyalty/i.test(userTxt)) {

      bot.sendMessage(chatId, '⏳ Creating your loyalty airdrop, please wait…');

      try {
        const tokenName   = 'Lassi Singh';
        const tokenSymbol = 'LASSI';
        const totalSupply = 10_000;

        const recipients  = await buildAirdropList(); // [{address,amount},…]
        const token = await deployToken(tokenName, tokenSymbol, totalSupply);
         await disburseTokens("0xDDD0C17A9F360fcBD2BA523D8AfF12b71Ee0851a", recipients);    // ← NEW

        return bot.sendMessage(
          chatId,
          `✅ Airdrop complete!\n` +
          `• Token: ${tokenSymbol} 0xDDD0C17A9F360fcBD2BA523D8AfF12b71Ee0851a\n` +
          `• Transfers: ${recipients.length} wallets`
        );
      } catch (err) {
        console.error('Airdrop error:', err);
        return bot.sendMessage(
          chatId,
          '⚠️ Sorry, something went wrong while creating the airdrop.'
        );
      }
    }

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

        // const reply = resp.data?.message || 'Sorry, I couldn’t understand that.';
        const reply = resp.data[response]
        bot.sendMessage(chatId, reply);

      } catch (err) {
        console.error('[Talk] error', err.message);
        bot.sendMessage(chatId, '⚠️ Something went wrong while contacting our assistant service.');
      }
      return;
    }

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

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data   = query.data;                
    const state  = userState.get(chatId);

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
    return bot;

}

// ─── exports ──────────────────────────────────────────────────────────────────
module.exports = { startTelegramBot, sendPromoMessageToMerchant };


// // bot/telegram.js
// require('dotenv').config();
// const TelegramBot = require('node-telegram-bot-api');
// const axios       = require('axios');
// const {
//   buildAirdropList,
//   deployToken,
//   disburseTokens,
// } = require('../services/airdrop');

// // Dynamic import for node-fetch (keeps CJS happy)
// const fetch = (...args) =>
//   import('node-fetch').then(({ default: fetch }) => fetch(...args));

// async function sendMailWithEmailJS() {
//   const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
//     method : 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body   : JSON.stringify({
//       service_id     : process.env.EMAILJS_SERVICE_ID,
//       template_id    : process.env.EMAILJS_TEMPLATE_ID,
//       user_id        : process.env.EMAILJS_PUBLIC_KEY,
//       accessToken    : process.env.EMAILJS_PRIVATE_KEY,
//       template_params: {},
//     }),
//   });
//   if (!res.ok) throw new Error(`EmailJS failed: ${await res.text()}`);
// }

// // ─── in-memory state ─────────────────────────────────────────────────────────
// const userState      = new Map();
// let   merchantChatId = null;
// let   botSingleton   = null;       // prevents duplicate bots in hot-reload

// // ─── helper: push a promo opt-in/out message to merchant ─────────────────────
// async function sendPromoMessageToMerchant(text) {
//   if (!botSingleton)      throw new Error('Bot not initialised yet.');
//   if (!merchantChatId)    throw new Error('Merchant hasn’t started the bot.');
//   return botSingleton.sendMessage(merchantChatId, text, {
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: 'Opt-in ✅',  callback_data: 'promo_opt_in'  }],
//         [{ text: 'Opt-out ❌', callback_data: 'promo_opt_out' }],
//       ],
//     },
//   });
// }

// // ─── main entry ──────────────────────────────────────────────────────────────
// function startTelegramBot(token) {
//   // Guard: if nodemon or a redeploy calls this twice, reuse the same bot.
//   if (botSingleton) return botSingleton;

//   const bot = new TelegramBot(token, { polling: true });
//   botSingleton = bot;

//   // ── MESSAGE HANDLER ────────────────────────────────────────────────────────
//   bot.on('message', async (msg) => {
//     const chatId  = msg.chat.id;
//     const userTxt = msg.text?.trim();
//     const state   = userState.get(chatId);
//     if (!userTxt) return;

//     //
//     // 1️⃣ initial greeting
//     //
//     if (userTxt.toLowerCase() === 'hey') {
//       merchantChatId = chatId;
//       userState.delete(chatId);   // reset any previous state for this user

//       bot.sendMessage(chatId, "Hey, I'm merchant mate, how can I assist you today?", {
//         reply_markup: {
//           keyboard          : [['Talk with us'], ['Issues and escalations']],
//           one_time_keyboard : true,
//           resize_keyboard   : true,
//         },
//       });
//       return;
//     }

//     //
//     // 2️⃣ choose conversation mode
//     //
//     if (userTxt === 'Talk with us') {
//       userState.set(chatId, { mode: 'talk' });
//       bot.sendMessage(chatId, 'Sure, what would you like to talk about?');
//       return;
//     }
//     if (userTxt === 'Issues and escalations') {
//       userState.set(chatId, { mode: 'issue' });
//       bot.sendMessage(chatId, 'Please describe the issue you are facing.');
//       return;
//     }

//     //
//     // 3️⃣ TALK MODE – forward prompt to LLM endpoint
//     //
//     if (state?.mode === 'talk') {
//       try {
//         console.log('[Talk] ⇢ POST /chat', { prompt: userTxt });
//         const resp = await axios.post(
//           'https://hack-ai-rrcc.onrender.com/chat',
//           { prompt: userTxt, google_uid: '102157665201439458654' },
//         );
//         console.log('[Talk] ⇠ status', resp.status);
//         const reply = resp.data?.message || 'Sorry, I couldn’t understand that.';
//         bot.sendMessage(chatId, reply);
//       } catch (err) {
//         console.error('[Talk] error', err.message);
//         bot.sendMessage(chatId, '⚠️ Something went wrong while contacting our assistant service.');
//       }
//       return;
//     }

//     //
//     // 4️⃣ ISSUE MODE – first message captured, ask for platform
//     //
//     if (state?.mode === 'issue' && !state.issueText) {
//       userState.set(chatId, { ...state, issueText: userTxt });
//       bot.sendMessage(chatId, 'Where is this issue being faced?', {
//         reply_markup: {
//           inline_keyboard: [
//             [{ text: 'Swiggy',   callback_data: 'swiggy'   }],
//             [{ text: 'Zomato',   callback_data: 'zomato'   }],
//             [{ text: 'Magicpin', callback_data: 'magicpin' }],
//           ],
//         },
//       });
//       return;
//     }

//     //
//     // 5️⃣ Crypto / loyalty keywords trigger demo airdrop
//     //
//     if (/crypto|web3|airdrop|loyalty/i.test(userTxt)) {
//       bot.sendMessage(chatId, '⏳ Creating your loyalty airdrop, please wait…');
//       try {
//         const recipients  = await buildAirdropList();                     // [{address,amount},…]
//         const tokenAddr   = await deployToken('Lassi Singh', 'LASSI', 10_000);
//         await disburseTokens(tokenAddr, recipients);

//         bot.sendMessage(
//           chatId,
//           `✅ Airdrop complete!\n` +
//           `• Token: LASSI ${tokenAddr}\n` +
//           `• Transfers: ${recipients.length} wallets`,
//         );
//       } catch (err) {
//         console.error('Airdrop error:', err);
//         bot.sendMessage(chatId, '⚠️ Sorry, something went wrong while creating the airdrop.');
//       }
//     }
//   });

//   // ── CALLBACK QUERY HANDLER (inline buttons) ────────────────────────────────
//   bot.on('callback_query', async (query) => {
//     const chatId = query.message.chat.id;
//     const data   = query.data;
//     const state  = userState.get(chatId);

//     // promo opt-in/out
//     if (data === 'promo_opt_in' || data === 'promo_opt_out') {
//       await bot.answerCallbackQuery(query.id);
//       await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
//         chat_id   : chatId,
//         message_id: query.message.message_id,
//       });

//       if (data === 'promo_opt_out') {
//         bot.sendMessage(chatId, '👍 No problem — the promotion was cancelled.');
//         return;
//       }

//       // apply 10 % promo
//       try {
//         console.log('[Promo] ⇢ POST /chat – apply 10% promo');
//         const resp = await axios.post(
//           'https://hack-ai-rrcc.onrender.com/chat',
//           {
//             prompt:
//               'Increase the promotion by 10 percent on all the dishes. ' +
//               'table name is promos and column to be updated is discount_value',
//             google_uid: '102157665201439458654',
//           },
//         );
//         console.log('[Promo] ⇠ status', resp.status);
//         bot.sendMessage(chatId, '✅ Promotion request sent, we’ll notify you when it’s live.');
//       } catch (err) {
//         console.error('[Promo] error', err.message);
//         bot.sendMessage(chatId, '⚠️ Failed to apply the promotion. Please try again later.');
//       }
//       return;
//     }

//     // issue escalation → send email
//     if (state?.mode === 'issue' && state.issueText) {
//       try {
//         await sendMailWithEmailJS();
//         bot.sendMessage(
//           chatId,
//           '📧 Issue escalation email has been sent successfully. We’ll follow up if there’s no response.',
//         );
//       } catch (err) {
//         console.error('EmailJS error:', err.message);
//         bot.sendMessage(chatId, '⚠️ Something went wrong while sending the email. Please try again later.');
//       }
//       userState.delete(chatId);
//     }
//   });

//   console.log('🤖 Telegram bot is running…');

//   // ── GRACEFUL SHUTDOWN (Render/Heroku/Docker) ───────────────────────────────
//   async function shutdown(sig) {
//     try {
//       console.log(`\n${sig} received ➜ stopping Telegram polling…`);
//       await bot.stopPolling();        // <- critical: frees long-poll HTTP conn
//       console.log('✅ Polling stopped — exiting.');
//     } catch (e) {
//       console.error('Failed to stop polling:', e);
//     }
//     process.exit(0);
//   }

//   process.once('SIGINT',  () => shutdown('SIGINT'));   // local Ctrl-C / docker stop
//   process.once('SIGTERM', () => shutdown('SIGTERM'));  // Render / Heroku restart

//   return bot;
// }

// // ─── exports ─────────────────────────────────────────────────────────────────
// module.exports = { startTelegramBot, sendPromoMessageToMerchant };
