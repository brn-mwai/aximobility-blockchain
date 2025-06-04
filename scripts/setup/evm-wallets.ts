import { ethers } from 'ethers';
import * as fs from 'fs';

async function setupEVMWallets() {
    console.log('⚡ Setting up EVM wallets for Solidity contract deployment...');

    // Generate EVM wallets
    const deployerWallet = ethers.Wallet.createRandom();
    const treasuryWallet = ethers.Wallet.createRandom();
    const disputeWallet = ethers.Wallet.createRandom();

    console.log('📝 Generated EVM wallets:');
    console.log('  Deployer:', deployerWallet.address);
    console.log('  Treasury:', treasuryWallet.address);
    console.log('  Dispute Resolver:', disputeWallet.address);

    // Create EVM wallet summary
    const evmWalletSummary = {
        created: new Date().toISOString(),
        network: "peaq-krest-evm",
        type: "EVM",
        wallets: {
            deployer: {
                address: deployerWallet.address,
                privateKey: deployerWallet.privateKey,
                mnemonic: deployerWallet.mnemonic?.phrase,
                purpose: "Deploy Solidity contracts"
            },
            treasury: {
                address: treasuryWallet.address,
                privateKey: treasuryWallet.privateKey,
                mnemonic: treasuryWallet.mnemonic?.phrase,
                purpose: "Collect platform fees from fare calculator"
            },
            disputeResolver: {
                address: disputeWallet.address,
                privateKey: disputeWallet.privateKey,
                mnemonic: disputeWallet.mnemonic?.phrase,
                purpose: "Handle ride disputes and emergency actions"
            }
        },
        security: {
            note: "Private keys are for testnet only - generate new ones for mainnet",
            backup: "Store private keys securely - they cannot be recovered"
        }
    };

    // Save EVM wallet summary
    fs.writeFileSync('wallets/evm-wallet-summary.json', JSON.stringify(evmWalletSummary, null, 2));
    console.log('✅ EVM wallet summary saved to wallets/evm-wallet-summary.json');

    // Update environment file with EVM addresses
    const evmEnvContent = `
# EVM Wallet Configuration (for Solidity contracts)
EVM_DEPLOYER_PRIVATE_KEY=${deployerWallet.privateKey}
EVM_DEPLOYER_ADDRESS=${deployerWallet.address}

EVM_TREASURY_PRIVATE_KEY=${treasuryWallet.privateKey}
EVM_TREASURY_ADDRESS=${treasuryWallet.address}

EVM_DISPUTE_RESOLVER_PRIVATE_KEY=${disputeWallet.privateKey}
EVM_DISPUTE_RESOLVER_ADDRESS=${disputeWallet.address}

# Peaq EVM Network Configuration
PEAQ_EVM_RPC_URL=https://rpc-krest.peaq.network
PEAQ_EVM_CHAIN_ID=2241
`;

    fs.appendFileSync('.env.deployment', evmEnvContent);
    console.log('✅ EVM configuration added to .env.deployment');

    console.log('\n📋 Next Steps for EVM wallets:');
    console.log('1. Get test tokens for EVM addresses:');
    console.log('   - Visit: https://faucet.peaq.network/');
    console.log(`   - Request tokens for: ${deployerWallet.address}`);
    console.log(`   - Request tokens for: ${treasuryWallet.address}`);
    console.log('');
    console.log('2. Note: You need BOTH Substrate AND EVM tokens');
    console.log('   - Substrate tokens for ink! contracts');
    console.log('   - EVM tokens for Solidity contracts');

    return evmWalletSummary;
}

// Execute if run directly
if (require.main === module) {
    setupEVMWallets()
        .then(() => {
            console.log('\n🎉 EVM wallet setup complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ EVM wallet setup failed:', error);
            process.exit(1);
        });
}

export { setupEVMWallets };