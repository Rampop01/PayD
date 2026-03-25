import { Request, Response } from 'express';
import {
  estimateBatchPaymentBudget,
  getFeeRecommendation,
} from '../services/feeEstimationService.js';

export class FeeController {
  static async recommendation(_req: Request, res: Response): Promise<void> {
    try {
      const data = await getFeeRecommendation();
      res.json({ success: true, data });
    } catch (error) {
      res.status(502).json({
        success: false,
        error: 'Failed to load fee statistics from Horizon',
        message: (error as Error).message,
      });
    }
  }

  static async batchBudget(req: Request, res: Response): Promise<void> {
    try {
      const raw = req.body?.transactionCount;
      const transactionCount = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
      const data = await estimateBatchPaymentBudget(transactionCount);
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
}
