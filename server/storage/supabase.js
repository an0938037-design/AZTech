const crypto = require("crypto");
const { compressJson, decompressJson } = require("../lib/compress");
const { defaultModel } = require("../lib/account");

const BASE = (process.env.SUPABASE_URL || "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1$/i, "");
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (BASE) console.log("[supabase] base =", BASE);

function configured() {
  return !!BASE && !!KEY;
}

async function sb(path, options = {}) {
  if (!configured()) throw new Error("Supabase is not configured");
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : null;
}

function rowToAccount(row, configs) {
  if (!row) return null;
  const aiConfigs = {};
  for (const cfg of configs || []) {
    aiConfigs[cfg.provider] = {
      keyEnc: cfg.api_key_enc || null,
      model: cfg.model || defaultModel(cfg.provider),
      updatedAt: cfg.updated_at,
    };
  }
  return {
    code: row.code,
    createdAt: row.created_at,
    activeProvider: row.active_provider || "gemini",
    aiConfigs,
  };
}

async function getAccount(code) {
  if (!code) return null;
  const rows = await sb(
    `accounts?code=eq.${encodeURIComponent(code)}&select=*`
  );
  if (!rows?.[0]) return null;
  const configs = await sb(
    `ai_configs?account_code=eq.${encodeURIComponent(code)}&select=*`
  );
  return rowToAccount(rows[0], configs);
}

async function getAccountByDevice(deviceCode) {
  if (!deviceCode) return null;
  const rows = await sb(
    `devices?device_code=eq.${encodeURIComponent(deviceCode)}&select=account_code`
  );
  if (!rows?.[0]) return null;
  return getAccount(rows[0].account_code);
}

async function createAccount({ deviceCode, ip }) {
  if (deviceCode) {
    const existing = await getAccountByDevice(deviceCode);
    if (existing) return existing;
  }
  let code = "";
  for (let i = 0; i < 20; i++) {
    code = String(Math.floor(10000000 + Math.random() * 90000000));
    const existing = await sb(
      `accounts?code=eq.${encodeURIComponent(code)}&select=code`
    );
    if (!existing?.length) break;
    code = "";
  }
  if (!code) throw new Error("Không tạo được mã tài khoản, thử lại.");

  await sb("accounts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      code,
      created_at: new Date().toISOString(),
      active_provider: "gemini",
    }),
  });

  if (deviceCode) {
    await sb("devices?on_conflict=device_code", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        device_code: deviceCode,
        account_code: code,
        last_seen: new Date().toISOString(),
        ip: ip || null,
      }),
    });
  }

  return getAccount(code);
}

async function bindDevice(deviceCode, accountCode, ip) {
  const account = await getAccount(accountCode);
  if (!account) return null;
  await sb("devices?on_conflict=device_code", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      device_code: deviceCode,
      account_code: accountCode,
      last_seen: new Date().toISOString(),
      ip: ip || null,
    }),
  });
  return account;
}

async function saveAiConfig(accountCode, provider, { keyEnc, model }) {
  const existing = await sb(
    `ai_configs?account_code=eq.${encodeURIComponent(
      accountCode
    )}&provider=eq.${encodeURIComponent(provider)}&select=*`
  );
  const nextKey = keyEnc !== undefined ? keyEnc : existing?.[0]?.api_key_enc || null;
  await sb("ai_configs?on_conflict=account_code,provider", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      account_code: accountCode,
      provider,
      api_key_enc: nextKey,
      model: model || existing?.[0]?.model || defaultModel(provider),
      updated_at: new Date().toISOString(),
    }),
  });
  return getAccount(accountCode);
}

