import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch, useSelector } from 'react-redux';
import { LoginFormValues, loginFormSchema } from '../utils/validation';
import { loginUser } from '../store/guest/loginSlice';
import { AppDispatch, RootState } from '../store';
import { Helmet } from "react-helmet-async";
import FormInput from "../component/FormInput";
import guestStyle from '../styles/pages/form-sign-signup.module.scss';
import { Link } from 'react-router-dom';
import { loginFields } from '../utils/fields';
import { handleFormErrors } from '../utils/handleFormErrors';
import { login } from '../store/auth/userSlice';

export default function Login() {
  const dispatch = useDispatch<AppDispatch>(); 
  const { loading } = useSelector((state: RootState) => state.login);
  
  const { control, handleSubmit, setError, formState: { errors, isValid, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    mode: 'onChange',
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      const { name, username, imageUrl, roleUser, token, createdAt } = await dispatch(loginUser(data)).unwrap();
      const userRole = roleUser[0];
      dispatch(login({ username, imageUrl, name, role: userRole, token, createdAt }));
    } catch (error) {
      handleFormErrors<LoginFormValues>(error, setError);
    }
  });

  return (
    <>
      <Helmet>
        <title>Login | Itungin</title>
        <meta name='description' content='Login page itungin' />
      </Helmet>
      <div className={`${guestStyle.loginSignupForm} animated fadeInDown`}>
        <div className={`${guestStyle.form}`}>
          <form onSubmit={onSubmit}>
            <h1 className={`${guestStyle.title}`}>Login into your account</h1>
            
            {loginFields.map((input) => (
              <Controller
                key={input.name}
                name={input.name}
                control={control}
                defaultValue=""
                render={({ field }) => (
                  <FormInput
                    label={input.label}
                    type={input.type}
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors[input.name]?.message}
                  >
                    {input.icon}
                  </FormInput>
                )}
              />
            ))}
            <button
              type="submit"
              disabled={!isValid || isSubmitting || loading}
              className={`${guestStyle.btn} ${guestStyle.btnBlock} disabled:bg-slate-200 disabled:cursor-not-allowed bg-black`}
            >
              {loading ? 'Loading...' : 'Login'}
            </button>

            <p className={`${guestStyle.message}`}>
              Not Registered? <Link to="/register" className="text-slate-600">Create an account</Link>
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
