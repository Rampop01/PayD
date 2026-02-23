import { EventEmitter } from 'events';

export interface ThrottlingConfig {
  tpm: number;
  maxQueueSize: number;
  refillIntervalMs: number;
}

export interface QueuedTransaction {
  id: string;
  timestamp: Date;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

export interface ThrottlingStatus {
  tpm: number;
  currentTokens: number;
  maxTokens: number;
  queueSize: number;
  maxQueueSize: number;
  processedCount: number;
  rejectedCount: number;
  isProcessing: boolean;
}

const DEFAULT_CONFIG: ThrottlingConfig = {
  tpm: 100,
  maxQueueSize: 1000,
  refillIntervalMs: 1000,
};

export class ThrottlingService extends EventEmitter {
  private static instance: ThrottlingService;
  
  private config: ThrottlingConfig;
  private tokens: number;
  private maxTokens: number;
  private queue: QueuedTransaction[] = [];
  private processedCount: number = 0;
  private rejectedCount: number = 0;
  private isProcessing: boolean = false;
  private refillTimer: NodeJS.Timeout | null = null;
  private refillRatePerSecond: number;

  private constructor(config: Partial<ThrottlingConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.maxTokens = this.config.tpm;
    this.tokens = this.maxTokens;
    this.refillRatePerSecond = Math.ceil(this.config.tpm / 60);
    this.startRefillTimer();
  }

  static getInstance(config?: Partial<ThrottlingConfig>): ThrottlingService {
    if (!ThrottlingService.instance) {
      ThrottlingService.instance = new ThrottlingService(config);
    }
    return ThrottlingService.instance;
  }

  static resetInstance(): void {
    if (ThrottlingService.instance) {
      ThrottlingService.instance.stop();
      ThrottlingService.instance = undefined as any;
    }
  }

  private startRefillTimer(): void {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
    }
    
    this.refillTimer = setInterval(() => {
      this.refillTokens();
    }, this.config.refillIntervalMs);
  }

  private refillTokens(): void {
    const previousTokens = this.tokens;
    this.tokens = Math.min(this.maxTokens, this.tokens + this.refillRatePerSecond);
    
    if (this.tokens > previousTokens && this.queue.length > 0) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0 && this.tokens > 0) {
      const item = this.queue.shift();
      if (!item) break;

      this.tokens--;
      this.processedCount++;

      try {
        const result = await item.execute();
        item.resolve(result);
        this.emit('transaction:processed', { id: item.id, success: true });
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error(String(error)));
        this.emit('transaction:failed', { id: item.id, error });
      }
    }

    this.isProcessing = false;

    if (this.queue.length > 0 && this.tokens > 0) {
      setImmediate(() => this.processQueue());
    }
  }

  async submit<T>(
    id: string,
    execute: () => Promise<T>,
    priority: boolean = false
  ): Promise<T> {
    if (this.queue.length >= this.config.maxQueueSize) {
      this.rejectedCount++;
      this.emit('transaction:rejected', { id, reason: 'queue_full' });
      throw new Error('Transaction queue is full. Please try again later.');
    }

    if (this.tokens > 0 && this.queue.length === 0) {
      this.tokens--;
      this.processedCount++;
      this.emit('transaction:processed', { id, success: true, immediate: true });
      return execute();
    }

    return new Promise<T>((resolve, reject) => {
      const transaction: QueuedTransaction = {
        id,
        timestamp: new Date(),
        execute,
        resolve: resolve as (value: any) => void,
        reject,
      };

      if (priority) {
        this.queue.unshift(transaction);
      } else {
        this.queue.push(transaction);
      }

      this.emit('transaction:queued', { id, queuePosition: this.queue.length });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  updateConfig(newConfig: Partial<ThrottlingConfig>): void {
    if (newConfig.tpm !== undefined) {
      this.config.tpm = newConfig.tpm;
      this.maxTokens = newConfig.tpm;
      this.refillRatePerSecond = Math.ceil(newConfig.tpm / 60);
      this.tokens = Math.min(this.tokens, this.maxTokens);
    }
    
    if (newConfig.maxQueueSize !== undefined) {
      this.config.maxQueueSize = newConfig.maxQueueSize;
    }
    
    if (newConfig.refillIntervalMs !== undefined) {
      this.config.refillIntervalMs = newConfig.refillIntervalMs;
      this.startRefillTimer();
    }

    this.emit('config:updated', this.config);
  }

  getStatus(): ThrottlingStatus {
    return {
      tpm: this.config.tpm,
      currentTokens: this.tokens,
      maxTokens: this.maxTokens,
      queueSize: this.queue.length,
      maxQueueSize: this.config.maxQueueSize,
      processedCount: this.processedCount,
      rejectedCount: this.rejectedCount,
      isProcessing: this.isProcessing,
    };
  }

  getConfig(): ThrottlingConfig {
    return { ...this.config };
  }

  clearQueue(): number {
    const clearedCount = this.queue.length;
    
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
      this.emit('transaction:rejected', { id: item.id, reason: 'queue_cleared' });
    });
    
    this.queue = [];
    this.rejectedCount += clearedCount;
    
    return clearedCount;
  }

  stop(): void {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
    this.clearQueue();
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  hasCapacity(): boolean {
    return this.tokens > 0 || this.queue.length < this.config.maxQueueSize;
  }
}

export default ThrottlingService;
