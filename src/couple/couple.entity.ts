import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Couple {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user1Id: string;

  @Column()
  user2Id: string;
}
