// Completa o app.json: o google-services.json (Firebase, push no Android)
// entra no build só quando o arquivo existe na pasta do app.

const fs = require("node:fs");
const path = require("node:path");

module.exports = ({ config }) => {
  const file = path.join(__dirname, "google-services.json");
  if (fs.existsSync(file)) config.android = { ...config.android, googleServicesFile: "./google-services.json" };
  return config;
};
