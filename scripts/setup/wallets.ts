import { Keyring } from '@polkadot/keyring';
import { mnemonicGenerate, cryptoWaitReady } from '@polkadot/util-crypto';
import * as fs from 'fs';

async function setupWallets() {
    console.log('🔐 Setting up Peaq wallets for AXI deployment...');

    // Wait for crypto to be ready
    await cryptoWaitReady();

    // Create keyring
    const keyring = new Keyring({ type: 'sr25519' });

    // Create wallets directory
    fs.mkdirSync('wallets', { recursive: true });

    // Generate deployment wallet
    console.log('📝 Generating deployment wallet...');
    const deploymentMnemonic = mnemonicGenerate();
    const deploymentKeyPair = keyring.addFromMnemonic(deploymentMnemonic);

    // Generate treasury wallet
    console.log('📝 Generating treasury wallet...');
    const treasuryMnemonic = mnemonicGenerate();
    const treasuryKeyPair = keyring.addFromMnemonic(treasuryMnemonic);

    // Generate dispute resolver wallet
    console.log('📝 Generating dispute resolver wallet...');
    const disputeMnemonic = mnemonicGenerate();
    const disputeKeyPair = keyring.addFromMnemonic(disputeMnemonic);

    // Create wallet summary
    const walletSummary = {
        created: new Date().toISOString(),
        network: "peaq-krest-testnet",
        wallets: {
            deployer: {
                address: deploymentKeyPair.address,
                mnemonic: deploymentMnemonic,
                purpose: "Deploy all contracts and manage ownership"
            },
            treasury: {
                address: treasuryKeyPair.address,
                mnemonic: treasuryMnemonic,
                purpose: "Collect platform fees from fare calculator"
            },
            disputeResolver: {
                address: disputeKeyPair.address,
                mnemonic: disputeMnemonic,
                purpose: "Handle ride disputes and emergency actions"
            }
        },
        security: {
            note: "Mnemonics are for testnet only - generate new ones for mainnet",
            backup: "Store mnemonics securely - they cannot be recovered"
        }
    };

    // Save wallet summary
    fs.writeFileSync('wallets/wallet-summary.json', JSON.stringify(walletSummary, null, 2));
    console.log('✅ Wallet summary saved to wallets/wallet-summary.json');

    // Create environment file
    const envContent = `# Peaq Network Configuration
PEAQ_NETWORK=krest
PEAQ_WS_URL=wss://wss-krest.peaq.network
PEAQ_RPC_URL=https://rpc-krest.peaq.network

# Deployment Wallets (TESTNET ONLY)
DEPLOYMENT_MNEMONIC="${deploymentMnemonic}"
DEPLOYMENT_ADDRESS=${deploymentKeyPair.address}

TREASURY_MNEMONIC="${treasuryMnemonic}"
TREASURY_ADDRESS=${treasuryKeyPair.address}

DISPUTE_RESOLVER_MNEMONIC="${disputeMnemonic}"
DISPUTE_RESOLVER_ADDRESS=${disputeKeyPair.address}

# Contract Deployment Settings
PLATFORM_FEE_RATE=500
GAS_LIMIT=1000000000000
PROOF_SIZE=1000000
`;

    fs.writeFileSync('.env.deployment', envContent);
    console.log('✅ Environment file created: .env.deployment');

    console.log('\n📋 Next Steps:');
    console.log('1. Get test tokens from Peaq faucet:');
    console.log('   - Visit: https://faucet.peaq.network/');
    console.log(`   - Request tokens for: ${deploymentKeyPair.address}`);
    console.log(`   - Request tokens for: ${treasuryKeyPair.address}`);
    console.log('');
    console.log('2. Verify balances:');
    console.log('   - Check deployment wallet has sufficient balance');
    console.log('   - Minimum 100 PEAQ recommended for deployments');
    console.log('');
    console.log('3. Keep mnemonics secure:');
    console.log('   - Backup wallet-summary.json');
    console.log('   - Never share mnemonics publicly');

    console.log('\n🎉 Wallet setup complete!');

    return walletSummary;
}

// Execute if run directly
if (require.main === module) {
    setupWallets()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Wallet setup failed:', error);
            process.exit(1);
        });
}

export { setupWallets };