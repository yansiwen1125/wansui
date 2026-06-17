import { EFFECTIVE_START_DATE, LEGACY_USERNAME, normalizeTask } from "./domain.js";

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
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function cloudEnabled() {
  return enabled;
}

export async function initializeCloud() {
  if (!enabled) return;
  const existing = await request("app_config?id=eq.1&select=id");
  if (existing.length) return;
  await request("app_config", {
    method: "POST",
    body: JSON.stringify({
      id: 1,
      username: LEGACY_USERNAME,
      effective_start_date: EFFECTIVE_START_DATE,
      schema_version: 1,
      last_known_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  });
}

export async function fetchUsers() {
  if (!enabled) return [];
  const users = await request("users?select=username,created_at&order=created_at.asc");
  return (users ?? []).map((user) => ({
    username: user.username,
    createdAt: user.created_at ?? new Date().toISOString()
  }));
}

export async function saveUser(username, createdAt = new Date().toISOString()) {
  if (!enabled) return { username, createdAt };
  const result = await request("users?on_conflict=username", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ username, created_at: createdAt }])
  });
  const saved = result?.[0];
  return {
    username: saved?.username ?? username,
    createdAt: saved?.created_at ?? createdAt
  };
}

export async function fetchTasks(username = LEGACY_USERNAME) {
  if (!enabled) return [];
  const tasks = await request(
    `tasks?username=eq.${encodeURIComponent(username)}&select=id,username,name,color,sort_order,created_date,hidden_periods,updated_at&order=sort_order.asc`
  );
  return (tasks ?? []).map((task, index) => normalizeTask(task, index));
}

export async function saveTasksRemote(username = LEGACY_USERNAME, tasks = []) {
  if (!enabled) return tasks;
  const payload = tasks.map((task, index) => {
    const normalized = normalizeTask(task, index);
    return {
      username,
      id: normalized.id,
      name: normalized.name,
      color: normalized.color,
      sort_order: normalized.sortOrder ?? index + 1,
      created_date: normalized.createdDate,
      hidden_periods: normalized.hiddenPeriods ?? []
    };
  });
  const result = await request("tasks?on_conflict=username,id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });
  return (result ?? []).map((task, index) => normalizeTask(task, index));
}

export async function fetchRecords(username = LEGACY_USERNAME) {
  if (!enabled) return null;
  const fields = "task_id,date,completed,updated_at";
  try {
    return await request(
      `checkins?username=eq.${encodeURIComponent(username)}&date=gte.${EFFECTIVE_START_DATE}&select=username,${fields}`
    );
  } catch (error) {
    if (username !== LEGACY_USERNAME) throw error;
    return request(`checkins?date=gte.${EFFECTIVE_START_DATE}&select=${fields}`);
  }
}

export async function saveRecord(taskId, date, completed, username = LEGACY_USERNAME) {
  if (!enabled) {
    return { username, task_id: taskId, date, completed, updated_at: new Date().toISOString() };
  }
  const usernameFilter = `username=eq.${encodeURIComponent(username)}&`;
  const existing = await request(
    `checkins?${usernameFilter}task_id=eq.${encodeURIComponent(taskId)}&date=eq.${encodeURIComponent(date)}&select=task_id,date`
  ).catch((error) => {
    if (username !== LEGACY_USERNAME) throw error;
    return request(`checkins?task_id=eq.${encodeURIComponent(taskId)}&date=eq.${encodeURIComponent(date)}&select=task_id,date`);
  });
  if (existing.length) {
    await request(
      `checkins?${usernameFilter}task_id=eq.${encodeURIComponent(taskId)}&date=eq.${encodeURIComponent(date)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ completed })
      }
    ).catch((error) => {
      if (username !== LEGACY_USERNAME) throw error;
      return request(
        `checkins?task_id=eq.${encodeURIComponent(taskId)}&date=eq.${encodeURIComponent(date)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ completed })
        }
      );
    });
    return { username, task_id: taskId, date, completed, updated_at: new Date().toISOString() };
  }
  const payload = { username, task_id: taskId, date, completed };
  const result = await request("checkins", {
    method: "POST",
    body: JSON.stringify(payload)
  }).catch((error) => {
    if (username !== LEGACY_USERNAME) throw error;
    return request("checkins", {
      method: "POST",
      body: JSON.stringify({ task_id: taskId, date, completed })
    });
  });
  return result?.[0] || { username, task_id: taskId, date, completed, updated_at: new Date().toISOString() };
}
