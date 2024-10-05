export interface FormInputRegis {
    name: string;
    email: string;
    password: string;
    passwordConfirmation: string;
}

export interface FormInputLogin {
    email: string;
    password: string;
}

export interface FormErrors {
  [key: string]: string[];
}

export interface UserData {
  id: number,
  image: string,
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface NotifSetting {
  message: string,
  setting: string,
}

export interface modalSetting {
    toggle: boolean,
    setting: string
}
