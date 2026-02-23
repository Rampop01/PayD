import { Request, Response } from "express";
import { z } from "zod";
import { BalanceService } from "../services/balanceService";

const paymentEntrySchema = z.object({
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  walletAddress: z.string().length(56),
  amount: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
    message: "Amount must be a positive number.",
  }),
});

const preflightSchema = z.object({
  distributionAccount: z.string().length(56),
  assetIssuer: z.string().length(56),
  payments: z.array(paymentEntrySchema).min(1),
});

export class BalanceController {
  /**
   * GET /api/balance/:accountId
   * Query ORGUSD balance for a Stellar account.
   */
  static async checkBalance(req: Request, res: Response) {
    try {
      const { accountId } = req.params;
      const { assetIssuer } = req.query;

      if (!accountId || accountId.length !== 56) {
        return res.status(400).json({ error: "Invalid account ID." });
      }

      if (!assetIssuer || String(assetIssuer).length !== 56) {
        return res.status(400).json({ error: "Missing or invalid assetIssuer query param." });
      }

      const result = await BalanceService.getOrgUsdBalance(
        accountId,
        String(assetIssuer)
      );

      res.json({
        account: accountId,
        assetCode: "ORGUSD",
        balance: result.balance,
        trustlineExists: result.exists,
      });
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return res.status(404).json({ error: "Account not found on Horizon." });
      }
      console.error("Check Balance Error:", error);
      res.status(500).json({ error: "Failed to fetch account balance." });
    }
  }

  /**
   * POST /api/balance/preflight
   * Run a preflight balance check before payroll execution.
   * Accepts the distribution account, asset issuer, and an array
   * of scheduled payments. Returns a shortfall report if balance
   * is insufficient.
   */
  static async preflightPayroll(req: Request, res: Response) {
    try {
      const { distributionAccount, assetIssuer, payments } =
        preflightSchema.parse(req.body);

      const result = await BalanceService.preflightCheck(
        distributionAccount,
        assetIssuer,
        payments
      );

      const status = result.sufficient ? 200 : 422;

      res.status(status).json({
        preflight: result.sufficient ? "passed" : "failed",
        ...result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation Error", details: error.errors });
      }
      if (error?.response?.status === 404) {
        return res.status(404).json({ error: "Distribution account not found on Horizon." });
      }
      console.error("Preflight Payroll Error:", error);
      res.status(500).json({ error: "Failed to run preflight balance check." });
    }
  }
}
