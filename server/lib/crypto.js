const crypto = require("crypto");

function masterKey() {
  const raw = process.env.APP_ENCRYPTION_KEY || "";
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest();
}

function encryptSecret(text) {
  if (!text) return null;
  const key = masterKey();
  if (!key) {
    return "plain:" + Buffer.from(String(text), "utf8").toString("base64");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

function decryptSecret(payload) {
  if (!payload) return null;
  if (payload.startsWith("plain:")) {
    return Buffer.from(payload.slice(6), "base64").toString("utf8");
  }
  if (!payload.startsWith("v1:")) return payload;
  const key = masterKey();
  if (!key) throw new Error("APP_ENCRYPTION_KEY is required to decrypt stored keys");
  const [, ivB64, tagB64, dataB64] = payload.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function keyHint(payload) {
  try {
    const value = decryptSecret(payload);
    if (!value) return null;
    return value.length <= 4 ? "••••" : "••••" + value.slice(-4);
  } catch {
    return "••••";
  }
}

module.exports = { encryptSecret, decryptSecret, keyHint };
