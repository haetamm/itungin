interface FormInputProps {
  label: string;
  type: string;
  name: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  children?: React.ReactNode;
  error?: string;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  type,
  name,
  value,
  onChange,
  disabled,
  children,
  error,
}) => (
  <div className="m-0">
    <div className="relative font-normal m-0">
      {children}
      <input
        onChange={onChange}
        disabled={disabled}
        name={name}
        value={value}
        type={type}
        className={`w-full outline-2 px-4 py-3 bg-white rounded-md mt-1 border focus:border-blue-500 focus:bg-white focus:outline-none pl-12 ${error ? 'border-red-500' : ''}`}
        placeholder={label}
      />
    </div>
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
);

export default FormInput;
