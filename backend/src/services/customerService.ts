import { Customer, Prisma } from '@prisma/client';
import { CustomerForm } from '../utils/interface';
import { validate } from '../validation/validation';
import { customerRepository } from '../repository/customerRepository';
import { formCustomer } from '../validation/customerValidation';
import { ResponseError } from '../entities/responseError';

export class CustomerService {
  async createCustomer({ body }: { body: CustomerForm }): Promise<Customer> {
    const customerReq = validate(formCustomer, body);
    const customer = await customerRepository.createCustomer(customerReq);
    return customer;
  }

  async updateCustomerById(
    { body }: { body: CustomerForm },
    id: string
  ): Promise<Customer> {
    const customerReq = validate(formCustomer, body);
    const { customerId } = await this.getCustomerById(id);
    const customer = await customerRepository.updateCustomerById(
      customerId,
      customerReq
    );
    return customer;
  }

  async getCustomerById(id: string) {
    const customer = await customerRepository.findCustomerById(id);
    if (!customer) throw new ResponseError(404, 'Customer not found');
    return customer;
  }

  async getAllCustomer(
    page: number = 1,
    limit: number = 10,
    search: string = ''
  ) {
    if (page < 1 || limit < 1) {
      throw new ResponseError(400, 'Halaman dan batas harus bilangan positif');
    }

    const { customers, total } = await customerRepository.getAllCustomer(
      page,
      limit,
      search
    );

    return {
      customers,
      pagination: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
    };
  }

  async deleteCustomerById(id: string) {
    const { customerId } = await this.getCustomerById(id);
    await customerRepository.deleteCustomerById(customerId);
  }

  async getCustomer(
    customerId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    const customer = await customerRepository.findCustomerTransaction(
      customerId,
      prismaTransaction
    );
    if (!customer) throw new ResponseError(404, 'Customer not found');
    return customer;
  }
}

export const customerService = new CustomerService();
