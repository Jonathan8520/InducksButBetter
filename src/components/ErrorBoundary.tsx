import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
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
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md w-full bg-surface border border-border-subtle rounded-3xl p-8 shadow-2xl shadow-red-900/5 dark:shadow-red-950/10 flex flex-col items-center gap-6 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">Oups ! Quelque chose a mal tourné</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                L'application a rencontré une erreur inattendue dans le moteur de rendu React.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full bg-surface-2 border border-border-subtle rounded-xl p-4 text-left max-h-[150px] overflow-auto">
                <code className="text-xs text-red-500 font-mono break-all whitespace-pre-wrap">
                  {this.state.error.toString()}
                </code>
              </div>
            )}

            <Button
              onClick={this.handleReset}
              className="w-full h-12 bg-primary text-primary-foreground font-medium text-sm rounded-2xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all active:scale-[0.98] shadow-lg shadow-primary/10"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recharger l'application</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
