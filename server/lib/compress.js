const zlib = require("zlib");

function compressJson(value) {
  const raw = Buffer.from(JSON.stringify(value), "utf8");
  const compressed = zlib.brotliCompressSync(raw, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  });
  return {
    b64: compressed.toString("base64"),
    size: compressed.length,
    rawSize: raw.length,
  };
}

function decompressJson(b64) {
  if (!b64) return null;
  const buf = zlib.brotliDecompressSync(Buffer.from(b64, "base64"));
  return JSON.parse(buf.toString("utf8"));
}

module.exports = { compressJson, decompressJson };
