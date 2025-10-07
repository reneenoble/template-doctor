// Temporary shim to satisfy legacy handlers during migration.
// Provides a minimal InvocationContext type used only for logging in remaining legacy function files.
// Remove once legacy handlers are refactored to use shared http wrapper utilities.
export interface InvocationContext {
    log: (...args: any[]) => void;
    error?: (...args: any[]) => void;
}
