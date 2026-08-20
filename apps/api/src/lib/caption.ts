// Fixed caption format - no AI, no templating engine. TITLE / EXCERPT / Read More: URL.
export function buildCaption(article: { title: string; excerpt: string; url: string }): string {
  const parts = [article.title.trim()];
  if (article.excerpt.trim()) parts.push(article.excerpt.trim());
  parts.push(`Read More:\n${article.url}`);
  return parts.join("\n\n");
}
