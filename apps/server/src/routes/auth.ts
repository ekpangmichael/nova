import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { parseOrThrow } from "../lib/http.js";
import { unauthorized } from "../lib/errors.js";

const signUpSchema = z.object({
  displayName: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const googleSignInSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(1),
  googleSub: z.string().trim().min(1),
  emailVerified: z.boolean(),
});

const readSessionToken = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/signup", async (request) => {
    const body = parseOrThrow(signUpSchema, request.body);
    return app.services.auth.signUp(body);
  });

  app.post("/auth/signin", async (request) => {
    const body = parseOrThrow(signInSchema, request.body);
    return app.services.auth.signIn(body);
  });

  app.post("/auth/google", async (request) => {
    const body = parseOrThrow(googleSignInSchema, request.body);
    return app.services.auth.signInWithGoogle(body);
  });

  app.get("/auth/session", async (request) => {
    const sessionToken = readSessionToken(request.headers["x-nova-session-token"]);

    if (!sessionToken) {
      throw unauthorized("Authentication required.");
    }

    return app.services.auth.getSessionByToken(sessionToken);
  });

  app.post("/auth/signout", async (request, reply) => {
    const sessionToken = readSessionToken(request.headers["x-nova-session-token"]);
    await app.services.auth.signOut(sessionToken);
    return reply.code(204).send();
  });
};
