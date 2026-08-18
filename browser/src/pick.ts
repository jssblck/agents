// A page element the user pointed at. Mentions resolve this into agent
// context at send time so the model sees the selector, HTML, and source,
// not just the chip label.

export const PICK_TIMEOUT_MS = 90_000;
export const HTML_PREVIEW_LIMIT = 4_000;
export const STYLES_LIMIT = 2_000;
export const TEXT_LIMIT = 500;
export const LABEL_TAG_MAX = 24;

export interface PickSource {
  functionName: string | null;
  fileName: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
}

export interface PickRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PickedElement {
  id: string;
  sessionKey: string;
  createdAt: string;
  pageUrl: string;
  pageTitle: string | null;
  tagName: string;
  selector: string | null;
  text: string;
  htmlPreview: string;
  styles: string;
  componentName: string | null;
  source: PickSource | null;
  rect: PickRect;
}

export interface RawPickResult {
  pageUrl?: unknown;
  pageTitle?: unknown;
  tagName?: unknown;
  selector?: unknown;
  text?: unknown;
  htmlPreview?: unknown;
  styles?: unknown;
  componentName?: unknown;
  source?: unknown;
  rect?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function normalizeMultiline(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "");
}

function parseSource(value: unknown): PickSource | null {
  if (!isRecord(value)) return null;
  const fileName = asString(value.fileName)?.trim() || null;
  const functionName = asString(value.functionName)?.trim() || null;
  const lineNumber = asFiniteNumber(value.lineNumber);
  const columnNumber = asFiniteNumber(value.columnNumber);
  if (!fileName && !functionName && lineNumber === null) return null;
  return { fileName, functionName, lineNumber, columnNumber };
}

function parseRect(value: unknown): PickRect {
  if (!isRecord(value)) return { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: asFiniteNumber(value.x) ?? 0,
    y: asFiniteNumber(value.y) ?? 0,
    width: Math.max(0, asFiniteNumber(value.width) ?? 0),
    height: Math.max(0, asFiniteNumber(value.height) ?? 0),
  };
}

export function newPickId(): string {
  return `el_${crypto.randomUUID().slice(0, 8)}`;
}

/** Parse the extension's pick payload into a stored element. */
export function parsePickedElement(
  raw: unknown,
  meta: { id: string; sessionKey: string; createdAt: string },
): PickedElement | null {
  if (!isRecord(raw)) return null;
  const pageUrl = asString(raw.pageUrl)?.trim() ?? "";
  const tagName = asString(raw.tagName)?.trim().toLowerCase() ?? "";
  if (!pageUrl || !tagName) return null;
  return {
    id: meta.id,
    sessionKey: meta.sessionKey,
    createdAt: meta.createdAt,
    pageUrl,
    pageTitle: asString(raw.pageTitle)?.trim() || null,
    tagName,
    selector: asString(raw.selector)?.trim() || null,
    text: truncate(normalizeMultiline(asString(raw.text) ?? ""), TEXT_LIMIT),
    htmlPreview: truncate(
      normalizeMultiline(asString(raw.htmlPreview) ?? ""),
      HTML_PREVIEW_LIMIT,
    ),
    styles: truncate(normalizeMultiline(asString(raw.styles) ?? ""), STYLES_LIMIT),
    componentName: asString(raw.componentName)?.trim() || null,
    source: parseSource(raw.source),
    rect: parseRect(raw.rect),
  };
}

function shortenTag(tagName: string): string {
  if (tagName.length <= LABEL_TAG_MAX) return tagName;
  return `${tagName.slice(0, LABEL_TAG_MAX - 1)}…`;
}

/** Compact chip label: `<SubmitButton>` when React named it, else `<button>`. */
export function formatPickLabel(pick: Pick<PickedElement, "tagName" | "componentName">): string {
  if (pick.componentName) return `<${pick.componentName}>`;
  return `<${shortenTag(pick.tagName)}>`;
}

function indent(value: string): string[] {
  return value.split("\n").map((line) => `  ${line}`);
}

/** Agent-visible context attached at send time. Hidden from the chat bubble. */
export function formatPickContext(pick: PickedElement): string {
  const lines = [`- ${formatPickLabel(pick)}:`];
  lines.push(`  url: ${pick.pageUrl}`);
  if (pick.pageTitle) lines.push(`  title: ${pick.pageTitle}`);
  if (pick.selector) lines.push(`  selector: ${pick.selector}`);
  if (pick.text) lines.push(`  text: ${pick.text}`);
  if (pick.source?.fileName) {
    const { fileName, lineNumber, columnNumber } = pick.source;
    const location =
      lineNumber == null
        ? fileName
        : `${fileName}:${lineNumber}${columnNumber == null ? "" : `:${columnNumber}`}`;
    lines.push(`  source: ${location}`);
  }
  if (pick.htmlPreview) {
    lines.push("  html:");
    lines.push(...indent(pick.htmlPreview));
  }
  if (pick.styles) {
    lines.push("  styles:");
    lines.push(...indent(pick.styles));
  }
  return ["<element_context>", ...lines, "</element_context>"].join("\n");
}
