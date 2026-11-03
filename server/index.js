const { loadEnv } = require("./lib/env");
loadEnv();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const storage = require("./storage");
const { encryptSecret, decryptSecret } = require("./lib/crypto");
const { publicAccount, defaultModel } = require("./lib/account");
const { AiError, getProvider, openRouterModels, geminiModels } = require("./ai/providers");
const prompts = require("./ai/prompts");
const validate = require("./ai/validate");

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((value) => value.trim())
      : true,
  })
);
app.use(express.json({ limit: "12mb" }));

function clientIp(req) {
  const header = req.headers["x-device-ip"];
  if (header) return String(header).split(",")[0].trim();
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function deviceCode(req) {
  return String(req.headers["x-device-code"] || req.query.deviceCode || "").trim();
}

async function requireAccount(req, res) {
  const code = deviceCode(req);
  if (!code) {
    res.status(401).json({ error: "no_device", message: "Thiếu mã thiết bị." });
    return null;
  }
  const account = await storage.getAccountByDevice(code);
  if (!account) {
    res.status(401).json({
      error: "no_account",
      message: "Thiết bị này chưa được gắn vào tài khoản nào.",
    });
    return null;
  }
  return account;
}

function requireProvider(account) {
  const provider = account.activeProvider || "gemini";
  const config = account.aiConfigs?.[provider];
  if (!config?.keyEnc) {
    throw new AiError(
      `Chưa cấu hình API key cho ${provider === "openrouter" ? "OpenRouter" : "Gemini"}.`,
      400,
      "no_key"
    );
  }
  const key = decryptSecret(config.keyEnc);
  return getProvider({
    provider,
    key,
    model: config.model || defaultModel(provider),
  });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, storage: storage.driver });
});

/* ------------------------------ Tài khoản ------------------------------ */

app.get(
  "/api/account",
  asyncHandler(async (req, res) => {
    const code = deviceCode(req);
    const account = code ? await storage.getAccountByDevice(code) : null;
    res.json({ account: publicAccount(account) });
  })
);

app.post(
  "/api/account/create",
  asyncHandler(async (req, res) => {
    const code = deviceCode(req);
    if (!code) {
      return res.status(400).json({ error: "no_device", message: "Thiếu mã thiết bị." });
    }
    const account = await storage.createAccount({
      deviceCode: code,
      ip: clientIp(req),
    });
    res.json({ account: publicAccount(account) });
  })
);

app.post(
  "/api/account/bind",
  asyncHandler(async (req, res) => {
    const code = deviceCode(req);
    const target = String(req.body?.code || "").trim();
    if (!code) {
      return res.status(400).json({ error: "no_device", message: "Thiếu mã thiết bị." });
    }
    if (!/^\d{8}$/.test(target)) {
      return res.status(400).json({
        error: "invalid_code",
        message: "Mã tài khoản phải gồm đúng 8 chữ số.",
      });
    }
    const account = await storage.bindDevice(code, target, clientIp(req));
    if (!account) {
      return res.status(404).json({
        error: "account_not_found",
        message: "Mã tài khoản không tồn tại.",
      });
    }
    res.json({ account: publicAccount(account) });
  })
);

/* -------------------------------- AI ---------------------------------- */

app.put(
  "/api/ai/settings",
  asyncHandler(async (req, res) => {
    const account = await requireAccount(req, res);
    if (!account) return;
    const provider = String(req.body?.provider || "").trim();
    if (!["gemini", "openrouter"].includes(provider)) {
      return res.status(400).json({
        error: "invalid_provider",
        message: "Provider phải là gemini hoặc openrouter.",
      });
    }
    const key = req.body?.key;
    const model = String(req.body?.model || "").trim();
    if (provider === "openrouter" && !model) {
      return res.status(400).json({
        error: "missing_model",
        message: "OpenRouter cần tên model, ví dụ google/gemini-2.5-flash.",
      });
    }
    if (key !== undefined && key !== null && String(key).trim().length > 0) {
      if (String(key).trim().length < 8) {
        return res.status(400).json({
          error: "invalid_key",
          message: "API key quá ngắn.",
        });
      }
    }
    const keyEnc =
      key === undefined
        ? undefined
        : String(key || "").trim()
          ? encryptSecret(String(key).trim())
          : null;
    const updated = await storage.saveAiConfig(account.code, provider, {
      keyEnc,
      model: model || defaultModel(provider),
    });
    res.json({ account: publicAccount(updated) });
  })
);

