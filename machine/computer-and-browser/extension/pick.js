// In-page element picker. These functions are serialized into the tab by
// chrome.scripting, so they must stay self-contained: no imports, no
// module-level state the next injection cannot see.

const CANCEL_EVENT = "agent-browser-pick-cancel";
const HOST_ATTR = "data-agent-browser-pick";

const STYLE_PROPS = [
  "display",
  "position",
  "color",
  "background-color",
  "font",
  "width",
  "height",
  "padding",
  "margin",
  "border",
  "border-radius",
];

export function cancelPickSession() {
  document.dispatchEvent(new CustomEvent(CANCEL_EVENT));
  return { cancelled: true };
}

export function runPickSession() {
  return new Promise((resolve) => {
    const existing = document.querySelector(`[${HOST_ATTR}]`);
    if (existing) existing.remove();

    const previousCursor = document.documentElement.style.cursor;
    document.documentElement.style.cursor = "crosshair";

    const host = document.createElement("div");
    host.setAttribute(HOST_ATTR, "");
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "none";
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .box {
          position: fixed;
          pointer-events: none;
          border: 2px solid #3b82f6;
          background: rgb(59 130 246 / 12%);
          box-sizing: border-box;
        }
        .label, .hint {
          position: fixed;
          pointer-events: none;
          font: 12px/1.3 ui-sans-serif, system-ui, sans-serif;
          color: #fff;
          background: #111827;
          padding: 3px 7px;
          border-radius: 4px;
          max-width: min(420px, 80vw);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .hint {
          left: 50%;
          bottom: 16px;
          transform: translateX(-50%);
        }
      </style>
      <div class="box" hidden></div>
      <div class="label" hidden></div>
      <div class="hint">Click an element · Esc cancels</div>
    `;
    const box = shadow.querySelector(".box");
    const label = shadow.querySelector(".label");
    document.documentElement.append(host);

    let current = null;
    let settled = false;

    const isHost = (node) =>
      node === host || (node instanceof Element && node.closest(`[${HOST_ATTR}]`));

    const elementFromPoint = (x, y) => {
      const stack = document.elementsFromPoint(x, y);
      return stack.find((node) => node instanceof Element && !isHost(node)) ?? null;
    };

    const cssPath = (element) => {
      if (element.id) {
        const escaped = CSS.escape(element.id);
        if (document.querySelectorAll(`#${escaped}`).length === 1) return `#${escaped}`;
      }
      const testId = element.getAttribute("data-testid");
      if (testId) {
        const selector = `[data-testid="${CSS.escape(testId)}"]`;
        if (document.querySelectorAll(selector).length === 1) return selector;
      }
      const parts = [];
      let node = element;
      while (node && node.nodeType === 1 && node !== document.documentElement) {
        const tag = node.tagName.toLowerCase();
        if (node.id) {
          parts.unshift(`${tag}#${CSS.escape(node.id)}`);
          break;
        }
        const parent = node.parentElement;
        if (!parent) {
          parts.unshift(tag);
          break;
        }
        const siblings = [...parent.children].filter((child) => child.tagName === node.tagName);
        const index = siblings.indexOf(node) + 1;
        parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
        node = parent;
        if (parts.length > 8) break;
      }
      return parts.join(" > ");
    };

    const reactInfo = (element) => {
      const key = Object.keys(element).find(
        (name) => name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$"),
      );
      if (!key) return { componentName: null, source: null };
      let fiber = element[key];
      for (let depth = 0; fiber && depth < 12; depth += 1) {
        const type = fiber.type;
        const name =
          (typeof type === "function" && (type.displayName || type.name)) ||
          (typeof type === "object" && type && (type.displayName || type.name)) ||
          null;
        const debugSource = fiber._debugSource;
        const source = debugSource
          ? {
              fileName: debugSource.fileName ?? null,
              lineNumber: debugSource.lineNumber ?? null,
              columnNumber: debugSource.columnNumber ?? null,
              functionName: name,
            }
          : null;
        if (name && name[0] !== name[0].toLowerCase()) {
          return { componentName: name, source };
        }
        if (source) return { componentName: name, source };
        fiber = fiber.return;
      }
      return { componentName: null, source: null };
    };

    const authorStyles = (element) => {
      const computed = getComputedStyle(element);
      return STYLE_PROPS.map((prop) => `${prop}: ${computed.getPropertyValue(prop)};`).join("\n");
    };

    const paint = (element) => {
      current = element;
      const rect = element.getBoundingClientRect();
      box.hidden = false;
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${Math.max(0, rect.width)}px`;
      box.style.height = `${Math.max(0, rect.height)}px`;
      const { componentName } = reactInfo(element);
      label.hidden = false;
      label.textContent = componentName
        ? `<${componentName}> ${element.tagName.toLowerCase()}`
        : `<${element.tagName.toLowerCase()}>`;
      const top = rect.top > 28 ? rect.top - 24 : rect.bottom + 6;
      label.style.left = `${Math.max(8, rect.left)}px`;
      label.style.top = `${Math.max(8, top)}px`;
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener(CANCEL_EVENT, onCancel, true);
      document.documentElement.style.cursor = previousCursor;
      host.remove();
      resolve(value);
    };

    const onCancel = () => finish(null);

    const onMove = (event) => {
      const element = elementFromPoint(event.clientX, event.clientY);
      if (element) paint(element);
    };

    const onClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const element = current ?? elementFromPoint(event.clientX, event.clientY);
      if (!element) {
        finish(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      const { componentName, source } = reactInfo(element);
      finish({
        pageUrl: location.href,
        pageTitle: document.title || null,
        tagName: element.tagName.toLowerCase(),
        selector: cssPath(element),
        text: (element.innerText || element.textContent || "").trim().slice(0, 500),
        htmlPreview: (element.outerHTML || "").slice(0, 4000),
        styles: authorStyles(element),
        componentName,
        source,
        rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      });
    };

    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      finish(null);
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener(CANCEL_EVENT, onCancel, true);
  });
}
