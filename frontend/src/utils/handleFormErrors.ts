import { UseFormSetError, FieldValues, Path } from 'react-hook-form';
import { toast } from 'sonner';

interface ErrorResponse {
    code: number; 
    status: string;
    message: string;
}

export const handleFormErrors = <T extends FieldValues>(
    error: unknown, 
    setError: UseFormSetError<T>
): void => {
    const errorResponse = error as ErrorResponse;

    if (errorResponse && errorResponse.code) {
        const { code, message } = errorResponse;

        switch (code) { 
            case 422: {
                const errorMessages = message.split(', ');

                errorMessages.forEach((errorMessage) => {
                    const match = errorMessage.match(/"(.*?)"/);

                    if (match) {
                        const fieldName = match[1];
                        const msg = errorMessage.replace(/"/g, '').trim();

                        setError(fieldName as Path<T>, { type: 'manual', message: msg });
                    }
                });
                break;
            }

            case 403: {
                toast.error(message || 'You are not authorized to access this resource');
                break;
            }

            case 401: {
                toast.error(message || 'Please log in again.');
                break;
            }

            case 400: {
                toast.error(message || 'Bad request.');
                break;
            }

            default: {
                if (code >= 400 && code < 500) {
                    toast.error(message || 'An error occurred. Please try again later.');
                }
                break;
            }
        }
    } else {
        toast.error('An error occurred. Please try again later.');
    }
};
