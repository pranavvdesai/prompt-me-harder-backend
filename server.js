require('dotenv').config();
const express = require('express');
const cors = require('cors');

const health    = require('./routes/health');
const merchantRoute = require('./routes/merchants');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/health', health);
app.use('/merchant', merchantRoute);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀  API up on http://localhost:${PORT}`));