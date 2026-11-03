const { keyHint } = require("./crypto");

function defaultModel(provider) {
  if (provider === "openrouter") {
    return process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  }
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function publicAccount(account) {
  if (!account) return null;
  const providers = ["gemini", "openrouter"];
  const ai = {};
  for (const provider of providers) {
    const cfg = account.aiConfigs?.[provider] || null;
    ai[provider] = {
      provider,
      model: cfg?.model || defaultModel(provider),
      hasKey: !!cfg?.keyEnc,
      keyHint: cfg?.keyEnc ? keyHint(cfg.keyEnc) : null,
    };
  }
  return {
    code: account.code,
    createdAt: account.createdAt,
    activeProvider: account.activeProvider || "gemini",
    ai,
  };
}

module.exports = { defaultModel, publicAccount };
