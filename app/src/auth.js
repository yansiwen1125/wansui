const HASH_ALGORITHM = "SHA-256";
const SALT_BYTES = 16;

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function normalizeSecret(value) {
  return String(value ?? "").trim();
}

export function normalizeSecurityAnswer(value) {
  return normalizeSecret(value).toLowerCase();
}

export function validatePassword(password) {
  const value = normalizeSecret(password);
  if (!value) return "请设置密码";
  if (value.length < 6) return "密码至少 6 位";
  if (value.length > 32) return "密码最多 32 位";
  return "";
}

export function validatePasswordPair(password, confirmPassword) {
  const error = validatePassword(password);
  if (error) return error;
  if (normalizeSecret(password) !== normalizeSecret(confirmPassword)) return "两次密码不一致";
  return "";
}

export function validateSecurityQuestion(question) {
  const value = normalizeSecret(question);
  if (!value) return "请设置安全问题";
  if (value.length < 4) return "安全问题太短";
  if (value.length > 30) return "安全问题最多 30 个字";
  return "";
}

export function validateSecurityAnswer(answer) {
  const value = normalizeSecret(answer);
  if (!value) return "请填写安全答案";
  if (value.length < 2) return "安全答案太短";
  if (value.length > 30) return "安全答案最多 30 个字";
  return "";
}

export function normalizeUserAuth(user) {
  if (!user?.username) return null;
  return {
    username: user.username,
    createdAt: user.createdAt ?? user.created_at ?? new Date().toISOString(),
    passwordHash: user.passwordHash ?? user.password_hash ?? "",
    passwordSalt: user.passwordSalt ?? user.password_salt ?? "",
    passwordUpdatedAt: user.passwordUpdatedAt ?? user.password_updated_at ?? "",
    securityQuestion: user.securityQuestion ?? user.security_question ?? "",
    securityAnswerHash: user.securityAnswerHash ?? user.security_answer_hash ?? "",
    securityAnswerSalt: user.securityAnswerSalt ?? user.security_answer_salt ?? "",
    securityAnswerUpdatedAt: user.securityAnswerUpdatedAt ?? user.security_answer_updated_at ?? ""
  };
}

export function hasPasswordCredential(user) {
  return Boolean(user?.passwordHash && user?.passwordSalt);
}

export function hasSecurityCredential(user) {
  return Boolean(user?.securityQuestion && user?.securityAnswerHash && user?.securityAnswerSalt);
}

export async function hashSecret(secret, saltBase64) {
  const encoded = new TextEncoder().encode(`${saltBase64}:${normalizeSecret(secret)}`);
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, encoded);
  return bytesToBase64(new Uint8Array(digest));
}

export async function createCredential(secret, normalizer = normalizeSecret) {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const saltBase64 = bytesToBase64(salt);
  return {
    hash: await hashSecret(normalizer(secret), saltBase64),
    salt: saltBase64
  };
}

export async function verifyCredential(secret, hash, salt, normalizer = normalizeSecret) {
  if (!hash || !salt) return false;
  try {
    base64ToBytes(salt);
    const candidate = await hashSecret(normalizer(secret), salt);
    return candidate === hash;
  } catch {
    return false;
  }
}

export async function withPasswordCredential(user, password) {
  const credential = await createCredential(password);
  return {
    ...normalizeUserAuth(user),
    passwordHash: credential.hash,
    passwordSalt: credential.salt,
    passwordUpdatedAt: new Date().toISOString()
  };
}

export async function withSecurityCredential(user, question, answer) {
  const credential = await createCredential(answer, normalizeSecurityAnswer);
  return {
    ...normalizeUserAuth(user),
    securityQuestion: normalizeSecret(question),
    securityAnswerHash: credential.hash,
    securityAnswerSalt: credential.salt,
    securityAnswerUpdatedAt: new Date().toISOString()
  };
}
