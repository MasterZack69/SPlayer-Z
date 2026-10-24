import fs from "node:fs";
import path from "node:path";
import { safeStorage } from "electron";
import { writeFileSync as atomicWriteSync } from "atomically";
import { configDir } from "@main/utils/paths";
import { decryptSecret, encryptSecret, isSecureStorageAvailable } from "@main/utils/secureStorage";
import type {
  StreamingServerConfig,
  StreamingServerInput,
  StreamingRuntimeConfig,
} from "@shared/types/streaming";

const STORAGE_FILE = path.join(configDir, "streaming.json");

interface PersistedServer {
  revision?: number;
  mediaRevision?: number;
  id: string;
  name: string;
  type: StreamingServerConfig["type"];
  url: string;
  username: string;
  encryptedPassword: string;
  lastConnected?: number;
}

interface PersistedState {
  servers: PersistedServer[];
  activeServerId: string | null;
}

let state: PersistedState | undefined;

/**
 * 读取流媒体配置
 * @returns 内存中的完整配置
 */
const getState = (): PersistedState => {
  if (state) return state;
  try {
    const parsed = JSON.parse(fs.readFileSync(STORAGE_FILE, "utf-8")) as PersistedState;
    state = Array.isArray(parsed?.servers)
      ? { servers: parsed.servers, activeServerId: parsed.activeServerId ?? null }
      : { servers: [], activeServerId: null };
  } catch {
    state = { servers: [], activeServerId: null };
  }
  return state;
};

/** 保存当前流媒体配置 */
const save = (): void => {
  const dir = path.dirname(STORAGE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  atomicWriteSync(STORAGE_FILE, JSON.stringify(getState(), null, 2));
};

/** Encrypt a password only when the Linux keyring is available.
 * @param password - Plaintext server password.
 */
const encryptPassword = async (password: string): Promise<string> => {
  if (!password) return "";
  if (
    !(await isSecureStorageAvailable()) ||
    safeStorage.getSelectedStorageBackend() === "basic_text"
  ) {
    throw new Error("Enable the system keyring before saving a media server password");
  }
  return `safe:v1:${(await encryptSecret(password)).toString("base64")}`;
};

/** Decrypt credentials and rotate ciphertext without overwriting a concurrent password edit.
 * @param server - Persisted server owning the encrypted password.
 */
const decryptPassword = async (server: PersistedServer): Promise<string> => {
  const encrypted = server.encryptedPassword;
  if (!encrypted) return "";
  if (
    !(await isSecureStorageAvailable()) ||
    safeStorage.getSelectedStorageBackend() === "basic_text"
  ) {
    throw new Error("The system keyring is unavailable");
  }
  let decrypted: Awaited<ReturnType<typeof decryptSecret>>;
  try {
    decrypted = await decryptSecret(Buffer.from(encrypted.replace(/^safe:v1:/, ""), "base64"));
  } catch {
    throw new Error("Unable to decrypt the media server password; enter it again in Settings");
  }
  if (decrypted.needsReEncrypt) {
    try {
      const rotated = `safe:v1:${(await encryptSecret(decrypted.plainText)).toString("base64")}`;
      if (getState().servers.includes(server) && server.encryptedPassword === encrypted) {
        server.encryptedPassword = rotated;
        save();
      }
    } catch {
      // A failed rotation must not prevent playback with the successfully decrypted secret.
    }
  }
  return decrypted.plainText;
};

/**
 * 转换为 renderer 可见配置
 * @param server - 持久化配置
 * @returns 不含凭据的配置
 */
const toServerConfig = (server: PersistedServer): StreamingServerConfig => ({
  revision: server.revision ?? 0,
  mediaRevision: server.mediaRevision ?? 0,
  id: server.id,
  name: server.name,
  type: server.type,
  url: server.url,
  username: server.username,
  hasPassword: Boolean(server.encryptedPassword),
  lastConnected: server.lastConnected,
});

/**
 * 转换为主进程运行时配置
 * @param server - 持久化配置
 * @returns 包含凭据的配置
 */
const toRuntimeConfig = async (server: PersistedServer): Promise<StreamingRuntimeConfig> => ({
  ...toServerConfig(server),
  password: await decryptPassword(server),
});

/**
 * 获取服务器列表和当前服务器
 * @returns renderer 可见配置状态
 */
export const getStreamingConfig = (): {
  servers: StreamingServerConfig[];
  activeServerId: string | null;
} => ({
  servers: getState().servers.map(toServerConfig),
  activeServerId: getState().activeServerId,
});

/**
 * 获取指定服务器的运行时配置
 * @param serverId - Server ID
 * @returns 包含凭据的配置
 */
export const getStreamingServer = async (serverId: string): Promise<StreamingRuntimeConfig> => {
  const server = getState().servers.find((item) => item.id === serverId);
  if (!server) throw new Error("找不到流媒体服务器");
  return toRuntimeConfig(server);
};

/**
 * Read a server configuration revision without decrypting credentials
 * @param serverId - Server ID
 * @returns Configuration revision
 */
export const getStreamingServerRevision = (serverId: string): number => {
  const server = getState().servers.find((item) => item.id === serverId);
  if (!server) throw new Error("找不到流媒体服务器");
  return server.revision ?? 0;
};

/**
 * 新增服务器
 * @param input - 服务器表单
 * @returns 新服务器配置
 */
export const addStreamingServer = async (
  input: StreamingServerInput,
): Promise<StreamingServerConfig> => {
  const server: PersistedServer = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    type: input.type,
    url: input.url.trim().replace(/\/+$/, ""),
    username: input.username,
    encryptedPassword: await encryptPassword(input.password),
  };
  getState().servers.push(server);
  save();
  return toServerConfig(server);
};

