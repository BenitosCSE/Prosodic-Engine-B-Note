import { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-matte-black text-white p-6 flex flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-bold text-orange-accent mb-4">Щось пішло не так</h1>
          <p className="text-gray-400 mb-6 max-w-md text-sm">
            Виникла помилка завантаження додатку.
          </p>
          <pre className="bg-black/50 p-4 rounded text-left text-xs text-red-400 max-w-lg overflow-auto mb-6">
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-orange-accent text-black font-bold rounded hover:opacity-90 transition-opacity"
          >
            Перезавантажити
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
