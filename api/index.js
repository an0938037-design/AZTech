import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const app = require("../server/index.js");

export default function handler(req, res) {
  /* Rewrite /api/(.*) -> /api giữ nguyên req.url gốc, dựng lại prefix nếu lỡ bị strip. */
  if (!req.url.startsWith("/api")) {
    req.url = "/api" + (req.url === "/" ? "" : req.url);
  }
  app(req, res);
}
