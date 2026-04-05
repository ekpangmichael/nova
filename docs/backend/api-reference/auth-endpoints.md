# Authentication Endpoints

Authentication endpoints are public -- they do not require an existing session.

Source: `apps/server/src/routes/auth.ts`

---

## Sign Up

```
POST /api/auth/signup
```

Creates a new user account and returns a session token.

**Request Body**

| Field         | Type   | Required | Description                              |
| ------------- | ------ | -------- | ---------------------------------------- |
| `displayName` | string | Yes      | Display name (min 1 char, trimmed).      |
| `email`       | string | Yes      | Valid email address.                     |
| `password`    | string | Yes      | Password (min 8 characters).             |

**Response** `200 OK`

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "User Name",
    "lastSignedInAt": "2025-01-15T10:00:00.000Z",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  },
  "expiresAt": "2025-02-14T10:00:00.000Z",
  "sessionToken": "raw-session-token",
  "sessionId": "uuid"
}
```

The `sessionToken` should be stored by the client and sent on subsequent requests via the `x-nova-session-token` header or `nova_session` cookie.

**Errors**

- `400 bad_request` -- Missing or invalid email, or password shorter than 8 characters.
- `409 conflict` -- An account with that email already exists.

---

## Sign In

```
POST /api/auth/signin
```

Authenticates with email and password. Returns a new session token.

**Request Body**

| Field      | Type   | Required | Description                  |
| ---------- | ------ | -------- | ---------------------------- |
| `email`    | string | Yes      | Valid email address.         |
| `password` | string | Yes      | Password (min 8 characters). |

**Response** `200 OK`

Same shape as sign-up response.

**Errors**

- `400 bad_request` -- Missing or invalid email, or password shorter than 8 characters.
- `401 unauthorized` -- Invalid email or password.

---

## Google Sign-In

```
POST /api/auth/google
```

Authenticates or registers a user via Google OAuth. Handles three scenarios:

1. Existing user found by Google subject ID -- updates and signs in.
2. Existing user found by email (no Google link) -- links the Google account and signs in.
3. No existing user -- creates a new account.

**Request Body**

| Field           | Type    | Required | Description                              |
| --------------- | ------- | -------- | ---------------------------------------- |
| `email`         | string  | Yes      | Google account email.                    |
| `displayName`   | string  | Yes      | Google display name (min 1 char).        |
| `googleSub`     | string  | Yes      | Google subject identifier (min 1 char).  |
| `emailVerified` | boolean | Yes      | Must be `true`.                          |

**Response** `200 OK`

Same shape as sign-up response.

**Errors**

- `401 unauthorized` -- Google account email is not verified (`emailVerified` is `false`).
- `400 bad_request` -- Incomplete Google account details.

---

## Get Session

```
GET /api/auth/session
```

Validates the current session and returns the authenticated user.

**Headers**

| Header                   | Description                      |
| ------------------------ | -------------------------------- |
| `x-nova-session-token`   | Session token from sign-in.     |

**Response** `200 OK`

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "User Name",
    "lastSignedInAt": "2025-01-15T10:00:00.000Z",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  },
  "expiresAt": "2025-02-14T10:00:00.000Z"
}
```

Note: This endpoint does not return `sessionToken` or `sessionId` -- only the user and expiration.

**Errors**

- `401 unauthorized` -- No session token provided, or the session is invalid or expired.

---

## Sign Out

```
POST /api/auth/signout
```

Invalidates the current session by deleting it from the database.

**Headers**

| Header                   | Description                      |
| ------------------------ | -------------------------------- |
| `x-nova-session-token`   | Session token to invalidate.    |

**Response** `204 No Content`

If no session token is provided, the request succeeds silently (no-op).
