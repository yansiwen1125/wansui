import { EFFECTIVE_START_DATE } from "./domain.js";

const config = window.WANSUI_CONFIG ?? {};
const enabled = Boolean(config.supabaseUrl && config.supabasePublishableKey);
const baseUrl = (config.supabaseUrl || "").replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");

function headers(extra = {}, hasBody = false) {
  const result = {
    apikey: config.supabasePublishableKey,
    Authorization: `Bearer ${config.supabasePublishableKey}`,
    ...extra
  };
  if (hasBody) result["Content-Type"] = "application/json";
  return result;
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: headers(options.headers, Boolean(options.body))
  });
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body.message || body.hint || body.details || "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    const suffix = detail ? `：${detail}` : "";
    throw new Error(`云端请求失败（${response.status}）${suffix}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function cloudEnabled() {
  return enabled;
}

export async function initializeCloud() {
  if (!enabled) return;
  await request("app_config?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      id: 1,
      username: "ysw",
      effective_start_date: EFFECTIVE_START_DATE,
      schema_version: 1,
      last_known_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  });
}

export async function fetchRecords() {
  if (!enabled) return null;
  return request(`checkins?date=gte.${EFFECTIVE_START_DATE}&select=task_id,date,completed,updated_at`);
}

export async function saveRecord(taskId, date, completed) {
  if (!enabled) return { task_id: taskId, date, completed, updated_at: new Date().toISOString() };
  const result = await request("checkins?on_conflict=task_id%2Cdate", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ task_id: taskId, date, completed })
  });
  return result[0];
}
