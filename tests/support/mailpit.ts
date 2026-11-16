// Reads auth emails from the local Mailpit (https://mailpit.axllent.org/docs/api-v1/).

interface MailpitSearch {
  messages: { ID: string }[];
}

/** The first link in the newest email sent to `to` whose href contains `contains`, or null. */
export async function findEmailLink(
  mailpitUrl: string,
  to: string,
  contains: string,
): Promise<string | null> {
  const query = encodeURIComponent(`to:"${to}"`);
  const search = (await (
    await fetch(`${mailpitUrl}/api/v1/search?query=${query}`)
  ).json()) as MailpitSearch;
  const newest = search.messages[0];
  if (!newest) return null;

  const message = (await (await fetch(`${mailpitUrl}/api/v1/message/${newest.ID}`)).json()) as {
    HTML: string;
  };
  for (const [, href] of message.HTML.matchAll(/href="([^"]+)"/g)) {
    const link = href!.replaceAll('&amp;', '&');
    if (link.includes(contains)) return link;
  }
  return null;
}
