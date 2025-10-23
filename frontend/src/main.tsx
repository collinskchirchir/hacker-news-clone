import { createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ReactDOM from 'react-dom/client';

import './globals.css';

import { routeTree } from './routeTree.gen';
import { Loader2Icon } from 'lucide-react';
import { NotFound } from '@/components/not-found';
import { ErrorComponent } from '@/components/error-component';

// react query query client
const queryClient = new QueryClient();

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0, // disable cache from tanstack router so that we use react query cache instead
  context: { queryClient },
  defaultPendingComponent: () => (
    <div className='mx-auto mt-8 flex flex-col items-center justify-center'>
      <Loader2Icon className='animate-spin' />
      <p className='text-muted-foreground mt-2 text-sm'>
        Loading...
      </p>
    </div>
  ),
  defaultNotFoundComponent: NotFound,
  defaultErrorComponent: ({error}) => <ErrorComponent error={error} />
});

// Register things for typesafety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('app')!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
