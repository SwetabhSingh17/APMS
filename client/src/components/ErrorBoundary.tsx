import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI. If not provided, a default error card is shown. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches unhandled JavaScript errors in any child
 * component tree and renders a graceful fallback UI instead of crashing the
 * entire application.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-lg">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              Something went wrong
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              An unexpected error occurred. You can try refreshing the page or
              click the button below to retry.
            </p>
            {this.state.error && (
              <pre className="mb-6 max-h-32 overflow-auto rounded bg-muted p-3 text-left text-xs text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
