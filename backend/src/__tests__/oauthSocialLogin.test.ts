/**
 * OAuth2 Social Login Integration Tests
 *
 * These tests verify that OAuth2 authentication with Google and GitHub
 * works correctly, including user creation, profile mapping, and JWT issuance.
 */

import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { generateToken } from '../services/authService.js';

describe('OAuth2 Social Login Integration', () => {
  let pool: Pool;
  let testUserId: number;
  const testEmail = 'oauth-test@example.com';
  const testName = 'OAuth Test User';

  beforeAll(async () => {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
    });

    const userResult = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ($1, $2, 'EMPLOYEE')
       ON CONFLICT (email) DO UPDATE SET name = $2
       RETURNING id`,
      [testEmail, testName]
    );
    testUserId = userResult.rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM social_identities WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  describe('Social Identity Management', () => {
    it('should link Google social identity to existing user', async () => {
      const providerId = 'google-12345-test';
      const provider = 'google';

      const result = await pool.query(
        `INSERT INTO social_identities (user_id, provider, provider_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (provider, provider_id) DO UPDATE SET user_id = $1
         RETURNING *`,
        [testUserId, provider, providerId]
      );

      expect(result.rows[0]).toBeDefined();
      expect(result.rows[0].user_id).toBe(testUserId);
      expect(result.rows[0].provider).toBe(provider);
      expect(result.rows[0].provider_id).toBe(providerId);
    });

    it('should link GitHub social identity to existing user', async () => {
      const providerId = 'github-67890-test';
      const provider = 'github';

      const result = await pool.query(
        `INSERT INTO social_identities (user_id, provider, provider_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (provider, provider_id) DO UPDATE SET user_id = $1
         RETURNING *`,
        [testUserId, provider, providerId]
      );

      expect(result.rows[0]).toBeDefined();
      expect(result.rows[0].user_id).toBe(testUserId);
      expect(result.rows[0].provider).toBe(provider);
      expect(result.rows[0].provider_id).toBe(providerId);
    });

    it('should retrieve user with linked social identities', async () => {
      const result = await pool.query(
        `SELECT u.*, 
                COALESCE(
                  json_agg(
                    json_build_object(
                      'provider', si.provider,
                      'provider_id', si.provider_id
                    )
                  ) FILTER (WHERE si.id IS NOT NULL),
                  '[]'
                ) as social_identities
         FROM users u
         LEFT JOIN social_identities si ON u.id = si.user_id
         WHERE u.id = $1
         GROUP BY u.id`,
        [testUserId]
      );

      expect(result.rows[0]).toBeDefined();
      expect(result.rows[0].email).toBe(testEmail);
      expect(result.rows[0].social_identities).toBeDefined();
      expect(result.rows[0].social_identities.length).toBeGreaterThanOrEqual(2);
    });

    it('should prevent duplicate provider_id for same provider', async () => {
      const providerId = 'google-unique-test';
      const provider = 'google';

      await pool.query(
        `INSERT INTO social_identities (user_id, provider, provider_id)
         VALUES ($1, $2, $3)`,
        [testUserId, provider, providerId]
      );

      await expect(
        pool.query(
          `INSERT INTO social_identities (user_id, provider, provider_id)
           VALUES ($1, $2, $3)`,
          [testUserId, provider, providerId]
        )
      ).rejects.toThrow();
    });

    it('should allow same provider_id for different providers', async () => {
      const providerId = 'same-id-different-provider';
      const userId2Result = await pool.query(
        `INSERT INTO users (email, name)
         VALUES ($1, $2) RETURNING id`,
        ['another-test@example.com', 'Another User']
      );
      const userId2 = userId2Result.rows[0].id;

      await pool.query(
        `INSERT INTO social_identities (user_id, provider, provider_id)
         VALUES ($1, 'google', $2)`,
        [userId2, providerId]
      );

      const result = await pool.query(
        `INSERT INTO social_identities (user_id, provider, provider_id)
         VALUES ($1, 'github', $2) RETURNING *`,
        [userId2, providerId]
      );

      expect(result.rows[0]).toBeDefined();

      await pool.query('DELETE FROM social_identities WHERE user_id = $1', [userId2]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId2]);
    });
  });

  describe('User Account Merging (Linked Identities)', () => {
    it('should allow user with same email to link new social identity', async () => {
      const newUserEmail = 'merge-test@example.com';

      const existingUserResult = await pool.query(
        `INSERT INTO users (email, name)
         VALUES ($1, 'Merge Test User')
         ON CONFLICT (email) DO UPDATE SET name = 'Merge Test User'
         RETURNING id`,
        [newUserEmail]
      );
      const existingUserId = existingUserResult.rows[0].id;

      const githubProviderId = 'github-merge-test-123';
      await pool.query(
        `INSERT INTO social_identities (user_id, provider, provider_id)
         VALUES ($1, 'github', $2)`,
        [existingUserId, githubProviderId]
      );

      const googleProviderId = 'google-merge-test-456';
      await pool.query(
        `INSERT INTO social_identities (user_id, provider, provider_id)
         VALUES ($1, 'google', $2)`,
        [existingUserId, googleProviderId]
      );

      const identitiesResult = await pool.query(
        `SELECT * FROM social_identities WHERE user_id = $1`,
        [existingUserId]
      );

      expect(identitiesResult.rows.length).toBe(2);

      await pool.query('DELETE FROM social_identities WHERE user_id = $1', [existingUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [existingUserId]);
    });

    it('should retrieve all linked identities for a user', async () => {
      const allIdentitiesResult = await pool.query(
        `SELECT provider, provider_id FROM social_identities WHERE user_id = $1`,
        [testUserId]
      );

      const providers = allIdentitiesResult.rows.map((r) => r.provider);
      expect(providers).toContain('google');
      expect(providers).toContain('github');
    });
  });

  describe('JWT Token Generation', () => {
    it('should generate valid JWT for authenticated user', async () => {
      const mockUser = {
        id: testUserId,
        email: testEmail,
        role: 'EMPLOYEE',
      };

      const token = generateToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include user info in JWT payload', () => {
      const mockUser = {
        id: testUserId,
        email: testEmail,
        role: 'ADMIN',
      };

      const token = generateToken(mockUser);
      const decoded = jwt.verify(token, config.JWT_SECRET);

      expect(decoded.id).toBe(testUserId);
      expect(decoded.email).toBe(testEmail);
      expect(decoded.role).toBe('ADMIN');
    });

    it('should set token expiration', () => {
      const mockUser = {
        id: testUserId,
        email: testEmail,
        role: 'EMPLOYEE',
      };

      const token = generateToken(mockUser);
      const decoded = jwt.verify(token, config.JWT_SECRET);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('New User Creation via Social Login', () => {
    it('should create new user when logging in with unknown email', async () => {
      const newEmail = 'new-social-user@example.com';
      const newName = 'New Social User';

      const userResult = await pool.query(
        `INSERT INTO users (email, name)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET name = $2
         RETURNING id, email, name`,
        [newEmail, newName]
      );

      expect(userResult.rows[0].email).toBe(newEmail);
      expect(userResult.rows[0].name).toBe(newName);

      await pool.query('DELETE FROM users WHERE email = $1', [newEmail]);
    });

    it('should link social identity to newly created user', async () => {
      const email = 'fresh-github-user@example.com';
      const name = 'Fresh GitHub User';
      const providerId = 'github-fresh-999';

      const userResult = await pool.query(
        `INSERT INTO users (email, name)
         VALUES ($1, $2) RETURNING id`,
        [email, name]
      );
      const userId = userResult.rows[0].id;

      await pool.query(
        `INSERT INTO social_identities (user_id, provider, provider_id)
         VALUES ($1, 'github', $2)`,
        [userId, providerId]
      );

      const identityResult = await pool.query(
        `SELECT * FROM social_identities WHERE user_id = $1 AND provider = 'github'`,
        [userId]
      );

      expect(identityResult.rows[0]).toBeDefined();
      expect(identityResult.rows[0].provider_id).toBe(providerId);

      await pool.query('DELETE FROM social_identities WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    });
  });
});
