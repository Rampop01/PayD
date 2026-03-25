import crypto from 'crypto';
import { config } from '../config/env.js';

export type ExportTokenPayload =
  | { kind: 'receipt'; txHash: string; exp: number }
  | {
      kind: 'payroll';
      organizationPublicKey: string;
      batchId: string;
      exp: number;
    };

function signSegment(segment: string): string {
  return crypto.createHmac('sha256', config.JWT_SECRET).update(segment).digest('base64url');
}

/** TTL in seconds from now. */
export function createExportDownloadToken(payload: ExportTokenPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signSegment(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyExportDownloadToken(token: string): ExportTokenPayload | null {
  try {
    const dot = token.indexOf('.');
    if (dot <= 0) return null;
    const payloadB64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (signSegment(payloadB64) !== sig) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as ExportTokenPayload;
    if (!payload || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.kind === 'receipt' && typeof payload.txHash === 'string') return payload;
    if (
      payload.kind === 'payroll' &&
      typeof payload.organizationPublicKey === 'string' &&
      typeof payload.batchId === 'string'
    ) {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}
