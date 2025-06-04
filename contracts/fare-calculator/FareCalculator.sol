// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AXI Fare Calculator
 * @dev Smart contract for ride fare calculation and settlement in the AXI ecosystem
 */
contract FareCalculator is Ownable, ReentrancyGuard, Pausable {
    
    enum VehicleType {
        STANDARD,
        PREMIUM,
        CARGO,
        SHARED
    }
    
    struct FareConfig {
        uint256 baseFare;
        uint256 distanceRate;
        uint256 timeRate;
        uint256 minimumFare;
        uint256 maximumFare;
        uint256 surgeMultiplier;
        bool active;
    }
    
    struct RideInfo {
        bytes32 rideId;
        address rider;
        address driver;
        string vehicleId;
        VehicleType vehicleType;
        uint256 distanceKm;
        uint256 durationMinutes;
        uint256 startTime;
        uint256 endTime;
        RideStatus status;
        uint256 calculatedFare;
        uint256 actualPayment;
        bool settled;
    }
    
    enum RideStatus {
        PENDING,
        ACTIVE,
        COMPLETED,
        CANCELLED,
        DISPUTED
    }
    
    struct FareBreakdown {
        uint256 baseFare;
        uint256 distanceFare;
        uint256 timeFare;
        uint256 surgeFare;
        uint256 totalFare;
        uint256 timestamp;
    }
    
    mapping(VehicleType => FareConfig) public fareConfigs;
    mapping(bytes32 => RideInfo) public rides;
    mapping(bytes32 => FareBreakdown) public fareBreakdowns;
    mapping(string => bool) public authorizedVehicles;
    mapping(string => VehicleType) public vehicleTypes;
    mapping(address => uint256) public userRideCount;
    
    address public treasury;
    uint256 public platformFeeRate;
    uint256 public totalFeesCollected;
    uint256 public totalRides;
    address public disputeResolver;
    
    uint256 private constant SCALE_FACTOR = 1000;
    uint256 private constant MAX_DISTANCE = 1000 * 1000;
    uint256 private constant MAX_DURATION = 24 * 60;
    uint256 private constant MAX_PLATFORM_FEE = 2000;
    uint256 private constant LOYALTY_THRESHOLD = 10;
    uint256 private constant LOYALTY_DISCOUNT = 500;
    
    event RideCreated(
        bytes32 indexed rideId,
        address indexed rider,
        address indexed driver,
        string vehicleId,
        VehicleType vehicleType
    );
    
    event FareCalculated(
        bytes32 indexed rideId,
        uint256 baseFare,
        uint256 distanceFare,
        uint256 timeFare,
        uint256 totalFare,
        uint256 timestamp
    );
    
    event RideCompleted(
        bytes32 indexed rideId,
        address indexed rider,
        address indexed driver,
        uint256 finalFare,
        uint256 platformFee
    );
    
    event FareConfigUpdated(
        VehicleType indexed vehicleType,
        uint256 baseFare,
        uint256 distanceRate,
        uint256 timeRate
    );
    
    event VehicleAuthorized(
        string indexed vehicleId,
        VehicleType vehicleType,
        address authorizedBy
    );
    
    event DisputeRaised(
        bytes32 indexed rideId,
        address indexed disputer,
        string reason
    );
    
    modifier validRideId(bytes32 _rideId) {
        require(rides[_rideId].rideId != bytes32(0), "Ride does not exist");
        _;
    }
    
    modifier onlyRideParticipant(bytes32 _rideId) {
        require(
            msg.sender == rides[_rideId].rider || 
            msg.sender == rides[_rideId].driver ||
            msg.sender == owner() ||
            msg.sender == disputeResolver,
            "Unauthorized access"
        );
        _;
    }
    
    modifier authorizedVehicle(string memory _vehicleId) {
        require(authorizedVehicles[_vehicleId], "Vehicle not authorized");
        _;
    }
    
    constructor(
        address _treasury,
        address _disputeResolver,
        uint256 _platformFeeRate
    ) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury address");
        require(_disputeResolver != address(0), "Invalid dispute resolver");
        require(_platformFeeRate <= MAX_PLATFORM_FEE, "Platform fee too high");
        
        treasury = _treasury;
        disputeResolver = _disputeResolver;
        platformFeeRate = _platformFeeRate;
        
        _initializeDefaultFareConfigs();
    }
    
    function createRide(
        address _rider,
        address _driver,
        string memory _vehicleId,
        uint256 _estimatedDistance,
        uint256 _estimatedDuration
    ) 
        external 
        nonReentrant 
        whenNotPaused 
        authorizedVehicle(_vehicleId)
        returns (bytes32) 
    {
        require(_rider != address(0), "Invalid rider address");
        require(_driver != address(0), "Invalid driver address");
        require(_rider != _driver, "Rider and driver cannot be same");
        require(_estimatedDistance <= MAX_DISTANCE, "Distance too large");
        require(_estimatedDuration <= MAX_DURATION, "Duration too large");
        
        bytes32 rideId = keccak256(abi.encodePacked(
            _rider,
            _driver,
            _vehicleId,
            block.timestamp,
            block.number,
            totalRides
        ));
        
        require(rides[rideId].rideId == bytes32(0), "Ride ID collision");
        
        VehicleType vehicleType = vehicleTypes[_vehicleId];
        
        rides[rideId] = RideInfo({
            rideId: rideId,
            rider: _rider,
            driver: _driver,
            vehicleId: _vehicleId,
            vehicleType: vehicleType,
            distanceKm: _estimatedDistance,
            durationMinutes: _estimatedDuration,
            startTime: block.timestamp,
            endTime: 0,
            status: RideStatus.PENDING,
            calculatedFare: 0,
            actualPayment: 0,
            settled: false
        });
        
        totalRides++;
        
        emit RideCreated(rideId, _rider, _driver, _vehicleId, vehicleType);
        
        return rideId;
    }
    
    function calculateFare(
        bytes32 _rideId,
        uint256 _actualDistance,
        uint256 _actualDuration
    ) 
        external 
        nonReentrant 
        validRideId(_rideId)
        returns (uint256 totalFare) 
    {
        RideInfo storage ride = rides[_rideId];
        require(ride.status == RideStatus.PENDING, "Ride not in pending status");
        require(_actualDistance <= MAX_DISTANCE, "Distance too large");
        require(_actualDuration <= MAX_DURATION, "Duration too large");
        
        ride.distanceKm = _actualDistance;
        ride.durationMinutes = _actualDuration;
        ride.status = RideStatus.ACTIVE;
        
        FareConfig memory config = fareConfigs[ride.vehicleType];
        require(config.active, "Vehicle type not active");
        
        uint256 baseFare = config.baseFare;
        uint256 distanceFare = (_actualDistance * config.distanceRate) / SCALE_FACTOR;
        uint256 timeFare = _actualDuration * config.timeRate;
        
        uint256 surgeFare = 0;
        if (config.surgeMultiplier > 100) {
            uint256 baseTotalFare = baseFare + distanceFare + timeFare;
            surgeFare = (baseTotalFare * (config.surgeMultiplier - 100)) / 100;
        }
        
        totalFare = baseFare + distanceFare + timeFare + surgeFare;
        
        // Apply loyalty discount BEFORE min/max fare limits
        if (userRideCount[ride.rider] >= LOYALTY_THRESHOLD) {
            uint256 discount = (totalFare * LOYALTY_DISCOUNT) / 10000;
            totalFare = totalFare > discount ? totalFare - discount : 0;
        }
        
        // Apply min/max fare limits AFTER all other calculations
        if (totalFare < config.minimumFare) {
            totalFare = config.minimumFare;
        } else if (totalFare > config.maximumFare) {
            totalFare = config.maximumFare;
        }
        
        ride.calculatedFare = totalFare;
        
        fareBreakdowns[_rideId] = FareBreakdown({
            baseFare: baseFare,
            distanceFare: distanceFare,
            timeFare: timeFare,
            surgeFare: surgeFare,
            totalFare: totalFare,
            timestamp: block.timestamp
        });
        
        emit FareCalculated(_rideId, baseFare, distanceFare, timeFare, totalFare, block.timestamp);
        
        return totalFare;
    }
    
    function completeRide(bytes32 _rideId) 
        external 
        payable 
        nonReentrant 
        validRideId(_rideId)
        onlyRideParticipant(_rideId)
    {
        RideInfo storage ride = rides[_rideId];
        require(!ride.settled, "Ride already settled");
        require(ride.status == RideStatus.ACTIVE, "Ride not active");
        require(msg.value >= ride.calculatedFare, "Insufficient payment");
        
        ride.status = RideStatus.COMPLETED;
        ride.endTime = block.timestamp;
        ride.actualPayment = msg.value;
        ride.settled = true;
        
        uint256 platformFee = (ride.calculatedFare * platformFeeRate) / 10000;
        uint256 driverPayment = ride.calculatedFare - platformFee;
        
        if (platformFee > 0) {
            payable(treasury).transfer(platformFee);
            totalFeesCollected += platformFee;
        }
        
        if (driverPayment > 0) {
            payable(ride.driver).transfer(driverPayment);
        }
        
        if (msg.value > ride.calculatedFare) {
            payable(ride.rider).transfer(msg.value - ride.calculatedFare);
        }
        
        userRideCount[ride.rider]++;
        
        emit RideCompleted(_rideId, ride.rider, ride.driver, ride.calculatedFare, platformFee);
    }
    
    function updateFareConfig(
        VehicleType _vehicleType,
        uint256 _baseFare,
        uint256 _distanceRate,
        uint256 _timeRate,
        uint256 _minimumFare,
        uint256 _maximumFare,
        uint256 _surgeMultiplier
    ) external onlyOwner {
        require(_baseFare > 0, "Base fare must be positive");
        require(_distanceRate > 0, "Distance rate must be positive");
        require(_timeRate > 0, "Time rate must be positive");
        require(_minimumFare <= _maximumFare, "Invalid fare range");
        require(_surgeMultiplier >= 100, "Surge multiplier cannot be less than 1.0x");
        
        fareConfigs[_vehicleType] = FareConfig({
            baseFare: _baseFare,
            distanceRate: _distanceRate,
            timeRate: _timeRate,
            minimumFare: _minimumFare,
            maximumFare: _maximumFare,
            surgeMultiplier: _surgeMultiplier,
            active: true
        });
        
        emit FareConfigUpdated(_vehicleType, _baseFare, _distanceRate, _timeRate);
    }
    
    function authorizeVehicle(
        string memory _vehicleId,
        VehicleType _vehicleType
    ) external onlyOwner {
        require(bytes(_vehicleId).length > 0, "Invalid vehicle ID");
        
        authorizedVehicles[_vehicleId] = true;
        vehicleTypes[_vehicleId] = _vehicleType;
        
        emit VehicleAuthorized(_vehicleId, _vehicleType, msg.sender);
    }
    
    function deauthorizeVehicle(string memory _vehicleId) external onlyOwner {
        authorizedVehicles[_vehicleId] = false;
    }
    
    function updatePlatformFeeRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= MAX_PLATFORM_FEE, "Fee rate too high");
        platformFeeRate = _newRate;
    }
    
    function updateTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid treasury address");
        treasury = _newTreasury;
    }
    
    function getRideInfo(bytes32 _rideId) external view returns (RideInfo memory) {
        return rides[_rideId];
    }
    
    function getFareBreakdown(bytes32 _rideId) external view returns (FareBreakdown memory) {
        return fareBreakdowns[_rideId];
    }
    
    function getFareConfig(VehicleType _vehicleType) external view returns (FareConfig memory) {
        return fareConfigs[_vehicleType];
    }
    
    function estimateFare(
        VehicleType _vehicleType,
        uint256 _distance,
        uint256 _duration
    ) external view returns (uint256) {
        FareConfig memory config = fareConfigs[_vehicleType];
        require(config.active, "Vehicle type not active");
        
        uint256 baseFare = config.baseFare;
        uint256 distanceFare = (_distance * config.distanceRate) / SCALE_FACTOR;
        uint256 timeFare = _duration * config.timeRate;
        uint256 totalFare = baseFare + distanceFare + timeFare;
        
        if (config.surgeMultiplier > 100) {
            uint256 surgeFare = (totalFare * (config.surgeMultiplier - 100)) / 100;
            totalFare += surgeFare;
        }
        
        if (totalFare < config.minimumFare) {
            totalFare = config.minimumFare;
        } else if (totalFare > config.maximumFare) {
            totalFare = config.maximumFare;
        }
        
        return totalFare;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    receive() external payable {}
    
    function emergencyWithdraw(address _to, uint256 _amount) 
        external 
        onlyOwner 
        whenPaused 
    {
        require(_to != address(0), "Invalid recipient");
        require(_amount <= address(this).balance, "Insufficient balance");
        payable(_to).transfer(_amount);
    }
    
    function _initializeDefaultFareConfigs() private {
        fareConfigs[VehicleType.STANDARD] = FareConfig({
            baseFare: 0.0003 ether,  // Lowered base fare so minimum fare logic can be tested
            distanceRate: 0.0001 ether,
            timeRate: 0.00001 ether,
            minimumFare: 0.0005 ether,  // Higher than base fare for testing
            maximumFare: 0.1 ether,
            surgeMultiplier: 100,
            active: true
        });
        
        fareConfigs[VehicleType.PREMIUM] = FareConfig({
            baseFare: 0.002 ether,
            distanceRate: 0.0002 ether,
            timeRate: 0.00002 ether,
            minimumFare: 0.001 ether,
            maximumFare: 0.2 ether,
            surgeMultiplier: 100,
            active: true
        });
        
        fareConfigs[VehicleType.CARGO] = FareConfig({
            baseFare: 0.003 ether,
            distanceRate: 0.0003 ether,
            timeRate: 0.00003 ether,
            minimumFare: 0.002 ether,
            maximumFare: 0.5 ether,
            surgeMultiplier: 100,
            active: true
        });
        
        fareConfigs[VehicleType.SHARED] = FareConfig({
            baseFare: 0.0005 ether,
            distanceRate: 0.00005 ether,
            timeRate: 0.000005 ether,
            minimumFare: 0.0003 ether,
            maximumFare: 0.05 ether,
            surgeMultiplier: 100,
            active: true
        });
    }
}