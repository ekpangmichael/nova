export class AuthClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthClientError";
    this.status = status;
  }
}

export type PasswordAuthResult = {
  user: {
    id: string;
    email: string;
    displayName: string;
    lastSignedInAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  expiresAt: string;
};

type PasswordSignInInput = {
  email: string;
  password: string;
};

type PasswordSignUpInput = PasswordSignInInput & {
  displayName: string;
};

const authRequest = async <T>(
  path: "signin" | "signup" | "signout",
  init: RequestInit
): Promise<T> => {
  const response = await fetch(`/api/auth/${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let payload: { error?: { message?: string }; message?: string } | null = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    throw new AuthClientError(
      payload?.error?.message ?? payload?.message ?? "Authentication request failed.",
      response.status
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const signInWithPassword = (payload: PasswordSignInInput) =>
  authRequest<PasswordAuthResult>("signin", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const signUpWithPassword = (payload: PasswordSignUpInput) =>
  authRequest<PasswordAuthResult>("signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const signOut = () =>
  authRequest<void>("signout", {
    method: "POST",
  });
