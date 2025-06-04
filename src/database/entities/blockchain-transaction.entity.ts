import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { TokenType, TransactionPurpose, TransactionStatus } from '@/common/types';

@Entity('blockchain_transactions')
@Index('idx_tx_hash', ['txHash'], { unique: true })
@Index('idx_tx_status', ['status'])
@Index('idx_tx_purpose', ['purpose'])
@Index('idx_tx_from_to', ['fromAddress', 'toAddress'])
export class BlockchainTransactionEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, length: 66 })
    txHash: string;

    @Column({ length: 42 })
    fromAddress: string;

    @Column({ length: 42 })
    toAddress: string;

    @Column('decimal', { precision: 36, scale: 18 })
    amount: string;

    @Column({
        type: 'enum',
        enum: TokenType,
    })
    tokenType: TokenType;

    @Column({
        type: 'enum',
        enum: TransactionPurpose,
    })
    purpose: TransactionPurpose;

    @Column({
        type: 'enum',
        enum: TransactionStatus,
        default: TransactionStatus.PENDING,
    })
    status: TransactionStatus;

    @Column('bigint')
    blockNumber: number;

    @Column({ nullable: true })
    blockHash: string;

    @Column('bigint')
    gasUsed: string;

    @Column('bigint')
    gasPrice: string;

    @Column('decimal', { precision: 10, scale: 6, nullable: true })
    transactionFee: string;

    @Column('jsonb', { nullable: true })
    metadata: Record<string, any>;

    @Column('timestamp with time zone')
    timestamp: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}