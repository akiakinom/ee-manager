const axios = require('axios');
const { default: addOAuthInterceptor } = require('axios-oauth-1.0a');

const USOS_BASE = process.env.USOS_BASE_URL;

/**
 * Creates an axios client pre-configured with OAuth 1.0a HMAC-SHA1 signing.
 */
function createClient({ token, tokenSecret } = {}) {
  const client = axios.create();

  addOAuthInterceptor(client, {
    algorithm: 'HMAC-SHA1',
    key: process.env.USOS_CONSUMER_KEY,
    secret: process.env.USOS_CONSUMER_SECRET,
    token,
    tokenSecret,
  });

  return client;
}

/**
 * Returns the token, its secret, and the URL to redirect the user to.
 */
async function getRequestToken() {
  const callbackUrl = `${process.env.APP_URL}/auth/callback`;
  const client = createClient();

  const response = await client.post(`${USOS_BASE}/services/oauth/request_token`, null, {
    params: { oauth_callback: callbackUrl },
  });

  const parsed = new URLSearchParams(response.data);

  return {
    requestToken: parsed.get('oauth_token'),
    requestTokenSecret: parsed.get('oauth_token_secret'),
    authorizeUrl: `${USOS_BASE}/services/oauth/authorize?oauth_token=${parsed.get('oauth_token')}`,
  };
}

/**
 * Exchange the verifier USOS sent back for a permanent access token.
 */
async function getAccessToken(requestToken, requestTokenSecret, oauthVerifier) {
  const client = createClient({
    token: requestToken,
    tokenSecret: requestTokenSecret,
  });

  const response = await client.post(`${USOS_BASE}/services/oauth/access_token`, null, {
    params: { oauth_verifier: oauthVerifier },
  });

  const parsed = new URLSearchParams(response.data);

  return {
    accessToken: parsed.get('oauth_token'),
    accessTokenSecret: parsed.get('oauth_token_secret'),
  };
}

/**
 * Fetch the authenticated user's profile from USOS.
 * Called after the OAuth flow is complete with the permanent access token.
 */
async function fetchUsosUser(accessToken, accessTokenSecret) {
  const client = createClient({
    token: accessToken,
    tokenSecret: accessTokenSecret,
  });

  const response = await client.get(`${USOS_BASE}/services/users/user`, {
    params: { fields: 'id|first_name|last_name' },
  });

  return response.data; // { id, first_name, last_name }
}

module.exports = { getRequestToken, getAccessToken, fetchUsosUser };