/**
 * 更新服务器
 * @param serverId - Server ID
 * @param input - 服务器表单
 * @returns 更新后的服务器配置
 */
export const updateStreamingServer = async (
  serverId: string,
  input: StreamingServerInput,
): Promise<StreamingServerConfig> => {
  const server = getState().servers.find((item) => item.id === serverId);
  if (!server) throw new Error("找不到流媒体服务器");
  const encryptedPassword = input.password
    ? await encryptPassword(input.password)
    : server.encryptedPassword;
  const identityChanged = Boolean(
    server.type !== input.type ||
    server.url !== input.url.trim().replace(/\/+$/, "") ||
    server.username !== input.username ||
    input.password,
  );
  if (identityChanged) {
    server.mediaRevision = (server.mediaRevision ?? 0) + 1;
    server.revision = (server.revision ?? 0) + 1;
    server.lastConnected = undefined;
  }
  server.name = input.name.trim();
  server.type = input.type;
  server.url = input.url.trim().replace(/\/+$/, "");
  server.username = input.username;
  server.encryptedPassword = encryptedPassword;
  save();
  return toServerConfig(server);
};

/**
 * 删除服务器
 * @param serverId - Server ID
 */
export const removeStreamingServer = (serverId: string): void => {
  const current = getState();
  current.servers = current.servers.filter((server) => server.id !== serverId);
  if (current.activeServerId === serverId) current.activeServerId = null;
  save();
};

/**
 * 设置当前服务器
 * @param serverId - Server ID
 */
export const setActiveStreamingServer = (serverId: string | null): void => {
  const current = getState();
  if (serverId && !current.servers.some((server) => server.id === serverId)) {
    throw new Error("找不到流媒体服务器");
  }
  current.activeServerId = serverId;
  save();
};

/**
 * 记录服务器连接成功
 * @param serverId - Server ID
 * @returns 更新后的服务器配置
 */
export const markStreamingServerConnected = (serverId: string): StreamingServerConfig => {
  const server = getState().servers.find((item) => item.id === serverId);
  if (!server) throw new Error("找不到流媒体服务器");
  server.lastConnected = Date.now();
  save();
  return toServerConfig(server);
};

/**
 * 创建连接测试使用的临时配置
 * @param input - 服务器表单
 * @param serverId - Server ID being edited
 * @returns 临时运行时配置
 */
export const createTestStreamingServer = async (
  input: StreamingServerInput,
  serverId?: string,
): Promise<StreamingRuntimeConfig> => {
  const saved = serverId ? getState().servers.find((server) => server.id === serverId) : undefined;
  const password = input.password || (saved ? await decryptPassword(saved) : "");

  const base = {
    id: `__test__:${crypto.randomUUID()}`,
    name: input.name.trim(),
    url: input.url.trim().replace(/\/+$/, ""),
    username: input.username,
    password,
    hasPassword: Boolean(password),
  };

  return {
    ...base,
    type: input.type,
  };
};
