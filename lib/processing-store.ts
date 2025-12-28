/**
 * Processing Status Store
 *
 * In-memory store for tracking async report generation
 * In production, this would use Redis or similar
 */

import { ProcessingStatus } from '@/types/report';

class ProcessingStore {
  private store: Map<string, ProcessingStatus> = new Map();

  /**
   * Create a new processing job
   */
  create(processId: string): ProcessingStatus {
    const status: ProcessingStatus = {
      processId,
      status: 'extracting',
      progress: 0,
      message: 'Extracting vehicle details from listing...',
      complete: false,
    };

    this.store.set(processId, status);
    return status;
  }

  /**
   * Update processing status
   */
  update(processId: string, updates: Partial<ProcessingStatus>): ProcessingStatus | null {
    const current = this.store.get(processId);
    if (!current) return null;

    const updated = { ...current, ...updates };
    this.store.set(processId, updated);
    return updated;
  }

  /**
   * Get processing status
   */
  get(processId: string): ProcessingStatus | null {
    return this.store.get(processId) || null;
  }

  /**
   * Delete processing status (cleanup)
   */
  delete(processId: string): void {
    this.store.delete(processId);
  }

  /**
   * Cleanup old entries (>1 hour)
   */
  cleanup(): void {
    // In a real implementation, track timestamps
    // For now, simple size-based cleanup
    if (this.store.size > 1000) {
      const entries = Array.from(this.store.entries());
      entries.slice(0, 500).forEach(([key]) => this.store.delete(key));
    }
  }
}

// Singleton instance
export const processingStore = new ProcessingStore();

// Cleanup every 10 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    processingStore.cleanup();
  }, 10 * 60 * 1000);
}
