import './Toast.css';

import React, {createContext, useCallback, useContext, useState} from 'react';

interface ToastAction {
  icon: 'refresh';
  onClick: () => void;
}

interface ToastState {
  message: string;
  action?: ToastAction;
  id: number;
  exiting?: boolean;
}

interface ToastOptions {
  action?: ToastAction;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;
const EXIT_ANIMATION_DURATION = 200;

let toastId = 0;

export const ToastProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const id = ++toastId;
    const duration = options?.duration ?? DEFAULT_DURATION;

    setToast({message, action: options?.action, id});

    setTimeout(() => {
      setToast((current) => {
        if (current?.id === id) {
          return {...current, exiting: true};
        }
        return current;
      });

      setTimeout(() => {
        setToast((current) => {
          if (current?.id === id) {
            return null;
          }
          return current;
        });
      }, EXIT_ANIMATION_DURATION);
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{showToast}}>
      {children}
      {toast && <Toast toast={toast} />}
    </ToastContext.Provider>
  );
};

const RefreshIcon: React.FC = () => (
  <svg
    className="Toast__action-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const Toast: React.FC<{toast: ToastState}> = ({toast}) => {
  const renderActionIcon = () => {
    if (!toast.action) return null;

    switch (toast.action.icon) {
      case 'refresh':
        return <RefreshIcon />;
      default:
        return null;
    }
  };

  return (
    <div className={`Toast ${toast.exiting ? 'Toast--exiting' : ''}`}>
      <span className="Toast__message">{toast.message}</span>
      {toast.action && (
        <button className="Toast__action" onClick={toast.action.onClick} title="Refresh">
          {renderActionIcon()}
        </button>
      )}
    </div>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
