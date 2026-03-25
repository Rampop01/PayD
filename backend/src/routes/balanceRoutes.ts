import { Router } from 'express';
import { BalanceController } from '../controllers/balanceController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Balance
 *   description: Stellar account balance and preflight checks
 */

/**
 * @swagger
 * /api/balance/{accountId}:
 *   get:
 *     summary: Query balance for a Stellar account
 *     tags: [Balance]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: assetIssuer
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/:accountId', BalanceController.checkBalance);

/**
 * @swagger
 * /api/balance/preflight:
 *   post:
 *     summary: Run preflight balance check before payroll execution
 *     tags: [Balance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               distributionAccount:
 *                 type: string
 *               assetIssuer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/preflight', BalanceController.preflightPayroll);

export default router;
