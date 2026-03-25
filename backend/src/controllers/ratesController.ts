import { Request, Response } from 'express';
import { getOrgUsdRates } from '../services/fxRateService.js';

export class RatesController {
  /**
   * GET /rates — ORGUSD→fiat conversion (ORGUSD ≡ USD), backed by live FX with Redis cache.
   */
  static async getRates(_req: Request, res: Response): Promise<void> {
    try {
      const data = await getOrgUsdRates();
      res.set('Cache-Control', 'public, max-age=60');
      res.json(data);
    } catch {
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'Unable to load exchange rates from upstream providers.',
      });
    }
  }
}
