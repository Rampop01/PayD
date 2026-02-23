import { Request, Response } from 'express';
import { PayrollAuditService, AuditLogFilter, PayrollAuditAction, ActorType } from '../services/payrollAuditService';
import logger from '../utils/logger';

export class PayrollAuditController {
  static async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        organizationId,
        payrollRunId,
        action,
        actorType,
        employeeId,
        txHash,
        startDate,
        endDate,
        status,
        page,
        limit,
      } = req.query;

      const filter: AuditLogFilter = {};

      if (organizationId) {
        filter.organizationId = parseInt(organizationId as string, 10);
      }

      if (payrollRunId) {
        filter.payrollRunId = parseInt(payrollRunId as string, 10);
      }

      if (action) {
        filter.action = action as PayrollAuditAction;
      }

      if (actorType) {
        filter.actorType = actorType as ActorType;
      }

      if (employeeId) {
        filter.employeeId = parseInt(employeeId as string, 10);
      }

      if (txHash) {
        filter.txHash = txHash as string;
      }

      if (startDate) {
        filter.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filter.endDate = new Date(endDate as string);
      }

      if (status) {
        filter.status = status as 'success' | 'failed';
      }

      const result = await PayrollAuditService.getAuditLogs(
        filter,
        parseInt(page as string, 10) || 1,
        parseInt(limit as string, 10) || 20
      );

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: parseInt(page as string, 10) || 1,
          limit: parseInt(limit as string, 10) || 20,
          total: result.total,
          totalPages: Math.ceil(result.total / (parseInt(limit as string, 10) || 20)),
        },
      });
    } catch (error) {
      logger.error('Failed to get audit logs', error);
      res.status(500).json({
        error: 'Failed to get audit logs',
        message: (error as Error).message,
      });
    }
  }

  static async getAuditLogById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const log = await PayrollAuditService.getAuditLogById(parseInt(id, 10));

      if (!log) {
        res.status(404).json({ error: 'Audit log not found' });
        return;
      }

      res.json({
        success: true,
        data: log,
      });
    } catch (error) {
      logger.error('Failed to get audit log', error);
      res.status(500).json({
        error: 'Failed to get audit log',
        message: (error as Error).message,
      });
    }
  }

  static async getAuditSummary(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, startDate, endDate } = req.query;

      if (!organizationId) {
        res.status(400).json({ error: 'Missing required parameter: organizationId' });
        return;
      }

      const summary = await PayrollAuditService.getAuditSummary(
        parseInt(organizationId as string, 10),
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Failed to get audit summary', error);
      res.status(500).json({
        error: 'Failed to get audit summary',
        message: (error as Error).message,
      });
    }
  }

  static async exportAuditLogsCsv(req: Request, res: Response): Promise<void> {
    try {
      const {
        organizationId,
        payrollRunId,
        action,
        actorType,
        employeeId,
        txHash,
        startDate,
        endDate,
        status,
      } = req.query;

      const filter: AuditLogFilter = {};

      if (organizationId) {
        filter.organizationId = parseInt(organizationId as string, 10);
      }

      if (payrollRunId) {
        filter.payrollRunId = parseInt(payrollRunId as string, 10);
      }

      if (action) {
        filter.action = action as PayrollAuditAction;
      }

      if (actorType) {
        filter.actorType = actorType as ActorType;
      }

      if (employeeId) {
        filter.employeeId = parseInt(employeeId as string, 10);
      }

      if (txHash) {
        filter.txHash = txHash as string;
      }

      if (startDate) {
        filter.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filter.endDate = new Date(endDate as string);
      }

      if (status) {
        filter.status = status as 'success' | 'failed';
      }

      const csv = await PayrollAuditService.exportToCsv(filter);

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `payroll-audit-${timestamp}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      logger.error('Failed to export audit logs', error);
      res.status(500).json({
        error: 'Failed to export audit logs',
        message: (error as Error).message,
      });
    }
  }

  static async getAuditLogsByPayrollRun(req: Request, res: Response): Promise<void> {
    try {
      const { payrollRunId } = req.params;
      const { page, limit } = req.query;

      const result = await PayrollAuditService.getAuditLogs(
        { payrollRunId: parseInt(payrollRunId, 10) },
        parseInt(page as string, 10) || 1,
        parseInt(limit as string, 10) || 50
      );

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: parseInt(page as string, 10) || 1,
          limit: parseInt(limit as string, 10) || 50,
          total: result.total,
          totalPages: Math.ceil(result.total / (parseInt(limit as string, 10) || 50)),
        },
      });
    } catch (error) {
      logger.error('Failed to get payroll run audit logs', error);
      res.status(500).json({
        error: 'Failed to get payroll run audit logs',
        message: (error as Error).message,
      });
    }
  }

  static async getAuditLogsByEmployee(req: Request, res: Response): Promise<void> {
    try {
      const { employeeId } = req.params;
      const { page, limit, startDate, endDate } = req.query;

      const filter: AuditLogFilter = {
        employeeId: parseInt(employeeId, 10),
      };

      if (startDate) {
        filter.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filter.endDate = new Date(endDate as string);
      }

      const result = await PayrollAuditService.getAuditLogs(
        filter,
        parseInt(page as string, 10) || 1,
        parseInt(limit as string, 10) || 20
      );

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: parseInt(page as string, 10) || 1,
          limit: parseInt(limit as string, 10) || 20,
          total: result.total,
          totalPages: Math.ceil(result.total / (parseInt(limit as string, 10) || 20)),
        },
      });
    } catch (error) {
      logger.error('Failed to get employee audit logs', error);
      res.status(500).json({
        error: 'Failed to get employee audit logs',
        message: (error as Error).message,
      });
    }
  }
}
