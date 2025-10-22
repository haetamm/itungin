import { PaymentStatus, Prisma } from '@prisma/client';
import { ResponseError } from '../entities/responseError';
import { payableRepository } from '../repository/payableRepository';

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

  async getAllPayable(
    page: number = 1,
    limit: number = 10,
    search: string = '',
    supplierId?: string,
    paymentStatus?: PaymentStatus,
    fromDueDate?: Date,
    toDueDate?: Date,
    minAmount?: number,
    maxAmount?: number,
    isPaid?: boolean
  ) {
    if (page < 1 || limit < 1) {
      throw new ResponseError(400, 'Page and limit must be positive numbers');
    }

    if (
      paymentStatus &&
      !Object.values(PaymentStatus).includes(paymentStatus)
    ) {
      throw new ResponseError(
        400,
        `Invalid payment status: '${paymentStatus}'. Allowed values: ${Object.values(PaymentStatus).join(', ')}`
      );
    }

    if (fromDueDate && isNaN(fromDueDate.getTime())) {
      throw new ResponseError(400, 'Invalid date format for fromDueDate');
    }

    if (toDueDate && isNaN(toDueDate.getTime())) {
      throw new ResponseError(400, 'Invalid date format for toDueDate');
    }

    if (minAmount !== undefined && (isNaN(minAmount) || minAmount < 0)) {
      throw new ResponseError(
        400,
        'Minimum amount must be a non-negative number'
      );
    }

    if (maxAmount !== undefined && (isNaN(maxAmount) || maxAmount < 0)) {
      throw new ResponseError(
        400,
        'Maximum amount must be a non-negative number'
      );
    }

    if (
      minAmount !== undefined &&
      maxAmount !== undefined &&
      minAmount > maxAmount
    ) {
      throw new ResponseError(
        400,
        'Minimum amount cannot be greater than maximum amount'
      );
    }

    const { items, total } = await payableRepository.getAllPayables(
      page,
      limit,
      search,
      supplierId,
      paymentStatus,
      fromDueDate,
      toDueDate,
      minAmount,
      maxAmount,
      isPaid
    );

    return {
      payables: items,
      pagination: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
    };
  }

  async getPayableDetail(id: string) {
    const payable = await payableRepository.getPayableDetail(id);
    if (!payable) throw new ResponseError(404, 'Payable not found');
    return payable;
  }
}

export const payableService = new PayableService();
