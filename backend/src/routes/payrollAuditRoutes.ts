import { Router } from 'express';
import { PayrollAuditController } from '../controllers/payrollAuditController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Payroll Audit
 *   description: Detailed payroll-specific audit logs
 */

/**
 * @swagger
 * /api/v1/payroll/audit:
 *   get:
 *     summary: List payroll audit logs
 *     tags: [Payroll Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
/**
 * @swagger
 * /api/v1/payroll/audit/export:
 *   get:
 *     summary: Export audit logs as CSV
 *     tags: [Payroll Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file
 */
/**
 * @swagger
 * /api/v1/payroll/audit/summary:
 *   get:
 *     summary: Get audit summary statistics
 *     tags: [Payroll Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
/**
 * @swagger
 * /api/v1/payroll/audit/payroll-run/{payrollRunId}:
 *   get:
 *     summary: Get audit logs for a specific payroll run
 *     tags: [Payroll Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payrollRunId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
/**
 * @swagger
 * /api/v1/payroll/audit/employee/{employeeId}:
 *   get:
 *     summary: Get audit logs for a specific employee
 *     tags: [Payroll Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
/**
 * @swagger
 * /api/v1/payroll/audit/{id}:
 *   get:
 *     summary: Get specific audit log by ID
 *     tags: [Payroll Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */

export default router;
