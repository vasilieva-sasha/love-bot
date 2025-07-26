import { DataSource } from 'typeorm';
import { User } from './src/user/user.entity';
import { Couple } from './src/couple/couple.entity';
import { Invite } from './src/invite/invite.entity';
import { MenuItem } from './src/menu/menu.entity';
import { Order } from './src/order/order.entity';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.DATABASE_PATH || 'database.sqlite',
  entities: [User, Couple, Invite, MenuItem, Order],
  migrations: ['src/migrations/*.ts'],
});
