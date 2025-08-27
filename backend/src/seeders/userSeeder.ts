import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const { hash } = bcrypt;

async function main() {
  try {
    const adminRole = await prisma.role.findUnique({
      where: { role: 'ADMIN' },
    });

    if (!adminRole) {
      await prisma.role.create({
        data: { role: 'ADMIN' },
      });
      console.log('Role ADMIN berhasil dibuat.');
    } else {
      console.log('Role ADMIN sudah ada dalam database.');
    }

    const existingAdmin = await prisma.user.findUnique({
      where: { username: 'supmin' },
    });

    if (!existingAdmin) {
      const hashedPassword = await hash('password', 10);
      await prisma.user.create({
        data: {
          name: 'tatang ganteng',
          username: 'supmin',
          password: hashedPassword,
          userRoles: {
            create: {
              role: { connect: { role: 'ADMIN' } },
            },
          },
        },
      });
      console.log('User Admin Super berhasil dibuat.');
    } else {
      console.log('User Admin Super sudah ada dalam database.');
    }

    console.log('Seeder untuk roles dan users berhasil dijalankan!');
  } catch (error) {
    console.error('Seeder roles dan users error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
