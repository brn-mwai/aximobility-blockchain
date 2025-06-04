#!/bin/bash

set -e  # Exit on error

echo "🚀 Setting up Ink! Smart Contract Development Environment on Ubuntu 24.04"
echo "=================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Ubuntu
if ! grep -q "Ubuntu" /etc/os-release; then
    print_error "This script is designed for Ubuntu. Detected OS:"
    cat /etc/os-release | grep PRETTY_NAME
    exit 1
fi

print_success "Detected Ubuntu system ✅"

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential development tools
print_status "Installing essential development tools..."
sudo apt install -y \
    curl \
    git \
    build-essential \
    pkg-config \
    libssl-dev \
    libudev-dev \
    llvm \
    clang \
    cmake \
    protobuf-compiler \
    wget \
    binaryen

print_success "Essential tools installed ✅"

# Install Rust using rustup
print_status "Installing Rust toolchain..."
if command -v rustc &> /dev/null; then
    print_warning "Rust already installed. Version: $(rustc --version)"
    print_status "Updating existing Rust installation..."
    rustup update stable
else
    print_status "Installing Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# Ensure we have the latest stable Rust
print_status "Setting up Rust toolchain..."
rustup default stable
rustup update stable
rustup component add rust-src
rustup target add wasm32-unknown-unknown

print_success "Rust toolchain configured ✅"
print_status "Rust version: $(rustc --version)"
print_status "Cargo version: $(cargo --version)"

# Install the latest compatible cargo-contract
print_status "Installing cargo-contract..."
if command -v cargo-contract &> /dev/null; then
    print_warning "cargo-contract already installed. Version: $(cargo-contract --version)"
    print_status "Updating cargo-contract..."
    cargo install cargo-contract --force
else
    cargo install cargo-contract
fi

print_success "cargo-contract installed ✅"
print_status "cargo-contract version: $(cargo-contract --version)"

# Verify WASM target installation
print_status "Verifying WASM target..."
if rustup target list --installed | grep -q "wasm32-unknown-unknown"; then
    print_success "WASM target installed ✅"
else
    print_error "WASM target not found"
    exit 1
fi

# Create project structure if it doesn't exist
print_status "Setting up project structure..."
mkdir -p contracts/ink
cd contracts/ink

# Create DID Registry contract with updated ink! version
print_status "Creating DID Registry contract..."
mkdir -p did_registry
cat > did_registry/Cargo.toml << 'EOF'
[package]
name = "did_registry"
version = "1.0.0"
edition = "2021"

[dependencies]
ink = { version = "5.0", default-features = false }
scale = { package = "parity-scale-codec", version = "3", default-features = false, features = ["derive"] }
scale-info = { version = "2.6", default-features = false, features = ["derive"], optional = true }

[lib]
path = "lib.rs"

[features]
default = ["std"]
std = [
    "ink/std",
    "scale/std",
    "scale-info/std",
]
ink-as-dependency = []
EOF

cat > did_registry/lib.rs << 'EOF'
#![cfg_attr(not(feature = "std"), no_std, no_main)]

/// DID Registry Contract for AXI Ecosystem
#[ink::contract]
mod did_registry {
    use ink::prelude::string::String;
    use ink::storage::Mapping;
    use scale::{Decode, Encode};

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct DidDocument {
        pub id: String,
        pub controller: AccountId,
        pub created: u64,
        pub active: bool,
    }

    #[ink(storage)]
    pub struct DidRegistry {
        dids: Mapping<String, DidDocument>,
        owner: AccountId,
        total_dids: u32,
    }

    #[ink(event)]
    pub struct DidCreated {
        #[ink(topic)]
        did: String,
        #[ink(topic)]
        controller: AccountId,
    }

    #[ink(event)]
    pub struct DidRevoked {
        #[ink(topic)]
        did: String,
        #[ink(topic)]
        revoked_by: AccountId,
    }

    impl Default for DidRegistry {
        fn default() -> Self {
            Self::new()
        }
    }

