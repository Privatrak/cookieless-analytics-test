/**
 * Percent-decodes every run of `%XX` escapes that forms valid UTF-8 and leaves
 * the rest as it is (where `decodeURIComponent` would reject the whole text).
 */
export function decode(text: string): string {
  return text.replace(/(?:%[0-9a-f]{2})+/gi, (escapes) => {
    try {
      return decodeURIComponent(escapes);
    } catch {
      return escapes;
    }
  });
}

/**
 * Text as a reader would see it: percent-decoded twice (some tools encode an
 * address that was already encoded) and with `+` as a space.
 */
export function readable(text: string | null | undefined): string {
  return decode(decode(text ?? '')).replaceAll('+', ' ');
}
