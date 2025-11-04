import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import FormInput from '../component/FormInput';
import guestStyle from '../styles/pages/form-sign-signup.module.scss';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { Controller, useForm } from 'react-hook-form';
import { registerFormSchema, RegisterFormValues } from '../utils/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerUser } from '../store/guest/registerSlice';
import { handleFormErrors } from '../utils/handleFormErrors';
import { registerFields } from '../utils/fields';

export default function Register() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { loading } = useSelector((state: RootState) => state.register);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isValid, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    mode: 'onChange',
  });

  const onSubmit = handleSubmit(async (data) => {
    const dataReg = {
      name: data.name,
      username: data.username,
      password: data.password,
    };
    try {
      await dispatch(registerUser(dataReg)).unwrap();
      navigate('/login');
    } catch (error) {
      handleFormErrors<RegisterFormValues>(error, setError);
    }
  });

  return (
    <>
      <Helmet>
        <title>Register | Itungin</title>
        <meta name="description" content="Register page itungin" />
      </Helmet>
      <div className={`${guestStyle.loginSignupForm} animated fadeInDown`}>
        <div className={`${guestStyle.form}`}>
          <form onSubmit={onSubmit}>
            <h1 className={`${guestStyle.title}`}>Register for free</h1>

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
                    name={input.name}
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
              {loading ? 'Loading...' : 'Register'}
            </button>

            <p className={`${guestStyle.message}`}>
              Already registered?{' '}
              <Link to="/login" className="text-slate-600">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
