import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  available: true,
  backend: "gnome_libsecret",
  decryptGate: undefined as Promise<void> | undefined,
  reEncrypt: false,
  persisted: "",
  initial: "",
  writes: vi.fn(),
}));
vi.mock("electron", () => ({
  safeStorage: {
    isAsyncEncryptionAvailable: async () => state.available,
    getSelectedStorageBackend: () => state.backend,
    encryptStringAsync: async (text: string) => Buffer.from(`cipher:${text}`),
    decryptStringAsync: async (buffer: Buffer) => {
      await state.decryptGate;
      if (!buffer.toString().startsWith("cipher:")) throw new Error("invalid ciphertext");
      return { result: buffer.toString().slice(7), shouldReEncrypt: state.reEncrypt };
    },
  },
}));
vi.mock("node:fs", () => ({
  default: {
    readFileSync: () => {
      if (!state.initial) throw new Error("missing");
      return state.initial;
    },
    existsSync: () => true,
  },
}));
vi.mock("atomically", () => ({
  writeFileSync: (_path: string, text: string) => {
    state.persisted = text;
    state.writes(text);
  },
}));
vi.mock("@main/utils/paths", () => ({ configDir: "test-config" }));
beforeEach(() => {
  vi.resetModules();
  state.available = true;
  state.backend = "gnome_libsecret";
  state.decryptGate = undefined;
  state.reEncrypt = false;
  state.initial = "";
  state.persisted = "";
  state.writes.mockClear();
});
const input = {
  name: "测试",
  type: "navidrome" as const,
  url: "https://server",
  username: "user",
  password: "secret",
};

describe("流媒体凭据存储", () => {
  it("改名称保留媒体身份，改账号或密码推进媒体代次", async () => {
    const service = await import("./config");
    const server = await service.addStreamingServer(input);
    expect(server.mediaRevision).toBe(0);
    expect(
      (await service.updateStreamingServer(server.id, { ...input, name: "新名称", password: "" }))
        .mediaRevision,
    ).toBe(0);
    expect(
      (
        await service.updateStreamingServer(server.id, {
          ...input,
          username: "other",
          password: "",
        })
      ).mediaRevision,
    ).toBe(1);
    expect(
      (await service.updateStreamingServer(server.id, { ...input, username: "other" }))
        .mediaRevision,
    ).toBe(2);
  });
  it("新密码带加密版本标识，renderer 视图没有凭据", async () => {
    const service = await import("./config");
    const server = await service.addStreamingServer(input);
    expect(JSON.parse(state.persisted).servers[0].encryptedPassword).toMatch(/^safe:v1:/);
    expect((await service.getStreamingServer(server.id)).password).toBe("secret");
    expect(server).not.toHaveProperty("password");
    expect(server).not.toHaveProperty("encryptedPassword");
  });

  it("安全存储不可用时拒绝保存，不写入 base64 Plain text", async () => {
    const service = await import("./config");
    state.available = false;
    await expect(service.addStreamingServer(input)).rejects.toThrow("Enable the system keyring");
    expect(service.getStreamingConfig().servers).toHaveLength(0);
    expect(state.writes).not.toHaveBeenCalled();
  });

  it("加密不可用时无法把旧密文误当成Plain text密码", async () => {
    const service = await import("./config");
    const server = await service.addStreamingServer(input);
    state.available = false;
    await expect(service.getStreamingServer(server.id)).rejects.toThrow(
      "system keyring is unavailable",
    );
    state.available = true;
    expect((await service.getStreamingServer(server.id)).password).toBe("secret");
  });

  it("系统要求轮换密钥时重新加密并回写", async () => {
    const service = await import("./config");
    const server = await service.addStreamingServer(input);
    state.writes.mockClear();
    state.reEncrypt = true;
    expect((await service.getStreamingServer(server.id)).password).toBe("secret");
    expect(state.writes).toHaveBeenCalledOnce();
    expect(JSON.parse(state.persisted).servers[0].encryptedPassword).toMatch(/^safe:v1:/);
  });

  it("兼容旧加密文件，历史Plain text回退要求重新输入而非错误解密", async () => {
    state.initial = JSON.stringify({
      servers: [
        { ...input, id: "server", encryptedPassword: Buffer.from("cipher:old").toString("base64") },
      ],
      activeServerId: "server",
    });
    const service = await import("./config");
    expect((await service.getStreamingServer("server")).password).toBe("old");
    vi.resetModules();
    state.initial = JSON.stringify({
      servers: [
        { ...input, id: "server", encryptedPassword: Buffer.from("old").toString("base64") },
      ],
      activeServerId: "server",
    });
    const legacy = await import("./config");
    await expect(legacy.getStreamingServer("server")).rejects.toThrow("enter it again");
    await legacy.updateStreamingServer("server", { ...input, password: "new" });
    expect((await legacy.getStreamingServer("server")).password).toBe("new");
  });
});

describe("asynchronous keyring safety", () => {
  it("rejects basic_text even when Electron reports encryption availability", async () => {
    const service = await import("./config");
    const server = await service.addStreamingServer(input);
    state.backend = "basic_text";
    await expect(service.addStreamingServer(input)).rejects.toThrow("system keyring");
    await expect(service.getStreamingServer(server.id)).rejects.toThrow("system keyring");
  });
  it("does not rotate over a password edited while decryption is pending", async () => {
    const service = await import("./config");
    const server = await service.addStreamingServer(input);
    let release!: () => void;
    state.decryptGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    state.reEncrypt = true;
    const pending = service.getStreamingServer(server.id);
    await service.updateStreamingServer(server.id, { ...input, password: "replacement" });
    release();
    await pending;
    state.decryptGate = undefined;
    state.reEncrypt = false;
    expect((await service.getStreamingServer(server.id)).password).toBe("replacement");
  });
});
