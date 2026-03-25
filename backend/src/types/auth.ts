export type UserRole = 'EMPLOYER' | 'EMPLOYEE';

export interface JWTPayload {
  id: number;
  walletAddress: string;
  /** Present on OAuth flows; wallet login may use empty string */
  email: string;
  organizationId: number | null;
  role: UserRole;
}

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends JWTPayload { }
  }
}
