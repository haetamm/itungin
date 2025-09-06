import { PrismaClient, AccountType, EntryType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Mulai seeding...');

  // ====== ROLES ======
  let adminRole = await prisma.role.findUnique({
    where: { role: 'ADMIN' },
  });

  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: { role: 'ADMIN' },
    });
    console.log('✅ Role ADMIN berhasil dibuat.');
  } else {
    console.log('ℹ️ Role ADMIN sudah ada dalam database.');
  }

  // ====== USER ADMIN ======
  let adminUser = await prisma.user.findUnique({
    where: { username: 'supmin' },
  });

  if (!adminUser) {
    const hashedPassword = await bcrypt.hash('password', 10);
    adminUser = await prisma.user.create({
      data: {
        name: 'tatang ganteng',
        username: 'supmin',
        password: hashedPassword,
        userRoles: {
          create: {
            role: { connect: { role: adminRole.role } },
          },
        },
      },
    });
    console.log('✅ User Admin Super berhasil dibuat.');
  } else {
    console.log('ℹ️ User Admin Super sudah ada dalam database.');
  }

  // ====== ACCOUNTS ======
  const accountsData = [
    {
      accountCode: '1000',
      accountName: 'Cash',
      accountType: AccountType.ASSET,
      normalBalance: EntryType.DEBIT,
    },
    {
      accountCode: '1100',
      accountName: 'Account Receivable',
      accountType: AccountType.ASSET,
      normalBalance: EntryType.DEBIT,
    },
    {
      accountCode: '1200',
      accountName: 'Merchandise Inventory',
      accountType: AccountType.ASSET,
      normalBalance: EntryType.DEBIT,
    },
    {
      accountCode: '1300',
      accountName: 'VAT Input',
      accountType: AccountType.ASSET,
      normalBalance: EntryType.DEBIT,
    },
    {
      accountCode: '2000',
      accountName: 'Accounts Payable',
      accountType: AccountType.LIABILITY,
      normalBalance: EntryType.CREDIT,
    },
    {
      accountCode: '3000',
      accountName: "Owner's Capital",
      accountType: AccountType.EQUITY,
      normalBalance: EntryType.CREDIT,
    },
    {
      accountCode: '4000',
      accountName: 'Sales',
      accountType: AccountType.REVENUE,
      normalBalance: EntryType.CREDIT,
    },
    {
      accountCode: '4100',
      accountName: 'VAT Output',
      accountType: AccountType.LIABILITY,
      normalBalance: EntryType.CREDIT,
    },
    {
      accountCode: '6000',
      accountName: 'Cost Of Goods Sold',
      accountType: AccountType.EXPENSE,
      normalBalance: EntryType.DEBIT,
    },
  ];

  const accounts: Record<string, any> = {};
  for (const acc of accountsData) {
    const account = await prisma.account.upsert({
      where: { accountCode: acc.accountCode },
      update: {},
      create: acc,
    });
    accounts[acc.accountName] = account;
  }
  console.log('✅ Accounts berhasil dibuat / sudah ada.');

  // ====== GENERAL SETTINGS ======
  await prisma.accountDefault.upsert({
    where: { id: 'default-setting' },
    update: {
      cashAccountId: accounts['Cash'].accountId,
      receivableAccountId: accounts['Account Receivable'].accountId,
      inventoryAccountId: accounts['Merchandise Inventory'].accountId,
      vatInputAccountId: accounts['VAT Input'].accountId,
      payableAccountId: accounts['Accounts Payable'].accountId,
      ownerCapitalAccountId: accounts["Owner's Capital"].accountId,
      salesAccountId: accounts['Sales'].accountId,
      vatOutputAccountId: accounts['VAT Output'].accountId,
      costOfGoodsSoldAccountId: accounts['Cost Of Goods Sold'].accountId,
    },
    create: {
      id: 'default-setting',
      cashAccountId: accounts['Cash'].accountId,
      receivableAccountId: accounts['Account Receivable'].accountId,
      inventoryAccountId: accounts['Merchandise Inventory'].accountId,
      vatInputAccountId: accounts['VAT Input'].accountId,
      payableAccountId: accounts['Accounts Payable'].accountId,
      ownerCapitalAccountId: accounts["Owner's Capital"].accountId,
      salesAccountId: accounts['Sales'].accountId,
      vatOutputAccountId: accounts['VAT Output'].accountId,
      costOfGoodsSoldAccountId: accounts['Cost Of Goods Sold'].accountId,
    },
  });
  console.log('✅ General Settings berhasil dibuat / diupdate.');

  console.log('🎉 Seeding selesai!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeder error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
