import { Request, Response, Router } from 'express';
import { payrollQueryService } from '../services/payroll-query.service.js';
import logger from '../utils/logger.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Payroll
 *   description: Payroll transaction querying and management
 */

// Apply authentication to all payroll routes
router.use(authenticateJWT);
router.use(isolateOrganization);

/**
 * @swagger
 * /api/payroll/transactions:
 *   get:
 *     summary: Query payroll transactions with filtering and pagination
 *     tags: [Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orgPublicKey
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: assetCode
 *         schema:
 *           type: string
 *       - in: query
 *         name: assetIssuer
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const {
      orgPublicKey,
      employeeId,
      batchId,
      assetCode,
      assetIssuer,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    if (!orgPublicKey) {
      return res.status(400).json({
        error: 'Missing required parameter: orgPublicKey',
      });
    }

    const query = {
      organizationPublicKey: String(orgPublicKey),
      employeeId: employeeId ? String(employeeId) : undefined,
      payrollBatchId: batchId ? String(batchId) : undefined,
      assetCode: assetCode ? String(assetCode) : undefined,
      assetIssuer: assetIssuer ? String(assetIssuer) : undefined,
      startDate: startDate ? new Date(String(startDate)) : undefined,
      endDate: endDate ? new Date(String(endDate)) : undefined,
    };

    const result = await payrollQueryService.queryPayroll(query, Number(page), Number(limit), {
      enrichPayrollData: true,
      sortBy: (sortBy as any) || 'timestamp',
      sortOrder: (sortOrder as any) || 'desc',
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('GET /api/payroll/transactions failed', error);
    res.status(500).json({
      error: 'Failed to query payroll transactions',
      message: (error as Error).message,
    });
  }
});

/**
 * @swagger
 * /api/payroll/employees/{employeeId}:
 *   get:
 *     summary: Get payroll for a specific employee
 *     tags: [Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: orgPublicKey
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/employees/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const { orgPublicKey, startDate, endDate, page, limit } = req.query;

    if (!orgPublicKey) {
      return res.status(400).json({
        error: 'Missing required query parameter: orgPublicKey',
      });
    }

    const result = await payrollQueryService.getEmployeePayroll(
      String(orgPublicKey),
      employeeId as string,
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`GET /api/payroll/employees/${req.params.employeeId} failed`, error);
    res.status(500).json({
      error: 'Failed to retrieve employee payroll',
      message: (error as Error).message,
    });
  }
});

/**
 * @swagger
 * /api/payroll/employees/{employeeId}/summary:
 *   get:
 *     summary: Get employee payroll summary
 *     tags: [Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: orgPublicKey
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/employees/:employeeId/summary', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const { orgPublicKey, startDate, endDate } = req.query;

    if (!orgPublicKey) {
      return res.status(400).json({
        error: 'Missing required query parameter: orgPublicKey',
      });
    }

    const summary = await payrollQueryService.getEmployeeSummary(
      String(orgPublicKey),
      employeeId as string,
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error(`GET /api/payroll/employees/${req.params.employeeId}/summary failed`, error);
    res.status(500).json({
      error: 'Failed to retrieve employee summary',
      message: (error as Error).message,
    });
  }
});

/**
 * @swagger
 * /api/payroll/batches/{batchId}:
 *   get:
 *     summary: Get payroll batch details
 *     tags: [Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: orgPublicKey
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/batches/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { orgPublicKey, page, limit } = req.query;

    if (!orgPublicKey) {
      return res.status(400).json({
        error: 'Missing required query parameter: orgPublicKey',
      });
    }

    const result = await payrollQueryService.getPayrollBatch(
      String(orgPublicKey),
      batchId as string,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`GET /api/payroll/batches/${req.params.batchId} failed`, error);
    res.status(500).json({
      error: 'Failed to retrieve payroll batch',
      message: (error as Error).message,
    });
  }
});

/**
 * @swagger
 * /api/payroll/aggregation:
 *   get:
 *     summary: Get payroll aggregation statistics
 *     tags: [Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orgPublicKey
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: assetCode
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
router.get('/aggregation', async (req: Request, res: Response) => {
  try {
    const { orgPublicKey, startDate, endDate, assetCode, assetIssuer } = req.query;

    if (!orgPublicKey) {
      return res.status(400).json({
        error: 'Missing required query parameter: orgPublicKey',
      });
    }

    const aggregation = await payrollQueryService.getPayrollAggregation(
      String(orgPublicKey),
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined,
      assetCode ? String(assetCode) : undefined,
      assetIssuer ? String(assetIssuer) : undefined
    );

    res.json({
      success: true,
      data: aggregation,
    });
  } catch (error) {
    logger.error('GET /api/payroll/aggregation failed', error);
    res.status(500).json({
      error: 'Failed to retrieve aggregation',
      message: (error as Error).message,
    });
  }
});

/**
 * @swagger
 * /api/payroll/audit:
 *   get:
 *     summary: Get organization-wide audit report
 *     tags: [Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orgPublicKey
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/audit', async (req: Request, res: Response) => {
  try {
    const { orgPublicKey, startDate, endDate } = req.query;

    if (!orgPublicKey) {
      return res.status(400).json({
        error: 'Missing required query parameter: orgPublicKey',
      });
    }

    const report = await payrollQueryService.getOrganizationAuditReport(
      String(orgPublicKey),
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('GET /api/payroll/audit failed', error);
    res.status(500).json({
      error: 'Failed to generate audit report',
      message: (error as Error).message,
    });
  }
});

/**
 * @swagger
 * /api/payroll/search/memo:
 *   get:
 *     summary: Search transactions by memo pattern
 *     tags: [Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orgPublicKey
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: pattern
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/search/memo', async (req: Request, res: Response) => {
  try {
    const { orgPublicKey, pattern, page, limit } = req.query;

    if (!orgPublicKey || !pattern) {
      return res.status(400).json({
        error: 'Missing required query parameters: orgPublicKey, pattern',
      });
    }

    const result = await payrollQueryService.searchByMemoPattern(
      String(orgPublicKey),
      String(pattern),
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('GET /api/payroll/search/memo failed', error);
    res.status(500).json({
      error: 'Failed to search by memo',
      message: (error as Error).message,
    });
  }
});

/**
 * @swagger
 * /api/payroll/transactions/{txHash}:
 *   get:
 *     summary: Get transaction details by hash
 *     tags: [Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: txHash
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/transactions/:txHash', async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;

    const transaction = await payrollQueryService.getTransactionDetails(txHash as string);

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found',
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    logger.error(`GET /api/payroll/transactions/${req.params.txHash} failed`, error);
    res.status(500).json({
      error: 'Failed to retrieve transaction',
      message: (error as Error).message,
    });
  }
});

/**
 * @swagger
 * /api/payroll/status/rate-limit:
 *   get:
 *     summary: Get SDS rate limit information
 *     tags: [Payroll]
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/status/rate-limit', (req: Request, res: Response) => {
  try {
    const rateLimitInfo = payrollQueryService.getSDSRateLimitInfo();

    res.json({
      success: true,
      data: rateLimitInfo || { message: 'No rate limit info available' },
    });
  } catch (error) {
    logger.error('GET /api/payroll/status/rate-limit failed', error);
    res.status(500).json({
      error: 'Failed to retrieve rate limit info',
      message: (error as Error).message,
    });
  }
});

/**
 * @swagger
 * /api/payroll/status/health:
 *   get:
 *     summary: Check SDS health status
 *     tags: [Payroll]
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/status/health', async (req: Request, res: Response) => {
  try {
    const healthy = await payrollQueryService.checkSDSHealth();

    res.json({
      success: true,
      data: {
        status: healthy ? 'healthy' : 'unhealthy',
        service: 'SDS',
      },
    });
  } catch (error) {
    logger.error('GET /api/payroll/status/health failed', error);
    res.status(500).json({
      error: 'Failed to check health',
      message: (error as Error).message,
    });
  }
});

/**
 * @swagger
 * /api/payroll/cache/clear:
 *   post:
 *     summary: Clear cache (admin endpoint)
 *     tags: [Payroll]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/cache/clear', (req: Request, res: Response) => {
  try {
    payrollQueryService.clearCache();

    res.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error) {
    logger.error('POST /api/payroll/cache/clear failed', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: (error as Error).message,
    });
  }
});

/**
 * @swagger
 * /api/payroll/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     tags: [Payroll]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/cache/stats', (req: Request, res: Response) => {
  try {
    const stats = payrollQueryService.getCacheStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('GET /api/payroll/cache/stats failed', error);
    res.status(500).json({
      error: 'Failed to retrieve cache stats',
      message: (error as Error).message,
    });
  }
});

export default router;
