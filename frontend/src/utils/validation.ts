import { z } from 'zod'

export const loginFormSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().trim().min(1, 'Password is required'),
});
export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const registerFormSchema = z.object({
  name: z.string()
      .trim()
      .min(4, 'Minimum 4 characters')
      .max(23, 'Maximu, 23 characters')
      .regex(/^[a-zA-Z ]+$/, "Name must contain only alphabet characters and spaces"),
  username: z.string()
      .trim()
      .min(4,'Minimum 4 characters')
      .max(8, 'Maximum 8 characters')
      .regex(/^[a-zA-Z0-9]+$/, "Username must contain only alphanumeric characters"),
  password: z.string()
      .trim()
      .min(6, 'Minimum 6 characters')
      .max(8, 'Maximum 8 characters')
      .regex(/^[a-zA-Z0-9]+$/, "Password must contain only alphanumeric characters"),
  passwordConfirmation: z.string()
      .trim()
      .min(1, 'Password Confirmation is required'),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: "Passwords don't match",
  path: ['passwordConfirmation'],
});

export type RegisterFormValues = z.infer<typeof registerFormSchema>;


export const updateFormSchema = z.object({
    name: z.string()
        .trim()
        .min(4, 'Minimum 4 characters')
        .max(23, 'Maximum 23 characters')
        .regex(/^[a-zA-Z ]+$/, "Name must contain only alphabet characters and spaces"),
    username: z.string()
        .trim()
        .min(4, 'Minimum 4 characters')
        .max(8, 'Maximum 8 characters')
        .regex(/^[a-zA-Z0-9]+$/, "Username must contain only alphanumeric characters"),
    password: z.string()
        .trim()
        .min(6, 'Minimum 6 characters')
        .max(8, 'Maximum 8 characters')
        .regex(/^[a-zA-Z0-9]+$/, "Password must contain only alphanumeric characters")
        .optional()
        .or(z.literal('')),  // Allow empty string for password
    passwordConfirmation: z.string()
        .trim()
        .min(1, 'Password Confirmation is required')
        .optional()
        .or(z.literal('')),  // Allow empty string for passwordConfirmation
}).refine((data) => {
    // If password is provided, check that it matches passwordConfirmation
    if (data.password && data.passwordConfirmation) {
        return data.password === data.passwordConfirmation;
    }
    // If neither are provided, consider it valid
    return !data.password && !data.passwordConfirmation;
}, {
    message: "Passwords don't match",
    path: ['passwordConfirmation'],
});


export type UpdateFormValues = z.infer<typeof updateFormSchema>;


