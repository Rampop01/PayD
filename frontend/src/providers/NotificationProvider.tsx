import React, { createContext, useContext, useCallback } from "react";
import { toast } from "sonner";

interface NotificationContextType {
  notify: (message: string) => void;
  notifySuccess: (message: string, description?: string) => void;
  notifyError: (message: string, description?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const notify = useCallback((message: string) => {
    toast(message);
  }, []);

  const notifySuccess = useCallback((message: string, description?: string) => {
    toast.success(message, { description });
  }, []);

  const notifyError = useCallback((message: string, description?: string) => {
    toast.error(message, { description });
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, notifySuccess, notifyError }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context)
    throw new Error("useNotification must be used within NotificationProvider");
  return context;
};