app.post(
  "/api/ai/active-provider",
  asyncHandler(async (req, res) => {
    const account = await requireAccount(req, res);
    if (!account) return;
    const provider = String(req.body?.provider || "").trim();
    if (!["gemini", "openrouter"].includes(provider)) {
      return res.status(400).json({
        error: "invalid_provider",
        message: "Provider phải là gemini hoặc openrouter.",
      });
    }
    if (!account.aiConfigs?.[provider]?.keyEnc) {
      return res.status(400).json({
        error: "no_key",
        message: "Provider này chưa có API key.",
      });
    }
    const updated = await storage.setActiveProvider(account.code, provider);
    res.json({ account: publicAccount(updated) });
  })
);

app.post(
  "/api/ai/test",
  asyncHandler(async (req, res) => {
    const account = await requireAccount(req, res);
    if (!account) return;
    const provider = String(req.body?.provider || "").trim();
    if (!["gemini", "openrouter"].includes(provider)) {
      return res.status(400).json({
        error: "invalid_provider",
        message: "Provider phải là gemini hoặc openrouter.",
      });
    }
    const config = account.aiConfigs?.[provider];
    const rawKey = String(req.body?.key || "").trim();
    const key = rawKey || (config?.keyEnc ? decryptSecret(config.keyEnc) : "");
    const model = String(req.body?.model || config?.model || defaultModel(provider)).trim();
    if (!key) {
      return res.status(400).json({
        error: "no_key",
        message: "Chưa có API key để kiểm tra.",
      });
    }
    const result = await getProvider({ provider, key, model }).test();
    res.json(result);
  })
);

app.get(
  "/api/ai/models",
  asyncHandler(async (req, res) => {
    const provider = String(req.query.provider || "openrouter").trim();
    if (provider === "openrouter") {
      return res.json({ models: await openRouterModels() });
    }
    const account = await requireAccount(req, res);
    if (!account) return;
    const config = account.aiConfigs?.gemini;
    if (!config?.keyEnc) {
      return res.status(400).json({
        error: "no_key",
        message: "Chưa có Gemini API key.",
      });
    }
    res.json({ models: await geminiModels(decryptSecret(config.keyEnc)) });
  })
);

app.post(
  "/api/ai/analyze",
  asyncHandler(async (req, res) => {
    const account = await requireAccount(req, res);
    if (!account) return;
    const provider = requireProvider(account);
    const subject = String(req.body?.subject || "Chung").trim();
    const topic = String(req.body?.topic || "Bài học").trim();
    const prompt = String(req.body?.prompt || "").trim();
    const notes = String(req.body?.notes || "").trim();

    const raw = await provider.generateJson({
      system:
        "Bạn là chuyên gia phân tích chương trình giáo dục Việt Nam. Chỉ trả về JSON hợp lệ, không markdown, không giải thích.",
      user: prompts.analysisPrompt({ subject, topic, prompt, notes }),
      maxTokens: 3200,
      temperature: 0.25,
    });
    const analysis = validate.validateAnalysis(raw, { subject, topic });
    res.json({ analysis });
  })
);

app.post(
  "/api/ai/lecture",
  asyncHandler(async (req, res) => {
    const account = await requireAccount(req, res);
    if (!account) return;
    const provider = requireProvider(account);
    const subject = String(req.body?.subject || "Chung").trim();
    const topic = String(req.body?.topic || "Bài học").trim();
    const analysis = validate.validateAnalysis(req.body?.analysis, {
      subject,
      topic,
    });

    const raw = await provider.generateJson({
      system:
        "Bạn là giáo viên biên soạn bài giảng phổ thông Việt Nam. Chỉ trả về JSON hợp lệ, không markdown ngoài nội dung.",
      user: prompts.lecturePrompt({ subject, topic, analysis }),
      maxTokens: 5000,
      temperature: 0.4,
    });
    res.json({ lecture: validate.validateLecture(raw) });
  })
);

