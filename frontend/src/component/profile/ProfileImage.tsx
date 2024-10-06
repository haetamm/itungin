import { formatDate, timestamp } from '../../utils/helper';
import { AppDispatch, RootState } from '../../store';
import { useDispatch, useSelector } from 'react-redux';
import { openModal } from '../../store/auth/modalSlice';



const ProfileImage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { imageUrl, createdAt } = useSelector((state: RootState) => state.user);

  const handleOpenModal = () => {
    dispatch(openModal({
      type: 'big',
      isOpen: true
    }));
  };

  return (
    <div className="h-full w-full lg:w-[33%] p-1 shadow-custom rounded-none xs:rounded-md">
      <div className="items-center justify-center flex md:justify-normal md:items-start">
        <div className="items-center justify-center">
          <div onClick={handleOpenModal} className="cursor-pointer">
            <img
              className="rounded-full w-[220px] h-[220px]" 
              alt="image-profile" 
              src={imageUrl ? `http://localhost:8000/api/v1/user${imageUrl}?update=${timestamp}` : "http://laravel-react-fullstack.test/default-image.png"}  
            />
          </div>
          <div className="flex items-center justify-center mt-3">
            Bergabung: {formatDate(createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileImage;


