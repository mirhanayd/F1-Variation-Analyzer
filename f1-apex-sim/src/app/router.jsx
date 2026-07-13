import { lazy, Suspense } from 'react';
import { createBrowserRouter, createHashRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import AppLayout from '../layout/AppLayout';

const HomeSchedulePage = lazy(() => import('../pages/HomeSchedulePage'));
const CircuitsPage = lazy(() => import('../pages/CircuitsPage'));
const CircuitDetailPage = lazy(() => import('../pages/CircuitDetailPage'));
const LiveTrackingPage = lazy(() => import('../pages/LiveTrackingPage'));
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

// Hash routing inside the native WebView survives reloads at any route;
// the web keeps clean history-API URLs.
const createRouter = Capacitor.isNativePlatform() ? createHashRouter : createBrowserRouter;

export const router = createRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: withPageFallback(<HomeSchedulePage />) },
      { path: 'circuits', element: withPageFallback(<CircuitsPage />) },
      { path: 'circuits/:circuitSlug', element: withPageFallback(<CircuitDetailPage />) },
      { path: 'live', element: withPageFallback(<LiveTrackingPage />) },
      { path: 'simulation', element: withPageFallback(<SimulationPage />) },
      { path: '*', element: withPageFallback(<NotFoundPage />) },
    ],
  },
]);
