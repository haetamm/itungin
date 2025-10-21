import { Prisma } from '@prisma/client';
import { ResponseError } from '../entities/responseError';
import { payableRepository } from '../repository/paybleRepository';

export class PayableService {
  async getPayable(
    payableId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    const payable = await payableRepository.getPayableById(
      payableId,
      prismaTransaction
    );
    if (!payable) {
      throw new ResponseError(404, `Payable ${payableId} not found`);
    }
    return payable;
  }
}

export const payableService = new PayableService();
