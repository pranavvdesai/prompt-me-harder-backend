require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Dynamic import for node-fetch@2 to avoid ESM issues
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Function to send the pre-configured EmailJS template using REST API
async function sendMailWithEmailJS() {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      accessToken: process.env.EMAILJS_PRIVATE_KEY, // optional if required
      template_params: {} // empty since we're using a static/default template
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`EmailJS failed: ${errText}`);
  }
}

// State tracker for each Telegram user
const userState = new Map();

function startTelegramBot(token) {
  const bot = new TelegramBot(token, { polling: true });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userText = msg.text?.trim();
    const state = userState.get(chatId);

    if (!userText) return;

    // Step 1: Greet
    if (userText.toLowerCase() === 'hey') {
      userState.delete(chatId);
      bot.sendMessage(chatId, "Hey, I'm merchant mate, how can I assist you today?", {
        reply_markup: {
          keyboard: [['Talk with us'], ['Issues and escalations']],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });
      return;
    }

    // Step 2a: Talk with us flow
    if (userText === 'Talk with us') {
      userState.set(chatId, { mode: 'talk' });
      bot.sendMessage(chatId, 'Sure, what would you like to talk about?');
      return;
    }

    // Step 2b: Issue flow
    if (userText === 'Issues and escalations') {
      userState.set(chatId, { mode: 'issue' });
      bot.sendMessage(chatId, 'Please describe the issue you are facing.');
      return;
    }

    // // Step 3a: Talk flow (your API can go here)
    // if (state?.mode === 'talk') {
    //   bot.sendMessage(chatId, "Thanks! We'll get back to you shortly.");
    //   return;
    // }

    // if (state?.mode === 'talk') {
    //   try {
    //     const response = await axios.post(
    //       'https://external-api.com/chat',
    //       {
    //         prompt: userText,
    //         google_uid: 'uid_merchant_a'
    //       }
    //     );
    //     const reply = response.data?.message || 'Sorry, I couldn’t understand that.';
    //     bot.sendMessage(chatId, reply);
    //   } catch (err) {
    //     console.error('Talk error:', err.message);
    //     bot.sendMessage(
    //       chatId,
    //       '⚠️ Something went wrong while contacting our assistant service.'
    //     );
    //   }
    //   return;
    // }

    // Step 3b: Capture issue text
    if (state?.mode === 'issue' && !state.issueText) {
      userState.set(chatId, { ...state, issueText: userText });
      bot.sendMessage(chatId, 'Where is this issue being faced?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Swiggy', callback_data: 'swiggy' }],
            [{ text: 'Zomato', callback_data: 'zomato' }],
            [{ text: 'Magicpin', callback_data: 'magicpin' }]
          ]
        }
      });
      return;
    }
  });

  // Step 4: Handle platform selection
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const state = userState.get(chatId);

    if (!state?.issueText) {
      bot.sendMessage(chatId, 'Please describe your issue first.');
      return;
    }

    try {
      await sendMailWithEmailJS(); // Send static EmailJS template
      bot.sendMessage(chatId, `📧 Issue escalation email has been sent successfully. We'll follow up if there's no response.`);
    } catch (err) {
      console.error('EmailJS error:', err.message);
      bot.sendMessage(chatId, '⚠️ Something went wrong while sending the email. Please try again later.');
    }

    userState.delete(chatId); // Reset session
  });

  console.log('🤖 Telegram bot is running...');
}

module.exports = { startTelegramBot };
