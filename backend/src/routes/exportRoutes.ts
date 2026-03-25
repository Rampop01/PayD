import { Router } from 'express';
import { ExportController } from '../controllers/exportController.js';
import { exportDownloadAuth } from '../middlewares/exportDownloadAuth.js';
import { authenticateJWT } from '../middlewares/auth.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Exports
 *   description: Export receipts and payroll reports
 */

/**
 * @swagger
 * /api/v1/exports/receipt/{txHash}/pdf:
 *   get:
 *     summary: Export transaction receipt as PDF
 *     tags: [Exports]
 *     parameters:
 *       - in: path
 *         name: txHash
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 */
router.get('/receipt/:txHash/pdf', ExportController.getReceiptPdf);

/**
 * @swagger
 * /api/v1/exports/payroll/{organizationPublicKey}/{batchId}/excel:
 *   get:
 *     summary: Export payroll report as Excel
 *     tags: [Exports]
 *     parameters:
 *       - in: path
 *         name: organizationPublicKey
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Excel file
 */
router.get('/payroll/:organizationPublicKey/:batchId/excel', ExportController.getPayrollExcel);

/**
 * @swagger
 * /api/v1/exports/payroll/{organizationPublicKey}/{batchId}/csv:
 *   get:
 *     summary: Export payroll report as CSV
 *     tags: [Exports]
 *     parameters:
 *       - in: path
 *         name: organizationPublicKey
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file
 */
router.get('/payroll/:organizationPublicKey/:batchId/csv', ExportController.getPayrollCsv);

export default router;
