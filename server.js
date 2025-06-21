require('dotenv').config();
const express = require('express');

const health    = require('./routes/health');
const merchants = require('./routes/merchants');

const app = express();
app.use(express.json());

app.use('/health',   health);
app.use('/merchants', merchants);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀  API up on http://localhost:${PORT}`));