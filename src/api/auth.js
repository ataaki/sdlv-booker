const { getCredentials } = require('../db/database');
const { API_BASE } = require('../constants');

let tokenData = null;
let tokenExpiry = 0;

async function login(email, password) {
  const res = await fetch(`${API_BASE}/client_login_check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password })
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  tokenData = data;

  // JWT exp is in the payload - decode it
  const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64').toString());
  tokenExpiry = payload.exp * 1000; // convert to ms

  return data;
}

async function getToken() {
  if (!tokenData || Date.now() >= tokenExpiry - 60000) {
    const creds = getCredentials();
    if (!creds) throw new Error('Identifiants DoInSport non configurés');
    await login(creds.email, creds.password);
  }
  return tokenData.token;
}

function resetToken() {
  tokenData = null;
  tokenExpiry = 0;
}

async function getMe() {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
}

module.exports = { login, getToken, resetToken, getMe };
