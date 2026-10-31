// JSON uploads keep the same CSRF checks as other writes. Validate bytes, not the supplied MIME alone.
export function decodeUpload(value: unknown, maxBytes: number): Buffer | undefined {
  if (typeof value !== 'string' || !value || value.length % 4 !== 0 || value.length > Math.ceil(maxBytes / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return;
  const bytes = Buffer.from(value, 'base64');
  if (!bytes.length || bytes.length > maxBytes || bytes.toString('base64') !== value) return;
  return bytes;
}

export function imageType(bytes: Buffer) {
  if (bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
}
