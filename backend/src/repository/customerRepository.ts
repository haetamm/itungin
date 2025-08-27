import { Customer } from '@prisma/client';
import { prismaClient } from '../application/database';
import { CustomerForm } from '../utils/interface';

export class CustomerRepository {
  async findCustomerById(customerId: string): Promise<Customer | null> {
    return await prismaClient.customer.findUnique({
      where: { customerId, deletedAt: null },
    });
  }

  async createCustomer(data: CustomerForm): Promise<Customer> {
    return prismaClient.customer.create({
      data: data,
    });
  }

  async updateCustomerById(
    customerId: string,
    data: CustomerForm
  ): Promise<Customer> {
    return await prismaClient.customer.update({
      where: { customerId },
      data: {
        ...data,
      },
    });
  }

  async deleteCustomerById(customerId: string): Promise<void> {
    await prismaClient.customer.update({
      where: { customerId },
      data: { deletedAt: new Date() },
    });
  }

  async getAllCustomer() {
    return await prismaClient.customer.findMany({
      where: { deletedAt: null },
    });
  }
}

export const customerRepository = new CustomerRepository();
