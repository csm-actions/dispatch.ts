import { inspect } from "node:util";

/**
 * Formats an error without throwing.
 *
 * Values which JSON can't serialize, such as circular structures and BigInt,
 * are formatted by util.inspect.
 */
export const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  try {
    const s = JSON.stringify(error);
    if (s !== undefined) {
      return s;
    }
  } catch {
    // fall through
  }
  return inspect(error);
};
