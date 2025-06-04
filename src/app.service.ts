import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    getHello(): string {
        return 'AXI Peaq Integration API - Ready for Tranche 1 Validation!';
    }

    getHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'axi-peaq-integration',
            version: '1.0.0',
            tranche: 1,
            milestones: {
                '1.1': 'Network Connectivity - Complete',
                '1.2': 'DID System & Data Pipeline - Complete',
                '1.3': 'Smart Contract Infrastructure - Complete'
            }
        };
    }

    getVersion() {
        return {
            name: 'AXI Peaq Integration',
            version: '1.0.0',
            description: 'Blockchain integration with Peaq Network for AXI Mobility',
            tranche: 1,
            completedMilestones: ['1.1', '1.2', '1.3'],
            nextTranche: 2,
            environment: process.env.NODE_ENV || 'development',
            buildDate: new Date().toISOString()
        };
    }
}