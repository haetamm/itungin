import { formatDate } from '../../utils/helper';
import { useStateContext } from '../../contexts/ContextProvider';



const ProfileImage = () => {
  const { user, setOpenModal } = useStateContext();

  return (
    <div className="h-full w-full md:w-[35%] lg:w-[33%] p-1 shadow-custom rounded-none xs:rounded-md">
      <div className="items-center justify-center flex md:justify-normal md:items-start">
        <div className="items-center justify-center">
          <div onClick={() => setOpenModal({ toggle: true, setting: "besar"})} className="cursor-pointer">
            <img src={user?.image ? `http://laravel-react-fullstack.test/storage/upload/${user.image}` : "http://laravel-react-fullstack.test/default-image.png"} className="rounded-full w-[220px] h-[220px]" alt="image-profile" />
          </div>
          <div className="flex items-center justify-center mt-3">
            Bergabung: {formatDate(user?.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileImage;
