import { Request, Response } from 'express';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import { Pool } from 'pg';
import { ExportService } from '../services/exportService.js';
import { payrollQueryService } from '../services/payroll-query.service.js';
import { exportJobService } from '../services/exportJobService.js';
import { createExportDownloadToken } from '../utils/exportDownloadToken.js';
import { config } from '../config/env.js';
import logger from '../utils/logger.js';

const pool = new Pool({ connectionString: config.DATABASE_URL });

async function organizationPublicKeyForUser(organizationId: number | null): Promise<string | null> {
  if (organizationId == null) return null;
  const r = await pool.query('SELECT public_key FROM organizations WHERE id = $1', [organizationId]);
  return r.rows[0]?.public_key ?? null;
}

export class ExportController {
  /**
   * Generates and streams a PDF receipt for a specific transaction.
   */
  static async getReceiptPdf(req: Request, res: Response): Promise<void> {
    try {
      const { txHash } = req.params;

      const transaction = await payrollQueryService.getTransactionDetails(txHash as string);
      if (!transaction) {
        res.status(404).json({ success: false, error: 'Transaction not found' });
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="receipt-${(txHash as string).substring(0, 8)}.pdf"`
      );

      await ExportService.generateReceiptPdf(transaction, res);
    } catch (error) {
      logger.error('Failed to generate PDF receipt', { error });

      // If headers are already sent, we can't send a JSON response.
      if (!res.headersSent) {
        res
          .status(500)
          .json({ success: false, error: 'Internal server error during PDF generation' });
      } else {
        res.end();
      }
    }
  }

  /**
   * Generates and streams an Excel report for a payroll batch.
   */
  static async getPayrollExcel(req: Request, res: Response): Promise<void> {
    try {
      const { organizationPublicKey, batchId } = req.params;

      // We would likely fetch all or a large chunk of transactions for the batch.
      // Assuming getPayrollBatch returns a paginated result, we might need a way to fetch all,
      // but for this implementation, we'll fetch the first massive page or assume limit handles it.
      const batchData = await payrollQueryService.getPayrollBatch(
        organizationPublicKey as string,
        batchId as string,
        1,
        500_000
      );

      if (!batchData || batchData.data.length === 0) {
        res.status(404).json({ success: false, error: 'Batch not found or empty' });
        return;
      }

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="payroll-batch-${batchId}.xlsx"`);

      await ExportService.generatePayrollExcel((batchId as string), batchData.data, res);
    } catch (error) {
      logger.error('Failed to generate Excel report', { error });

      if (!res.headersSent) {
        res
          .status(500)
          .json({ success: false, error: 'Internal server error during Excel generation' });
      } else {
        res.end();
      }
    }
  }

