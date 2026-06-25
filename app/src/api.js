import { EFFECTIVE_START_DATE, LEGACY_USERNAME, normalizeTask, normalizeTaskVersions } from "./domain.js";
import { READING_ALGORITHM_VERSION, normalizeDailyReading } from "./reading.js";
import { normalizeUserAuth } from "./auth.js";

const config = window.WANSUI_CONFIG ?? {};
const enabled = Boolean(config.supabaseUrl && config.supabasePublishableKey);
const baseUrl = (config.supabaseUrl || "").replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");

function headers(extra = {}, hasBody = false, forceAuthorization = false) {
  const result = {
    apikey: config.supabasePublishableKey,
    ...extra
  };
  if (forceAuthorization || !String(config.supabasePublishableKey).startsWith("sb_publishable_")) {
    result.Authorization = `Bearer ${config.supabasePublishableKey}`;
  }
  if (hasBody) result["Content-Type"] = "application/json";
  return result;
}

async function performRequest(path, options = {}, forceAuthorization = false) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: headers(options.headers, Boolean(options.body), forceAuthorization)
  });
  return response;
}

async function request(path, options = {}) {
  let response = await performRequest(path, options);
  if (response.status === 401 && String(config.supabasePublishableKey).startsWith("sb_publishable_")) {
    response = await performRequest(path, options, true);
  }
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
      schema_version: 12,
      last_known_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  });
}

export async function fetchUsers() {
  if (!enabled) return [];
  const users = await request("users?select=username,created_at,password_hash,password_salt,password_updated_at,security_question,security_answer_hash,security_answer_salt,security_answer_updated_at&order=created_at.asc")
    .catch(() => request("users?select=username,created_at&order=created_at.asc"));
  return (users ?? []).map(normalizeUserAuth).filter(Boolean);
}

export async function saveUser(userOrUsername, createdAt = new Date().toISOString()) {
  const user = normalizeUserAuth(typeof userOrUsername === "string" ? { username: userOrUsername, createdAt } : userOrUsername);
  if (!enabled) return user;
  const payload = {
    username: user.username,
    created_at: user.createdAt ?? createdAt,
    password_hash: user.passwordHash || null,
    password_salt: user.passwordSalt || null,
    password_updated_at: user.passwordUpdatedAt || null,
    security_question: user.securityQuestion || null,
    security_answer_hash: user.securityAnswerHash || null,
    security_answer_salt: user.securityAnswerSalt || null,
    security_answer_updated_at: user.securityAnswerUpdatedAt || null
  };
  const result = await request("users?on_conflict=username", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  }).catch(async (error) => {
    const retryPayload = { username: user.username, created_at: user.createdAt ?? createdAt };
    await request("users?on_conflict=username", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(retryPayload)
    }).catch(() => null);
    const retry = await request("users?select=username,created_at,password_hash,password_salt,password_updated_at,security_question,security_answer_hash,security_answer_salt,security_answer_updated_at&username=eq." + encodeURIComponent(user.username))
      .catch(() => request("users?select=username,created_at&username=eq." + encodeURIComponent(user.username)));
    if (retry.length) return retry;
    throw error;
  });
  return normalizeUserAuth(result?.[0]) ?? user;
}

export async function fetchUserProfile(username = LEGACY_USERNAME) {
  if (!enabled) return null;
  const rows = await request(
    `user_profiles?username=eq.${encodeURIComponent(username)}&select=username,birth_date,birth_time,birth_city,birth_timezone,birth_time_unknown,reading_start_date,created_at,updated_at&limit=1`
  );
  const profile = rows?.[0];
  if (!profile) return null;
  return {
    username: profile.username,
    birthDate: profile.birth_date,
    birthTime: profile.birth_time ?? "",
    birthCity: profile.birth_city ?? "",
    birthTimezone: profile.birth_timezone ?? "",
    birthTimeUnknown: Boolean(profile.birth_time_unknown),
    readingStartDate: profile.reading_start_date,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  };
}

export async function saveUserProfileRemote(username = LEGACY_USERNAME, profile) {
  if (!enabled) return profile;
  await saveUser(username);
  const now = new Date().toISOString();
  const payload = {
    username,
    birth_date: profile.birthDate,
    birth_time: profile.birthTimeUnknown ? null : (profile.birthTime || null),
    birth_city: profile.birthCity || null,
    birth_timezone: profile.birthTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    birth_time_unknown: Boolean(profile.birthTimeUnknown),
    reading_start_date: profile.readingStartDate,
    updated_at: now
  };
  const existing = await fetchUserProfile(username);
  if (!existing) payload.created_at = profile.createdAt ?? now;
  const result = await request("user_profiles?on_conflict=username", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });
  const saved = result?.[0];
  return {
    username: saved?.username ?? username,
    birthDate: saved?.birth_date ?? profile.birthDate,
    birthTime: saved?.birth_time ?? "",
    birthCity: saved?.birth_city ?? "",
    birthTimezone: saved?.birth_timezone ?? payload.birth_timezone,
    birthTimeUnknown: Boolean(saved?.birth_time_unknown ?? profile.birthTimeUnknown),
    readingStartDate: saved?.reading_start_date ?? profile.readingStartDate,
    createdAt: saved?.created_at ?? profile.createdAt ?? now,
    updatedAt: saved?.updated_at ?? now
  };
}

