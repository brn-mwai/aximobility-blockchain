import { ApiPromise, WsProvider } from '@polkadot/api';
import * as fs from 'fs';

async function testAgungConnection() {
  console.log('Testing Peaq Agung network connection...');

  const endpoint = 'wss://wss-async.agung.peaq.network';

  let walletData;
  try {
    walletData = JSON.parse(fs.readFileSync('wallets/wallet-summary.json', 'utf8'));
  } catch (error) {
    console.error('Failed to read wallet data:', error.message);
    return false;
  }

  const testAddress = walletData.wallets.deployer.address;
  console.log(`Testing endpoint: ${endpoint}`);

  try {
    const wsProvider = new WsProvider(endpoint, 10000);
    const api = await Promise.race([
      ApiPromise.create({ provider: wsProvider }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout after 15s')), 15000)
      )
    ]);

    // Basic conn check
    const chain = await api.rpc.system.chain();
    const version = api.runtimeVersion.specVersion.toString();
    console.log(`Connected to ${chain}, runtime version: ${version}`);

    // Check balance
    const accountInfo = await api.query.system.account(testAddress);
    const accountJson = accountInfo.toJSON() as any;
    const balance = BigInt(accountJson.data.free || 0);
    const balanceFormatted = (Number(balance) / 1e18).toFixed(4);

    console.log(`Account balance: ${balanceFormatted} AGNG`);

    if (balance > 0) {
      console.log('Balance confirmed - ready for deployment');

      // Update env file
      try {
        const envContent = fs.readFileSync('.env.deployment', 'utf8');
        const updatedEnv = envContent
          .replace(/PEAQ_WS_URL=.*/, `PEAQ_WS_URL=${endpoint}`)
          .replace(/PEAQ_NETWORK=.*/, `PEAQ_NETWORK=agung`);

        fs.writeFileSync('.env.deployment', updatedEnv);
        console.log('Environment file updated');
      } catch (envError) {
        console.warn('Could not update environment file:', envError.message);
      }

      await api.disconnect();
      return true;
    } else {
      console.log('No balance found - fund wallet before deployment');
    }

    await api.disconnect();
    return false;

  } catch (error) {
    console.error('Connection failed:', error.message);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  testAgungConnection()
    .then((success) => {
      if (success) {
        console.log('\nAgung network test passed');
        console.log('Run: bash scripts/deploy.sh');
      } else {
        console.log('\nAgung network test failed');
      }
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test error:', error);
      process.exit(1);
    });
}