# Authentication

Nova uses session-based authentication. Users sign up or sign in to receive a session token, then present that token on subsequent requests. There is no JWT -- sessions are stored server-side in SQLite and looked up by a hashed token.

## Session Transport

The session token can be sent in two ways:

1. **HTTP header**: `x-nova-session-token: <token>`
2. **Cookie**: `nova_session=<token>`

The server checks the header first, then falls back to the cookie. Both mechanisms work for REST API requests and the WebSocket `/ws` endpoint.

## Public Paths

The following paths do not require authentication:

- `/api/auth/*` -- Sign-up, sign-in, session check, sign-out.
- `/api/health` -- Health check.

Additionally, `OPTIONS` requests (CORS preflight) are never authenticated.

In the `test` environment (`NODE_ENV=test`), authentication is entirely bypassed.

## AuthService

The `AuthService` class (in `apps/server/src/services/AuthService.ts`) handles all identity operations.

### Password Handling

Passwords are hashed using Node.js `scrypt` via the `hashPassword()` and `verifyPassword()` helpers in `lib/passwords.ts`. The minimum password length is 8 characters.

### Session Lifecycle

- Sessions are created on sign-up, sign-in, or Google OAuth.
- Each session has a **30-day TTL** (`SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30`).
- The raw session token is returned to the client. The server stores only a SHA-256 hash of the token.
- Expired sessions are deleted on access and return `401` with the message "Session expired. Please sign in again."

### Sign-Up

```
POST /api/auth/signup
```

Creates a new user account. Requires `displayName`, `email`, and `password` (min 8 chars). Emails are normalized (trimmed and lowercased). Returns a session token and user object.

Throws `409 conflict` if the email is already registered.

### Sign-In

```
POST /api/auth/signin
```

Authenticates with `email` and `password`. Updates `lastSignedInAt` on success. Returns a session token and user object.

Throws `401 unauthorized` for invalid credentials.

### Google OAuth

```
POST /api/auth/google
```

Authenticates or registers a user via Google. Requires `email`, `displayName`, `googleSub`, and `emailVerified` (must be `true`).

The flow handles three cases:

1. **Existing user by `googleSub`** -- Updates display name and signs in.
2. **Existing user by email (no Google link)** -- Links the Google account and signs in.
3. **New user** -- Creates an account with `passwordHash` set to `"oauth:google"` (cannot sign in with password).

### Session Validation

```
GET /api/auth/session
```

Validates the session token from the `x-nova-session-token` header and returns the current user and session expiration.

### Sign-Out

```
POST /api/auth/signout
```

Deletes the session record from the database. Returns `204 No Content`.

## Session Result Shape

Successful sign-up, sign-in, and Google OAuth return:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "User Name",
    "lastSignedInAt": "2025-01-01T00:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "expiresAt": "2025-01-31T00:00:00.000Z",
  "sessionToken": "raw-token-string",
  "sessionId": "uuid"
}
```

The `sessionToken` value is what the client should store and send back on future requests.

## AuthSession Shape (on validated requests)

Every authenticated request has `request.authSession` populated with:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "User Name",
    "lastSignedInAt": "...",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "expiresAt": "2025-01-31T00:00:00.000Z"
}
```