export async function fetchDailyReading(username = LEGACY_USERNAME, date) {
  if (!enabled) return null;
  const rows = await request(
    `daily_readings?username=eq.${encodeURIComponent(username)}&reading_date=eq.${encodeURIComponent(date)}&select=username,reading_date,fortune_score,good_tags,caution_tags,lucky_number,lucky_color,astrology_key,tarot_card_id,tarot_orientation,content,algorithm_version,created_at,updated_at&limit=1`
  );
  return normalizeDailyReading(rows?.[0]);
}

export async function saveDailyReadingRemote(username = LEGACY_USERNAME, reading) {
  if (!enabled) return reading;
  await saveUser(username);
  const payload = {
    username,
    reading_date: reading.date,
    fortune_score: reading.score,
    good_tags: reading.goodTags ?? [],
    caution_tags: reading.cautionTags ?? [],
    lucky_number: reading.luckyNumber,
    lucky_color: reading.luckyColor?.key ?? reading.luckyColor?.name ?? null,
    astrology_key: reading.astrologyKey,
    tarot_card_id: reading.tarot?.id,
    tarot_orientation: reading.tarot?.orientation,
    content: {
      summary: reading.summary,
      astrologyText: reading.astrologyText,
      astrology: reading.astrology,
      themes: reading.themes ?? [],
      luckyColor: reading.luckyColor,
      tarot: reading.tarot
    },
    algorithm_version: reading.algorithmVersion ?? READING_ALGORITHM_VERSION
  };
  const result = await request("daily_readings?on_conflict=username,reading_date", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });
  return normalizeDailyReading(result?.[0]) ?? reading;
}

export async function fetchTasks(username = LEGACY_USERNAME) {
  if (!enabled) return [];
  const tasks = await request(
    `tasks?username=eq.${encodeURIComponent(username)}&select=id,username,name,color,sort_order,created_date,hidden_periods,updated_at&order=sort_order.asc`
  );
  return (tasks ?? []).map((task, index) => normalizeTask(task, index)).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveTasksRemote(username = LEGACY_USERNAME, tasks = []) {
  if (!enabled) return tasks;
  await saveUser(username);
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
  if (!payload.length) return [];
  const result = await request("tasks?on_conflict=username,id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });
  return (result ?? []).map((task, index) => normalizeTask(task, index)).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function fetchTaskVersions(username = LEGACY_USERNAME) {
  if (!enabled) return [];
  const versions = await request(
    `task_versions?username=eq.${encodeURIComponent(username)}&select=username,effective_date,tasks,updated_at&order=effective_date.asc`
  );
  return normalizeTaskVersions(versions ?? []);
}

export async function saveTaskVersionsRemote(username = LEGACY_USERNAME, versions = []) {
  if (!enabled) return normalizeTaskVersions(versions);
  await saveUser(username);
  const payload = normalizeTaskVersions(versions).map((version) => ({
    username,
    effective_date: version.effectiveDate,
    tasks: version.tasks
  }));
  if (!payload.length) return [];
  const result = await request("task_versions?on_conflict=username,effective_date", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });
  return normalizeTaskVersions(result ?? []);
}

export async function saveTaskVersionRemote(username = LEGACY_USERNAME, version) {
  const saved = await saveTaskVersionsRemote(username, [version]);
  return saved.find((item) => item.effectiveDate === version.effectiveDate) ?? version;
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

export async function hasCompletedRecordRemote(username = LEGACY_USERNAME, taskId) {
  if (!enabled) return false;
  const usernameFilter = `username=eq.${encodeURIComponent(username)}&`;
  const rows = await request(
    `checkins?${usernameFilter}task_id=eq.${encodeURIComponent(taskId)}&completed=eq.true&select=task_id&limit=1`
  ).catch((error) => {
    if (username !== LEGACY_USERNAME) throw error;
    return request(`checkins?task_id=eq.${encodeURIComponent(taskId)}&completed=eq.true&select=task_id&limit=1`);
  });
  return Boolean(rows?.length);
}

export async function deleteTaskRemote(username = LEGACY_USERNAME, taskId) {
  if (!enabled) return;
  const usernameFilter = `username=eq.${encodeURIComponent(username)}&`;
  await request(
    `checkins?${usernameFilter}task_id=eq.${encodeURIComponent(taskId)}&completed=eq.false`,
    { method: "DELETE" }
  ).catch((error) => {
    if (username !== LEGACY_USERNAME) throw error;
    return request(`checkins?task_id=eq.${encodeURIComponent(taskId)}&completed=eq.false`, { method: "DELETE" });
  });
  await request(
    `tasks?${usernameFilter}id=eq.${encodeURIComponent(taskId)}`,
    { method: "DELETE" }
  );
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
