import { lazy, Suspense } from 'react';
import { createHashRouter } from 'react-router-dom';
import App from '@/App';
import PageLoader from '@/components/layout/PageLoader';

const Home = lazy(() => import('@/pages/Home'));
const Assistant = lazy(() => import('@/pages/Assistant'));
const MoreSpace = lazy(() => import('@/pages/MoreSpace'));
const About = lazy(() => import('@/pages/About'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const page = (element: JSX.Element) => <Suspense fallback={<PageLoader />}>{element}</Suspense>;

/**
 * Hash-based routing (createHashRouter).
 * URLs look like `/#/…` and need no server rewrite rules.
 *
 * Why hash mode:
 * - Works on any static host without extra server config
 * - The fragment is not sent to the server
 * - Handy for static sites and CDNs
 *
 * Add a route:
 * {
 *   path: 'your-path',
 *   element: <YourComponent />,
 * }
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: page(<Home />),
      },
      {
        path: 'assistant',
        element: page(<Assistant />),
      },
      {
        path: 'space',
        element: page(<MoreSpace />),
      },
      {
        path: 'about',
        element: page(<About />),
      },
      {
        path: '*',
        element: page(<NotFound />),
      },
    ],
  },
]);
