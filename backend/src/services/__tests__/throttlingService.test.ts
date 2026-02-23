import { ThrottlingService } from '../services/throttlingService';

describe('ThrottlingService', () => {
  beforeEach(() => {
    ThrottlingService.resetInstance();
  });

  afterAll(() => {
    ThrottlingService.resetInstance();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = ThrottlingService.getInstance();
      const instance2 = ThrottlingService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should accept custom configuration', () => {
      const service = ThrottlingService.getInstance({
        tpm: 50,
        maxQueueSize: 100,
      });
      
      const config = service.getConfig();
      
      expect(config.tpm).toBe(50);
      expect(config.maxQueueSize).toBe(100);
    });
  });

  describe('submit', () => {
    it('should execute transaction immediately when tokens available', async () => {
      const service = ThrottlingService.getInstance({ tpm: 10 });
      
      const result = await service.submit('test-1', async () => 'success');
      
      expect(result).toBe('success');
      
      const status = service.getStatus();
      expect(status.processedCount).toBe(1);
      expect(status.currentTokens).toBe(9);
    });

    it('should queue transaction when no tokens available', async () => {
      const service = ThrottlingService.getInstance({ tpm: 1 });
      
      await service.submit('test-1', async () => 'first');
      
      const queuePromise = service.submit('test-2', async () => 'second');
      
      expect(service.getQueueLength()).toBe(1);
      
      const status = service.getStatus();
      expect(status.currentTokens).toBe(0);
    });

    it('should reject transaction when queue is full', async () => {
      const service = ThrottlingService.getInstance({ tpm: 1, maxQueueSize: 2 });
      
      await service.submit('test-1', async () => 'first');
      
      service.submit('test-2', async () => new Promise(r => setTimeout(r, 100)));
      service.submit('test-3', async () => new Promise(r => setTimeout(r, 100)));
      
      await expect(
        service.submit('test-4', async () => 'rejected')
      ).rejects.toThrow('Transaction queue is full');
      
      const status = service.getStatus();
      expect(status.rejectedCount).toBe(1);
    });

    it('should prioritize transactions when priority flag is set', async () => {
      const service = ThrottlingService.getInstance({ tpm: 1 });
      
      await service.submit('test-1', async () => 'first');
      
      service.submit('test-2', async () => 'second', false);
      service.submit('test-priority', async () => 'priority', true);
      
      const queueLength = service.getQueueLength();
      expect(queueLength).toBe(2);
    });
  });

  describe('getStatus', () => {
    it('should return current throttling status', () => {
      const service = ThrottlingService.getInstance({ tpm: 100 });
      
      const status = service.getStatus();
      
      expect(status.tpm).toBe(100);
      expect(status.currentTokens).toBe(100);
      expect(status.maxTokens).toBe(100);
      expect(status.queueSize).toBe(0);
      expect(status.processedCount).toBe(0);
      expect(status.rejectedCount).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update TPM configuration', () => {
      const service = ThrottlingService.getInstance({ tpm: 100 });
      
      service.updateConfig({ tpm: 50 });
      
      const config = service.getConfig();
      expect(config.tpm).toBe(50);
      
      const status = service.getStatus();
      expect(status.maxTokens).toBe(50);
    });

    it('should update max queue size', () => {
      const service = ThrottlingService.getInstance({ maxQueueSize: 100 });
      
      service.updateConfig({ maxQueueSize: 200 });
      
      const config = service.getConfig();
      expect(config.maxQueueSize).toBe(200);
    });
  });

  describe('clearQueue', () => {
    it('should clear all queued transactions', async () => {
      const service = ThrottlingService.getInstance({ tpm: 1, maxQueueSize: 10 });
      
      await service.submit('test-1', async () => 'first');
      
      const promises = [
        service.submit('test-2', async () => 'second'),
        service.submit('test-3', async () => 'third'),
      ];
      
      const cleared = service.clearQueue();
      
      expect(cleared).toBe(2);
      expect(service.getQueueLength()).toBe(0);
    });
  });

  describe('hasCapacity', () => {
    it('should return true when tokens available', () => {
      const service = ThrottlingService.getInstance({ tpm: 10 });
      
      expect(service.hasCapacity()).toBe(true);
    });

    it('should return true when queue has space', () => {
      const service = ThrottlingService.getInstance({ tpm: 1, maxQueueSize: 10 });
      
      expect(service.hasCapacity()).toBe(true);
    });
  });

  describe('events', () => {
    it('should emit transaction:processed event', async () => {
      const service = ThrottlingService.getInstance({ tpm: 10 });
      
      const eventHandler = jest.fn();
      service.on('transaction:processed', eventHandler);
      
      await service.submit('test-1', async () => 'success');
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test-1', success: true })
      );
    });

    it('should emit config:updated event', () => {
      const service = ThrottlingService.getInstance();
      
      const eventHandler = jest.fn();
      service.on('config:updated', eventHandler);
      
      service.updateConfig({ tpm: 50 });
      
      expect(eventHandler).toHaveBeenCalled();
    });
  });
});