  /**
   * Generates and streams a CSV report for a payroll batch.
   */
  static async getPayrollCsv(req: Request, res: Response): Promise<void> {
    try {
      const { organizationPublicKey, batchId } = req.params;

      const batchData = await payrollQueryService.getPayrollBatch(
        organizationPublicKey as string,
        batchId as string,
        1,
        500_000
      );

      if (!batchData || batchData.data.length === 0) {
        res.status(404).json({ success: false, error: 'Batch not found or empty' });
        return;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payroll-batch-${batchId}.csv"`);

      await ExportService.generatePayrollCsv(batchData.data, res);
    } catch (error) {
      logger.error('Failed to generate CSV report', { error });

      if (!res.headersSent) {
        res
          .status(500)
          .json({ success: false, error: 'Internal server error during CSV generation' });
      } else {
        res.end();
      }
    }
  }

  /**
   * POST /api/v1/exports/download-token
   * Issues a time-limited HMAC token for PDF or payroll downloads (shareable signed URL).
   */
  static async issueDownloadToken(req: Request, res: Response): Promise<void> {
    try {
      const ttlRaw = Number(req.body?.ttlSec);
      const ttlSec = Math.min(Number.isFinite(ttlRaw) && ttlRaw > 0 ? ttlRaw : 900, 3600);
      const exp = Math.floor(Date.now() / 1000) + ttlSec;
      const kind = req.body?.kind as string | undefined;

      const orgPk = await organizationPublicKeyForUser(req.user?.organizationId ?? null);

      if (kind === 'receipt') {
        const txHash = req.body?.txHash as string | undefined;
        if (!txHash) {
          res.status(400).json({ error: 'txHash is required for receipt tokens' });
          return;
        }
        const tx = await payrollQueryService.getTransactionDetails(txHash);
        if (!tx || tx.sourceAccount !== orgPk) {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }
        const token = createExportDownloadToken({ kind: 'receipt', txHash, exp });
        const q = `token=${encodeURIComponent(token)}`;
        res.json({
          expiresAt: new Date(exp * 1000).toISOString(),
          pdfUrl: `/api/v1/exports/receipt/${encodeURIComponent(txHash)}/pdf?${q}`,
          token,
        });
        return;
      }

      if (kind === 'payroll') {
        const organizationPublicKey = req.body?.organizationPublicKey as string | undefined;
        const batchId = req.body?.batchId as string | undefined;
        if (!organizationPublicKey || !batchId) {
          res.status(400).json({ error: 'organizationPublicKey and batchId are required' });
          return;
        }
        if (organizationPublicKey !== orgPk) {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }
        const token = createExportDownloadToken({
          kind: 'payroll',
          organizationPublicKey,
          batchId,
          exp,
        });
        const q = `token=${encodeURIComponent(token)}`;
        res.json({
          expiresAt: new Date(exp * 1000).toISOString(),
          excelUrl: `/api/v1/exports/payroll/${encodeURIComponent(organizationPublicKey)}/${encodeURIComponent(batchId)}/excel?${q}`,
          csvUrl: `/api/v1/exports/payroll/${encodeURIComponent(organizationPublicKey)}/${encodeURIComponent(batchId)}/csv?${q}`,
          token,
        });
        return;
      }

      res.status(400).json({ error: 'kind must be receipt or payroll' });
    } catch (error) {
      logger.error('issueDownloadToken failed', { error });
      res.status(500).json({ error: 'Failed to issue download token' });
    }
  }

  /** POST /api/v1/exports/payroll-jobs/excel — async generation for large batches */
  static async startPayrollExcelJob(req: Request, res: Response): Promise<void> {
    try {
      const organizationPublicKey = req.body?.organizationPublicKey as string | undefined;
      const batchId = req.body?.batchId as string | undefined;
      if (!organizationPublicKey || !batchId) {
        res.status(400).json({ error: 'organizationPublicKey and batchId are required' });
        return;
      }
      const orgPk = await organizationPublicKeyForUser(req.user?.organizationId ?? null);
      if (organizationPublicKey !== orgPk) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const jobId = exportJobService.startPayrollExcelJob(organizationPublicKey, batchId);
      res.status(202).json({
        jobId,
        statusUrl: `/api/v1/exports/payroll-jobs/${jobId}`,
        downloadUrl: `/api/v1/exports/payroll-jobs/${jobId}/download`,
      });
    } catch (error) {
      logger.error('startPayrollExcelJob failed', { error });
      res.status(500).json({ error: 'Failed to start export job' });
    }
  }

  static async getPayrollExportJobStatus(req: Request, res: Response): Promise<void> {
    const jobId = String(req.params.jobId);
    const job = exportJobService.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const orgPk = await organizationPublicKeyForUser(req.user?.organizationId ?? null);
    if (job.organizationPublicKey !== orgPk) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (job.status === 'failed') {
      res.json({ status: job.status, error: job.error });
      return;
    }
    res.json({ status: job.status });
  }

  static async downloadPayrollExportJob(req: Request, res: Response): Promise<void> {
    const jobId = String(req.params.jobId);
    const jobBefore = exportJobService.getJob(jobId);
    if (!jobBefore) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const orgPk = await organizationPublicKeyForUser(req.user?.organizationId ?? null);
    if (jobBefore.organizationPublicKey !== orgPk) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (jobBefore.status !== 'completed') {
      res.status(409).json({ error: 'Export not ready', status: jobBefore.status });
      return;
    }

    const filePath = await exportJobService.takeCompletedFile(jobId);
    if (!filePath) {
      res.status(404).json({ error: 'Export file no longer available' });
      return;
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payroll-batch-${jobBefore.batchId}.xlsx"`
    );

    const stream = createReadStream(filePath);
    stream.on('error', (err) => {
      logger.error('export job download stream error', err);
      if (!res.headersSent) res.status(500).end();
    });
    res.on('finish', () => {
      void fs.unlink(filePath).catch(() => {});
    });
    stream.pipe(res);
  }
}
