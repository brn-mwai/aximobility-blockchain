#!/bin/bash

# Deploy ink! contracts to Peaq networks
# Usage: ./deploy-ink-contracts.sh [mainnet|agung|krest]
# Default: agung (for testing)

NETWORK=${1:-agung}

echo "Deploying ink! contracts to Peaq $NETWORK..."

# Load environment
if [ -f ".env.deployment" ]; then
    source .env.deployment
else
    echo "Error: .env.deployment not found"
    exit 1
fi

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Network config
set_network_config() {
    case $NETWORK in
        "mainnet")
            WS_URL=${PEAQ_MAINNET_WS_URL:-"wss://peaq.api.onfinality.io/public-ws"}
            RPC_URL=${PEAQ_MAINNET_RPC_URL:-"https://peaq.api.onfinality.io/public"}
            NETWORK_NAME="peaq-mainnet"
            ;;
        "agung")
            WS_URL=${PEAQ_AGUNG_WS_URL:-"wss://wss-async.agung.peaq.network"}
            RPC_URL=${PEAQ_AGUNG_RPC_URL:-"https://peaq-agung.api.onfinality.io/public"}
            NETWORK_NAME="peaq-agung-testnet"
            ;;
        "krest")
            WS_URL=${PEAQ_KREST_WS_URL:-"wss://wss-krest.peaq.network"}
            RPC_URL=${PEAQ_KREST_RPC_URL:-"https://peaq-krest.api.onfinality.io/public"}
            NETWORK_NAME="peaq-krest-canary"
            ;;
        *)
            print_error "Invalid network: $NETWORK. Use 'mainnet', 'agung', or 'krest'"
            exit 1
            ;;
    esac
    
    print_status "Network: $NETWORK_NAME"
    print_status "WS URL: $WS_URL"
}

# Check prerequisites
check_deps() {
    if [ -z "$DEPLOYMENT_SEED" ]; then
        print_error "DEPLOYMENT_SEED not found. Run wallet setup first."
        exit 1
    fi
    
    if ! command -v cargo-contract &> /dev/null; then
        print_error "cargo-contract not found"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        print_error "jq not found"
        exit 1
    fi
    
    # Warn for mainnet dplymnt
    if [ "$NETWORK" = "mainnet" ]; then
        print_warning "MAINNET DEPLOYMENT - This will use real PEAQ tokens!"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Deployment cancelled"
            exit 0
        fi
    fi
}

# Deploy single contract
deploy_contract() {
    local contract_name=$1
    local contract_path=$2
    
    print_status "Deploying $contract_name..."
    
    # Network-specific gas limits
    case $NETWORK in
        "mainnet")
            GAS_LIMIT=${MAINNET_GAS_LIMIT:-"500000000000"}
            PROOF_SIZE=${MAINNET_PROOF_SIZE:-"500000"}
            ;;
        "agung"|"krest")
            GAS_LIMIT=${TESTNET_GAS_LIMIT:-"1000000000000"}
            PROOF_SIZE=${TESTNET_PROOF_SIZE:-"1000000"}
            ;;
    esac
    
    result=$(cargo contract instantiate \
        --contract "$contract_path" \
        --constructor new \
        --suri "$DEPLOYMENT_SEED" \
        --url "$WS_URL" \
        --gas "$GAS_LIMIT" \
        --proof-size "$PROOF_SIZE" \
        --skip-confirm \
        --output-json 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        address=$(echo "$result" | jq -r '.contract' 2>/dev/null)
        if [ "$address" != "null" ] && [ -n "$address" ]; then
            print_success "$contract_name: $address"
            echo "$address"
        else
            print_error "$contract_name deployment failed - invalid response"
            exit 1
        fi
    else
        print_error "$contract_name deployment failed"
        exit 1
    fi
}

# Main deployment
deploy_contracts() {
    mkdir -p deployments/ink-contracts
    cd contracts/ink || exit 1
    
    print_status "Deployer: $DEPLOYMENT_ADDRESS"
    
    # Deploy contracts
    DID_REGISTRY_ADDRESS=$(deploy_contract "DID Registry" "target/ink/did_registry/did_registry.contract")
    TELEMETRY_ADDRESS=$(deploy_contract "Telemetry Processor" "target/ink/telemetry_processor/telemetry_processor.contract")
    VEHICLE_ADDRESS=$(deploy_contract "Vehicle Registry" "target/ink/vehicle_registry/vehicle_registry.contract")
    
    cd ../../
}

# Create deployment summary
create_summary() {
    cd deployments/ink-contracts
    
    cat > deployment-summary.json << EOF
{
    "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "network": {
        "name": "$NETWORK_NAME",
        "wsUrl": "$WS_URL",
        "rpcUrl": "$RPC_URL"
    },
    "deployer": {
        "address": "$DEPLOYMENT_ADDRESS"
    },
    "contracts": {
        "didRegistry": {
            "address": "$DID_REGISTRY_ADDRESS",
            "name": "DID Registry"
        },
        "telemetryProcessor": {
            "address": "$TELEMETRY_ADDRESS",
            "name": "Telemetry Processor"
        },
        "vehicleRegistry": {
            "address": "$VEHICLE_ADDRESS",
            "name": "Vehicle Registry"
        }
    }
}
EOF

    print_success "Summary saved to deployments/ink-contracts/deployment-summary.json"
    cd ../../
}

# Update env file
update_env() {
    # Create network-specific env vars
    NETWORK_UPPER=$(echo "$NETWORK" | tr '[:lower:]' '[:upper:]')
    
    cat >> .env.deployment << EOF

# Deployed ink! Contract Addresses ($NETWORK)
${NETWORK_UPPER}_DID_REGISTRY_ADDRESS=$DID_REGISTRY_ADDRESS
${NETWORK_UPPER}_TELEMETRY_PROCESSOR_ADDRESS=$TELEMETRY_ADDRESS
${NETWORK_UPPER}_VEHICLE_REGISTRY_ADDRESS=$VEHICLE_ADDRESS
EOF

    print_success "Contract addresses added to .env.deployment"
}

# Show deployment results
show_results() {
    print_success "Deployment complete!"
    echo ""
    print_status "Contract addresses:"
    print_status "  DID Registry: $DID_REGISTRY_ADDRESS"
    print_status "  Telemetry Processor: $TELEMETRY_ADDRESS"
    print_status "  Vehicle Registry: $VEHICLE_ADDRESS"
    echo ""
    
    # Network-specific explorer links
    case $NETWORK in
        "mainnet")
            print_status "Peaq Explorer:"
            print_status "  https://peaq.subscan.io/account/$DID_REGISTRY_ADDRESS"
            ;;
        "agung")
            print_status "Agung Explorer:"
            print_status "  https://agung-testnet.subscan.io/account/$DID_REGISTRY_ADDRESS"
            ;;
        "krest")
            print_status "Krest Explorer:"
            print_status "  https://krest.subscan.io/account/$DID_REGISTRY_ADDRESS"
            ;;
    esac
}

# Main execution
main() {
    set_network_config
    check_deps
    deploy_contracts
    create_summary
    update_env
    show_results
}

main