import { ethers } from "hardhat";
import * as fs from 'fs';

async function deployToNetwork() {
    console.log("Deploying Solidity contracts...");

    // Load config
    const envData = fs.readFileSync('.env.deployment', 'utf8');
    const config = Object.fromEntries(
        envData.split('\n')
            .filter(line => line.includes('='))
            .map(line => line.split('=').map(s => s.trim()))
    );

    const provider = new ethers.JsonRpcProvider(config.PEAQ_RPC_URL);
    const wallet = new ethers.Wallet(config.DEPLOYMENT_SEED, provider);

    console.log("Network:", config.PEAQ_NETWORK);
    console.log("Deployer:", wallet.address);
    console.log("Treasury:", config.TREASURY_ADDRESS);

    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");

    if (balance < ethers.parseEther("1")) {
        throw new Error("Insufficient balance. Need at least 1 ETH.");
    }

    console.log("\nDeploying FareCalculator...");

    const FareCalculator = await ethers.getContractFactory("FareCalculator", wallet);
    const fareCalculator = await FareCalculator.deploy(
        config.TREASURY_ADDRESS,
        config.DISPUTE_RESOLVER_ADDRESS,
        parseInt(config.PLATFORM_FEE_RATE)
    );

    await fareCalculator.waitForDeployment();
    const address = await fareCalculator.getAddress();

    console.log("Deployed to:", address);

    console.log("Waiting for confirmations...");
    const deployTx = fareCalculator.deploymentTransaction();
    if (deployTx) {
        const receipt = await deployTx.wait(3);
        console.log("Block:", receipt?.blockNumber);
        console.log("Gas used:", receipt?.gasUsed.toString());
    }

    console.log("\nVerifying...");
    const owner = await fareCalculator.owner();
    const treasury = await fareCalculator.treasury();
    const platformFee = await fareCalculator.platformFeeRate();

    console.log("Owner:", owner);
    console.log("Treasury:", treasury);
    console.log("Platform fee:", platformFee.toString(), "bps");

    console.log("\nTesting fare estimation...");
    const estimatedFare = await fareCalculator.estimateFare(
        0, // STANDARD vehicle
        5000, // 5km
        15 // 15 minutes
    );
    console.log("Fare (5km, 15min):", ethers.formatEther(estimatedFare), "ETH");

    const summary = {
        deployedAt: new Date().toISOString(),
        network: config.PEAQ_NETWORK,
        chainId: (await provider.getNetwork()).chainId.toString(),
        deployer: wallet.address,
        contracts: {
            fareCalculator: {
                address: address,
                args: [
                    config.TREASURY_ADDRESS,
                    config.DISPUTE_RESOLVER_ADDRESS,
                    parseInt(config.PLATFORM_FEE_RATE)
                ],
                gasUsed: deployTx ? (await deployTx.wait())?.gasUsed.toString() : "unknown"
            }
        },
        config: {
            treasury: config.TREASURY_ADDRESS,
            disputeResolver: config.DISPUTE_RESOLVER_ADDRESS,
            platformFee: config.PLATFORM_FEE_RATE
        }
    };

    // Write files
    fs.mkdirSync('./deployments/solidity-contracts', { recursive: true });
    fs.writeFileSync(
        './deployments/solidity-contracts/deployment-summary.json',
        JSON.stringify(summary, null, 2)
    );

    // Update env
    fs.appendFileSync('.env.deployment', `\nFARE_CALCULATOR_ADDRESS=${address}\n`);

    console.log("\nDeployment complete!");
    console.log("Summary:", "deployments/solidity-contracts/deployment-summary.json");

    const explorerUrl = config.PEAQ_NETWORK.includes('krest')
        ? `https://krest.subscan.io/account/${address}`
        : config.PEAQ_NETWORK.includes('agung')
            ? `https://agung-testnet.subscan.io/account/${address}`
            : `https://subscan.io/account/${address}`;
    console.log("Explorer:", explorerUrl);

    return {
        fareCalculator: address,
        summary
    };
}

// Run if called directly
if (require.main === module) {
    deployToNetwork()
        .then((result) => {
            console.log("\nAll contracts deployed successfully!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\nDeployment failed:", error);
            process.exit(1);
        });
}

export { deployToNetwork };