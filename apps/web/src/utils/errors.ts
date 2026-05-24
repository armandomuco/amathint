const SERVER_UNAVAILABLE = "SERVER_UNAVAILABLE";

export function chatErrorMessage(err: unknown, fallback: string, serverProblem: string) {
  if (err instanceof Error && err.message === SERVER_UNAVAILABLE) {
    return serverProblem;
  }
  return err instanceof Error ? err.message : fallback;
}
