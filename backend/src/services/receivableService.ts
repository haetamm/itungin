import { PaymentStatus } from '@prisma/client';
import { ResponseError } from '../entities/responseError';
import { receivableRepository } from '../repository/receivableRepository';

export class ReceivableService {
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
