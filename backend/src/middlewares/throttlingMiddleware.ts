import { Request, Response, NextFunction } from 'express';
import { ThrottlingService } from '../services/throttlingService';

export interface ThrottlingMiddlewareOptions {
  priorityHeader?: string;
  skipCondition?: (req: Request) => boolean;
}

export const throttlingMiddleware = (options: ThrottlingMiddlewareOptions = {}) => {
  const throttlingService = ThrottlingService.getInstance();
  const priorityHeader = options.priorityHeader || 'x-priority';
  
  return async (req: Request, res: Response, next: NextFunction) => {
    if (options.skipCondition && options.skipCondition(req)) {
      return next();
    }

    const transactionId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const isPriority = req.headers[priorityHeader] === 'high';

    if (!throttlingService.hasCapacity()) {
      const status = throttlingService.getStatus();
      res.setHeader('X-RateLimit-Limit', status.tpm.toString());
      res.setHeader('X-RateLimit-Remaining', status.currentTokens.toString());
      res.setHeader('X-RateLimit-QueueSize', status.queueSize.toString());
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Transaction queue is full. Please try again later.',
        retryAfter: Math.ceil(status.queueSize / (status.tpm / 60)),
      });
    }

    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);

    (req as any).throttlingContext = {
      transactionId,
      isPriority,
      submitTransaction: async <T>(execute: () => Promise<T>): Promise<T> => {
        return throttlingService.submit(transactionId, execute, isPriority);
      },
    };

    res.on('finish', () => {
      if (res.statusCode >= 400) {
        throttlingService.emit('transaction:error', {
          id: transactionId,
          statusCode: res.statusCode,
        });
      }
    });

    const status = throttlingService.getStatus();
    res.setHeader('X-RateLimit-Limit', status.tpm.toString());
    res.setHeader('X-RateLimit-Remaining', status.currentTokens.toString());
    res.setHeader('X-RateLimit-QueueSize', status.queueSize.toString());

    next();
  };
};

export const requireThrottling = async (
  req: Request,
  execute: () => Promise<any>
): Promise<any> => {
  const context = (req as any).throttlingContext;
  
  if (!context) {
    throw new Error('Throttling context not found. Ensure throttlingMiddleware is applied.');
  }
  
  return context.submitTransaction(execute);
};

export default throttlingMiddleware;
