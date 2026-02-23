import { StellarService } from "./stellarService";

export interface PaymentEntry {
  employeeId: string;
  employeeName: string;
  walletAddress: string;
  amount: string;
}

export interface ShortfallDetail {
  employeeId: string;
  employeeName: string;
  amount: string;
}

export interface PreflightResult {
  sufficient: boolean;
  distributionAccount: string;
  assetCode: string;
  availableBalance: string;
  totalRequired: string;
  shortfall: string;
  scheduledPayments: number;
  breakdown: ShortfallDetail[];
}

export class BalanceService {
  /**
   * Query Horizon for the ORGUSD balance of a given account.
   * Returns "0" if the account has no trustline for the asset.
   */
  static async getOrgUsdBalance(
    accountPublicKey: string,
    assetIssuer: string
  ): Promise<{ balance: string; exists: boolean }> {
    const server = StellarService.getServer();
    const account = await server.loadAccount(accountPublicKey);

    const entry = account.balances.find(
      (b: any) =>
        b.asset_type === "credit_alphanum12" || b.asset_type === "credit_alphanum4"
          ? b.asset_code === "ORGUSD" && b.asset_issuer === assetIssuer
          : false
    );

    if (!entry) {
      return { balance: "0", exists: false };
    }

    return { balance: (entry as any).balance, exists: true };
  }

  /**
   * Run a preflight balance check before payroll execution.
   * Compares the distribution account ORGUSD balance against
   * the total of all scheduled payments. Returns a shortfall
   * report when the balance is insufficient.
   */
  static async preflightCheck(
    distributionAccount: string,
    assetIssuer: string,
    payments: PaymentEntry[]
  ): Promise<PreflightResult> {
    const { balance, exists } = await BalanceService.getOrgUsdBalance(
      distributionAccount,
      assetIssuer
    );

    const available = parseFloat(balance);
    const totalRequired = payments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    );

    const shortfall = totalRequired - available;
    const sufficient = exists && available >= totalRequired;

    const breakdown: ShortfallDetail[] = payments.map((p) => ({
      employeeId: p.employeeId,
      employeeName: p.employeeName,
      amount: p.amount,
    }));

    return {
      sufficient,
      distributionAccount,
      assetCode: "ORGUSD",
      availableBalance: balance,
      totalRequired: totalRequired.toFixed(7),
      shortfall: sufficient ? "0" : shortfall.toFixed(7),
      scheduledPayments: payments.length,
      breakdown,
    };
  }
}
