import { xdr } from '@stellar/stellar-sdk';

export interface ContractErrorDetail {
  code: string;
  message: string;
  suggestedAction: string;
  rawXdr?: string;
  errorContext?: string;
}

// Map of known contract error codes (from bulk_payment and general patterns)
const CONTRACT_ERROR_MAPPING: Record<number, { message: string; action: string }> = {
  1: {
    message: 'Contract already initialized',
    action: 'The contract has already been set up. No further initialization is required.',
  },
  2: {
    message: 'Contract not initialized',
    action: 'Please initialize the contract before performing this operation.',
  },
  3: {
    message: 'Unauthorized access',
    action: 'Ensure you are signed in with the correct account and have the required permissions.',
  },
  4: {
    message: 'Empty payment batch',
    action: 'Please add at least one payment to the batch before submitting.',
  },
  5: {
    message: 'Batch size too large',
    action:
      'The batch exceeds the maximum allowed size (100). Please split it into smaller batches.',
  },
  6: {
    message: 'Invalid payment amount',
    action: 'The payment amount must be greater than zero.',
  },
  7: {
    message: 'Amount overflow',
    action:
      'The total batch amount exceeds the capacity of the contract. Please reduce the amounts.',
  },
  8: {
    message: 'Sequence mismatch',
    action: 'The transaction sequence is out of sync. Please refresh and try again.',
  },
  9: {
    message: 'Batch not found',
    action: 'The requested batch could not be found. Please verify the batch ID.',
  },
};

/**
 * Parses a Soroban execution result XDR or simulation error into a structured format.
 */
export function parseContractError(
  resultXdr?: string,
  simulationError?: string
): ContractErrorDetail {
  // 1. Check for known error messages in simulation string (Matches transactionSimulation.ts pattern)
  if (simulationError) {
    const errorMatch = simulationError.match(/Error\(Contract, (\d+)\)/);
    if (errorMatch) {
      const code = parseInt(errorMatch[1], 10);
      const mapped = CONTRACT_ERROR_MAPPING[code];
      if (mapped) {
        return {
          code: `CONTRACT_ERR_${code}`,
          message: mapped.message,
          suggestedAction: mapped.action,
        };
      }
    }

    // Pattern matching for generic errors
    const lowerError = simulationError.toLowerCase();
    if (lowerError.includes('unauthorized')) {
      return {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized contract invocation.',
        suggestedAction: 'Ensure you are the correct administrator for this contract.',
      };
    }
  }

  // 2. Decode XDR if available
  if (resultXdr) {
    try {
      const txResult = xdr.TransactionResult.fromXDR(resultXdr, 'base64');
      const result = txResult.result();

      // If transaction failed, we check the inner operation results
      if (result.switch() === xdr.TransactionResultCode.txFailed()) {
        const opResults = result.results();
        for (const opResult of opResults) {
          if (opResult.switch() === xdr.OperationResultCode.opInner()) {
            const tr = opResult.tr();
            if (tr.switch() === xdr.OperationType.invokeHostFunction()) {
              const ihfResult = tr.invokeHostFunctionResult();

              const ihfCode = ihfResult.switch();
              if (ihfCode !== xdr.InvokeHostFunctionResultCode.invokeHostFunctionSuccess()) {
                return {
                  code: ihfCode.name,
                  message: `Soroban execution failed: ${ihfCode.name}`,
                  suggestedAction:
                    'Review the contract state, resource limits, and input parameters.',
                  rawXdr: resultXdr,
                };
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse result XDR:', e);
    }
  }

  // 3. Fallback to generic responses
  return {
    code: 'UNKNOWN_CONTRACT_ERROR',
    message: simulationError || 'Soroban contract invocation failed.',
    suggestedAction:
      'Check your network connection and try again, or contact support if the issue persists.',
    rawXdr: resultXdr,
  };
}
