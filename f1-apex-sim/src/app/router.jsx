import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';

const HomeSchedulePage = lazy(() => import('../pages/HomeSchedulePage'));
const CircuitsPage = lazy(() => import('../pages/CircuitsPage'));
const CircuitDetailPage = lazy(() => import('../pages/CircuitDetailPage'));
const SimulationPage = lazy(() => import('../pages/SimulationPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

const routeLoading = (
  <div className="route-loading" role="status">
    <span className="pw-spinner" aria-hidden="true" />
    <span>Loading…</span>
  </div>
);

const withPageFallback = (element) => (
  <Suspense fallback={routeLoading}>
    {element}
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: withPageFallback(<HomeSchedulePage />) },
      { path: 'circuits', element: withPageFallback(<CircuitsPage />) },
      { path: 'circuits/:circuitSlug', element: withPageFallback(<CircuitDetailPage />) },
      { path: 'simulation', element: withPageFallback(<SimulationPage />) },
      { path: '*', element: withPageFallback(<NotFoundPage />) },
    ],
  },
]);
