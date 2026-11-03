const local = require("./local");
const supabase = require("./supabase");

function selectStorage() {
  const requested = String(process.env.STORAGE_DRIVER || "").toLowerCase();
  if (requested === "supabase") {
    if (!supabase.configured()) {
      console.warn(
        "[storage] STORAGE_DRIVER=supabase nhưng thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Dùng local."
      );
      return local;
    }
    return supabase;
  }
  if (!requested && supabase.configured()) return supabase;
  return local;
}

const storage = selectStorage();
console.log(`[storage] using ${storage.driver}`);

module.exports = storage;
