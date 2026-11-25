import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FD] p-4 text-[#1A1F2C]">
          <div className="w-full max-w-md rounded-[28px] border border-[#E9ECF5] bg-white p-8 shadow-[0_20px_50px_rgba(25,45,100,0.08)] text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FCE8E9] text-[#C2414B]">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#1A1F2C]">
              Something went wrong
            </h1>
            <p className="text-xs text-[#7E8B9B] leading-relaxed">
              An unexpected error occurred while loading this view. You can reload the page to restore your workspace.
            </p>
            {this.state.error?.message && (
              <div className="rounded-xl bg-[#F8FAFD] border border-[#E9ECF5] p-3 text-[11px] text-[#C2414B] font-mono break-all text-left">
                {this.state.error.message}
              </div>
            )}
            <div className="pt-2">
              <Button
                variant="primary"
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reload Application</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
