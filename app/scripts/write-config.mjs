import { writeFile } from "node:fs/promises";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

const config = `window.WANSUI_CONFIG = ${JSON.stringify(
  {
    supabaseUrl,
    supabasePublishableKey,
  },
  null,
  2,
)};
`;

await writeFile(new URL("../config.js", import.meta.url), config, "utf8");

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn("Supabase secrets are empty; the app will use local-only mode.");
}
