// Small helpers for the markup this engine writes and reads. Scene sources are our own
// format (double-quoted attributes only), so regexes are enough; no DOM library needed.

export const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ATTR = /([^\s=/>]+)(?:\s*=\s*"([^"]*)")?/g;

// '  id="a" data-x="1" hidden' → [['id','a'], ['data-x','1'], ['hidden','']]
export function parseAttrs(str = '') {
  const out = [];
  let m;
  ATTR.lastIndex = 0;
  while ((m = ATTR.exec(str))) out.push([m[1], m[2] ?? '']);
  return out;
}

export const attrsObject = (list) => Object.fromEntries(list);
export const attrsString = (list) => list.map(([k, v]) => ` ${k}="${v}"`).join('');

// Apply fn to the parts of an HTML string that are outside <script> and <style> blocks.
export function mapOutsideCode(html, fn) {
  const parts = html.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/i);
  return parts.map((p, i) => (i % 2 ? p : fn(p))).join('');
}

// Every opening tag outside code blocks: fn(tagName, attrList, selfClosing) → new tag or null.
export function mapTags(html, fn) {
  return mapOutsideCode(html, (seg) => seg.replace(/<([a-zA-Z][\w-]*)((?:\s+[^\s>"'=/]+(?:\s*=\s*"[^"]*")?)*)\s*(\/?)>/g,
    (tag, name, attrs, slash) => fn(name, parseAttrs(attrs), !!slash) ?? tag));
}
