import { Payment, PaymentStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prismaClient } from '../application/database';
import { ResponseError } from '../entities/responseError';
import { accountRepository } from '../repository/accountRepository';
import { journalEntryRepository } from '../repository/journalEntryRepository';
import { validate } from '../validation/validation';
import { accountService } from './accountService';
import {
  PaymentPayableRequest,
  UpdatePaymentPayableRequest,
} from '../utils/interface';
import {
  paymentPayableSchema,
  updatePaymentPayableSchema,
} from '../validation/paymentValidation';
import { payableService } from './payableService';
import { journalRepository } from '../repository/journalRepository';
import { payableRepository } from '../repository/payableRepository';
import { payablePaymentRepository } from '../repository/payablePaymentRepository';
import { formatRupiah } from '../utils/helper';

export class PayablePaymentService {
  private async validatePaymentDate(
    paymentDate: Date | string,
    purchaseDate: Date | string
  ) {
    const paymentDt = new Date(paymentDate);
    const purchaseDt = new Date(purchaseDate);

    if (paymentDt < purchaseDt) {
      throw new ResponseError(
        400,
        `Payment date (${paymentDt.toISOString().split('T')[0]}) cannot be earlier than purchase date (${purchaseDt.toISOString().split('T')[0]}).`
      );
    }

    return paymentDt;
  }

  async getPayment(
    paymentId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    const payment = await payablePaymentRepository.getPaymentById(
      paymentId,
      prismaTransaction
    );
    if (!payment) throw new ResponseError(404, 'Payment not found');
    return payment;
  }

  async getPayablePaymentDetail(paymentId: string) {
    const payment = await payablePaymentRepository.getPaymentDetail(paymentId);
    if (!payment) throw new ResponseError(404, 'Payment not found');
    return payment;
  }

