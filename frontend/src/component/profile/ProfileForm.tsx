import FormInput from "../FormInput";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../store";
import { Controller, useForm } from "react-hook-form";
import { updateFormSchema, UpdateFormValues } from "../../utils/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateUser } from "../../store/auth/userUpdateSlice";
import { handleFormErrors } from "../../utils/handleFormErrors";
import { registerFields } from "../../utils/fields";
import { setUser } from "../../store/auth/userSlice";

interface ProfileFormProps {
  openEdit: boolean;
  handleEditToggle: () => void;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ openEdit, 
  
  handleEditToggle }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading } = useSelector((state: RootState) => state.userUpdate);
  const { username, name } = useSelector((state: RootState) => state.user);

  const { control, handleSubmit, setError, reset, formState: { errors, isValid, isSubmitting } } = useForm<UpdateFormValues>({
    resolver: zodResolver(updateFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: name,
      username: username,
    }
  });

  const onSubmit = handleSubmit(async (data) => {
    const dataUpdate = {
      name: data.name,
      username: data.username,
      password: data.password ?? null
    };
    try {
      const { name, username, imageUrl } = await dispatch(updateUser(dataUpdate)).unwrap();
      dispatch(setUser({
        username: username,
        name: name,
        imageUrl: imageUrl,
      }));
      handleEditToggle();
    } catch(error) {
      handleFormErrors<UpdateFormValues>(error, setError);
    }
  });

  return (
    <div className=" overflow-auto w-full md:w-[65%] tab:w-[65%] lg:w-[62%] p-1">
      <div className="flex justify-end mt-2 md:hidden ">
        <button onClick={() => { handleEditToggle(); reset(); }} className="py-2 px-3 border-2 rounded-md border-slate-300 text-center hover:bg-white hover:border-white">{!openEdit ? 'Edit': 'Cancel'}</button>
      </div>
      <form onSubmit={onSubmit} className="mt-2 md:mt-0">

        {registerFields.map((input) => (
          <Controller 
            key={input.name}
            name={input.name}
            control={control}
            defaultValue=""
            render={({ field }) => (
              <FormInput 
                label={input.label}
                type={input.type}
                disabled={!openEdit ? true : false}
                name={input.name}
                value={field.value || ""}
                onChange={field.onChange}
                error={errors[input.name]?.message}
              >
                {input.icon}
              </FormInput>
            )}
          />
        ))}
      
        { openEdit && (
            <div className="flex gap-1 mt-2 text-center">
              <div onClick={() => { handleEditToggle(); reset(); }} className="cursor-pointer btn text-md w-1/2 bg-yellow-500 p-[15px] rounded-md">Cancel</div>
              <button
                disabled={!isValid || isSubmitting || loading}
                className="btn text-md w-1/2 bg-blue-500 p-[15px] rounded-md disabled:bg-blue-300 disabled:text-white text-black"
                >
                  {loading ? 'Loading..' : 'Update'}
              </button>
            </div>
          )
        }
      </form>
    </div>
  );
}



export default ProfileForm;
