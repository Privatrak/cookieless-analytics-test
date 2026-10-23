/** A Markdown table: one header row, then one row per entry. */
export function markdownTable(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const line = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}
