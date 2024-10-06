import CropImage from '../profile/CropImage';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { closeModal } from '../../store/auth/modalSlice';
import axiosInstance from '../../utils/api-default';
import { logout } from '../../store/auth/userSlice';
import Cookies from 'js-cookie';
import { handleFormErrors } from '../../utils/handleFormErrors';
import { AxiosError } from 'axios';

import '../../styles/components/modal.scss';

export default function Modal() {
  const dispatch = useDispatch<AppDispatch>();
  const { type, isOpen } = useSelector((state: RootState) => state.modal);

  const onLogout = async () => {
    try {
      await axiosInstance.delete('/auth');
      dispatch(logout());
      closeModalHandle();
      localStorage.removeItem('user');
      Cookies.remove('token');
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        handleFormErrors(axiosError.response.data, null);
      } else {
        console.log("Unexpected error:", error);
      }
    }
  };
  
  const closeModalHandle = () => {
    dispatch(closeModal());
  }

  return (
    <> {
        isOpen && (
          <div id="myModal" className="modal-custom animated fadeInDown">
              <div className={`modal-content ${type !== "small" ? 'mt-besar' : 'mt-kecil'}`}>
                  <div className={`modal-card ${type !== "small" ? 'besar-modal' : 'kecil-modal'}`}>
                    <div className="modal-card-kecil__body">
                        <div className="close-wrap flex justify-end">
                            <div onClick={closeModalHandle} className="close">&times;</div>
                        </div>
                        { type === "big" &&
                          <div className="besar-modal__wrap">
                            <div className="besar-modal__title"></div>
                            <CropImage />
                            <div className="besar-modal__title"></div>
                          </div>
                        }

                        { type === "small" &&
                          <>
                            <div>Logout ??</div>
                            <div className="wrap-button flex justify-end">
                                <button onClick={onLogout} className="pointer button-custom">Yes</button>
                            </div>
                          </>
                        }
                    </div>
                </div>
              </div>
          </div>
        )
      }
    </>
  )
}
