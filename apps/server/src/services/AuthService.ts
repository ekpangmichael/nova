import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { userSessions, users, type AppDatabase } from "@nova/db";
import { badRequest, conflict, unauthorized } from "../lib/errors.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { createSessionToken, hashSessionToken } from "../lib/session-tokens.js";

const PASSWORD_MIN_LENGTH = 8;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

type AuthUserRow = typeof users.$inferSelect;

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  lastSignedInAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  user: AuthenticatedUser;
  expiresAt: string;
};

type SessionResult = AuthSession & {
  sessionToken: string;
  sessionId: string;
};

type SignUpInput = {
  displayName: string;
  email: string;
  password: string;
};

type SignInInput = {
  email: string;
  password: string;
};

type GoogleSignInInput = {
  email: string;
  displayName: string;
  googleSub: string;
  emailVerified: boolean;
};

const nowIso = () => new Date().toISOString();

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const buildDefaultDisplayName = (email: string) => {
  const [localPart] = email.split("@");
  return localPart || "Operator";
};

export class AuthService {
  readonly #db: AppDatabase;

  constructor(db: AppDatabase) {
    this.#db = db;
  }

  async signUp(input: SignUpInput): Promise<SessionResult> {
    const email = normalizeEmail(input.email);
    const displayName = input.displayName.trim() || buildDefaultDisplayName(email);
    const password = input.password;

    this.#validateCredentials(email, password);

    const existingUser = await this.#db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (existingUser) {
      throw conflict("An account with that email already exists.");
    }

    const now = nowIso();
    const userId = randomUUID();
    const passwordHash = await hashPassword(password);

    await this.#db
      .insert(users)
      .values({
        id: userId,
        email,
        displayName,
        passwordHash,
        lastSignedInAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const createdUser = await this.#requireUser(userId);
    return this.#createSession(createdUser);
  }

  async signIn(input: SignInInput): Promise<SessionResult> {
    const email = normalizeEmail(input.email);
    const password = input.password;

    this.#validateCredentials(email, password);

    const user = await this.#db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (!user) {
      throw unauthorized("Invalid email or password.");
    }

    const validPassword = await verifyPassword(password, user.passwordHash);

    if (!validPassword) {
      throw unauthorized("Invalid email or password.");
    }

    const now = nowIso();

    await this.#db
      .update(users)
      .set({
        lastSignedInAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id))
      .run();

    const updatedUser = await this.#requireUser(user.id);
    return this.#createSession(updatedUser);
  }

  async signInWithGoogle(input: GoogleSignInInput): Promise<SessionResult> {
    const email = normalizeEmail(input.email);
    const displayName = input.displayName.trim() || buildDefaultDisplayName(email);
    const googleSub = input.googleSub.trim();

    if (!input.emailVerified) {
      throw unauthorized("Google account email is not verified.");
    }

    if (!email || !googleSub) {
      throw badRequest("Google account details are incomplete.");
    }

    const now = nowIso();
    const existingGoogleUser = await this.#db
      .select()
      .from(users)
      .where(eq(users.googleSub, googleSub))
      .get();

    if (existingGoogleUser) {
      await this.#db
        .update(users)
        .set({
          displayName,
          lastSignedInAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, existingGoogleUser.id))
        .run();

      return this.#createSession(await this.#requireUser(existingGoogleUser.id));
    }

    const existingEmailUser = await this.#db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (existingEmailUser) {
      await this.#db
        .update(users)
        .set({
          displayName,
          googleSub,
          lastSignedInAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, existingEmailUser.id))
        .run();

      return this.#createSession(await this.#requireUser(existingEmailUser.id));
    }

    const userId = randomUUID();

    await this.#db
      .insert(users)
      .values({
        id: userId,
        email,
        displayName,
        passwordHash: "oauth:google",
        googleSub,
        lastSignedInAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return this.#createSession(await this.#requireUser(userId));
  }

  async getSessionByToken(sessionToken: string): Promise<AuthSession> {
    const session = await this.#getValidSession(sessionToken);

    return {
      user: this.#serializeUser(session.user),
      expiresAt: session.session.expiresAt,
    };
  }

  async signOut(sessionToken: string | null | undefined) {
    if (!sessionToken) {
      return;
    }

    await this.#db
      .delete(userSessions)
      .where(eq(userSessions.sessionTokenHash, hashSessionToken(sessionToken)))
      .run();
  }

  async #createSession(user: AuthUserRow): Promise<SessionResult> {
    const now = nowIso();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const sessionId = randomUUID();
    const { token, tokenHash } = createSessionToken();

    await this.#db
      .insert(userSessions)
      .values({
        id: sessionId,
        userId: user.id,
        sessionTokenHash: tokenHash,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return {
      user: this.#serializeUser(user),
      expiresAt,
      sessionToken: token,
      sessionId,
    };
  }

  async #getValidSession(sessionToken: string) {
    const row = await this.#db
      .select({
        session: userSessions,
        user: users,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .where(eq(userSessions.sessionTokenHash, hashSessionToken(sessionToken)))
      .get();

    if (!row) {
      throw unauthorized("Authentication required.");
    }

    if (new Date(row.session.expiresAt).getTime() <= Date.now()) {
      await this.#db
        .delete(userSessions)
        .where(eq(userSessions.id, row.session.id))
        .run();
      throw unauthorized("Session expired. Please sign in again.");
    }

    return row;
  }

  async #requireUser(userId: string) {
    const user = await this.#db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!user) {
      throw unauthorized("Authentication required.");
    }

    return user;
  }

  #validateCredentials(email: string, password: string) {
    if (!email) {
      throw badRequest("Email is required.");
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      throw badRequest(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    }
  }

  #serializeUser(user: AuthUserRow): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      lastSignedInAt: user.lastSignedInAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
