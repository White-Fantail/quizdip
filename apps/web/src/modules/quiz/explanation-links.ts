/** Present source citations without mutating saved quiz explanations. */
export type ExplanationSegment = { text: string; href?: string };

const URL_PATTERN = /(?:https?:\/\/|https?%3a%2f%2f|https?%253a%252f%252f|www\.)[^\s<>"'\x60]+/gi;

/** Decode valid URI escape runs, leaving malformed escapes and ordinary percent signs alone. */
export function readableExplanationText(value: string): string {
  let current = value;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = current.replace(/(?:%[\da-f]{2})+/gi, (run) => {
      try { return decodeURIComponent(run); } catch { return run; }
    });
    if (next === current) break;
    current = next;
  }
  return current;
}

function splitTrailingPunctuation(value: string): [string, string] {
  let end = value.length;
  while (end > 0) {
    const char = value[end - 1];
    if (/[.,!?;:，。！？；：]/u.test(char)) { end -= 1; continue; }
    if ((char === ")" && (value.slice(0, end).match(/\)/g)?.length ?? 0) >
      (value.slice(0, end).match(/\(/g)?.length ?? 0)) ||
      (char === "]" && (value.slice(0, end).match(/\]/g)?.length ?? 0) >
      (value.slice(0, end).match(/\[/g)?.length ?? 0))) {
      end -= 1;
      continue;
    }
    break;
  }
  return [value.slice(0, end), value.slice(end)];
}

function safeLink(value: string): string | undefined {
  const decoded = readableExplanationText(value);
  const candidate = /^www\./i.test(decoded) ? "https://" + decoded : decoded;
  try {
    const url = new URL(candidate);
    if (!(["http:", "https:"].includes(url.protocol)) || !url.hostname || url.username || url.password) return undefined;
    return url.href;
  } catch { return undefined; }
}

export function explanationSegments(value: string): ExplanationSegment[] {
  const parts: ExplanationSegment[] = [];
  const appendText = (text: string) => {
    const decoded = readableExplanationText(text);
    if (!decoded) return;
    const last = parts[parts.length - 1];
    if (last && !last.href) last.text += decoded;
    else parts.push({ text: decoded });
  };
  let cursor = 0;
  for (const match of value.matchAll(URL_PATTERN)) {
    const start = match.index;
    const [rawUrl, suffix] = splitTrailingPunctuation(match[0]);
    const href = safeLink(rawUrl);
    const preceding = value.slice(cursor, start);
    const markdownLabel = preceding.match(/\[([^\]\r\n]{1,180})\]\($/);
    if (href && markdownLabel && suffix.startsWith(")")) {
      appendText(preceding.slice(0, -markdownLabel[0].length));
      parts.push({ text: readableExplanationText(markdownLabel[1]), href });
      appendText(suffix.slice(1));
    } else {
      appendText(preceding);
      if (href) parts.push({ text: readableExplanationText(rawUrl), href });
      else appendText(rawUrl);
      appendText(suffix);
    }
    cursor = start + match[0].length;
  }
  appendText(value.slice(cursor));
  return parts;
}
