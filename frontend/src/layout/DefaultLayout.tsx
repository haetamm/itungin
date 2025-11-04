import { Navigate, Outlet } from 'react-router-dom';
import SideBar from '../component/auth/SideBar';
import NavBar from '../component/auth/NavBar';
import Modal from '../component/auth/Modal';
import Footer from '../component/auth/Footer';
import { Toaster } from 'sonner';
import { RootState } from '../store';
import { useSelector } from 'react-redux';

export default function DefaultLayout() {
  const { token } = useSelector((state: RootState) => state.user);

  if (!token) {
    return <Navigate to={'/login'} />;
  }

  return (
    <>
      <div className="kontener">
        <SideBar />
        <div className="ml-[60px] xl:ml-[230px] flex-1 flex flex-col min-h-screen px-1">
          <NavBar />
          <div className="flex-1  pt-12 px-2 xs:pt-14 lg:pt-20 lg:px-6">
            <Outlet />
          </div>
          <Footer />
        </div>
      </div>
      <Modal />
      <Toaster position="bottom-right" />
    </>
  );
}
