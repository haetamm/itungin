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
      throw new ResponseError(400, 'Halaman dan batas harus bilangan positif');
    }

    if (
      paymentStatus &&
      !Object.values(PaymentStatus).includes(paymentStatus)
    ) {
      throw new ResponseError(
        400,
        `Status pembayaran tidak valid: '${paymentStatus}'. Nilai yang diperbolehkan: ${Object.values(PaymentStatus).join(', ')}`
      );
    }

    if (fromDueDate && isNaN(fromDueDate.getTime())) {
      throw new ResponseError(400, 'Format tanggal fromDueDate tidak valid');
    }

    if (toDueDate && isNaN(toDueDate.getTime())) {
      throw new ResponseError(400, 'Format tanggal toDueDate tidak valid');
    }

    if (minAmount !== undefined && (isNaN(minAmount) || minAmount < 0)) {
      throw new ResponseError(400, 'Jumlah minimum harus bilangan non-negatif');
    }

    if (maxAmount !== undefined && (isNaN(maxAmount) || maxAmount < 0)) {
      throw new ResponseError(
        400,
        'Jumlah maksimum harus bilangan non-negatif'
      );
    }

    if (
      minAmount !== undefined &&
      maxAmount !== undefined &&
      minAmount > maxAmount
    ) {
      throw new ResponseError(
        400,
        'Jumlah minimum tidak boleh lebih besar dari jumlah maksimum'
      );
    }

    // Call repository function
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
}

export const payableService = new PayableService();
