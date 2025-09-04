import { Customer } from '@prisma/client';
import { prismaClient } from '../application/database';
import { CustomerForm } from '../utils/interface';
import { paginate } from '../utils/pagination';

export class CustomerRepository {
  async getAllCustomer(
    page: number = 1,
    limit: number = 10,
    search: string = ''
  ) {
    const searchFilter = search
      ? {
          OR: [
            { phone: { contains: search, mode: 'insensitive' } },
            { customerName: { contains: search, mode: 'insensitive' } },
          ],
          deletedAt: null,
        }
      : { deletedAt: null };

    const result = await paginate<Customer>(prismaClient.customer, {
      page,
      limit,
      where: searchFilter,
      orderBy: { createdAt: 'desc' },
    });

    return { customers: result.items, total: result.total };
  }

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
}

export const customerRepository = new CustomerRepository();
