/** The networks a reader can send a page to. */
export type ShareNetwork = "x" | "facebook" | "line";

/**
 * The address to share. Only the origin and path travel: a query string can
 * carry a `?bibs=` list, and who someone is following is theirs. Rebuilding
 * the URL rather than trimming it means a parameter added later cannot leak
 * by being forgotten here.
 */
export function shareUrl(href: string): string {
  const url = new URL(href);
  return `${url.origin}${url.pathname}`;
}

/** Where a share button sends the reader, per network. */
export function shareHref(network: ShareNetwork, url: string, text: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  switch (network) {
    case "x":
      return `https://x.com/intent/post?text=${t}&url=${u}`;
    case "facebook":
      // Facebook takes no text of its own; it reads the page's Open Graph tags.
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "line":
      return `https://social-plugins.line.me/lineit/share?url=${u}&text=${t}`;
  }
}
