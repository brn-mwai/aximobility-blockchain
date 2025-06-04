import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { FareCalculator } from "../../src/blockchain/contracts/types/typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FareCalculator", function () {
    async function deployFareCalculatorFixture() {
        const [owner, treasury, disputeResolver, rider, driver, otherAccount] = await ethers.getSigners();

        const platformFeeRate = 500; // 5%
        const vehicleId = "AXI_VEHICLE_001";

        const FareCalculator = await ethers.getContractFactory("FareCalculator");
        const fareCalculator = await FareCalculator.deploy(
            treasury.address,
            disputeResolver.address,
            platformFeeRate
        ) as any as FareCalculator;

        await fareCalculator.waitForDeployment();

        // Authorize a test vehicle
        await fareCalculator.authorizeVehicle(vehicleId, 0); // VehicleType.STANDARD

        return {
            fareCalculator,
            owner,
            treasury,
            disputeResolver,
            rider,
            driver,
            otherAccount,
            platformFeeRate,
            vehicleId
        };
    }

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            const { fareCalculator, owner } = await loadFixture(deployFareCalculatorFixture);
            expect(await fareCalculator.owner()).to.equal(owner.address);
        });

        it("Should set the correct treasury", async function () {
            const { fareCalculator, treasury } = await loadFixture(deployFareCalculatorFixture);
            expect(await fareCalculator.treasury()).to.equal(treasury.address);
        });

        it("Should set the correct platform fee rate", async function () {
            const { fareCalculator, platformFeeRate } = await loadFixture(deployFareCalculatorFixture);
            expect(await fareCalculator.platformFeeRate()).to.equal(platformFeeRate);
        });

        it("Should initialize default fare configs", async function () {
            const { fareCalculator } = await loadFixture(deployFareCalculatorFixture);
            const config = await fareCalculator.getFareConfig(0); // VehicleType.STANDARD
            expect(config.baseFare).to.equal(ethers.parseEther("0.0003"));
            expect(config.active).to.be.true;
        });
    });

    describe("Vehicle Management", function () {
        it("Should authorize vehicle successfully", async function () {
            const { fareCalculator, owner } = await loadFixture(deployFareCalculatorFixture);
            const newVehicleId = "AXI_VEHICLE_002";

            await expect(
                fareCalculator.authorizeVehicle(newVehicleId, 1) // VehicleType.PREMIUM
            ).to.emit(fareCalculator, "VehicleAuthorized")
                .withArgs(newVehicleId, 1, owner.address);

            expect(await fareCalculator.authorizedVehicles(newVehicleId)).to.be.true;
            expect(await fareCalculator.vehicleTypes(newVehicleId)).to.equal(1);
        });

        it("Should deauthorize vehicle successfully", async function () {
            const { fareCalculator, vehicleId } = await loadFixture(deployFareCalculatorFixture);
            await fareCalculator.deauthorizeVehicle(vehicleId);
            expect(await fareCalculator.authorizedVehicles(vehicleId)).to.be.false;
        });

        it("Should prevent non-owner from authorizing vehicles", async function () {
            const { fareCalculator, otherAccount } = await loadFixture(deployFareCalculatorFixture);
            await expect(
                fareCalculator.connect(otherAccount).authorizeVehicle("UNAUTHORIZED", 0)
            ).to.be.revertedWithCustomError(fareCalculator, "OwnableUnauthorizedAccount");
        });
    });

    describe("Ride Creation", function () {
        it("Should create ride successfully", async function () {
            const { fareCalculator, rider, driver, vehicleId } = await loadFixture(deployFareCalculatorFixture);
            const estimatedDistance = 5000; // 5km scaled by 1000
            const estimatedDuration = 15;   // 15 minutes

            await expect(
                fareCalculator.createRide(
                    rider.address,
                    driver.address,
                    vehicleId,
                    estimatedDistance,
                    estimatedDuration
                )
            ).to.emit(fareCalculator, "RideCreated");

            expect(await fareCalculator.totalRides()).to.equal(1);
        });

        it("Should reject ride creation with unauthorized vehicle", async function () {
            const { fareCalculator, rider, driver } = await loadFixture(deployFareCalculatorFixture);
            const unauthorizedVehicle = "UNAUTHORIZED_VEHICLE";

            await expect(
                fareCalculator.createRide(
                    rider.address,
                    driver.address,
                    unauthorizedVehicle,
                    5000,
                    15
                )
            ).to.be.revertedWith("Vehicle not authorized");
        });

        it("Should reject ride with same rider and driver", async function () {
            const { fareCalculator, rider, vehicleId } = await loadFixture(deployFareCalculatorFixture);
            await expect(
                fareCalculator.createRide(
                    rider.address,
                    rider.address, // Same as rider
                    vehicleId,
                    5000,
                    15
                )
            ).to.be.revertedWith("Rider and driver cannot be same");
        });

        it("Should reject ride with invalid distance", async function () {
            const { fareCalculator, rider, driver, vehicleId } = await loadFixture(deployFareCalculatorFixture);
            const tooLargeDistance = 1000 * 1000 + 1; // Exceeds MAX_DISTANCE

            await expect(
                fareCalculator.createRide(
                    rider.address,
                    driver.address,
                    vehicleId,
                    tooLargeDistance,
                    15
                )
            ).to.be.revertedWith("Distance too large");
        });
    });

    describe("Fare Calculation", function () {
        async function createRideFixture() {
            const baseFixture = await deployFareCalculatorFixture();
            const { fareCalculator, rider, driver, vehicleId } = baseFixture;

            // Create a test ride
            const tx = await fareCalculator.createRide(
                rider.address,
                driver.address,
                vehicleId,
                5000, // 5km
                15    // 15 minutes
            );
            const receipt = await tx.wait();

            // Extract ride ID from event
            const event = receipt?.logs.find(
                (log: any) => log.topics[0] === fareCalculator.interface.getEvent('RideCreated')!.topicHash
            ) as any;
            const rideId = event!.topics[1]; // First indexed parameter is rideId

            return { ...baseFixture, rideId };
        }

        it("Should calculate fare correctly", async function () {
            const { fareCalculator, rideId } = await loadFixture(createRideFixture);
            const actualDistance = 6000; // 6km scaled by 1000
            const actualDuration = 18;   // 18 minutes

            await expect(
                fareCalculator.calculateFare(rideId, actualDistance, actualDuration)
            ).to.emit(fareCalculator, "FareCalculated");

            const fareBreakdown = await fareCalculator.getFareBreakdown(rideId);

            // Verify fare components
            expect(fareBreakdown.baseFare).to.equal(ethers.parseEther("0.0003"));
            expect(fareBreakdown.distanceFare).to.equal(ethers.parseEther("0.0006")); // 6km * 0.0001
            expect(fareBreakdown.timeFare).to.equal(ethers.parseEther("0.00018"));    // 18min * 0.00001

            // Total should be sum of components (no surge in default config)
            const expectedTotal = fareBreakdown.baseFare +
                fareBreakdown.distanceFare +
                fareBreakdown.timeFare;
            expect(fareBreakdown.totalFare).to.equal(expectedTotal);
        });

        it("Should apply minimum fare when calculated fare is too low", async function () {
            const { fareCalculator, rideId } = await loadFixture(createRideFixture);
            const smallDistance = 100;  // Very small distance
            const smallDuration = 1;    // Very short time

            await fareCalculator.calculateFare(rideId, smallDistance, smallDuration);

            const fareBreakdown = await fareCalculator.getFareBreakdown(rideId);
            const config = await fareCalculator.getFareConfig(0); // VehicleType.STANDARD

            expect(fareBreakdown.totalFare).to.equal(config.minimumFare);
        });

        it("Should apply maximum fare when calculated fare is too high", async function () {
            const { fareCalculator, rideId } = await loadFixture(createRideFixture);
            const largeDistance = 999000; // Very large distance
            const largeDuration = 1000;   // Very long time

            await fareCalculator.calculateFare(rideId, largeDistance, largeDuration);

            const fareBreakdown = await fareCalculator.getFareBreakdown(rideId);
            const config = await fareCalculator.getFareConfig(0); // VehicleType.STANDARD

            expect(fareBreakdown.totalFare).to.equal(config.maximumFare);
        });

        it("Should prevent fare calculation on non-pending ride", async function () {
            const { fareCalculator, rideId } = await loadFixture(createRideFixture);
            // Calculate fare once
            await fareCalculator.calculateFare(rideId, 5000, 15);

            // Try to calculate again
            await expect(
                fareCalculator.calculateFare(rideId, 5000, 15)
            ).to.be.revertedWith("Ride not in pending status");
        });
    });

    describe("Ride Completion", function () {
        async function rideWithFareFixture() {
            const baseFixture = await deployFareCalculatorFixture();
            const { fareCalculator, rider, driver, vehicleId } = baseFixture;

            // Create and calculate fare for a test ride
            const createTx = await fareCalculator.createRide(
                rider.address,
                driver.address,
                vehicleId,
                5000, // 5km
                15    // 15 minutes
            );
            const createReceipt = await createTx.wait();

            const event = createReceipt?.logs.find(
                (log: any) => log.topics[0] === fareCalculator.interface.getEvent('RideCreated')!.topicHash
            ) as any;
            const rideId = event!.topics[1];

            // Calculate fare
            await fareCalculator.calculateFare(rideId, 5000, 15);

            const fareBreakdown = await fareCalculator.getFareBreakdown(rideId);
            const calculatedFare = fareBreakdown.totalFare;

            return { ...baseFixture, rideId, calculatedFare };
        }

        it("Should complete ride successfully with correct payment", async function () {
            const { fareCalculator, treasury, driver, rider, rideId, calculatedFare, platformFeeRate } = await loadFixture(rideWithFareFixture);

            const initialTreasuryBalance = await ethers.provider.getBalance(treasury.address);
            const initialDriverBalance = await ethers.provider.getBalance(driver.address);

            await expect(
                fareCalculator.connect(rider).completeRide(rideId, {
                    value: calculatedFare
                })
            ).to.emit(fareCalculator, "RideCompleted");

            // Check balances
            const finalTreasuryBalance = await ethers.provider.getBalance(treasury.address);
            const finalDriverBalance = await ethers.provider.getBalance(driver.address);

            const platformFee = (calculatedFare * BigInt(platformFeeRate)) / BigInt(10000);
            const driverPayment = calculatedFare - platformFee;

            expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(platformFee);
            expect(finalDriverBalance - initialDriverBalance).to.equal(driverPayment);

            // Check ride status
            const rideInfo = await fareCalculator.getRideInfo(rideId);
            expect(rideInfo.settled).to.be.true;
            expect(rideInfo.status).to.equal(2); // RideStatus.COMPLETED
        });

        it("Should refund excess payment", async function () {
            const { fareCalculator, rider, rideId, calculatedFare } = await loadFixture(rideWithFareFixture);
            const overpayment = calculatedFare + ethers.parseEther("0.001");
            const initialRiderBalance = await ethers.provider.getBalance(rider.address);

            const tx = await fareCalculator.connect(rider).completeRide(rideId, {
                value: overpayment
            });
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            const finalRiderBalance = await ethers.provider.getBalance(rider.address);
            const expectedBalance = initialRiderBalance - calculatedFare - gasUsed;

            expect(finalRiderBalance).to.equal(expectedBalance);
        });

        it("Should reject completion with insufficient payment", async function () {
            const { fareCalculator, rider, rideId, calculatedFare } = await loadFixture(rideWithFareFixture);
            const insufficientPayment = calculatedFare - ethers.parseEther("0.0001");

            await expect(
                fareCalculator.connect(rider).completeRide(rideId, {
                    value: insufficientPayment
                })
            ).to.be.revertedWith("Insufficient payment");
        });

        it("Should prevent duplicate completion", async function () {
            const { fareCalculator, rider, rideId, calculatedFare } = await loadFixture(rideWithFareFixture);
            // Complete ride once
            await fareCalculator.connect(rider).completeRide(rideId, {
                value: calculatedFare
            });

            // Try to complete again
            await expect(
                fareCalculator.connect(rider).completeRide(rideId, {
                    value: calculatedFare
                })
            ).to.be.revertedWith("Ride already settled");
        });

        it("Should update user ride count for loyalty program", async function () {
            const { fareCalculator, rider, rideId, calculatedFare } = await loadFixture(rideWithFareFixture);
            const initialRideCount = await fareCalculator.userRideCount(rider.address);

            await fareCalculator.connect(rider).completeRide(rideId, {
                value: calculatedFare
            });

            const finalRideCount = await fareCalculator.userRideCount(rider.address);
            expect(finalRideCount).to.equal(initialRideCount + BigInt(1));
        });
    });

    describe("Fare Configuration", function () {
        it("Should update fare configuration successfully", async function () {
            const { fareCalculator } = await loadFixture(deployFareCalculatorFixture);
            const newBaseFare = ethers.parseEther("0.002");
            const newDistanceRate = ethers.parseEther("0.0002");
            const newTimeRate = ethers.parseEther("0.00002");
            const newMinimumFare = ethers.parseEther("0.001");
            const newMaximumFare = ethers.parseEther("0.2");
            const newSurgeMultiplier = 150; // 1.5x

            await expect(
                fareCalculator.updateFareConfig(
                    0, // VehicleType.STANDARD
                    newBaseFare,
                    newDistanceRate,
                    newTimeRate,
                    newMinimumFare,
                    newMaximumFare,
                    newSurgeMultiplier
                )
            ).to.emit(fareCalculator, "FareConfigUpdated");

            const config = await fareCalculator.getFareConfig(0);
            expect(config.baseFare).to.equal(newBaseFare);
            expect(config.distanceRate).to.equal(newDistanceRate);
            expect(config.timeRate).to.equal(newTimeRate);
            expect(config.surgeMultiplier).to.equal(newSurgeMultiplier);
        });

        it("Should prevent invalid fare configuration", async function () {
            const { fareCalculator } = await loadFixture(deployFareCalculatorFixture);
            await expect(
                fareCalculator.updateFareConfig(
                    0,
                    0, // Invalid base fare
                    ethers.parseEther("0.0001"),
                    ethers.parseEther("0.00001"),
                    ethers.parseEther("0.0005"),
                    ethers.parseEther("0.1"),
                    100
                )
            ).to.be.revertedWith("Base fare must be positive");
        });

        it("Should prevent non-owner from updating configuration", async function () {
            const { fareCalculator, otherAccount } = await loadFixture(deployFareCalculatorFixture);
            await expect(
                fareCalculator.connect(otherAccount).updateFareConfig(
                    0,
                    ethers.parseEther("0.001"),
                    ethers.parseEther("0.0001"),
                    ethers.parseEther("0.00001"),
                    ethers.parseEther("0.0005"),
                    ethers.parseEther("0.1"),
                    100
                )
            ).to.be.revertedWithCustomError(fareCalculator, "OwnableUnauthorizedAccount");
        });
    });

    describe("Fare Estimation", function () {
        it("Should estimate fare correctly", async function () {
            const { fareCalculator } = await loadFixture(deployFareCalculatorFixture);
            const distance = 5000; // 5km
            const duration = 15;   // 15 minutes

            const estimatedFare = await fareCalculator.estimateFare(0, distance, duration);

            // Calculate expected fare manually
            const config = await fareCalculator.getFareConfig(0);
            const expectedBaseFare = config.baseFare;
            const expectedDistanceFare = (BigInt(distance) * config.distanceRate) / BigInt(1000);
            const expectedTimeFare = BigInt(duration) * config.timeRate;
            const expectedTotal = expectedBaseFare + expectedDistanceFare + expectedTimeFare;

            expect(estimatedFare).to.equal(expectedTotal);
        });

        it("Should apply minimum fare in estimation", async function () {
            const { fareCalculator } = await loadFixture(deployFareCalculatorFixture);
            const smallDistance = 10;
            const smallDuration = 1;

            const estimatedFare = await fareCalculator.estimateFare(0, smallDistance, smallDuration);
            const config = await fareCalculator.getFareConfig(0);

            expect(estimatedFare).to.equal(config.minimumFare);
        });
    });

    describe("Emergency Functions", function () {
        it("Should pause and unpause successfully", async function () {
            const { fareCalculator, rider, driver, vehicleId } = await loadFixture(deployFareCalculatorFixture);
            await fareCalculator.pause();

            await expect(
                fareCalculator.createRide(
                    rider.address,
                    driver.address,
                    vehicleId,
                    5000,
                    15
                )
            ).to.be.revertedWithCustomError(fareCalculator, "EnforcedPause");

            await fareCalculator.unpause();

            await expect(
                fareCalculator.createRide(
                    rider.address,
                    driver.address,
                    vehicleId,
                    5000,
                    15
                )
            ).to.emit(fareCalculator, "RideCreated");
        });

        it("Should allow emergency withdrawal when paused", async function () {
            const { fareCalculator, owner, treasury } = await loadFixture(deployFareCalculatorFixture);

            // Add some funds to contract
            await owner.sendTransaction({
                to: await fareCalculator.getAddress(),
                value: ethers.parseEther("1")
            });

            await fareCalculator.pause();

            const initialBalance = await ethers.provider.getBalance(treasury.address);
            const withdrawAmount = ethers.parseEther("0.5");

            await fareCalculator.emergencyWithdraw(treasury.address, withdrawAmount);

            const finalBalance = await ethers.provider.getBalance(treasury.address);
            expect(finalBalance - initialBalance).to.equal(withdrawAmount);
        });

        it("Should prevent emergency withdrawal when not paused", async function () {
            const { fareCalculator, treasury } = await loadFixture(deployFareCalculatorFixture);
            await expect(
                fareCalculator.emergencyWithdraw(treasury.address, ethers.parseEther("0.1"))
            ).to.be.revertedWithCustomError(fareCalculator, "ExpectedPause");
        });
    });

    describe("Platform Fee Management", function () {
        it("Should update platform fee rate", async function () {
            const { fareCalculator } = await loadFixture(deployFareCalculatorFixture);
            const newFeeRate = 1000; // 10%

            await fareCalculator.updatePlatformFeeRate(newFeeRate);
            expect(await fareCalculator.platformFeeRate()).to.equal(newFeeRate);
        });

        it("Should prevent setting fee rate too high", async function () {
            const { fareCalculator } = await loadFixture(deployFareCalculatorFixture);
            const tooHighFee = 2001; // 20.01% (exceeds MAX_PLATFORM_FEE)

            await expect(
                fareCalculator.updatePlatformFeeRate(tooHighFee)
            ).to.be.revertedWith("Fee rate too high");
        });

        it("Should update treasury address", async function () {
            const { fareCalculator, otherAccount } = await loadFixture(deployFareCalculatorFixture);
            await fareCalculator.updateTreasury(otherAccount.address);
            expect(await fareCalculator.treasury()).to.equal(otherAccount.address);
        });
    });
});