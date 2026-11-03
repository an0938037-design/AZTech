const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { compressJson, decompressJson } = require("../lib/compress");
const { encryptSecret } = require("../lib/crypto");
const { defaultModel } = require("../lib/account");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const LEGACY_FILE = path.join(DATA_DIR, "accounts.json");

function emptyDb() {
  return { accounts: {}, devices: {}, lessons: {} };
}

function load() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      return {
        accounts: parsed.accounts || {},
        devices: parsed.devices || {},
        lessons: parsed.lessons || {},
      };
    }
  } catch {
    // fall through to legacy migration
  }

  const db = emptyDb();
  if (fs.existsSync(LEGACY_FILE)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_FILE, "utf8"));
      for (const [deviceCode, value] of Object.entries(legacy)) {
        const code = String(value?.code || deviceCode);
        if (!db.accounts[code]) {
          db.accounts[code] = {
            code,
            createdAt: value?.createdAt || Date.now(),
            activeProvider: "gemini",
            aiConfigs: {},
          };
        }
        if (value?.geminiKey) {
          db.accounts[code].aiConfigs.gemini = {
            keyEnc: encryptSecret(value.geminiKey),
            model: defaultModel("gemini"),
            updatedAt: Date.now(),
          };
        }
        db.devices[deviceCode] = {
          deviceCode,
          accountCode: code,
          lastSeen: Date.now(),
        };
      }
      save(db);
    } catch {
      // ignore malformed legacy data
    }
  }
  return db;
}

function save(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

function genCode(db) {
  let code = "";
  do {
    code = String(Math.floor(10000000 + Math.random() * 90000000));
  } while (db.accounts[code]);
  return code;
}

async function getAccountByDevice(deviceCode) {
  if (!deviceCode) return null;
  const db = load();
  const device = db.devices[deviceCode];
  if (!device) return null;
  return db.accounts[device.accountCode] || null;
}

async function getAccount(code) {
  const db = load();
  return db.accounts[code] || null;
}

async function createAccount({ deviceCode, ip }) {
  const db = load();
  if (deviceCode) {
    const existing = db.devices[deviceCode];
    const account = existing?.accountCode
      ? db.accounts[existing.accountCode]
      : null;
    if (account) {
      existing.lastSeen = Date.now();
      if (ip) existing.ip = ip;
      save(db);
      return account;
    }
  }
  const code = genCode(db);
  const account = {
    code,
    createdAt: Date.now(),
    activeProvider: "gemini",
    aiConfigs: {},
  };
  db.accounts[code] = account;
  if (deviceCode) {
    db.devices[deviceCode] = {
      deviceCode,
      accountCode: code,
      lastSeen: Date.now(),
      ip: ip || null,
    };
  }
  save(db);
  return account;
}

async function bindDevice(deviceCode, accountCode, ip) {
  const db = load();
  const account = db.accounts[accountCode];
  if (!account) return null;
  db.devices[deviceCode] = {
    deviceCode,
    accountCode,
    lastSeen: Date.now(),
    ip: ip || null,
  };
  save(db);
  return account;
}

async function saveAiConfig(accountCode, provider, { keyEnc, model }) {
  const db = load();
  const account = db.accounts[accountCode];
  if (!account) return null;
  account.aiConfigs = account.aiConfigs || {};
  const existing = account.aiConfigs[provider] || {};
  account.aiConfigs[provider] = {
    keyEnc: keyEnc !== undefined ? keyEnc : existing.keyEnc || null,
    model: model || existing.model || defaultModel(provider),
    updatedAt: Date.now(),
  };
  if (!account.activeProvider) account.activeProvider = provider;
  save(db);
  return account;
}

async function setActiveProvider(accountCode, provider) {
  const db = load();
  const account = db.accounts[accountCode];
  if (!account) return null;
  account.activeProvider = provider;
  save(db);
  return account;
}

async function listLessons(accountCode) {
  const db = load();
  return Object.values(db.lessons)
    .filter((lesson) => lesson.accountCode === accountCode)
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    .map((lesson) => ({
      id: lesson.id,
      subject: lesson.subject,
      topic: lesson.topic,
      summary: lesson.summary || "",
      createdAt: lesson.createdAt,
      sizeBytes: lesson.sizeBytes || 0,
      version: lesson.version || 1,
    }));
}

async function getLesson(accountCode, id) {
  const db = load();
  const lesson = db.lessons[id];
  if (!lesson || lesson.accountCode !== accountCode) return null;
  const lecture = decompressJson(lesson.artifacts?.lecture) || {};
  return {
    id: lesson.id,
    subject: lesson.subject,
    topic: lesson.topic,
    summary: lecture.summary || lesson.summary || "",
    blocks: lecture.blocks || [],
    artifacts: {
      mindmap: decompressJson(lesson.artifacts?.mindmap) || undefined,
      interactive: decompressJson(lesson.artifacts?.interactive) || undefined,
    },
    quiz: decompressJson(lesson.artifacts?.quiz) || [],
    createdAt: lesson.createdAt,
    version: lesson.version || 1,
    sizeBytes: lesson.sizeBytes || 0,
  };
}

async function saveLesson(accountCode, lesson) {
  const db = load();
  let id = lesson.id && lesson.id !== "draft" ? String(lesson.id) : crypto.randomUUID();
  if (db.lessons[id]) id = crypto.randomUUID();

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
  const createdAt = Date.now();

  db.lessons[id] = {
    id,
    accountCode,
    subject: lesson.subject || "Chung",
    topic: lesson.topic || "Bài học",
    summary: lesson.summary || "",
    createdAt,
    version: 1,
    sizeBytes,
    artifacts: {
      lecture: lecture.b64,
      ...(mindmap ? { mindmap: mindmap.b64 } : {}),
      ...(interactive ? { interactive: interactive.b64 } : {}),
      quiz: quiz.b64,
    },
  };
  save(db);

  return {
    id,
    createdAt,
    version: 1,
    sizeBytes,
  };
}

async function deleteLesson(accountCode, id) {
  const db = load();
  const lesson = db.lessons[id];
  if (!lesson || lesson.accountCode !== accountCode) return false;
  delete db.lessons[id];
  save(db);
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
  driver: "local",
  configured: true,
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
