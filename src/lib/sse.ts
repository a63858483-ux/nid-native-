export type SseEvent = { event: string; data: any };

// Splits a text stream into `event:/data:` frames separated by a blank line.
export class SseParser {
  private buf = '';

  push(chunk: string): SseEvent[] {
    this.buf += chunk;
    const parts = this.buf.split(/\r?\n\r?\n/);
    this.buf = parts.pop() ?? '';
    return parts.map(parseFrame).filter((e): e is SseEvent => e !== null);
  }

  flush(): SseEvent[] {
    const rest = this.buf;
    this.buf = '';
    const e = rest.trim() ? parseFrame(rest) : null;
    return e ? [e] : [];
  }
}

function parseFrame(frame: string): SseEvent | null {
  let event = '';
  let data = '';
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!event || !data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}
