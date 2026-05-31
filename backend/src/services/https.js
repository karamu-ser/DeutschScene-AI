const https = require('https');
const fs = require('fs');
const path = require('path');

function getHttpsOptions() {
  const keyPath = process.env.HTTPS_KEY_PATH || path.join(__dirname, '../certs/key.pem');
  const certPath = process.env.HTTPS_CERT_PATH || path.join(__dirname, '../certs/cert.pem');

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    return null;
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

function startHttpsServer(app, port, logger) {
  const options = getHttpsOptions();

  if (!options) {
    logger.warn('HTTPS certificates not found, skipping HTTPS server');
    return null;
  }

  const server = https.createServer(options, app);
  server.listen(port, () => {
    logger.info(`🔒 HTTPS Server running on https://localhost:${port}`);
  });

  return server;
}

module.exports = { startHttpsServer };
