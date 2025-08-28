import Joi, { ObjectSchema } from 'joi';
import { AccountForm } from '../utils/interface';
import { AccountType, EntryType } from '@prisma/client';

export const storeAccount: ObjectSchema<AccountForm> = Joi.object({
  accountCode: Joi.string()
    .max(20)
    .required()
    .custom((value, helpers) => {
      const { accountType } = helpers.state.ancestors[0]; // Ambil accountType dari payload
      const codePrefixMap: { [key in AccountType]: string } = {
        ASSET: '1',
        LIABILITY: '2',
        EQUITY: '3',
        REVENUE: '4',
        COGS: '5',
        EXPENSE: '6',
        OTHER_EXPENSE: '7',
      };
      const expectedPrefix = codePrefixMap[accountType as AccountType];
      if (!value.startsWith(expectedPrefix)) {
        return helpers.error('string.pattern.accountCode', {
          message: `Account code must start with "${expectedPrefix}" for ${accountType}`,
        });
      }
      return value;
    })
    .messages({
      'string.pattern.accountCode': '{#message}',
    }),
  accountName: Joi.string().max(100).required(),
  accountType: Joi.string()
    .valid(...Object.values(AccountType))
    .required(),
  normalBalance: Joi.string()
    .valid(...Object.values(EntryType))
    .required(),
  balance: Joi.number().precision(2).default(0.0).allow(''),
});
