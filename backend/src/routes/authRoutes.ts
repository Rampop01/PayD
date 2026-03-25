import { Router, Request, Response } from 'express';
import passport from 'passport';
import { generateToken, generateRefreshToken } from '../services/authService.js';
import { AuthController } from '../controllers/authController.js';
import authenticateJWT from '../middlewares/auth.js';
import pool from '../config/database.js';

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication API endpoints
 */

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Initiate Google OAuth login
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to Google authentication page
 */

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to frontend dashboard with JWT token
 */

/**
 * @swagger
 * /auth/github:
 *   get:
 *     summary: Initiate GitHub OAuth login
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to GitHub authentication page
 */

/**
 * @swagger
 * /auth/github/callback:
 *   get:
 *     summary: GitHub OAuth callback
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to frontend dashboard with JWT token
 */

const router = Router();

// ── Social Login Callback Handler ─────────────────────────────────────────────
// Shared handler for both Google and GitHub OAuth2 callbacks.
// If the user has 2FA enabled, redirects to a MFA verification page instead of
// issuing tokens directly. This ensures that highly-sensitive actions are still
// protected even when using social login.
function socialLoginCallback(req: Request, res: Response) {
  const user = req.user as any;
  if (!user) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=auth_failed`);
  }

  // If user has 2FA enabled, redirect to MFA verification page
  if (user.is_2fa_enabled) {
    const tempToken = generateToken(user);
    return res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth-callback?requires2fa=true&tempToken=${tempToken}`
    );
  }

  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);
  res.redirect(
    `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth-callback?token=${token}&refreshToken=${refreshToken}`
  );
}

// ── Google OAuth2 ─────────────────────────────────────────────────────────────

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  socialLoginCallback,
);

// ── GitHub OAuth2 ─────────────────────────────────────────────────────────────

router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login' }),
  socialLoginCallback,
);

// ── Link Social Account to Existing Profile ───────────────────────────────────
// Authenticated users can link their Google/GitHub accounts to their existing
// wallet-based profile, enabling social login for future sessions.

router.post('/link-social', authenticateJWT, async (req: Request, res: Response) => {
  const { provider, providerId } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!provider || !providerId) {
    return res.status(400).json({ error: 'Missing provider or providerId' });
  }
  if (!['google', 'github'].includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider. Must be google or github.' });
  }

  try {
    // Check if this social identity is already linked to another user
    const existing = await pool.query(
      'SELECT user_id FROM social_identities WHERE provider = $1 AND provider_id = $2',
      [provider, providerId],
    );

    if (existing.rows.length > 0 && existing.rows[0].user_id !== userId) {
      return res.status(409).json({
        error: 'This social account is already linked to another user',
      });
    }

    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO social_identities (user_id, provider, provider_id) VALUES ($1, $2, $3)',
        [userId, provider, providerId],
      );
    }

    res.json({ success: true, message: `${provider} account linked successfully` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── List Linked Social Accounts ───────────────────────────────────────────────

router.get('/social-accounts', authenticateJWT, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const result = await pool.query(
      'SELECT provider, provider_id, created_at FROM social_identities WHERE user_id = $1',
      [userId],
    );
    res.json({ accounts: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Unlink Social Account ─────────────────────────────────────────────────────

router.delete('/social-accounts/:provider', authenticateJWT, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const provider = req.params.provider as string;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!['google', 'github'].includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  try {
    await pool.query(
      'DELETE FROM social_identities WHERE user_id = $1 AND provider = $2',
      [userId, provider],
    );
    res.json({ success: true, message: `${provider} account unlinked` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Wallet Auth (existing endpoints) ──────────────────────────────────────────

router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/2fa/setup', AuthController.setup2fa);
router.post('/2fa/verify', AuthController.verify2fa);
router.post('/2fa/disable', AuthController.disable2fa);

export default router;
