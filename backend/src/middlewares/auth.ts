import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { JWTPayload } from '../types/auth';

/**
 * Middleware to authenticate requests using JWT
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
      req.user = decoded;
      next();
    } catch (error) {
      console.error('JWT verification failed:', error);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  } else {
    res.status(401).json({ error: 'Authorization header missing' });
  }
};

export default authenticateJWT;
