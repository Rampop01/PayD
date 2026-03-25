import { Request, Response, NextFunction } from 'express';
import { require2FA } from './require2fa.js';

/**
 * Runs TOTP / recovery verification when the client updates an employee Stellar wallet.
 */
export function require2FAIfWalletUpdate(req: Request, res: Response, next: NextFunction): void {
  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'wallet_address')) {
    require2FA(req, res, next);
    return;
  }
  next();
}
