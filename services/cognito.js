// routes/cognito.js  (CJS)
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const REGION = process.env.AWS_REGION;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET || null;

if (!REGION || !CLIENT_ID) {
  throw new Error('AWS_REGION or COGNITO_CLIENT_ID is not set');
}

let cognitoClient = null;
let awsMod = null;
async function getClient() {
  if (cognitoClient && awsMod) return { cognitoClient, awsMod };
  awsMod = await import('@aws-sdk/client-cognito-identity-provider');
  const { CognitoIdentityProviderClient } = awsMod;
  cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
  return { cognitoClient, awsMod };
}

function secretHash(username) {
  if (!CLIENT_SECRET) return undefined;
  const hmac = crypto.createHmac('sha256', CLIENT_SECRET);
  hmac.update(username + CLIENT_ID);
  return hmac.digest('base64');
}

// POST /api/cognito/signup
router.post('/signup', async (req, res) => {
  try {
    const { username, password, email } = req.body || {};
    if (!username || !password || !email) return res.status(400).json({ error: 'username/password/email required' });

    const { cognitoClient, awsMod } = await getClient();
    const { SignUpCommand } = awsMod;

    const params = {
      ClientId: CLIENT_ID,
      Username: username,
      Password: password,
      UserAttributes: [{ Name: 'email', Value: email }]
    };
    const sh = secretHash(username);
    if (sh) params.SecretHash = sh;

    await cognitoClient.send(new SignUpCommand(params));
    res.json({ ok: true });
  } catch (e) {
    console.error('[Cognito signup]', e);
    res.status(400).json({ error: e.message || 'signup failed' });
  }
});

// POST /api/cognito/confirm
router.post('/confirm', async (req, res) => {
  try {
    const { username, code } = req.body || {};
    if (!username || !code) return res.status(400).json({ error: 'username/code required' });

    const { cognitoClient, awsMod } = await getClient();
    const { ConfirmSignUpCommand } = awsMod;

    const params = { ClientId: CLIENT_ID, Username: username, ConfirmationCode: code };
    const sh = secretHash(username);
    if (sh) params.SecretHash = sh;

    await cognitoClient.send(new ConfirmSignUpCommand(params));
    res.json({ ok: true });
  } catch (e) {
    console.error('[Cognito confirm]', e);
    res.status(400).json({ error: e.message || 'confirm failed' });
  }
});

// POST /api/cognito/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username/password required' });

    const { cognitoClient, awsMod } = await getClient();
    const { InitiateAuthCommand } = awsMod;

    const params = {
      ClientId: CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: username, PASSWORD: password }
    };
    const sh = secretHash(username);
    if (sh) params.AuthParameters.SECRET_HASH = sh;

    const out = await cognitoClient.send(new InitiateAuthCommand(params));
    const a = out.AuthenticationResult || {};
    res.json({
      idToken: a.IdToken,
      accessToken: a.AccessToken,
      refreshToken: a.RefreshToken,
      expiresIn: a.ExpiresIn
    });
  } catch (e) {
    console.error('[Cognito login]', e);
    res.status(400).json({ error: e.message || 'login failed' });
  }
});

module.exports = router;
