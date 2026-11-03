const { defaultModel } = require("../lib/account");

class AiError extends Error {
  constructor(message, status = 502, code = "ai_error") {
    super(message);
    this.name = "AiError";
    this.status = status;
    this.code = code;
  }
}

function extractJson(text) {
  let value = String(text || "").trim();
  value = value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new AiError("Model không trả về JSON hợp lệ.", 502, "invalid_json");
  }
  const candidate = value.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    throw new AiError("Model trả về JSON không đọc được.", 502, "invalid_json");
  }
}

async function requestJson(url, options = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const providerMessage =
        data?.error?.message ||
        (typeof data?.error === "string" ? data.error : "") ||
        text.slice(0, 400) ||
        `HTTP ${res.status}`;
      throw new AiError(providerMessage, res.status, "provider_http");
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new AiError(
        "Model phản hồi quá lâu. Hãy thử model nhẹ hơn hoặc thử lại.",
        504,
        "timeout"
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function geminiUrl(model, action, key) {
  const cleanModel = String(model || defaultModel("gemini")).replace(/^models\//, "");
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    cleanModel
  )}:${action}?key=${encodeURIComponent(key)}`;
}

async function geminiGenerate({ key, model, system, user, maxTokens, temperature }) {
  const data = await requestJson(geminiUrl(model, "generateContent", key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: temperature ?? 0.35,
        maxOutputTokens: maxTokens ?? 4096,
        responseMimeType: "application/json",
      },
    }),
  });

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || "";
  if (!text) throw new AiError("Gemini không trả về nội dung.", 502, "empty");
  return extractJson(text);
}

async function openRouterGenerate({
  key,
  model,
  system,
  user,
  maxTokens,
  temperature,
}) {
  const url = "https://openrouter.ai/api/v1/chat/completions";
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.APP_URL || "http://localhost:5173",
    "X-Title": "AI Learning Engine",
  };
  const body = {
    model: model || defaultModel("openrouter"),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: temperature ?? 0.35,
    max_tokens: maxTokens ?? 4096,
    response_format: { type: "json_object" },
  };

  let data;
  try {
    data = await requestJson(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error?.status === 400 || error?.status === 422) {
      delete body.response_format;
      data = await requestJson(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } else {
      throw error;
    }
  }

  const content = data?.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map((part) => part.text || "").join("")
    : String(content || "");
  if (!text) throw new AiError("OpenRouter không trả về nội dung.", 502, "empty");
  return extractJson(text);
}

async function geminiModels(key) {
  const data = await requestJson(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
      key
    )}`
  );
  return (data?.models || [])
    .map((model) => ({
      id: String(model.name || "").replace(/^models\//, ""),
      name: model.displayName || String(model.name || "").replace(/^models\//, ""),
      context_length: model.inputTokenLimit || null,
      pricing: null,
    }))
    .filter((model) => model.id);
}

async function openRouterModels() {
  const data = await requestJson("https://openrouter.ai/api/v1/models", {}, 30000);
  return (data?.data || [])
    .map((model) => ({
      id: model.id,
      name: model.name || model.id,
      context_length: model.context_length || null,
      pricing: model.pricing || null,
    }))
    .filter((model) => model.id);
}

async function testGemini({ key, model }) {
  const models = await geminiModels(key);
  const wanted = String(model || defaultModel("gemini")).replace(/^models\//, "");
  if (wanted && !models.some((item) => item.id === wanted)) {
    throw new AiError(
      `Không tìm thấy model "${wanted}" trong tài khoản Gemini.`,
      404,
      "model_not_found"
    );
  }
  return {
    ok: true,
    message: `Kết nối Gemini thành công. Model ${wanted} khả dụng.`,
    models: models.map((item) => item.id),
  };
}

async function testOpenRouter({ key, model }) {
  await requestJson(
    "https://openrouter.ai/api/v1/key",
    { headers: { Authorization: `Bearer ${key}` } },
    30000
  );
  const models = await openRouterModels();
  const wanted = model || defaultModel("openrouter");
  if (wanted && !models.some((item) => item.id === wanted)) {
    throw new AiError(
      `Không tìm thấy model "${wanted}" trên OpenRouter.`,
      404,
      "model_not_found"
    );
  }
  return {
    ok: true,
    message: `Kết nối OpenRouter thành công. Model ${wanted} khả dụng.`,
    models: models.map((item) => item.id).slice(0, 1000),
  };
}

function getProvider({ provider, key, model }) {
  if (!key) throw new AiError("Chưa có API key.", 400, "no_key");
  if (provider === "openrouter") {
    return {
      provider,
      model: model || defaultModel("openrouter"),
      generateJson: (input) =>
        openRouterGenerate({ ...input, key, model: model || defaultModel("openrouter") }),
      test: () => testOpenRouter({ key, model }),
      listModels: () => openRouterModels(),
    };
  }
  return {
    provider: "gemini",
    model: model || defaultModel("gemini"),
    generateJson: (input) =>
      geminiGenerate({ ...input, key, model: model || defaultModel("gemini") }),
    test: () => testGemini({ key, model }),
    listModels: () => geminiModels(key),
  };
}

module.exports = {
  AiError,
  getProvider,
  extractJson,
  openRouterModels,
  geminiModels,
};
