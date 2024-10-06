import { ChangeEvent, createRef, useState } from 'react'
import Cropper, { ReactCropperElement } from "react-cropper";
import { dataURLtoBlob } from '../../utils/helper';
import { AppDispatch, RootState } from '../../store';
import { useDispatch, useSelector } from 'react-redux';
import { handleFormErrors } from '../../utils/handleFormErrors';
import { closeModal } from '../../store/auth/modalSlice';
import { setImageUser } from '../../store/auth/userSlice';

import "cropperjs/dist/cropper.css";
import '../../styles/components/crop-image.scss'
import { uploadImage } from '../../store/auth/uploadImageSlice';
import { toast } from 'sonner';

export default function CropImage() {
  const dispatch = useDispatch<AppDispatch>();
  const { imageUrl } = useSelector((state: RootState) => state.user);
  const [image, setImage] = useState<string | undefined>(`http://localhost:8000/api/v1/user${imageUrl}`);
  const [change, setChange] = useState<boolean>(false);
  const [cropData, setCropData] = useState<string>("");
  const cropperRef = createRef<ReactCropperElement>();

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setCropData("");
    const files = e.target.files;
    if (files && files.length > 0) {
        const file = files[0];
        const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        const maxFileSize = 200 * 1024;

        if (!validImageTypes.includes(file.type)) {
            toast.error("File harus berupa gambar (jpg, jpeg, png).");
            return;
        }

        if (file.size > maxFileSize) {
            toast.error("Ukuran file harus kurang dari 200kb.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setImage(reader.result);
            }
        };
        reader.readAsDataURL(file);
    }
};

  const getCropData = () => {
    if (typeof cropperRef.current?.cropper !== "undefined") {
      setCropData(cropperRef.current?.cropper.getCroppedCanvas().toDataURL());
    }
  };

  const onSubmit = async () => {
    const formData = new FormData();
    if (cropData) {
      const blob = dataURLtoBlob(cropData);
      formData.append('image', blob, 'profile.png');
      try {
        const { imageUrl } = await dispatch(uploadImage(formData)).unwrap();
        dispatch(closeModal());
        dispatch(setImageUser({ imageUrl: imageUrl }));
      } catch(error) {
          handleFormErrors(error, null);
      }
    }
  };

  return (
    <>
      <div className="w-full inline-block lg:flex mt-2">
        {!change &&
          <div className="flex items-center justify-center w-full lg:w-[65%]">
            <img src={imageUrl ? image : "http://laravel-react-fullstack.test/default-image.png"} className="rounded-full w-[300px] h-[300px]" alt="image-profile" />
          </div>
        }

         {change &&
            <Cropper
              ref={cropperRef}
              className="w-full lg:w-[65%] h-[300px]"
              initialAspectRatio={1}
              preview=".img-preview"
              src={image}
              viewMode={1}
              minCropBoxHeight={220}
              minCropBoxWidth={220}
              background={false}
              responsive={true}
              autoCropArea={1}
              checkOrientation={false}
              guides={true}
            />
        }
        
        <div className="relative mt-6 ml-0 lg:ml-6 items-center justify-center mx-auto">
            <div className="mb-0 xs:mb-2 w-full" onClick={() => setChange(true)} >
                <input type="file" accept=".jpg, .jpeg, .png" onChange={onChange} className="fmt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0" />
            </div>

            <button 
              onClick={!cropData ? getCropData : onSubmit} 
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0">
                {!cropData ? 'Crop' : 'Upload'}
            </button>
        </div>
      </div>
      <br style={{ clear: "both" }} />
    </>
  )
}
