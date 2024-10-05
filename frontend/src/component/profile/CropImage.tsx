import { ChangeEvent, createRef, useState } from 'react'
import { useStateContext } from '../../contexts/ContextProvider';
import Cropper, { ReactCropperElement } from "react-cropper";
import axiosInstance from '../../utils/api-default';
import { dataURLtoBlob, getUser } from '../../utils/helper';
import { FormErrors } from '../../utils/dataInterface';

import "cropperjs/dist/cropper.css";
import '../../styles/components/crop-image.scss'

export default function CropImage() {
  const { user, setUser, setNotification, setOpenModal } = useStateContext();
  const [errors, setErrors] = useState<FormErrors | null>(null);

  const [change, setChange] = useState<boolean>(false);
  const [image, setImage] = useState<string | undefined>(user?.image);
  const [cropData, setCropData] = useState<string>("");
  const cropperRef = createRef<ReactCropperElement>();

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.preventDefault();
    setCropData("");
    const files = e.target.files;
    if (files && files.length > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImage(reader.result);
        }
      };
      reader.readAsDataURL(files[0]);
    }
  };

  const getCropData = () => {
    if (typeof cropperRef.current?.cropper !== "undefined") {
      setCropData(cropperRef.current?.cropper.getCroppedCanvas().toDataURL());
    }
  };

   const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();

    if (cropData) {
      const blob = dataURLtoBlob(cropData);
      formData.append('profile', blob, 'profile.png');
    }

    axiosInstance.post('/user/upload', formData, {
       headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    .then(async () => {
      setNotification("foto profile berhasil diupload", "success");
      const userData = await getUser();
      setUser(userData);
      setOpenModal({ toggle: false, setting: "" });

    })
    .catch(err => {
      const response = err.response
      if (response && response.status === 422) {
        setErrors(response.data.errors);
      }
    })
  };

  return (
    <>
      <div className="w-full inline-block lg:flex mt-0">
        {!change &&
          <div className="flex items-center justify-center w-full lg:w-[65%]">
            <img src={user?.image ? `http://laravel-react-fullstack.test/storage/upload/${user.image}` : "http://laravel-react-fullstack.test/default-image.png"} className="rounded-full w-[300px] h-[300px]" alt="image-profile" />
          </div>
        }

         {change &&
            <Cropper
              ref={cropperRef}
              className="w-full xs:w-[65%] h-[300px]"
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

            {
              errors &&
              <div className="bg-red-400 text-white mb-[3px] block text-sm p-1 mt-3 rounded-md">
                  {Object.keys(errors).map((key, index) => (
                    <p key={index}>{errors[key][0]}</p>
                  ))}
              </div>
          }

            {cropData === "" ? (
                <button onClick={getCropData} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0">Crop</button>
            ) : (
                <button onClick={onSubmit} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0">Upload</button>
            )}
        </div>
      </div>
      <br style={{ clear: "both" }} />
    </>
  )
}
