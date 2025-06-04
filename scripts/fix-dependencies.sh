#!/bin/bash

echo "🔧 Installing correct Hardhat dependencies..."

# Remove conflicting packages
yarn remove @nomiclabs/hardhat-ethers @nomiclabs/hardhat-waffle @typechain/ethers-v5

# Install correct Hardhat packages for ethers v6
yarn add -D hardhat@^2.22.0
yarn add -D @nomicfoundation/hardhat-toolbox@^5.0.0
yarn add -D @nomicfoundation/hardhat-ethers@^3.0.0
yarn add -D @nomicfoundation/hardhat-chai-matchers@^2.0.0
yarn add -D @nomicfoundation/hardhat-network-helpers@^1.0.0
yarn add -D @nomicfoundation/hardhat-verify@^2.0.0

# TypeChain for v6
yarn add -D @typechain/hardhat@^9.1.0
yarn add -D @typechain/ethers-v6@^0.5.1
yarn add -D typechain@^8.3.0

# Ethers v6
yarn add ethers@^6.11.1

# Testing and utilities
yarn add -D hardhat-gas-reporter@^1.0.10
yarn add -D solidity-coverage@^0.8.12

echo "✅ Hardhat dependencies updated!"
echo "📝 Make sure your hardhat.config.ts imports are correct"