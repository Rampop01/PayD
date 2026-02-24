import { createContext, use } from 'react';

export interface NotificationContextType {
  notify: (message: string) => void;
  notifySuccess: (message: string, description?: string) => void;
  notifyError: (message: string, description?: string) => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = use(NotificationContext);
  if (!context) throw new Error('useNotification must be used within NotificationProvider');
  return context;
};
