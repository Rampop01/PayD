import React, { useCallback } from 'react';
import { toast } from 'sonner';
import { NotificationContext } from '../hooks/useNotification';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notify = useCallback((message: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    (toast as any)(message);
  }, []);

  const notifySuccess = useCallback((message: string, description?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    (toast as any).success(message, { description });
  }, []);

  const notifyError = useCallback((message: string, description?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    (toast as any).error(message, { description });
  }, []);

  return (
    <NotificationContext value={{ notify, notifySuccess, notifyError }}>
      {children}
    </NotificationContext>
  );
};
