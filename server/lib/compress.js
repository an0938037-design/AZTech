const zlib = require("zlib");

function compressJson(value) {
  const raw = Buffer.from(JSON.stringify(value), "utf8");
  /* Quality 11 nén 145KB mất 150ms và chặn event loop; quality 6 chỉ 4ms mà
     file lớn hơn 1.4% — đổi lấy độ trễ lưu/đọc bài thấp hơn nhiều. */
  const compressed = zlib.brotliCompressSync(raw, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 },
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
