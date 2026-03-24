import { useState, useEffect, useCallback } from 'react';
import { claimService, ClaimableBalance, ClaimsSummary } from '../services/claimableBalance';

export interface UseClaimableBalancesOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseClaimableBalancesReturn {
  claims: ClaimableBalance[];
  summary: ClaimsSummary | null;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  totalClaims: number;
  refresh: () => Promise<void>;
  markAsClaimed: (id: number) => Promise<void>;
  sendNotification: (id: number) => Promise<void>;
  getClaimInstructions: (claim: ClaimableBalance) => Promise<string>;
}

export function useClaimableBalances(
  options: UseClaimableBalancesOptions = {}
): UseClaimableBalancesReturn {
  const { autoRefresh = false, refreshInterval = 60000 } = options;

  const [claims, setClaims] = useState<ClaimableBalance[]>([]);
  const [summary, setSummary] = useState<ClaimsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const loadClaims = useCallback(async () => {
    try {
      setError(null);
      const result = await claimService.getPendingClaims(currentPage, limit);
      setClaims(result.data);
      setTotalCount(result.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims');
    }
  }, [currentPage]);

  const loadSummary = useCallback(async () => {
    try {
      const sum = await claimService.getClaimsSummary();
      setSummary(sum);
    } catch (err) {
      console.error('Failed to load claims summary:', err);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadClaims(), loadSummary()]);
    setIsLoading(false);
  }, [loadClaims, loadSummary]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void loadClaims();
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadClaims]);

  const markAsClaimed = useCallback(
    async (id: number) => {
      try {
        await claimService.markAsClaimed(id);
        await loadClaims();
        await loadSummary();
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to mark as claimed');
      }
    },
    [loadClaims, loadSummary]
  );

  const sendNotification = useCallback(async (id: number) => {
    try {
      await claimService.sendClaimNotification(id);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to send notification');
    }
  }, []);

  const getClaimInstructions = useCallback(async (claim: ClaimableBalance): Promise<string> => {
    if (claim.claim_instructions) {
      return claim.claim_instructions;
    }
    return claimService.generateClaimInstructions(
      claim.asset_code,
      claim.asset_issuer || undefined,
      claim.amount
    );
  }, []);

  return {
    claims,
    summary,
    isLoading,
    error,
    currentPage,
    setCurrentPage,
    totalPages: Math.ceil(totalCount / limit),
    totalClaims: totalCount,
    refresh: loadAll,
    markAsClaimed,
    sendNotification,
    getClaimInstructions,
  };
}

export interface UseEmployeeClaimsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useEmployeeClaims(
  employeeId: number,
  options: UseEmployeeClaimsOptions = {}
): {
  claims: ClaimableBalance[];
  pendingClaims: ClaimableBalance[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { autoRefresh = false, refreshInterval = 60000 } = options;

  const [claims, setClaims] = useState<ClaimableBalance[]>([]);
  const [isLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClaims = useCallback(async () => {
    try {
      setError(null);
      const result = await claimService.getEmployeeClaims(employeeId, { limit: 100 });
      setClaims(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims');
    }
  }, [employeeId]);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void loadClaims();
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadClaims]);

  const pendingClaims = claims.filter((c) => c.status === 'pending');

  return {
    claims,
    pendingClaims,
    isLoading,
    error,
    refresh: loadClaims,
  };
}
