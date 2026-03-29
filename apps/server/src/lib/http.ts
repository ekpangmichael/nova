import { z } from "zod";
import { badRequest } from "./errors.js";

export const parseOrThrow = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw badRequest("Invalid request payload.", parsed.error.flatten());
  }

  return parsed.data;
};