app.post(
  "/api/ai/mindmap",
  asyncHandler(async (req, res) => {
    const account = await requireAccount(req, res);
    if (!account) return;
    const provider = requireProvider(account);
    const subject = String(req.body?.subject || "Chung").trim();
    const topic = String(req.body?.topic || "Bài học").trim();
    const analysis = validate.validateAnalysis(req.body?.analysis, {
      subject,
      topic,
    });

    const raw = await provider.generateJson({
      system:
        "Bạn là lập trình viên front-end. Chỉ trả về JSON hợp lệ, không markdown, không giải thích.",
      user: prompts.mindmapPrompt({ subject, topic, analysis }),
      maxTokens: 6000,
      temperature: 0.35,
    });
    res.json({ artifact: validate.validateArtifact(raw, "mindmap") });
  })
);

app.post(
  "/api/ai/interactive",
  asyncHandler(async (req, res) => {
    const account = await requireAccount(req, res);
    if (!account) return;
    const provider = requireProvider(account);
    const subject = String(req.body?.subject || "Chung").trim();
    const topic = String(req.body?.topic || "Bài học").trim();
    const analysis = validate.validateAnalysis(req.body?.analysis, {
      subject,
      topic,
    });

    const raw = await provider.generateJson({
      system:
        "Bạn là lập trình viên front-end. Chỉ trả về JSON hợp lệ, không markdown, không giải thích.",
      user: prompts.interactivePrompt({ subject, topic, analysis }),
      maxTokens: 6000,
      temperature: 0.35,
    });
    res.json({ artifact: validate.validateArtifact(raw, "interactive") });
  })
);

app.post(
  "/api/ai/quiz",
  asyncHandler(async (req, res) => {
    const account = await requireAccount(req, res);
    if (!account) return;
    const provider = requireProvider(account);
    const subject = String(req.body?.subject || "Chung").trim();
    const topic = String(req.body?.topic || "Bài học").trim();
    const analysis = validate.validateAnalysis(req.body?.analysis, {
      subject,
      topic,
    });
    const lecture = validate.validateLecture(req.body?.lecture);

    const raw = await provider.generateJson({
      system:
        "Bạn là giáo viên ra đề kiểm tra. Chỉ trả về JSON hợp lệ, không markdown, không giải thích.",
      user: prompts.quizPrompt({ subject, topic, analysis, lecture }),
      maxTokens: 3000,
      temperature: 0.35,
    });
    res.json({ quiz: validate.validateQuiz(raw) });
  })
);

/* ------------------------------- Bài học ------------------------------ */

app.get(
  "/api/lessons",
  asyncHandler(async (req, res) => {
    const account = await requireAccount(req, res);
    if (!account) return;
    res.json({ lessons: await storage.listLessons(account.code) });
  })
);

app.get(
  "/api/lessons/:id",
  asyncHandler(async (req, res) => {
    const account = await requireAccount(req, res);
    if (!account) return;
    const lesson = await storage.getLesson(account.code, req.params.id);
    if (!lesson) {
      return res.status(404).json({
        error: "lesson_not_found",
        message: "Không tìm thấy bài học.",
      });
    }
    res.json({ lesson });
  })
);

app.post(
  "/api/lessons",
  asyncHandler(async (req, res) => {
    const account = await requireAccount(req, res);
    if (!account) return;
    const lesson = validate.validateLessonForSave(req.body?.lesson);
    const saved = await storage.saveLesson(account.code, lesson);
    res.json({ lesson: saved });
  })
);

app.delete(
  "/api/lessons/:id",
  asyncHandler(async (req, res) => {
    const account = await requireAccount(req, res);
    if (!account) return;
    await storage.deleteLesson(account.code, req.params.id);
    res.json({ ok: true });
  })
);

app.post(
  "/api/lessons/import",
  asyncHandler(async (req, res) => {
    const account = await requireAccount(req, res);
    if (!account) return;
    const lessons = Array.isArray(req.body?.lessons) ? req.body.lessons : [];
    const safe = lessons.map((lesson) => validate.validateLessonForSave(lesson));
    const count = await storage.importLessons(account.code, safe);
    res.json({ count });
  })
);

/* ------------------------------ Frontend ------------------------------ */

const dist = path.join(__dirname, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number(error.status) || 500;
  const code = error.code || "server_error";
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: code,
    message: error.message || "Lỗi máy chủ.",
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`server listening on ${PORT} (${storage.driver})`);
});
