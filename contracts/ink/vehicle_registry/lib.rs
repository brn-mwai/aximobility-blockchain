#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod vehicle_registry {
    use ink::prelude::{string::String, vec::Vec};
    use ink::storage::Mapping;
    use scale::{Decode, Encode};

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct Vehicle {
        pub id: String,
        pub did_identifier: String,
        pub owner: AccountId,
        pub operator: Option<AccountId>,
        pub vin: String,
        pub make: String,
        pub model: String,
        pub year: u16,
        pub license_plate: String,
        pub engine_type: EngineType,
        pub battery_capacity: Option<u32>,
        pub status: VehicleStatus,
        pub registered_at: u64,
        pub last_updated: u64,
        pub mileage: u32,
        pub location: Option<Location>,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub enum EngineType {
        Electric,
        Hybrid,
        Gasoline,
        Diesel,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub enum VehicleStatus {
        Active,
        Inactive,
        Maintenance,
        Suspended,
        Deregistered,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct Location {
        pub latitude: i32,  // Scaled by 1000000 for precision
        pub longitude: i32, // Scaled by 1000000 for precision
        pub timestamp: u64,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct VehicleRegistration {
        pub vehicle_id: String,
        pub did_identifier: String,
        pub vin: String,
        pub make: String,
        pub model: String,
        pub year: u16,
        pub license_plate: String,
        pub engine_type: EngineType,
        pub battery_capacity: Option<u32>,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct Sensor {
        pub id: String,
        pub did_identifier: String,
        pub vehicle_id: String,
        pub sensor_type: SensorType,
        pub manufacturer: String,
        pub model: String,
        pub status: SensorStatus,
        pub installed_at: u64,
        pub last_calibrated: u64,
        pub accuracy: String,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct SensorRegistration {
        pub sensor_id: String,
        pub did_identifier: String,
        pub vehicle_id: String,
        pub sensor_type: SensorType,
        pub manufacturer: String,
        pub model: String,
        pub accuracy: String,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub enum SensorType {
        Gps,
        Accelerometer,
        Gyroscope,
        Battery,
        Temperature,
        Speed,
        FuelLevel,
        EngineRpm,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub enum SensorStatus {
        Active,
        Inactive,
        Faulty,
        Calibrating,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug, Default)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct RegistryStats {
        pub total_vehicles: u32,
        pub active_vehicles: u32,
        pub total_sensors: u32,
        pub active_sensors: u32,
        pub electric_vehicles: u32,
    }

    #[ink(storage)]
    pub struct VehicleRegistry {
        vehicles: Mapping<String, Vehicle>,
        sensors: Mapping<String, Sensor>,
        owner_vehicles: Mapping<AccountId, Vec<String>>,
        operator_vehicles: Mapping<AccountId, Vec<String>>,
        vehicle_sensors: Mapping<String, Vec<String>>,
        vin_to_id: Mapping<String, String>,
        license_to_id: Mapping<String, String>,
        stats: RegistryStats,
        owner: AccountId,
        authorized_operators: Mapping<AccountId, bool>,
    }

    #[ink(event)]
    pub struct VehicleRegistered {
        #[ink(topic)]
        vehicle_id: String,
        #[ink(topic)]
        owner: AccountId,
        vin: String,
        make: String,
        model: String,
    }

    #[ink(event)]
    pub struct VehicleStatusChanged {
        #[ink(topic)]
        vehicle_id: String,
        old_status: VehicleStatus,
        new_status: VehicleStatus,
        changed_by: AccountId,
    }

    #[ink(event)]
    pub struct SensorRegistered {
        #[ink(topic)]
        sensor_id: String,
        #[ink(topic)]
        vehicle_id: String,
        sensor_type: SensorType,
        registered_by: AccountId,
    }

    #[ink(event)]
    pub struct OperatorAssigned {
        #[ink(topic)]
        vehicle_id: String,
        #[ink(topic)]
        operator: AccountId,
        #[ink(topic)]
        assigned_by: AccountId,
    }

    #[ink(event)]
    pub struct LocationUpdated {
        #[ink(topic)]
        vehicle_id: String,
        latitude: i32,
        longitude: i32,
        timestamp: u64,
    }

    impl Default for VehicleRegistry {
        fn default() -> Self {
            Self::new()
        }
    }

    impl VehicleRegistry {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                vehicles: Mapping::default(),
                sensors: Mapping::default(),
                owner_vehicles: Mapping::default(),
                operator_vehicles: Mapping::default(),
                vehicle_sensors: Mapping::default(),
                vin_to_id: Mapping::default(),
                license_to_id: Mapping::default(),
                stats: RegistryStats::default(),
                owner: Self::env().caller(),
                authorized_operators: Mapping::default(),
            }
        }

        #[ink(message)]
        pub fn register_vehicle(&mut self, registration: VehicleRegistration) -> Result<(), String> {
            if self.vehicles.contains(&registration.vehicle_id) {
                return Err(String::from("Vehicle already registered"));
            }

            if self.vin_to_id.contains(&registration.vin) {
                return Err(String::from("VIN already registered"));
            }

            if self.license_to_id.contains(&registration.license_plate) {
                return Err(String::from("License plate already registered"));
            }

            if registration.vehicle_id.is_empty() || registration.vin.is_empty() || registration.make.is_empty() {
                return Err(String::from("Invalid vehicle data"));
            }

            let caller = self.env().caller();
            let timestamp = self.env().block_timestamp();

            let vehicle = Vehicle {
                id: registration.vehicle_id.clone(),
                did_identifier: registration.did_identifier,
                owner: caller,
                operator: None,
                vin: registration.vin.clone(),
                make: registration.make.clone(),
                model: registration.model.clone(),
                year: registration.year,
                license_plate: registration.license_plate.clone(),
                engine_type: registration.engine_type.clone(),
                battery_capacity: registration.battery_capacity,
                status: VehicleStatus::Active,
                registered_at: timestamp,
                last_updated: timestamp,
                mileage: 0,
                location: None,
            };

            self.vehicles.insert(&registration.vehicle_id, &vehicle);
            self.vin_to_id.insert(&registration.vin, &registration.vehicle_id);
            self.license_to_id.insert(&registration.license_plate, &registration.vehicle_id);

            let mut owner_list = self.owner_vehicles.get(caller).unwrap_or_default();
            owner_list.push(registration.vehicle_id.clone());
            self.owner_vehicles.insert(caller, &owner_list);

            self.stats.total_vehicles = self.stats.total_vehicles.saturating_add(1);
            self.stats.active_vehicles = self.stats.active_vehicles.saturating_add(1);
            
            if registration.engine_type == EngineType::Electric {
                self.stats.electric_vehicles = self.stats.electric_vehicles.saturating_add(1);
            }

            self.env().emit_event(VehicleRegistered {
                vehicle_id: registration.vehicle_id,
                owner: caller,
                vin: registration.vin,
                make: registration.make,
                model: registration.model,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn assign_operator(
            &mut self,
            vehicle_id: String,
            operator: AccountId,
        ) -> Result<(), String> {
            let mut vehicle = self.vehicles.get(&vehicle_id)
                .ok_or("Vehicle not found")?;

            let caller = self.env().caller();
            if vehicle.owner != caller && caller != self.owner {
                return Err(String::from("Unauthorized"));
            }

            if !self.authorized_operators.get(operator).unwrap_or(false) {
                return Err(String::from("Operator not authorized"));
            }

            if let Some(old_operator) = vehicle.operator {
                let mut old_operator_list = self.operator_vehicles.get(old_operator).unwrap_or_default();
                old_operator_list.retain(|id| id != &vehicle_id);
                self.operator_vehicles.insert(old_operator, &old_operator_list);
            }

            vehicle.operator = Some(operator);
            vehicle.last_updated = self.env().block_timestamp();
            self.vehicles.insert(&vehicle_id, &vehicle);

            let mut operator_list = self.operator_vehicles.get(operator).unwrap_or_default();
            operator_list.push(vehicle_id.clone());
            self.operator_vehicles.insert(operator, &operator_list);

            self.env().emit_event(OperatorAssigned {
                vehicle_id,
                operator,
                assigned_by: caller,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn register_sensor(&mut self, registration: SensorRegistration) -> Result<(), String> {
            if !self.vehicles.contains(&registration.vehicle_id) {
                return Err(String::from("Vehicle not found"));
            }

            if self.sensors.contains(&registration.sensor_id) {
                return Err(String::from("Sensor already registered"));
            }

            let vehicle = self.vehicles.get(&registration.vehicle_id).unwrap();
            let caller = self.env().caller();
            
            if vehicle.owner != caller && vehicle.operator != Some(caller) && caller != self.owner {
                return Err(String::from("Unauthorized"));
            }

            let timestamp = self.env().block_timestamp();

            let sensor = Sensor {
                id: registration.sensor_id.clone(),
                did_identifier: registration.did_identifier,
                vehicle_id: registration.vehicle_id.clone(),
                sensor_type: registration.sensor_type.clone(),
                manufacturer: registration.manufacturer,
                model: registration.model,
                status: SensorStatus::Active,
                installed_at: timestamp,
                last_calibrated: timestamp,
                accuracy: registration.accuracy,
            };

            self.sensors.insert(&registration.sensor_id, &sensor);

            let mut vehicle_sensor_list = self.vehicle_sensors.get(&registration.vehicle_id).unwrap_or_default();
            vehicle_sensor_list.push(registration.sensor_id.clone());
            self.vehicle_sensors.insert(&registration.vehicle_id, &vehicle_sensor_list);

            self.stats.total_sensors = self.stats.total_sensors.saturating_add(1);
            self.stats.active_sensors = self.stats.active_sensors.saturating_add(1);

            self.env().emit_event(SensorRegistered {
                sensor_id: registration.sensor_id,
                vehicle_id: registration.vehicle_id,
                sensor_type: registration.sensor_type,
                registered_by: caller,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn update_vehicle_status(
            &mut self,
            vehicle_id: String,
            new_status: VehicleStatus,
        ) -> Result<(), String> {
            let mut vehicle = self.vehicles.get(&vehicle_id)
                .ok_or("Vehicle not found")?;

            let caller = self.env().caller();
            if vehicle.owner != caller && vehicle.operator != Some(caller) && caller != self.owner {
                return Err(String::from("Unauthorized"));
            }

            let old_status = vehicle.status.clone();
            
            if old_status == VehicleStatus::Active && new_status != VehicleStatus::Active {
                self.stats.active_vehicles = self.stats.active_vehicles.saturating_sub(1);
            } else if old_status != VehicleStatus::Active && new_status == VehicleStatus::Active {
                self.stats.active_vehicles = self.stats.active_vehicles.saturating_add(1);
            }

            vehicle.status = new_status.clone();
            vehicle.last_updated = self.env().block_timestamp();
            self.vehicles.insert(&vehicle_id, &vehicle);

            self.env().emit_event(VehicleStatusChanged {
                vehicle_id,
                old_status,
                new_status,
                changed_by: caller,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn update_location(
            &mut self,
            vehicle_id: String,
            latitude: i32,
            longitude: i32,
        ) -> Result<(), String> {
            let mut vehicle = self.vehicles.get(&vehicle_id)
                .ok_or("Vehicle not found")?;

            let caller = self.env().caller();
            if vehicle.owner != caller && vehicle.operator != Some(caller) && caller != self.owner {
                return Err(String::from("Unauthorized"));
            }

            let timestamp = self.env().block_timestamp();
            
            vehicle.location = Some(Location {
                latitude,
                longitude,
                timestamp,
            });
            vehicle.last_updated = timestamp;
            self.vehicles.insert(&vehicle_id, &vehicle);

            self.env().emit_event(LocationUpdated {
                vehicle_id,
                latitude,
                longitude,
                timestamp,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn update_mileage(
            &mut self,
            vehicle_id: String,
            mileage: u32,
        ) -> Result<(), String> {
            let mut vehicle = self.vehicles.get(&vehicle_id)
                .ok_or("Vehicle not found")?;

            let caller = self.env().caller();
            if vehicle.owner != caller && vehicle.operator != Some(caller) && caller != self.owner {
                return Err(String::from("Unauthorized"));
            }

            if mileage < vehicle.mileage {
                return Err(String::from("Invalid mileage"));
            }

            vehicle.mileage = mileage;
            vehicle.last_updated = self.env().block_timestamp();
            self.vehicles.insert(&vehicle_id, &vehicle);

            Ok(())
        }

        #[ink(message)]
        pub fn authorize_operator(&mut self, operator: AccountId) -> Result<(), String> {
            if self.env().caller() != self.owner {
                return Err(String::from("Unauthorized"));
            }

            self.authorized_operators.insert(operator, &true);
            Ok(())
        }

        #[ink(message)]
        pub fn deauthorize_operator(&mut self, operator: AccountId) -> Result<(), String> {
            if self.env().caller() != self.owner {
                return Err(String::from("Unauthorized"));
            }

            self.authorized_operators.insert(operator, &false);
            Ok(())
        }

        #[ink(message)]
        pub fn get_vehicle(&self, vehicle_id: String) -> Option<Vehicle> {
            self.vehicles.get(&vehicle_id)
        }

        #[ink(message)]
        pub fn get_vehicle_by_vin(&self, vin: String) -> Option<Vehicle> {
            if let Some(vehicle_id) = self.vin_to_id.get(&vin) {
                self.vehicles.get(&vehicle_id)
            } else {
                None
            }
        }

        #[ink(message)]
        pub fn get_vehicle_by_license(&self, license_plate: String) -> Option<Vehicle> {
            if let Some(vehicle_id) = self.license_to_id.get(&license_plate) {
                self.vehicles.get(&vehicle_id)
            } else {
                None
            }
        }

        #[ink(message)]
        pub fn get_sensor(&self, sensor_id: String) -> Option<Sensor> {
            self.sensors.get(&sensor_id)
        }

        #[ink(message)]
        pub fn get_vehicle_sensors(&self, vehicle_id: String) -> Vec<String> {
            self.vehicle_sensors.get(&vehicle_id).unwrap_or_default()
        }

        #[ink(message)]
        pub fn get_owner_vehicles(&self, owner: AccountId) -> Vec<String> {
            self.owner_vehicles.get(owner).unwrap_or_default()
        }

        #[ink(message)]
        pub fn get_operator_vehicles(&self, operator: AccountId) -> Vec<String> {
            self.operator_vehicles.get(operator).unwrap_or_default()
        }

        #[ink(message)]
        pub fn get_stats(&self) -> RegistryStats {
            self.stats.clone()
        }

        #[ink(message)]
        pub fn is_operator_authorized(&self, operator: AccountId) -> bool {
            self.authorized_operators.get(operator).unwrap_or(false)
        }

        #[ink(message)]
        pub fn is_vehicle_active(&self, vehicle_id: String) -> bool {
            if let Some(vehicle) = self.vehicles.get(&vehicle_id) {
                vehicle.status == VehicleStatus::Active
            } else {
                false
            }
        }

        #[ink(message)]
        pub fn get_owner(&self) -> AccountId {
            self.owner
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[ink::test]
        fn new_works() {
            let registry = VehicleRegistry::new();
            let stats = registry.get_stats();
            assert_eq!(stats.total_vehicles, 0);
            assert_eq!(stats.active_vehicles, 0);
        }

        #[ink::test]
        fn register_vehicle_works() {
            let mut registry = VehicleRegistry::new();
            
            let registration = VehicleRegistration {
                vehicle_id: String::from("AXI_001"),
                did_identifier: String::from("did:peaq:vehicle:axi_001"),
                vin: String::from("TEST123456789"),
                make: String::from("Tesla"),
                model: String::from("Model 3"),
                year: 2023,
                license_plate: String::from("AXI001"),
                engine_type: EngineType::Electric,
                battery_capacity: Some(75),
            };

            let result = registry.register_vehicle(registration);

            assert!(result.is_ok());
            assert!(registry.get_vehicle(String::from("AXI_001")).is_some());
            
            let stats = registry.get_stats();
            assert_eq!(stats.total_vehicles, 1);
            assert_eq!(stats.active_vehicles, 1);
            assert_eq!(stats.electric_vehicles, 1);
        }

        #[ink::test]
        fn duplicate_vehicle_fails() {
            let mut registry = VehicleRegistry::new();
            
            let registration1 = VehicleRegistration {
                vehicle_id: String::from("AXI_001"),
                did_identifier: String::from("did:peaq:vehicle:axi_001"),
                vin: String::from("TEST123456789"),
                make: String::from("Tesla"),
                model: String::from("Model 3"),
                year: 2023,
                license_plate: String::from("AXI001"),
                engine_type: EngineType::Electric,
                battery_capacity: Some(75),
            };
            
            let registration2 = VehicleRegistration {
                vehicle_id: String::from("AXI_001"),
                did_identifier: String::from("did:peaq:vehicle:axi_002"),
                vin: String::from("TEST987654321"),
                make: String::from("BMW"),
                model: String::from("i3"),
                year: 2023,
                license_plate: String::from("AXI002"),
                engine_type: EngineType::Electric,
                battery_capacity: Some(42),
            };

            let result1 = registry.register_vehicle(registration1);
            assert!(result1.is_ok());

            let result2 = registry.register_vehicle(registration2);
            assert!(result2.is_err());
        }

        #[ink::test]
        fn register_sensor_works() {
            let mut registry = VehicleRegistry::new();
            
            let vehicle_registration = VehicleRegistration {
                vehicle_id: String::from("AXI_001"),
                did_identifier: String::from("did:peaq:vehicle:axi_001"),
                vin: String::from("TEST123456789"),
                make: String::from("Tesla"),
                model: String::from("Model 3"),
                year: 2023,
                license_plate: String::from("AXI001"),
                engine_type: EngineType::Electric,
                battery_capacity: Some(75),
            };

            registry.register_vehicle(vehicle_registration).unwrap();

            let sensor_registration = SensorRegistration {
                sensor_id: String::from("GPS_001"),
                did_identifier: String::from("did:peaq:sensor:gps_001"),
                vehicle_id: String::from("AXI_001"),
                sensor_type: SensorType::Gps,
                manufacturer: String::from("Bosch"),
                model: String::from("GPS-2023"),
                accuracy: String::from("±1m"),
            };

            let result = registry.register_sensor(sensor_registration);

            assert!(result.is_ok());
            assert!(registry.get_sensor(String::from("GPS_001")).is_some());
            
            let sensors = registry.get_vehicle_sensors(String::from("AXI_001"));
            assert_eq!(sensors.len(), 1);
            assert_eq!(sensors[0], "GPS_001");
        }

        #[ink::test]
        fn operator_assignment_works() {
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();
            let mut registry = VehicleRegistry::new();
            
            let registration = VehicleRegistration {
                vehicle_id: String::from("AXI_001"),
                did_identifier: String::from("did:peaq:vehicle:axi_001"),
                vin: String::from("TEST123456789"),
                make: String::from("Tesla"),
                model: String::from("Model 3"),
                year: 2023,
                license_plate: String::from("AXI001"),
                engine_type: EngineType::Electric,
                battery_capacity: Some(75),
            };

            registry.register_vehicle(registration).unwrap();
            registry.authorize_operator(accounts.bob).unwrap();
            
            let result = registry.assign_operator(String::from("AXI_001"), accounts.bob);
            assert!(result.is_ok());

            let vehicle = registry.get_vehicle(String::from("AXI_001")).unwrap();
            assert_eq!(vehicle.operator, Some(accounts.bob));
        }

        #[ink::test]
        fn location_update_works() {
            let mut registry = VehicleRegistry::new();
            
            let registration = VehicleRegistration {
                vehicle_id: String::from("AXI_001"),
                did_identifier: String::from("did:peaq:vehicle:axi_001"),
                vin: String::from("TEST123456789"),
                make: String::from("Tesla"),
                model: String::from("Model 3"),
                year: 2023,
                license_plate: String::from("AXI001"),
                engine_type: EngineType::Electric,
                battery_capacity: Some(75),
            };

            registry.register_vehicle(registration).unwrap();

            let latitude = -1234567; // -1.234567 degrees scaled by 1000000
            let longitude = 36987654; // 36.987654 degrees scaled by 1000000

            let result = registry.update_location(String::from("AXI_001"), latitude, longitude);
            assert!(result.is_ok());

            let vehicle = registry.get_vehicle(String::from("AXI_001")).unwrap();
            assert!(vehicle.location.is_some());
            
            let location = vehicle.location.unwrap();
            assert_eq!(location.latitude, latitude);
            assert_eq!(location.longitude, longitude);
        }
    }
}