import { Helmet } from 'react-helmet-async';
import HeaderPage from '../component/auth/HeaderPage';
import { useState } from 'react';
import ProfileImage from '../component/profile/ProfileImage';
import ProfileForm from '../component/profile/ProfileForm';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

export default function Profile() {
  const [openEdit, setOpenEdit] = useState<boolean>(false);
  const { name } = useSelector((state: RootState) => state.user);

  const handleEditToggle = () => {
    setOpenEdit(!openEdit);
  };

  return (
    <>
      <Helmet>
        <title>{name}</title>
        <meta name="description" content="profile page" />
      </Helmet>
      <div className="wrap-page overflow-auto items-center flex-grow mb-5">
        <div className="kontener-page mt-3 mx-auto">
          <div className=" mx-auto">
            <HeaderPage title="Profile Setting">
              <div className="flex justify-end xs:justify-normal space-x-1">
                <button
                  onClick={handleEditToggle}
                  className="py-2 hidden md:block px-3 border-2 rounded-md border-slate-300 text-center hover:bg-white hover:border-white"
                >
                  {!openEdit ? 'Edit' : 'Cancel'}
                </button>
              </div>
            </HeaderPage>

            <div className=" my-2">
              <div className="grid md:grid-cols-2 md:flex w-full md:justify-center">
                <ProfileImage />

                <ProfileForm
                  openEdit={openEdit}
                  handleEditToggle={handleEditToggle}
                />

                <div className="hidden lg:w-[20%] lg:flex top-0 md:flex-col gap-4">
                  <div className="mt-2"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
