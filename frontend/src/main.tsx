import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles/fonts';
import './styles/tokens.css';
import './styles/global.css';
import { createQueryClient } from './app/queryClient';
import { routes } from './app/routes';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

const router = createBrowserRouter(routes);
const queryClient = createQueryClient();

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
