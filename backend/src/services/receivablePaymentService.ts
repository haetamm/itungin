import { updateReceivablePaymentSchema } from './../validation/receivablePaymentValidation';
import { PaymentStatus, Prisma, ReceivablePayment } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prismaClient } from '../application/database';
import { ResponseError } from '../entities/responseError';
import { accountRepository } from '../repository/accountRepository';
import { journalEntryRepository } from '../repository/journalEntryRepository';
import { validate } from '../validation/validation';
import { accountService } from './accountService';
import {
  ReceivablePaymentRequest,
  UpdatePaymentReceivableRequest,
} from '../utils/interface';
import { journalRepository } from '../repository/journalRepository';
import { receivablePaymentRepository } from '../repository/receivablePaymentRepository';
import { receivablePaymentSchema } from '../validation/receivablePaymentValidation';
import { receivableService } from './receivableService';
import { receivableRepository } from '../repository/receivableRepository';
import { formatRupiah, stringToDate } from '../utils/helper';

export class ReceivablePaymentService {
  private async validatePaymentDate(
    paymentDate: Date | string,
    saleDate: Date | string
  ) {
    const paymentDt = new Date(paymentDate);
    const saleDt = new Date(saleDate);

    if (paymentDt < saleDt) {
      throw new ResponseError(
        400,
        `Payment date (${paymentDt.toISOString().split('T')[0]}) cannot be earlier than sale date (${saleDt.toISOString().split('T')[0]}).`
      );
    }

    return paymentDt;
  }

  async getPayment(
    paymentId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    const payment = await receivablePaymentRepository.getPaymentById(
      paymentId,
      prismaTransaction
    );
    if (!payment) throw new ResponseError(404, 'Payment not found');
    return payment;
  }

  async getReceivablePaymentDetail(paymentId: string) {
    const payment =
      await receivablePaymentRepository.getPaymentDetail(paymentId);
    if (!payment) throw new ResponseError(404, 'Payment not found');
    return payment;
  }

