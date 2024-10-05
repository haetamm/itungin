import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import DefaultLayout from './layout/DefaultLayout';
import GuestLayout from './layout/GuestLayout';
import Report from './pages/Report';
import CashBank from './pages/CashBank';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Expense from './pages/Expense';
import Profile from './pages/Profile';

interface RouteConfig {
  path: string;
  element: React.ReactNode;
  children?: RouteConfig[];
}

const routerConfig: RouteConfig[] = [
  {
    path: '/',
    element: <DefaultLayout />,
    children: [
      {
        path: '/',
        element: <Navigate to="/home" />,
      },
      {
        path: '/home',
        element: <Home />,
      },
      {
        path: '/report',
        element: <Report />,
      },
      {
        path: '/cash',
        element: <CashBank />
      },
      {
        path: '/sales',
        element: <Sales />
      },
      {
        path: '/purchases',
        element: <Purchases />
      },
      {
        path: '/expense',
        element: <Expense />
      },
      {
        path: '/profile',
        element: <Profile />
      },
    ],
  },
  {
    path: '/',
    element: <GuestLayout />,
    children: [
      {
        path: '/login',
        element: <Login />,
      },
      {
        path: '/register',
        element: <Register />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

const router = createBrowserRouter(routerConfig);

export default router;
