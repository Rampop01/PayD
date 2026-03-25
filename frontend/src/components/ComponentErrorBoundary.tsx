import React from 'react';
import * as Sentry from '@sentry/react';
import { Button, Icon } from '@stellar/design-system';

type ComponentErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  componentName?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

type ComponentErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export default class ComponentErrorBoundary extends React.Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
        componentName: this.props.componentName,
      },
    });

    this.props.onError?.(error as Error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 bg-danger/5 border border-danger/20 rounded-lg">
          <div className="flex items-center gap-2 text-danger mb-2">
            <Icon.AlertTriangle size="sm" />
            <span className="font-medium text-sm">
              {this.props.componentName
                ? `${this.props.componentName} encountered an error`
                : 'Component Error'}
            </span>
          </div>
          <p className="text-xs text-muted mb-4 text-center">
            This section encountered an error. You can try again or refresh the page.
          </p>
          <Button variant="secondary" size="sm" onClick={this.resetError}>
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
