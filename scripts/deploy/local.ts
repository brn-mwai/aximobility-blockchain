import "@nomicfoundation/hardhat-ethers";
import { ethers } from "hardhat";

async function main() {
    console.log("Deploying contracts...");

    const [deployer, treasury, disputeResolver] = await ethers.getSigners();

    console.log("Deployer:", deployer.address);
    console.log("Treasury:", treasury.address);
    console.log("Dispute resolver:", disputeResolver.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");

    // Config
    const platformFee = 500; // 5%

    console.log("\nDeploying FareCalculator...");
    const FareCalculator = await ethers.getContractFactory("FareCalculator");

    const fareCalculator = await FareCalculator.deploy(
        treasury.address,
        disputeResolver.address,
        platformFee
    );

    await fareCalculator.waitForDeployment();
    const address = await fareCalculator.getAddress();

    console.log("Contract deployed:", address);

    // Wait for confirmations
    const tx = fareCalculator.deploymentTransaction();
    if (tx) {
        await tx.wait(2);
        console.log("Confirmed");
    }

    // Basic verification
    try {
        const owner = await fareCalculator.owner();
        const contractTreasury = await fareCalculator.treasury();
        const feeRate = await fareCalculator.platformFeeRate();

        console.log("Owner:", owner);
        console.log("Treasury:", contractTreasury);
        console.log("Fee rate:", feeRate.toString());

        // Check default config
        const config = await fareCalculator.getFareConfig(0);
        console.log("Base fare:", ethers.formatEther(config.baseFare), "ETH");

    } catch (error) {
        console.error("Verification failed:", error);
        throw error;
    }

    // Setup test vehicles
    console.log("\nSetting up test vehicles...");

    const vehicles = [
        { id: "TEST_001", type: 0 },
        { id: "TEST_002", type: 1 },
        { id: "TEST_003", type: 2 }
    ];

    for (const vehicle of vehicles) {
        try {
            const vehicleTx = await fareCalculator.authorizeVehicle(vehicle.id, vehicle.type);
            await vehicleTx.wait();
            console.log(`Authorized: ${vehicle.id}`);
        } catch (error) {
            console.error(`Failed to authorize ${vehicle.id}:`, error);
        }
    }

    // Test fare calculation
    console.log("\nTesting fare calculation...");
    try {
        const distance = 5000; // 5km
        const duration = 15;   // 15 min

        const fare = await fareCalculator.estimateFare(0, distance, duration);
        console.log("Test fare:", ethers.formatEther(fare), "ETH");
    } catch (error) {
        console.error("Fare test failed:", error);
    }

    // Gas info
    const receipt = await tx?.wait();
    if (receipt) {
        console.log("\nGas used:", receipt.gasUsed.toString());
        const cost = receipt.gasUsed * receipt.gasPrice;
        console.log("Cost:", ethers.formatEther(cost), "ETH");
    }

    // Save deployment info
    const deploymentData = {
        address: address,
        deployer: deployer.address,
        treasury: treasury.address,
        platformFee: platformFee,
        timestamp: new Date().toISOString(),
        txHash: tx?.hash,
        gasUsed: receipt?.gasUsed.toString()
    };

    const fs = require('fs');
    const path = require('path');

    const deployDir = path.join(__dirname, '../../deployments');
    if (!fs.existsSync(deployDir)) {
        fs.mkdirSync(deployDir, { recursive: true });
    }

    const filename = `deployment-${Date.now()}.json`;
    const filepath = path.join(deployDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(deploymentData, null, 2));

    console.log("\nDeployment complete!");
    console.log("Address:", address);
    console.log("File:", filename);

    console.log("\nNext:");
    console.log(`1. Update .env: FARE_CALCULATOR_ADDRESS=${address}`);
    console.log("2. Run tests");

    return { address, deploymentData };
}

main()
    .then(() => {
        console.log("Done");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });