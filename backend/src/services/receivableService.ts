import { PaymentStatus, Prisma } from '@prisma/client';
import { ResponseError } from '../entities/responseError';
import { receivableRepository } from '../repository/receivableRepository';

export class ReceivableService {
  async getReceivable(
    receivableId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    const receivable = await receivableRepository.getReceivableById(
      receivableId,
      prismaTransaction
    );
    if (!receivable) {
      throw new ResponseError(404, `Receivable ${receivableId} not found`);
    }
    return receivable;
  }

  async getAllReceivable(
    page: number = 1,
    limit: number = 10,
    search: string = '',
    customerId?: string,
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

    const { items, total } = await receivableRepository.getAllReceivable(
      page,
      limit,
      search,
      customerId,
      paymentStatus,
      fromDueDate,
      toDueDate,
      minAmount,
      maxAmount,
      isPaid
    );

    return {
      receivables: items,
      pagination: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
    };
  }

  async getReceivableDetail(id: string) {
    const receivable = await receivableRepository.getReceivableDetail(id);
    if (!receivable) throw new ResponseError(404, 'Receivable not found');
    return receivable;
  }
}

export const receivableService = new ReceivableService();
