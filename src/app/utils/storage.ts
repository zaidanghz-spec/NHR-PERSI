/**
 * Utility to safely handle localStorage operations and prevent crashes
 * due to QuotaExceededError or other browser storage issues.
 */

export function safeLocalStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
      console.warn("LocalStorage Quota Exceeded for key:", key);
      // Optional: Logic to clear oldest drafts or non-essential data if needed.
    } else {
      console.error("LocalStorage Error:", e);
    }
  }
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
    return defaultValue;
  } catch {
    return defaultValue;
  }
}
