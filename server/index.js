require('dotenv').config();

const cookieParser = require('cookie-parser');
const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const express = require('express');

const app = express();
const port = Number(process.env.PORT || 3000);
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
const callbackUrl = process.env.GITHUB_CALLBACK_URL || `${frontendUrl}/auth/github/callback`;
const sessionCookieName = 'nube_session';
const stateCookieName = 'github_oauth_state';
const sessionDurationMs = 8 * 60 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production'
};

app.disable('x-powered-by');
app.use(cookieParser());
app.use('/api', (_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function githubOAuthIsConfigured() {
  return Boolean(
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET &&
    process.env.SESSION_SECRET
  );
}

function signSession(profile) {
  const payload = Buffer.from(JSON.stringify({
    profile,
    expiresAt: Date.now() + sessionDurationMs
  })).toString('base64url');
  const signature = createHmac('sha256', process.env.SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

function readSession(cookieValue) {
  if (typeof cookieValue !== 'string') {
    return null;
  }

  const parts = cookieValue.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1] || !process.env.SESSION_SECRET) {
    return null;
  }

  const expectedSignature = createHmac('sha256', process.env.SESSION_SECRET)
    .update(parts[0])
    .digest();
  const providedSignature = Buffer.from(parts[1], 'base64url');
  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }

  if (
    !isRecord(payload) ||
    typeof payload['expiresAt'] !== 'number' ||
    payload['expiresAt'] <= Date.now() ||
    !isRecord(payload['profile'])
  ) {
    return null;
  }

  const profile = payload['profile'];
  if (
    profile['provider'] !== 'github' ||
    typeof profile['name'] !== 'string' ||
    typeof profile['email'] !== 'string' ||
    typeof profile['picture'] !== 'string' ||
    typeof profile['username'] !== 'string'
  ) {
    return null;
  }

  return profile;
}

function clearCookie(response, name, path) {
  response.clearCookie(name, {
    ...cookieOptions,
    path
  });
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/auth/session', (request, response) => {
  const profile = readSession(request.cookies[sessionCookieName]);
  if (!profile) {
    clearCookie(response, sessionCookieName, '/');
    response.json({ authenticated: false });
    return;
  }

  response.json({ authenticated: true, profile });
});

app.get('/auth/github', (_request, response) => {
  if (!githubOAuthIsConfigured()) {
    response.status(503).send(
      'GitHub OAuth is not configured. Copy .env.example to .env and add your GitHub OAuth App credentials.'
    );
    return;
  }

  const state = randomBytes(32).toString('hex');
  response.cookie(stateCookieName, state, {
    ...cookieOptions,
    maxAge: 10 * 60 * 1000,
    path: '/auth/github/callback'
  });

  const authorizationUrl = new URL('https://github.com/login/oauth/authorize');
  authorizationUrl.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID);
  authorizationUrl.searchParams.set('redirect_uri', callbackUrl);
  authorizationUrl.searchParams.set('scope', 'read:user');
  authorizationUrl.searchParams.set('state', state);
  response.redirect(authorizationUrl.toString());
});

app.get('/auth/github/callback', async (request, response) => {
  const queryError = request.query['error'];
  const code = request.query['code'];
  const state = request.query['state'];
  const savedState = request.cookies[stateCookieName];
  clearCookie(response, stateCookieName, '/auth/github/callback');

  if (queryError || typeof code !== 'string' || typeof state !== 'string' || typeof savedState !== 'string') {
    response.redirect(`${frontendUrl}/?authError=github`);
    return;
  }

  const providedState = Buffer.from(state);
  const expectedState = Buffer.from(savedState);
  if (
    providedState.length !== expectedState.length ||
    !timingSafeEqual(providedState, expectedState)
  ) {
    response.redirect(`${frontendUrl}/?authError=github`);
    return;
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`GitHub token exchange returned HTTP ${tokenResponse.status}.`);
    }

    const tokenPayload = await tokenResponse.json();
    if (!isRecord(tokenPayload) || typeof tokenPayload['access_token'] !== 'string') {
      throw new Error('GitHub did not return an access token.');
    }

    const profileResponse = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenPayload['access_token']}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Nube-Login'
      }
    });

    if (!profileResponse.ok) {
      throw new Error(`GitHub profile request returned HTTP ${profileResponse.status}.`);
    }

    const githubUser = await profileResponse.json();
    if (
      !isRecord(githubUser) ||
      typeof githubUser['login'] !== 'string' ||
      typeof githubUser['avatar_url'] !== 'string'
    ) {
      throw new Error('GitHub returned an invalid user profile.');
    }

    const profile = {
      provider: 'github',
      username: githubUser['login'],
      name: typeof githubUser['name'] === 'string' && githubUser['name'].trim()
        ? githubUser['name'].trim()
        : githubUser['login'],
      email: typeof githubUser['email'] === 'string' ? githubUser['email'] : '',
      picture: githubUser['avatar_url']
    };

    response.cookie(sessionCookieName, signSession(profile), {
      ...cookieOptions,
      maxAge: sessionDurationMs,
      path: '/'
    });
    response.redirect(frontendUrl);
  } catch (error) {
    console.error(
      'GitHub OAuth callback failed:',
      error instanceof Error ? error.message : 'Unknown error.'
    );
    response.redirect(`${frontendUrl}/?authError=github`);
  }
});

app.post('/api/auth/logout', (_request, response) => {
  clearCookie(response, sessionCookieName, '/');
  response.status(204).end();
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Authentication API listening on http://127.0.0.1:${port}`);
});
