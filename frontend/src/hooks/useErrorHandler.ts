import { useCallback } from 'react';
import * as Sentry from '@sentry/react';

export function useErrorHandler() {
  const handleError = useCallback((error: unknown, context?: Record<string, unknown>) => {
    if (error instanceof Error) {
      Sentry.captureException(error, {
        extra: context,
      });
      throw error;
    }
    const err = new Error(String(error));
    Sentry.captureException(err, {
      extra: context,
    });
    throw err;
  }, []);

  return handleError;
}
