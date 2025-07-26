import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum OrderStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
}

export enum Currency {
  KISS = 'kiss',
  HUG = 'hug',
  MESSAGE = 'message',
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fromUserId: string;

  @Column()
  toUserId: string;

  @Column()
  menuItemId: string;

  @Column({ type: 'text' })
  currency: Currency;

  @Column({ nullable: true })
  deadline: string;

  @Column({ type: 'text', default: OrderStatus.PENDING })
  status: OrderStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  message: string | null;
}
