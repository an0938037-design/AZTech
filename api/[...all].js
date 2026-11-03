import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const app = require("../server/index.js");

export default function handler(req, res) {
  /* Vercel có thể strip prefix /api khi route vào catch-all, nên dựng lại đường dẫn gốc. */
  if (!req.url.startsWith("/api")) {
    req.url = "/api" + (req.url === "/" ? "" : req.url);
  }
  app(req, res);
}
