export function unescapeHTML(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

export function weakEscapeHTML(text: string) {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
