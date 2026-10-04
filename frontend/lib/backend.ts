export const MAX_TEXT_CHARS = 20_000;

export function backendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
}

export type StepEvent = {
  step: string;
  status: "start" | "done";
  data?: Record<string, unknown>;
};

/** Read a newline-delimited JSON response as a stream of events. */
export async function* readEvents(response: Response): AsyncGenerator<StepEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line) as StepEvent;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as StepEvent;
}
