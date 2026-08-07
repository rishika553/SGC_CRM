import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { ToastProvider } from './components/ui/Toast';
import { AppRouter } from './router';

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
