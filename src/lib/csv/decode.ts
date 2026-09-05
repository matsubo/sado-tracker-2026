/**
 * The result export is Shift_JIS. Node and modern browsers both ship a
 * shift_jis decoder, so no dependency is needed.
 */
export function decodeCp932(buffer: ArrayBuffer | ArrayBufferView): string {
  const decoder = new TextDecoder("shift_jis", { fatal: false });
  return decoder.decode(buffer);
}
