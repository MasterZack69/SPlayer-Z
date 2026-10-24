import { safeStorage } from "electron";

/**
 * Check asynchronous secure storage availability
 * @returns Whether encryption is available
 */
export const isSecureStorageAvailable = (): Promise<boolean> =>
  safeStorage.isAsyncEncryptionAvailable();

/**
 * Encrypt text
 * @param plainText - Plain text
 * @returns Encrypted bytes
 */
export const encryptSecret = (plainText: string): Promise<Buffer> =>
  safeStorage.encryptStringAsync(plainText);

/**
 * Decrypt text and report whether the system requests key rotation
 * @param encrypted - Encrypted bytes
 * @returns Plain text and the key rotation flag
 */
export const decryptSecret = async (
  encrypted: Buffer,
): Promise<{ plainText: string; needsReEncrypt: boolean }> => {
  const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(encrypted);
  return { plainText: result, needsReEncrypt: shouldReEncrypt };
};
