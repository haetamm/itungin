import { Navigate, Outlet } from 'react-router-dom'
import SideBar from '../component/auth/SideBar';
import NavBar from '../component/auth/NavBar';
import Modal from '../component/auth/Modal';
import Footer from '../component/auth/Footer';
import { Toaster } from 'sonner';
import { RootState } from '../store';
import { useSelector } from 'react-redux';

import '../styles/default-layout.scss';

export default function DefaultLayout() {
  const { token } = useSelector((state: RootState) => state.user);

  if (!token) {
    return <Navigate to={'/login'} />
  }

  return (
    <>
      <div className='wrap-default-layout '>
        <div className='min-h-screen flex flex-col'>
          <NavBar />
          <SideBar />
          <Outlet />
          <Footer />
        </div>
        <Modal />
      </div>
    
      <Toaster className="text-lg" position="bottom-right" />
    </>
  )
}
