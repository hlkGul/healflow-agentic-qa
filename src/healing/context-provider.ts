import type { Page } from '@playwright/test';
import type { AccessibilitySnapshot } from '../types/index.js';

/**
 * Provides page context (accessibility snapshot) for the healer.
 * Allows different capture strategies without changing healer logic.
 */
export interface ContextProvider {
  name: string;
  captureSnapshot(url: string, options?: CaptureOptions): Promise<AccessibilitySnapshot>;
  dispose(): Promise<void>;
}

export interface CaptureOptions {
  /** Actions to replay before capturing (e.g., fill search, navigate) */
  replayActions?: ReplayAction[];
  /** Locale settings for cookie-based locale */
  locale?: { country: string; language: string };
  /** Timeout for page navigation */
  timeout?: number;
}

export interface ReplayAction {
  type: 'goto' | 'fill' | 'press' | 'click';
  selector: string;
  value: string;
}