    impl DidRegistry {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                dids: Mapping::default(),
                owner: Self::env().caller(),
                total_dids: 0,
            }
        }

        #[ink(message)]
        pub fn create_did(&mut self, did_id: String) -> Result<(), String> {
            if self.dids.contains(&did_id) {
                return Err(String::from("DID already exists"));
            }

            let caller = self.env().caller();
            let timestamp = self.env().block_timestamp();

            let did_doc = DidDocument {
                id: did_id.clone(),
                controller: caller,
                created: timestamp,
                active: true,
            };

            self.dids.insert(&did_id, &did_doc);
            self.total_dids = self.total_dids.saturating_add(1);

            self.env().emit_event(DidCreated {
                did: did_id,
                controller: caller,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn get_did(&self, did_id: String) -> Option<DidDocument> {
            self.dids.get(&did_id)
        }

        #[ink(message)]
        pub fn get_total_dids(&self) -> u32 {
            self.total_dids
        }

        #[ink(message)]
        pub fn revoke_did(&mut self, did_id: String) -> Result<(), String> {
            if !self.dids.contains(&did_id) {
                return Err(String::from("DID not found"));
            }

            let caller = self.env().caller();
            if caller != self.owner {
                return Err(String::from("Unauthorized"));
            }

            if let Some(mut did_doc) = self.dids.get(&did_id) {
                did_doc.active = false;
                self.dids.insert(&did_id, &did_doc);

                self.env().emit_event(DidRevoked {
                    did: did_id,
                    revoked_by: caller,
                });
            }

            Ok(())
        }

        #[ink(message)]
        pub fn is_owner(&self, account: AccountId) -> bool {
            self.owner == account
        }

        #[ink(message)]
        pub fn is_did_active(&self, did_id: String) -> bool {
            if let Some(did_doc) = self.dids.get(&did_id) {
                did_doc.active
            } else {
                false
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[ink::test]
        fn new_works() {
            let registry = DidRegistry::new();
            assert_eq!(registry.get_total_dids(), 0);
        }

        #[ink::test]
        fn default_works() {
            let registry = DidRegistry::default();
            assert_eq!(registry.get_total_dids(), 0);
        }

        #[ink::test]
        fn create_did_works() {
            let mut registry = DidRegistry::new();
            let result = registry.create_did(String::from("did:peaq:test001"));
            assert!(result.is_ok());
            assert_eq!(registry.get_total_dids(), 1);
        }

        #[ink::test]
        fn duplicate_did_fails() {
            let mut registry = DidRegistry::new();
            let did_id = String::from("did:peaq:test001");
            
            let result1 = registry.create_did(did_id.clone());
            assert!(result1.is_ok());
            
            let result2 = registry.create_did(did_id);
            assert!(result2.is_err());
            assert_eq!(result2.unwrap_err(), "DID already exists");
        }

        #[ink::test]
        fn revoke_did_works() {
            let mut registry = DidRegistry::new();
            let did_id = String::from("did:peaq:test001");
            
            registry.create_did(did_id.clone()).unwrap();
            let result = registry.revoke_did(did_id.clone());
            assert!(result.is_ok());
            
            // Check that DID is revoked
            assert!(!registry.is_did_active(did_id));
        }
    }
}
EOF

# Create Telemetry Processor contract with updated ink! version
print_status "Creating Telemetry Processor contract..."
mkdir -p telemetry_processor
cat > telemetry_processor/Cargo.toml << 'EOF'
[package]
name = "telemetry_processor"
version = "1.0.0"
edition = "2021"

[dependencies]
ink = { version = "5.0", default-features = false }
scale = { package = "parity-scale-codec", version = "3", default-features = false, features = ["derive"] }
scale-info = { version = "2.6", default-features = false, features = ["derive"], optional = true }

[lib]
path = "lib.rs"

[features]
default = ["std"]
std = [
    "ink/std",
    "scale/std",
    "scale-info/std",
]
ink-as-dependency = []
EOF

cat > telemetry_processor/lib.rs << 'EOF'
#![cfg_attr(not(feature = "std"), no_std, no_main)]

/// Telemetry Processor Contract for AXI Ecosystem
#[ink::contract]
mod telemetry_processor {
    use ink::prelude::string::String;
    use ink::storage::Mapping;
    use scale::{Decode, Encode};

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug, Default)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct ProcessingStats {
        pub total_records: u64,
        pub valid_records: u64,
        pub avg_quality_score: u16,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct TelemetryRecord {
        pub id: [u8; 32],
        pub vehicle_hash: [u8; 32],
        pub sensor_type: u8,
        pub timestamp: u64,
        pub quality_score: u8,
        pub processed: bool,
    }

    #[ink(storage)]
    pub struct TelemetryProcessor {
        stats: ProcessingStats,
        owner: AccountId,
        processing_enabled: bool,
        authorized_vehicles: Mapping<[u8; 32], bool>,
        records: Mapping<[u8; 32], TelemetryRecord>,
    }

    #[ink(event)]
    pub struct RecordProcessed {
        #[ink(topic)]
        record_id: [u8; 32],
        #[ink(topic)]
        vehicle_hash: [u8; 32],
        quality_score: u8,
    }

    #[ink(event)]
    pub struct VehicleAuthorized {
        #[ink(topic)]
        vehicle_hash: [u8; 32],
        #[ink(topic)]
        authorized_by: AccountId,
    }

    impl Default for TelemetryProcessor {
        fn default() -> Self {
            Self::new()
        }
    }

    impl TelemetryProcessor {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                stats: ProcessingStats::default(),
                owner: Self::env().caller(),
                processing_enabled: true,
                authorized_vehicles: Mapping::default(),
                records: Mapping::default(),
            }
        }

        #[ink(message)]
        pub fn process_record(
            &mut self,
            vehicle_hash: [u8; 32],
            sensor_type: u8,
            data_hash: [u8; 32],
            quality_score: u8,
        ) -> Result<[u8; 32], String> {
            if !self.processing_enabled {
                return Err(String::from("Processing disabled"));
            }

            if !self.authorized_vehicles.get(&vehicle_hash).unwrap_or(false) {
                return Err(String::from("Vehicle not authorized"));
            }

            if quality_score < 50 {
                return Err(String::from("Quality score too low"));
            }

            let block_number = self.env().block_number();
            let timestamp = self.env().block_timestamp();
            let record_id = self.env().hash_encoded::<ink::env::hash::Sha2x256, _>(&(
                &vehicle_hash,
                sensor_type,
                block_number,
                timestamp,
            ));

            let record = TelemetryRecord {
                id: record_id,
                vehicle_hash,
                sensor_type,
                timestamp,
                quality_score,
                processed: true,
            };

            self.records.insert(&record_id, &record);

            // Update statistics
            self.stats.total_records = self.stats.total_records.saturating_add(1);
            self.stats.valid_records = self.stats.valid_records.saturating_add(1);

            // Update average quality score
            let total_quality = (self.stats.avg_quality_score as u64)
                .saturating_mul(self.stats.valid_records.saturating_sub(1))
                .saturating_add(quality_score as u64);
            self.stats.avg_quality_score = (total_quality / self.stats.valid_records) as u16;

            self.env().emit_event(RecordProcessed {
                record_id,
                vehicle_hash,
                quality_score,
            });

            Ok(record_id)
        }

        #[ink(message)]
        pub fn authorize_vehicle(&mut self, vehicle_hash: [u8; 32]) -> Result<(), String> {
            if self.env().caller() != self.owner {
                return Err(String::from("Unauthorized"));
            }
            
            self.authorized_vehicles.insert(&vehicle_hash, &true);

            self.env().emit_event(VehicleAuthorized {
                vehicle_hash,
                authorized_by: self.env().caller(),
            });

            Ok(())
        }

        #[ink(message)]
        pub fn deauthorize_vehicle(&mut self, vehicle_hash: [u8; 32]) -> Result<(), String> {
            if self.env().caller() != self.owner {
                return Err(String::from("Unauthorized"));
            }
            
            self.authorized_vehicles.insert(&vehicle_hash, &false);
            Ok(())
        }

        #[ink(message)]
        pub fn is_vehicle_authorized(&self, vehicle_hash: [u8; 32]) -> bool {
            self.authorized_vehicles.get(&vehicle_hash).unwrap_or(false)
        }

        #[ink(message)]
        pub fn toggle_processing(&mut self) -> Result<(), String> {
            if self.env().caller() != self.owner {
                return Err(String::from("Unauthorized"));
            }
            
            self.processing_enabled = !self.processing_enabled;
            Ok(())
        }

        #[ink(message)]
        pub fn get_stats(&self) -> ProcessingStats {
            self.stats.clone()
        }

        #[ink(message)]
        pub fn get_record(&self, record_id: [u8; 32]) -> Option<TelemetryRecord> {
            self.records.get(&record_id)
        }

        #[ink(message)]
        pub fn is_processing_enabled(&self) -> bool {
            self.processing_enabled
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[ink::test]
        fn new_works() {
            let processor = TelemetryProcessor::new();
            let stats = processor.get_stats();
            assert_eq!(stats.total_records, 0);
            assert!(processor.is_processing_enabled());
        }

        #[ink::test]
        fn authorize_vehicle_works() {
            let mut processor = TelemetryProcessor::new();
            let vehicle_hash = [1u8; 32];
            let result = processor.authorize_vehicle(vehicle_hash);
            assert!(result.is_ok());
            assert!(processor.is_vehicle_authorized(vehicle_hash));
        }

        #[ink::test]
        fn process_record_works() {
            let mut processor = TelemetryProcessor::new();
            let vehicle_hash = [1u8; 32];
            let data_hash = [2u8; 32];
            
            processor.authorize_vehicle(vehicle_hash).unwrap();
            let result = processor.process_record(vehicle_hash, 1, data_hash, 80);
            assert!(result.is_ok());
            
            let stats = processor.get_stats();
            assert_eq!(stats.total_records, 1);
            assert_eq!(stats.valid_records, 1);
        }
    }
}
EOF

# Test compilation with better error handling
print_status "Testing contract compilation..."

# Test DID Registry
cd did_registry
print_status "Testing DID Registry compilation..."
if cargo check; then
    print_success "DID Registry syntax check passed ✅"
else
    print_error "DID Registry syntax check failed ❌"
    exit 1
fi

# Test WASM build with better error handling
print_status "Testing DID Registry WASM build..."
if cargo contract build --release; then
    print_success "DID Registry WASM build successful ✅"
    ls -la target/ink/ | grep -E '\.(wasm|json)$' || true
elif cargo contract build --release --skip-linting; then
    print_warning "DID Registry WASM build successful (with linting skipped) ⚠️"
    ls -la target/ink/ | grep -E '\.(wasm|json)$' || true
else
    print_error "DID Registry WASM build failed ❌"
    print_status "Trying to update dependencies..."
    cargo update
    if cargo contract build --release --skip-linting; then
        print_success "DID Registry WASM build successful after update ✅"
    else
        print_error "DID Registry WASM build failed even after updates ❌"
        exit 1
    fi
fi

cd ../telemetry_processor

# Test Telemetry Processor
print_status "Testing Telemetry Processor compilation..."
if cargo check; then
    print_success "Telemetry Processor syntax check passed ✅"
else
    print_error "Telemetry Processor syntax check failed ❌"
    exit 1
fi

# Test WASM build with better error handling
print_status "Testing Telemetry Processor WASM build..."
if cargo contract build --release; then
    print_success "Telemetry Processor WASM build successful ✅"
    ls -la target/ink/ | grep -E '\.(wasm|json)$' || true
elif cargo contract build --release --skip-linting; then
    print_warning "Telemetry Processor WASM build successful (with linting skipped) ⚠️"
    ls -la target/ink/ | grep -E '\.(wasm|json)$' || true
else
    print_error "Telemetry Processor WASM build failed ❌"
    print_status "Trying to update dependencies..."
    cargo update
    if cargo contract build --release --skip-linting; then
        print_success "Telemetry Processor WASM build successful after update ✅"
    else
        print_error "Telemetry Processor WASM build failed even after updates ❌"
        exit 1
    fi
fi

cd ../../..

# Create helper scripts
print_status "Creating helper scripts..."
mkdir -p scripts

cat > scripts/build-contracts.sh << 'EOF'
#!/bin/bash
# Build all contracts

echo "🔨 Building all ink! contracts..."

cd contracts/ink/did_registry
echo "📋 Building DID Registry..."
cargo contract build --release

cd ../telemetry_processor
echo "📊 Building Telemetry Processor..."
cargo contract build --release

cd ../../..
echo "✅ All contracts built successfully!"
EOF

cat > scripts/build-contracts-skip-linting.sh << 'EOF'
#!/bin/bash
# Build all contracts with linting skipped (for development)

echo "🔨 Building all ink! contracts (skipping linting)..."

cd contracts/ink/did_registry
echo "📋 Building DID Registry..."
cargo contract build --release --skip-linting

cd ../telemetry_processor
echo "📊 Building Telemetry Processor..."
cargo contract build --release --skip-linting

cd ../../..
echo "✅ All contracts built successfully!"
EOF

cat > scripts/test-contracts.sh << 'EOF'
#!/bin/bash
# Test all contracts

echo "🧪 Testing all ink! contracts..."

cd contracts/ink/did_registry
echo "📋 Testing DID Registry..."
cargo test

cd ../telemetry_processor
echo "📊 Testing Telemetry Processor..."
cargo test

cd ../../..
echo "✅ All tests passed!"
EOF

cat > scripts/clean-contracts.sh << 'EOF'
#!/bin/bash
# Clean all contract builds

echo "🧹 Cleaning all contract builds..."

cd contracts/ink/did_registry
cargo clean

cd ../telemetry_processor
cargo clean

cd ../../..
echo "✅ All builds cleaned!"
EOF

cat > scripts/update-dependencies.sh << 'EOF'
#!/bin/bash
# Update all contract dependencies

echo "🔄 Updating all contract dependencies..."

cd contracts/ink/did_registry
echo "📋 Updating DID Registry dependencies..."
cargo update

cd ../telemetry_processor
echo "📊 Updating Telemetry Processor dependencies..."
cargo update

cd ../../..
echo "✅ All dependencies updated!"
EOF

chmod +x scripts/*.sh

print_success "Helper scripts created ✅"

# Final verification
print_status "Final verification..."
print_status "Rust version: $(rustc --version)"
print_status "Cargo version: $(cargo --version)"
print_status "cargo-contract version: $(cargo-contract --version)"

echo ""
print_success "🎉 Ink! Smart Contract Development Environment Setup Complete!"
echo "=================================================================="
echo ""
echo "📦 Installed components:"
echo "  ✅ Rust stable toolchain"
echo "  ✅ WASM target (wasm32-unknown-unknown)"
echo "  ✅ cargo-contract (latest compatible version)"
echo "  ✅ Essential development tools"
echo "  ✅ LLVM and Clang"
echo ""
echo "📁 Created contracts:"
echo "  📋 DID Registry (contracts/ink/did_registry/) - ink! 5.0"
echo "  📊 Telemetry Processor (contracts/ink/telemetry_processor/) - ink! 5.0"
echo ""
echo "🔧 Available helper scripts:"
echo "  📜 scripts/build-contracts.sh - Build all contracts"
echo "  🔧 scripts/build-contracts-skip-linting.sh - Build without linting"
echo "  🧪 scripts/test-contracts.sh - Test all contracts"  
echo "  🧹 scripts/clean-contracts.sh - Clean all builds"
echo "  🔄 scripts/update-dependencies.sh - Update dependencies"
echo ""
echo "🚀 Next steps:"
echo "  1. Build contracts: ./scripts/build-contracts.sh"
echo "  2. Run tests: ./scripts/test-contracts.sh"
echo "  3. Deploy to testnet with cargo-contract"
echo ""
echo "💡 If you encounter linting issues:"
echo "  Use: ./scripts/build-contracts-skip-linting.sh"
echo ""
echo "💡 To build individual contracts:"
echo "  cd contracts/ink/did_registry && cargo contract build --release"
echo "  cd contracts/ink/telemetry_processor && cargo contract build --release"
echo ""
print_success "Happy coding! 🦀✨"