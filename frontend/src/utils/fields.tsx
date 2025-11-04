import { BiSolidKey, BiSolidUser } from 'react-icons/bi';
import { FaUserCircle } from 'react-icons/fa';

type InputField = {
  name: 'username' | 'password';
  label: string;
  type: string;
  icon: JSX.Element;
};

export const loginFields: InputField[] = [
  {
    name: 'username',
    label: 'Username',
    type: 'text',
    icon: (
      <FaUserCircle className="absolute left-3 top-4 h-6 w-6 text-gray-400 cursor-pointer" />
    ),
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    icon: (
      <BiSolidKey className="absolute left-3 top-4 h-6 w-6 text-gray-400 cursor-pointer" />
    ),
  },
];

type InputFieldRegister = {
  name: 'name' | 'username' | 'password' | 'passwordConfirmation';
  label: string;
  type: string;
  icon: JSX.Element;
};

export const registerFields: InputFieldRegister[] = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    icon: (
      <BiSolidUser className="absolute left-3 top-4 h-6 w-6 text-gray-400 cursor-pointer" />
    ),
  },
  {
    name: 'username',
    label: 'Username',
    type: 'text',
    icon: (
      <FaUserCircle className="absolute left-3 top-4 h-6 w-6 text-gray-400 cursor-pointer" />
    ),
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    icon: (
      <BiSolidKey className="absolute left-3 top-4 h-6 w-6 text-gray-400 cursor-pointer" />
    ),
  },
  {
    name: 'passwordConfirmation',
    label: 'Password Confirmation',
    type: 'password',
    icon: (
      <BiSolidKey className="absolute left-3 top-4 h-6 w-6 text-gray-400 cursor-pointer" />
    ),
  },
];
