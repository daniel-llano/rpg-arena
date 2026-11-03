const tokenKey = (runId: string) => `rpg-arena.token.${runId}`;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** The run token proves you started the run. It stays in this browser only. */
export function readToken(runId: string): string | null {
  try {
    return localStorage.getItem(tokenKey(runId));
  } catch {
    return null;
  }
}

export function writeToken(runId: string, token: string) {
  try {
    localStorage.setItem(tokenKey(runId), token);
  } catch {
    // Private mode: the run still works until the tab closes.
  }
}

interface Problem {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

export async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  if (token) headers.set("X-Run-Token", token);

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError(0, "Can't reach the arena. Check your connection and try again.");
  }

  if (!response.ok) {
    if (response.status === 429) throw new ApiError(429, "Slow down a little and try again.");
    let message = `Request failed (${response.status}).`;
    try {
      const problem = (await response.json()) as Problem;
      message = Object.values(problem.errors ?? {}).flat().join(" ") || problem.detail || problem.title || message;
    } catch {
      // Not a problem body, keep the generic message.
    }
    throw new ApiError(response.status, message);
  }
  return (await response.json()) as T;
}
