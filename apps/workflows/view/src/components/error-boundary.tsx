import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  onError: (error: Error) => void;
  fallback?: React.ReactNode;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps> {
  state = {
    hasError: false,
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Error</div>;
    }

    return this.props.children;
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
    this.setState({ hasError: true });
  }
}
