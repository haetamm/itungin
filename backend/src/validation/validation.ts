import { Schema, ValidationResult } from 'joi';
import { ResponseError } from '../entities/responseError';

const validate = <T>(schema: Schema<T>, request: unknown): T => {
    const result: ValidationResult<T> = schema.validate(request, { abortEarly: false });
    if (result.error) {
        const errorMessages = result.error.details.map(detail => detail.message).join(', ');
        throw new ResponseError(422, errorMessages);
    } else {
        return result.value;
    }
}

export { validate };