async function setActiveProvider(accountCode, provider) {
  await sb(`accounts?code=eq.${encodeURIComponent(accountCode)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ active_provider: provider }),
  });
  return getAccount(accountCode);
}

async function listLessons(accountCode) {
  const rows = await sb(
    `lessons?account_code=eq.${encodeURIComponent(
      accountCode
    )}&select=id,subject,topic,summary,created_at,size_bytes,version&order=created_at.desc`
  );
  return (rows || []).map((row) => ({
    id: row.id,
    subject: row.subject,
    topic: row.topic,
    summary: row.summary || "",
    createdAt: row.created_at,
    sizeBytes: row.size_bytes || 0,
    version: row.version || 1,
  }));
}

async function getLesson(accountCode, id) {
  const rows = await sb(
    `lessons?id=eq.${encodeURIComponent(
      id
    )}&account_code=eq.${encodeURIComponent(accountCode)}&select=*`
  );
  const row = rows?.[0];
  if (!row) return null;

  const artifacts = await sb(
    `lesson_artifacts?lesson_id=eq.${encodeURIComponent(id)}&select=*`
  );
  const byKind = {};
  for (const artifact of artifacts || []) byKind[artifact.kind] = artifact;

  const lecture = decompressJson(byKind.lecture?.payload_b64) || {};
  return {
    id: row.id,
    subject: row.subject,
    topic: row.topic,
    summary: lecture.summary || row.summary || "",
    blocks: lecture.blocks || [],
    artifacts: {
      mindmap: decompressJson(byKind.mindmap?.payload_b64) || undefined,
      interactive: decompressJson(byKind.interactive?.payload_b64) || undefined,
    },
    quiz: decompressJson(byKind.quiz?.payload_b64) || [],
    createdAt: row.created_at,
    version: row.version || 1,
    sizeBytes: row.size_bytes || 0,
  };
}

async function saveLesson(accountCode, lesson) {
  const id = crypto.randomUUID();
  const lecture = compressJson({
    summary: lesson.summary || "",
    blocks: Array.isArray(lesson.blocks) ? lesson.blocks : [],
  });
  const mindmap = lesson.artifacts?.mindmap
    ? compressJson(lesson.artifacts.mindmap)
    : null;
  const interactive = lesson.artifacts?.interactive
    ? compressJson(lesson.artifacts.interactive)
    : null;
  const quiz = compressJson(Array.isArray(lesson.quiz) ? lesson.quiz : []);
  const sizeBytes =
    lecture.size + (mindmap?.size || 0) + (interactive?.size || 0) + quiz.size;
  const createdAt = new Date().toISOString();

  await sb("lessons", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id,
      account_code: accountCode,
      subject: lesson.subject || "Chung",
      topic: lesson.topic || "Bài học",
      summary: lesson.summary || "",
      created_at: createdAt,
      size_bytes: sizeBytes,
      version: 1,
    }),
  });

  const rows = [
    {
      lesson_id: id,
      kind: "lecture",
      payload_b64: lecture.b64,
      size_bytes: lecture.size,
    },
    {
      lesson_id: id,
      kind: "quiz",
      payload_b64: quiz.b64,
      size_bytes: quiz.size,
    },
  ];
  if (mindmap) {
    rows.push({
      lesson_id: id,
      kind: "mindmap",
      payload_b64: mindmap.b64,
      size_bytes: mindmap.size,
    });
  }
  if (interactive) {
    rows.push({
      lesson_id: id,
      kind: "interactive",
      payload_b64: interactive.b64,
      size_bytes: interactive.size,
    });
  }

  await sb("lesson_artifacts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });

  return { id, createdAt, version: 1, sizeBytes };
}

async function deleteLesson(accountCode, id) {
  await sb(
    `lessons?id=eq.${encodeURIComponent(
      id
    )}&account_code=eq.${encodeURIComponent(accountCode)}`,
    { method: "DELETE" }
  );
  return true;
}

async function importLessons(accountCode, lessons) {
  let count = 0;
  for (const lesson of lessons || []) {
    await saveLesson(accountCode, lesson);
    count += 1;
  }
  return count;
}

module.exports = {
  driver: "supabase",
  configured,
  getAccountByDevice,
  getAccount,
  createAccount,
  bindDevice,
  saveAiConfig,
  setActiveProvider,
  listLessons,
  getLesson,
  saveLesson,
  deleteLesson,
  importLessons,
};
