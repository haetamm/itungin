import { Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

export default function GuestLayout() {
  const { token } = useSelector((state: RootState) => state.user);

  if (token) {
    return <Navigate to={'/'} />;
  }

  return (
    <>
      <Outlet />
      <Toaster className="text-lg" position="bottom-right" />
    </>
  );
}
