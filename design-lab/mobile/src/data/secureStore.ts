/**
 * Secure-storage port for Android (Relay 05).
 *
 * Binds the shared SecureKV interface to expo-secure-store (Android Keystore-
 * backed encryption). There is deliberately no AsyncStorage / plaintext
 * fallback: if the native module is unavailable, `createSecureKV()` returns a
 * memory-only store with `persistent: false`, and the UI says sessions and
 * queued check-ins won't survive a restart.
 *
 * Requires the dependency `expo-secure-store` (SDK 54: `npx expo install
 * expo-secure-store`) — requested from Codex in relay/05_CLAUDE_RESULT.md.
 * Values are never logged.
 */
import * as SecureStore from 'expo-secure-store';
import { MemoryKV, type SecureKV } from '@rb-lab/shared';

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Not synced or restored to another device.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

class ExpoSecureKV implements SecureKV {
  readonly persistent = true;
  getItem(key: string) {
    return SecureStore.getItemAsync(key, OPTIONS);
  }
  setItem(key: string, value: string) {
    return SecureStore.setItemAsync(key, value, OPTIONS);
  }
  deleteItem(key: string) {
    return SecureStore.deleteItemAsync(key, OPTIONS);
  }
}

export async function createSecureKV(): Promise<SecureKV> {
  try {
    if (await SecureStore.isAvailableAsync()) return new ExpoSecureKV();
  } catch {
    /* native module missing */
  }
  return new MemoryKV();
}
