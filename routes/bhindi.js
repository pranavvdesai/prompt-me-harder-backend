// // routes/bhindi.js
// const express = require('express');
// const router = express.Router();

// const TOOL_ID = 'merchant-mate-bhindi';
// const TOOL_NAME = 'Merchant Mate AI';
// const TOOL_DESCRIPTION = 'Helps food merchants manage stores, escalate issues, and track analytics';
// const TOOL_ENDPOINT = process.env.PUBLIC_URL || 'https://your-app.onrender.com'; // customize

// // GET /tools
// router.get('/', (req, res) => {
//   res.json([
//     {
//       id: TOOL_ID,
//       name: TOOL_NAME,
//       description: TOOL_DESCRIPTION,
//       endpoint: TOOL_ENDPOINT
//     }
//   ]);
// });

// // POST /tools/:toolName
// router.post('/:toolName', async (req, res) => {
//   const { toolName } = req.params;
//   const { prompt } = req.body;

//   if (toolName !== TOOL_ID) {
//     return res.status(404).json({ error: 'Tool not found' });
//   }

//   if (!prompt || typeof prompt !== 'string') {
//     return res.status(400).json({ error: 'Prompt is required' });
//   }

//   try {
//     // Replace this with real logic or external API call
//     if (prompt.toLowerCase().includes('issue')) {
//       return res.json({ message: 'Please describe the issue you are facing.' });
//     } else if (prompt.toLowerCase().includes('menu')) {
//       return res.json({ message: 'Here is your current menu list. [dummy response]' });
//     }

//     return res.json({
//       message: `Echo: "${prompt}" — Merchant Mate is here to help.`
//     });
//   } catch (err) {
//     console.error('Bhindi agent error:', err.message);
//     return res.status(500).json({ error: 'Internal server error' });
//   }
// });

// module.exports = router;
