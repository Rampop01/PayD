import { Router, Request, Response, NextFunction } from 'express';
import { advancedReportService, ReportFilter } from '../services/advancedReportService.js';
import logger from '../utils/logger.js';
import { pipeline } from 'stream/promises';

const router = Router();

interface ReportRequest {
  query: {
    organizationId?: string;
    startDate?: string;
    endDate?: string;
    payrollRunId?: string;
    employeeId?: string;
    assetCode?: string;
  };
}

function parseReportFilter(req: ReportRequest): ReportFilter {
  const { query } = req;

  if (!query.organizationId) {
    throw new Error('organizationId is required');
  }

  const filter: ReportFilter = {
    organizationId: parseInt(query.organizationId, 10),
  };

  if (query.startDate) {
    filter.startDate = new Date(query.startDate);
  }

  if (query.endDate) {
    filter.endDate = new Date(query.endDate);
  }

  if (query.payrollRunId) {
    filter.payrollRunId = parseInt(query.payrollRunId, 10);
  }

  if (query.employeeId) {
    filter.employeeId = parseInt(query.employeeId, 10);
  }

  if (query.assetCode) {
    filter.assetCode = query.assetCode;
  }

  return filter;
}

async function requireOrganizationId(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.query.organizationId) {
      res.status(400).json({
        success: false,
        error: 'organizationId query parameter is required',
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

router.get(
  '/payroll-history/pdf',
  requireOrganizationId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = parseReportFilter(req as ReportRequest);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `payroll-history-${timestamp}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');

      logger.info('Generating payroll history PDF', { filter });

      await advancedReportService.generatePayrollHistoryPdf(filter, res);

      logger.info('Payroll history PDF generated successfully', { filename });
    } catch (error) {
      logger.error('Failed to generate payroll history PDF', { error });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to generate PDF report',
        });
      } else {
        res.end();
      }
    }
  }
);

router.get(
  '/payroll-history/excel',
  requireOrganizationId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = parseReportFilter(req as ReportRequest);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `payroll-history-${timestamp}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');

      logger.info('Generating payroll history Excel', { filter });

      await advancedReportService.generatePayrollHistoryExcel(filter, res);

      logger.info('Payroll history Excel generated successfully', { filename });
    } catch (error) {
      logger.error('Failed to generate payroll history Excel', { error });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to generate Excel report',
        });
      } else {
        res.end();
      }
    }
  }
);

router.get(
  '/audit-log/pdf',
  requireOrganizationId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = parseReportFilter(req as ReportRequest);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `audit-log-${timestamp}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');

      logger.info('Generating audit log PDF', { filter });

      await advancedReportService.generateAuditLogPdf(filter, res);

      logger.info('Audit log PDF generated successfully', { filename });
    } catch (error) {
      logger.error('Failed to generate audit log PDF', { error });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to generate PDF report',
        });
      } else {
        res.end();
      }
    }
  }
);

router.get(
  '/audit-log/excel',
  requireOrganizationId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = parseReportFilter(req as ReportRequest);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `audit-log-${timestamp}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');

      logger.info('Generating audit log Excel', { filter });

      await advancedReportService.generateAuditLogExcel(filter, res);

      logger.info('Audit log Excel generated successfully', { filename });
    } catch (error) {
      logger.error('Failed to generate audit log Excel', { error });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to generate Excel report',
        });
      } else {
        res.end();
      }
    }
  }
);

router.post(
  '/payroll-history/save',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { format, filename } = req.body;
      const filter = parseReportFilter(req as ReportRequest);

      if (!format || !['pdf', 'excel'].includes(format)) {
        res.status(400).json({
          success: false,
          error: 'format must be either "pdf" or "excel"',
        });
        return;
      }

      const savedPath = await advancedReportService.saveReport('payroll', format, filter, filename);

      res.json({
        success: true,
        path: savedPath,
        filename: savedPath.split('/').pop(),
      });
    } catch (error) {
      logger.error('Failed to save payroll report', { error });
      next(error);
    }
  }
);

router.post(
  '/audit-log/save',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { format, filename } = req.body;
      const filter = parseReportFilter(req as ReportRequest);

      if (!format || !['pdf', 'excel'].includes(format)) {
        res.status(400).json({
          success: false,
          error: 'format must be either "pdf" or "excel"',
        });
        return;
      }

      const savedPath = await advancedReportService.saveReport('audit', format, filter, filename);

      res.json({
        success: true,
        path: savedPath,
        filename: savedPath.split('/').pop(),
      });
    } catch (error) {
      logger.error('Failed to save audit report', { error });
      next(error);
    }
  }
);

router.get(
  '/stored/:filename',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { filename } = req.params;

      if (!filename || filename.includes('..') || filename.includes('/')) {
        res.status(400).json({
          success: false,
          error: 'Invalid filename',
        });
        return;
      }

      const stream = advancedReportService.getStoredReport(filename);

      const ext = filename.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
      } else if (ext === 'xlsx') {
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      }

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await pipeline(stream, res);
    } catch (error) {
      logger.error('Failed to retrieve stored report', { error });

      if (!res.headersSent) {
        res.status(404).json({
          success: false,
          error: 'Report not found',
        });
      }
    }
  }
);

router.post('/cleanup', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deletedCount = await advancedReportService.cleanupOldReports();

    res.json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} old report(s)`,
    });
  } catch (error) {
    logger.error('Failed to cleanup reports', { error });
    next(error);
  }
});

export default router;