  async createPayablePayment({
    body,
  }: {
    body: PaymentPayableRequest;
  }): Promise<Payment> {
    const paymentReq = validate(paymentPayableSchema, body);
    const { payableId, paymentVoucher, amount, paymentDate, method } =
      paymentReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // ambil hutang
      const payable = await payableService.getPayable(
        payableId,
        prismaTransaction
      );

      const { purchase, supplier, dueDate } = payable;
      if (!purchase) {
        throw new ResponseError(
          400,
          'Payable does not have an associated purchase'
        );
      }

      // Validasi: paymentDate tidak boleh lebih awal dari tanggal purchase
      const paymentDt = await this.validatePaymentDate(
        paymentDate,
        purchase.date
      );

      // Cek jika pembayaran dilakukan lewat jatuh tempo
      const isLatePayment = paymentDt > dueDate;

      // validasi payment amount
      const paymentAmount = new Decimal(amount);
      if (paymentAmount.gt(payable.remainingAmount)) {
        throw new ResponseError(
          400,
          'Payment amount exceeds remaining payable'
        );
      }

      // ambil akun default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);
      const { cashAccount, payableAccount } = accountDefault;

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
          description: `Pembayaran utang pembelian kepada ${supplier.supplierName} (No. Invoice: ${purchase.invoiceNumber})${
            isLatePayment ? ' [TERLAMBAT]' : ''
          }`,
          reference: paymentVoucher,
        },
        prismaTransaction
      );

      // buat journal entries
      const journalEntries = [
        {
          journalId: journal.journalId,
          accountId: payableAccount.accountId,
          debit: paymentAmount,
          credit: new Decimal(0),
        },
        {
          journalId: journal.journalId,
          accountId: cashAccount.accountId,
          debit: new Decimal(0),
          credit: paymentAmount,
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

      // Buat payment
      const payment = await payablePaymentRepository.createPayment(
        {
          payableId,
          paymentVoucher,
          journalEntryId: cashJournalEntry.journalEntryId,
          paymentAmount,
          paymentDate: new Date(paymentDate),
          method,
        },
        prismaTransaction
      );

      // Update payable
      const newPaidAmount = payable.paidAmount.plus(paymentAmount);
      const newRemainingAmount = payable.amount.minus(newPaidAmount);
      const newStatus = newRemainingAmount.eq(0)
        ? PaymentStatus.PAID
        : PaymentStatus.PARTIAL;

      await payableRepository.recordPayablePayment(
        {
          payableId,
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
        },
        prismaTransaction
      );

      // Update account balances
      await accountRepository.updateAccountTransaction(
        {
          accountCode: payableAccount.accountCode,
          balance: payableAccount.balance.minus(paymentAmount),
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

      return payment;
    });
  }

  async updatePayablePayment(
    paymentId: string,
    body: UpdatePaymentPayableRequest
  ): Promise<Payment> {
    const paymentReq = validate(updatePaymentPayableSchema, body);
    const { paymentVoucher, amount, paymentDate, method } = paymentReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Ambil data payment lama
      const existingPayment = await this.getPayment(
        paymentId,
        prismaTransaction
      );
      const { amount: oldPaymentAmount, payableId } = existingPayment;

      // Ambil payable
      const payable = await payableService.getPayable(
        payableId,
        prismaTransaction
      );

      const { purchase, supplier, dueDate } = payable;
      if (!purchase) {
        throw new ResponseError(
          400,
          'Payable does not have an associated purchase'
        );
      }

      // Validasi tanggal
      const paymentDt = await this.validatePaymentDate(
        paymentDate,
        purchase.date
      );
      const isLatePayment = paymentDt > dueDate;

      // Hitung ulang payable
      const newPaymentAmount = new Decimal(amount);
      const adjustedPaidAmount = payable.paidAmount
        .minus(oldPaymentAmount)
        .plus(newPaymentAmount);
      const newRemainingAmount = payable.amount.minus(adjustedPaidAmount);

      if (newRemainingAmount.lt(0)) {
        throw new ResponseError(
          400,
          `Updated payment exceeds remaining payable amount of ${formatRupiah(payable.remainingAmount)}`
        );
      }

      // Ambil akun default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);
      const { cashAccount, payableAccount } = accountDefault;

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
          description: `Update pembayaran utang pembelian kepada ${supplier.supplierName} (No. Invoice: ${purchase.invoiceNumber})${
            isLatePayment ? ' [TERLAMBAT]' : ''
          }`,
          reference: paymentVoucher,
        },
        prismaTransaction
      );

      // Update entries lama
      for (const entry of oldEntries) {
        // akun utang: debit
        if (entry.accountId === payableAccount.accountId) {
          await journalEntryRepository.updateJournalEntryAmounts(
            {
              journalEntryId: entry.journalEntryId,
              debit: newPaymentAmount,
              credit: new Decimal(0),
            },
            prismaTransaction
          );
        } else if (entry.accountId === cashAccount.accountId) {
          // akun kas: kredit
          await journalEntryRepository.updateJournalEntryAmounts(
            {
              journalEntryId: entry.journalEntryId,
              debit: new Decimal(0),
              credit: newPaymentAmount,
            },
            prismaTransaction
          );
        }
      }

      // Update Payment
      const updatedPayment = await payablePaymentRepository.updatePayment(
        {
          paymentId,
          paymentVoucher,
          paymentAmount: newPaymentAmount,
          paymentDate: paymentDt,
          method,
        },
        prismaTransaction
      );

      // Update Payable
      const newStatus = newRemainingAmount.eq(0)
        ? PaymentStatus.PAID
        : PaymentStatus.PARTIAL;

      await payableRepository.recordPayablePayment(
        {
          payableId,
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
          accountCode: payableAccount.accountCode,
          balance: payableAccount.balance.minus(diff),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: cashAccount.accountCode,
          balance: cashAccount.balance.minus(diff),
        },
        prismaTransaction
      );

      return updatedPayment;
    });
  }

  async deletePayablePayment(paymentId: string): Promise<void> {
    return await prismaClient.$transaction(async (prismaTransaction) => {
      // ambil payment
      const payment = await this.getPayment(paymentId, prismaTransaction);

      const { payableId, amount, journalEntryId, method } = payment;
      const paymentAmount = new Decimal(amount);

      // ambil payable
      const payable = await payableService.getPayable(
        payableId,
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
      const { cashAccount, payableAccount } = accountDefault;
      if (!cashAccount || !payableAccount) {
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
          accountCode: payableAccount.accountCode,
          balance: payableAccount.balance.plus(paymentAmount),
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

      // Update payable
      const newPaidAmount = payable.paidAmount.minus(paymentAmount);
      const newRemainingAmount = payable.amount.minus(newPaidAmount);
      const newStatus = newRemainingAmount.eq(0)
        ? PaymentStatus.PAID
        : newPaidAmount.eq(0)
          ? PaymentStatus.UNPAID
          : PaymentStatus.PARTIAL;

      await payableRepository.recordPayablePayment(
        {
          payableId,
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
        },
        prismaTransaction
      );

      // Delete payment
      await payablePaymentRepository.deletePayment(
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

export const payablePaymentService = new PayablePaymentService();
