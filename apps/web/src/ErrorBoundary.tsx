import { Component, createContext, ErrorInfo, ReactNode, use } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  shouldCatch?: (error: Error) => boolean;
};

type State = {
  error: Error | null;
};

const Context = createContext<State>({ error: null });

export const useError = () => use(Context);

const catchAll = (_error: Error) => true;

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  // TODO: Add posthog error tracking in here
  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(error, errorInfo);
  }

  override render() {
    const shouldCatch = this.props.shouldCatch ?? catchAll;

    if (this.state.error && shouldCatch(this.state.error)) {
      return (
        <Context.Provider value={this.state}>
          {this.props.fallback ?? null}
        </Context.Provider>
      );
    }

    return this.props.children;
  }
}