  async createReceivablePayment({
    body,
  }: {
    body: ReceivablePaymentRequest;
  }): Promise<ReceivablePayment> {
    const paymentReq = validate(receivablePaymentSchema, body);
    const { receivableId, receiveVoucher, amount, paymentDate, method } =
      paymentReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // ambil hutang
      const receivable = await receivableService.getReceivable(
        receivableId,
        prismaTransaction
      );

      const { sale, customer, dueDate } = receivable;
      if (!sale) {
        throw new ResponseError(
          400,
          'Receivable does not have an associated sale'
        );
      }

      // Validasi: paymentDate tidak boleh lebih awal dari tanggal sale
      const paymentDt = await this.validatePaymentDate(paymentDate, sale.date);

      // Cek jika pembayaran dilakukan lewat jatuh tempo
      const isLatePayment = paymentDt > dueDate;

      // validasi payment amount
      const paymentAmount = new Decimal(amount);
      if (paymentAmount.gt(receivable.remainingAmount)) {
        throw new ResponseError(
          400,
          'Payment amount exceeds remaining receivable'
        );
      }

      // ambil akun default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);
      const { cashAccount, receivableAccount } = accountDefault;

      // valid saldo cash
      if (
        method.toLowerCase() === 'cash' &&
        cashAccount.balance.comparedTo(paymentAmount) < 0
      ) {
        throw new ResponseError(400, 'Insufficient cash balance');
      }

      // buat journal
      const journal = await journalRepository.createJournal(
        {
          date: new Date(paymentDate),
          description: `Pembayaran piutang penjualan dari ${customer.customerName}${
            isLatePayment ? ' [TERLAMBAT]' : ''
          }`,
          reference: receiveVoucher,
        },
        prismaTransaction
      );

      // buat journal entries
      const journalEntries = [
        {
          journalId: journal.journalId,
          accountId: receivableAccount.accountId,
          debit: new Decimal(0),
          credit: paymentAmount,
        },
        {
          journalId: journal.journalId,
          accountId: cashAccount.accountId,
          debit: paymentAmount,
          credit: new Decimal(0),
        },
      ];

      await journalEntryRepository.createManyJournalEntries(
        journalEntries,
        prismaTransaction
      );

      // Cari cash journal entry (credit) untuk pencatatan payment
      const cashJournalEntry =
        await journalEntryRepository.findLatestCreditEntry(
          journal.journalId,
          paymentAmount,
          prismaTransaction
        );
      if (!cashJournalEntry) {
        throw new ResponseError(400, 'Failed to find cash journal entry');
      }

      // Create payment record
      const payment = await receivablePaymentRepository.createPayment(
        {
          receivableId,
          receiveVoucher,
          journalEntryId: cashJournalEntry.journalEntryId,
          paymentAmount,
          paymentDate: new Date(paymentDate),
          method,
        },
        prismaTransaction
      );

      // Update receivable
      const newPaidAmount = receivable.paidAmount.plus(paymentAmount);
      const newRemainingAmount = receivable.amount.minus(newPaidAmount);
      const newStatus = newRemainingAmount.eq(0)
        ? PaymentStatus.PAID
        : PaymentStatus.PARTIAL;

      await receivableRepository.recordReceivablePayment(
        {
          receivableId,
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
        },
        prismaTransaction
      );

      // Update account balances
      await accountRepository.updateAccountTransaction(
        {
          accountCode: receivableAccount.accountCode,
          balance: receivableAccount.balance.minus(paymentAmount),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: cashAccount.accountCode,
          balance: cashAccount.balance.plus(paymentAmount),
        },
        prismaTransaction
      );

      return payment;
    });
  }

  async updateReceivablePayment(
    paymentId: string,
    body: UpdatePaymentReceivableRequest
  ): Promise<ReceivablePayment> {
    const paymentReq = validate(updateReceivablePaymentSchema, body);
    const { receiveVoucher, amount, paymentDate, method } = paymentReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Ambil payment lama
      const existingPayment = await this.getPayment(
        paymentId,
        prismaTransaction
      );

      const { amount: oldPaymentAmount, receivableId } = existingPayment;
      const newPaymentAmount = new Decimal(amount);

      // Ambil receivable
      const receivable = await receivableService.getReceivable(
        receivableId,
        prismaTransaction
      );

      const { sale, customer, dueDate } = receivable;
      if (!sale) {
        throw new ResponseError(
          400,
          'Receivable does not have an associated sale'
        );
      }

      // Validasi tanggal
      const paymentDt = await this.validatePaymentDate(paymentDate, sale.date);
      const isLatePayment = paymentDt > dueDate;

      // Hitung ulang receivable
      const adjustedPaidAmount = receivable.paidAmount
        .minus(oldPaymentAmount)
        .plus(newPaymentAmount);
      const newRemainingAmount = receivable.amount.minus(adjustedPaidAmount);

      if (newRemainingAmount.lt(0)) {
        throw new ResponseError(
          400,
          `Updated payment exceeds remaining receivable amount of ${formatRupiah(receivable.remainingAmount)}`
        );
      }

      // Ambil akun default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);
      const { cashAccount, receivableAccount } = accountDefault;

      // Validasi saldo kas
      if (
        method.toLowerCase() === 'cash' &&
        newPaymentAmount.gt(oldPaymentAmount) &&
        cashAccount.balance.comparedTo(
          newPaymentAmount.minus(oldPaymentAmount)
        ) < 0
      ) {
        throw new ResponseError(400, 'Insufficient cash balance');
      }

      // Ambil jurnal & entries lama
      const oldJournalEntry = await journalEntryRepository.getById(
        existingPayment.journalEntryId,
        prismaTransaction
      );
      if (!oldJournalEntry) {
        throw new ResponseError(404, 'Journal entry not found');
      }

      const { journal: oldJournal } = oldJournalEntry;
      const oldEntries = await journalEntryRepository.getByJournalId(
        oldJournal.journalId,
        prismaTransaction
      );

      // Update jurnal
      await journalRepository.updateJournalTransaction(
        {
          journalId: oldJournal.journalId,
          date: paymentDt,
          description: `Pembayaran piutang penjualan dari ${customer.customerName} ${
            isLatePayment ? ' [TERLAMBAT]' : ''
          } | diperbarui: ${stringToDate(new Date())}`,
          reference: receiveVoucher,
        },
        prismaTransaction
      );

      // Update entries lama
      for (const entry of oldEntries) {
        if (entry.accountId === receivableAccount.accountId) {
          // akun piutang: credit
          await journalEntryRepository.updateJournalEntryAmounts(
            {
              journalEntryId: entry.journalEntryId,
              debit: new Decimal(0),
              credit: newPaymentAmount,
            },
            prismaTransaction
          );
        } else if (entry.accountId === cashAccount.accountId) {
          // akun kas: debit
          await journalEntryRepository.updateJournalEntryAmounts(
            {
              journalEntryId: entry.journalEntryId,
              debit: newPaymentAmount,
              credit: new Decimal(0),
            },
            prismaTransaction
          );
        }
      }

      // Update Payment
      const updatedPayment = await receivablePaymentRepository.updatePayment(
        {
          paymentId,
          receiveVoucher,
          paymentAmount: newPaymentAmount,
          paymentDate: paymentDt,
          method,
        },
        prismaTransaction
      );

      // Update Receivable
      const newStatus = newRemainingAmount.eq(0)
        ? PaymentStatus.PAID
        : PaymentStatus.PARTIAL;

      await receivableRepository.recordReceivablePayment(
        {
          receivableId,
          paidAmount: adjustedPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
        },
        prismaTransaction
      );

      // Update saldo akun
      const diff = newPaymentAmount.minus(oldPaymentAmount);

      await accountRepository.updateAccountTransaction(
        {
          accountCode: receivableAccount.accountCode,
          balance: receivableAccount.balance.minus(diff),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: cashAccount.accountCode,
          balance: cashAccount.balance.plus(diff),
        },
        prismaTransaction
      );

      return updatedPayment;
    });
  }

  async deleteReceivablePayment(paymentId: string): Promise<void> {
    return await prismaClient.$transaction(async (prismaTransaction) => {
      // ambil payment
      const payment = await this.getPayment(paymentId, prismaTransaction);

      const { receivableId, amount, journalEntryId, method } = payment;
      const paymentAmount = new Decimal(amount);

      // ambil receivable
      const receivable = await receivableService.getReceivable(
        receivableId,
        prismaTransaction
      );

      // ambil journal entries
      const journalEntry = await journalEntryRepository.getById(
        journalEntryId,
        prismaTransaction
      );
      if (!journalEntry || !journalEntry.journal) {
        throw new ResponseError(404, 'Journal entry or journal not found');
      }

      const { journal } = journalEntry;

      // ambil account default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);
      const { cashAccount, receivableAccount } = accountDefault;
      if (!cashAccount || !receivableAccount) {
        throw new ResponseError(404, 'Cash or payable account not found');
      }

      // Validate cash balance jika payment method adalah cash
      if (method.toLowerCase() === 'cash') {
        const newCashBalance = cashAccount.balance.plus(paymentAmount);
        if (newCashBalance.lt(0)) {
          throw new ResponseError(
            400,
            'Restoring payment would result in negative cash balance'
          );
        }
      }

      // Reverse account balances
      await accountRepository.updateAccountTransaction(
        {
          accountCode: receivableAccount.accountCode,
          balance: receivableAccount.balance.plus(paymentAmount),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: cashAccount.accountCode,
          balance: cashAccount.balance.minus(paymentAmount),
        },
        prismaTransaction
      );

      // Update receivable
      const newPaidAmount = receivable.paidAmount.minus(paymentAmount);
      const newRemainingAmount = receivable.amount.minus(newPaidAmount);
      const newStatus = newRemainingAmount.eq(0)
        ? PaymentStatus.PAID
        : newPaidAmount.eq(0)
          ? PaymentStatus.UNPAID
          : PaymentStatus.PARTIAL;

      await receivableRepository.recordReceivablePayment(
        {
          receivableId,
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
        },
        prismaTransaction
      );

      // Delete payment
      await receivablePaymentRepository.deletePayment(
        paymentId,
        prismaTransaction
      );

      // Delete journal entries
      await journalEntryRepository.deleteByJournalId(
        journal.journalId,
        prismaTransaction
      );

      // Delete journal
      await journalRepository.deleteJournal(
        journal.journalId,
        prismaTransaction
      );
    });
  }
}

export const receivablePaymentService = new ReceivablePaymentService();
