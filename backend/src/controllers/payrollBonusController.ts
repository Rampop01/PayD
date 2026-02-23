import { Request, Response } from 'express';
import { PayrollBonusService } from '../services/payrollBonusService';
import logger from '../utils/logger';

export class PayrollBonusController {
  static async createPayrollRun(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, periodStart, periodEnd, assetCode } = req.body;

      if (!organizationId || !periodStart || !periodEnd) {
        res.status(400).json({
          error: 'Missing required fields: organizationId, periodStart, periodEnd',
        });
        return;
      }

      const payrollRun = await PayrollBonusService.createPayrollRun(
        organizationId,
        new Date(periodStart),
        new Date(periodEnd),
        assetCode || 'XLM'
      );

      res.status(201).json({
        success: true,
        data: payrollRun,
      });
    } catch (error) {
      logger.error('Failed to create payroll run', error);
      res.status(500).json({
        error: 'Failed to create payroll run',
        message: (error as Error).message,
      });
    }
  }

  static async getPayrollRun(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const summary = await PayrollBonusService.getPayrollRunSummary(parseInt(id, 10));

      if (!summary) {
        res.status(404).json({ error: 'Payroll run not found' });
        return;
      }

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Failed to get payroll run', error);
      res.status(500).json({
        error: 'Failed to get payroll run',
        message: (error as Error).message,
      });
    }
  }

  static async listPayrollRuns(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, page, limit } = req.query;

      if (!organizationId) {
        res.status(400).json({ error: 'Missing required parameter: organizationId' });
        return;
      }

      const result = await PayrollBonusService.listPayrollRuns(
        parseInt(organizationId as string, 10),
        parseInt(page as string, 10) || 1,
        parseInt(limit as string, 10) || 20
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to list payroll runs', error);
      res.status(500).json({
        error: 'Failed to list payroll runs',
        message: (error as Error).message,
      });
    }
  }

  static async addBonusItem(req: Request, res: Response): Promise<void> {
    try {
      const { payrollRunId, employeeId, amount, description } = req.body;

      if (!payrollRunId || !employeeId || !amount) {
        res.status(400).json({
          error: 'Missing required fields: payrollRunId, employeeId, amount',
        });
        return;
      }

      const item = await PayrollBonusService.addBonusItem({
        payroll_run_id: payrollRunId,
        employee_id: employeeId,
        amount,
        description,
      });

      res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error) {
      logger.error('Failed to add bonus item', error);
      res.status(500).json({
        error: 'Failed to add bonus item',
        message: (error as Error).message,
      });
    }
  }

  static async addBatchBonusItems(req: Request, res: Response): Promise<void> {
    try {
      const { payrollRunId, items } = req.body;

      if (!payrollRunId || !items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          error: 'Missing required fields: payrollRunId, items (array)',
        });
        return;
      }

      for (const item of items) {
        if (!item.employeeId || !item.amount) {
          res.status(400).json({
            error: 'Each item must have employeeId and amount',
          });
          return;
        }
      }

      const formattedItems = items.map(item => ({
        employee_id: item.employeeId,
        amount: item.amount,
        description: item.description,
      }));

      const insertedItems = await PayrollBonusService.addBatchBonusItems(
        payrollRunId,
        formattedItems
      );

      res.status(201).json({
        success: true,
        data: insertedItems,
        count: insertedItems.length,
      });
    } catch (error) {
      logger.error('Failed to add batch bonus items', error);
      res.status(500).json({
        error: 'Failed to add batch bonus items',
        message: (error as Error).message,
      });
    }
  }

  static async getPayrollItems(req: Request, res: Response): Promise<void> {
    try {
      const { payrollRunId } = req.params;
      const { itemType } = req.query;

      const items = await PayrollBonusService.getPayrollItems(
        parseInt(payrollRunId, 10),
        itemType as 'base' | 'bonus' | undefined
      );

      res.json({
        success: true,
        data: items,
        count: items.length,
      });
    } catch (error) {
      logger.error('Failed to get payroll items', error);
      res.status(500).json({
        error: 'Failed to get payroll items',
        message: (error as Error).message,
      });
    }
  }

  static async deletePayrollItem(req: Request, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      const deleted = await PayrollBonusService.deletePayrollItem(parseInt(itemId, 10));

      if (!deleted) {
        res.status(404).json({ error: 'Payroll item not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Payroll item deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete payroll item', error);
      res.status(500).json({
        error: 'Failed to delete payroll item',
        message: (error as Error).message,
      });
    }
  }

  static async updatePayrollRunStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['draft', 'pending', 'processing', 'completed', 'failed'].includes(status)) {
        res.status(400).json({
          error: 'Invalid status. Must be one of: draft, pending, processing, completed, failed',
        });
        return;
      }

      const payrollRun = await PayrollBonusService.updatePayrollRunStatus(
        parseInt(id, 10),
        status
      );

      if (!payrollRun) {
        res.status(404).json({ error: 'Payroll run not found' });
        return;
      }

      res.json({
        success: true,
        data: payrollRun,
      });
    } catch (error) {
      logger.error('Failed to update payroll run status', error);
      res.status(500).json({
        error: 'Failed to update payroll run status',
        message: (error as Error).message,
      });
    }
  }

  static async getBonusHistory(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, page, limit } = req.query;

      if (!organizationId) {
        res.status(400).json({ error: 'Missing required parameter: organizationId' });
        return;
      }

      const result = await PayrollBonusService.getOrganizationBonusHistory(
        parseInt(organizationId as string, 10),
        parseInt(page as string, 10) || 1,
        parseInt(limit as string, 10) || 20
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to get bonus history', error);
      res.status(500).json({
        error: 'Failed to get bonus history',
        message: (error as Error).message,
      });
    }
  }
}
