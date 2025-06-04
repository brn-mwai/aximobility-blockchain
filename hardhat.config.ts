import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: `.env.${process.env.NODE_ENV || 'development'}` });

const config: any = {
    solidity: {
        version: "0.8.30",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            viaIR: true, // for better optimization
            metadata: {
                useLiteralContent: true,
            },
        },
    },

    networks: {
        hardhat: {
            chainId: 1337,
            gas: 12000000,
            blockGasLimit: 12000000,
            allowUnlimitedContractSize: true,
            accounts: {
                mnemonic: "test test test test test test test test test test test junk",
                count: 20,
            },
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            chainId: 1337,
        },
        // Peaq Networks
        peaq: {
            url: process.env.PEAQ_MAIN_RPC_URL || "https://peaq.api.onfinality.io/public",
            chainId: 3338,
            accounts: process.env.PEAQ_PRIVATE_KEY ? [process.env.PEAQ_PRIVATE_KEY] : [],
        },
        krest: {
            url: process.env.PEAQ_KREST_RPC_URL || "https://krest.api.onfinality.io/public",
            chainId: 2241,
            accounts: process.env.PEAQ_PRIVATE_KEY ? [process.env.PEAQ_PRIVATE_KEY] : [],
        },
        agung: {
            url: process.env.PEAQ_AGUNG_RPC_URL || "https://agung.api.onfinality.io/public",
            chainId: 9990,
            accounts: process.env.PEAQ_PRIVATE_KEY ? [process.env.PEAQ_PRIVATE_KEY] : [],
        },
    },

    paths: {
        sources: "./contracts",
        tests: "./test/contracts",
        cache: "./cache",
        artifacts: "./artifacts",
    },

    typechain: {
        outDir: "src/blockchain/contracts/types/typechain",
        target: "ethers-v6",
        alwaysGenerateOverloads: false,
        externalArtifacts: ["node_modules/@openzeppelin/contracts/build/contracts/*.json"],
    },

    gasReporter: {
        enabled: process.env.REPORT_GAS === "true",
        currency: "USD",
        gasPrice: 20,
        coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },

    etherscan: {
        apiKey: {
            peaq: process.env.PEAQ_ETHERSCAN_API_KEY || "",
            krest: process.env.KREST_ETHERSCAN_API_KEY || "",
        },
        customChains: [
            {
                network: "peaq",
                chainId: 3338,
                urls: {
                    apiURL: "https://peaq.api.etherscan.io/api",
                    browserURL: "https://peaq.etherscan.io",
                },
            },
            {
                network: "krest",
                chainId: 2241,
                urls: {
                    apiURL: "https://krest.api.etherscan.io/api",
                    browserURL: "https://krest.etherscan.io",
                },
            },
        ],
    },

    mocha: {
        timeout: 40000,
    },
};

export default config;