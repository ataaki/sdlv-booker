require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const { startScheduler } = require('./scheduler/scheduler');
const { resolveConfig } = require('./api/config-resolver');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', apiRoutes);

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, async () => {
  console.log(`Foot Du Lundi running at http://localhost:${PORT}`);

  // Auto-resolve Stripe & club config from DoInSport API
  try {
    await resolveConfig();
    console.log('[Config] Configuration resolved successfully');
  } catch (err) {
    console.error(`[Config] Failed to resolve config: ${err.message}`);
    console.error('[Config] Payment features will not work until config is resolved');
  }

  startScheduler();
});
