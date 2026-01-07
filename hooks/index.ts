/**
 * Hooks Index
 * 
 * Central export point for all custom hooks.
 * These hooks can be gradually adopted in App.tsx to reduce complexity.
 */

export { useStorage, STORAGE_KEYS, generateId } from './useStorage';
export type { StorageData } from './useStorage';

export { useAuth } from './useAuth';
export type { AuthState, AuthActions } from './useAuth';

export { useToast } from './useToast';
export type { ToastState, UseToastReturn } from './useToast';

export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export type { KeyboardShortcuts } from './useKeyboardShortcuts';
