import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super-refresh-secret-key';
const JWT_EXPIRES_IN = '24h';
const JWT_REFRESH_EXPIRES_IN = '7d';

/**
 * Generate an access token for a user (wallet login or OAuth2 social login).
 * Includes all fields expected by the JWTPayload interface so downstream
 * middleware can rely on a consistent token shape regardless of login method.
 */
export const generateToken = (user: any) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email || '',
      walletAddress: user.wallet_address || '',
      organizationId: user.organization_id || null,
      role: user.role || 'EMPLOYEE',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
};

/**
 * Generate a refresh token for long-lived sessions.
 */
export const generateRefreshToken = (user: any) => {
  return jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN },
  );
};
