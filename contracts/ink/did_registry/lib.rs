#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod did_registry {
    use ink::prelude::{string::String, vec::Vec};
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
        pub public_key: [u8; 32],
        pub service_endpoint: String,
        pub created: u64,
        pub updated: u64,
        pub status: DidStatus,
        pub entity_type: EntityType,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub enum DidStatus {
        Active,
        Revoked,
        Suspended,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub enum EntityType {
        Vehicle,
        Sensor,
        User,
        Service,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct VehicleMetadata {
        pub vin: String,
        pub make: String,
        pub model: String,
        pub year: u16,
        pub license_plate: String,
        pub engine_type: EngineType,
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
    pub struct SensorMetadata {
        pub sensor_type: String,
        pub manufacturer: String,
        pub model: String,
        pub accuracy: String,
        pub parent_vehicle_did: Option<String>,
    }

    #[ink(storage)]
    pub struct DidRegistry {
        dids: Mapping<String, DidDocument>,
        vehicle_metadata: Mapping<String, VehicleMetadata>,
        sensor_metadata: Mapping<String, SensorMetadata>,
        owner_dids: Mapping<AccountId, Vec<String>>,
        authorizations: Mapping<String, Vec<AccountId>>,
        owner: AccountId,
        total_dids: u32,
    }

    #[ink(event)]
    pub struct DidCreated {
        #[ink(topic)]
        did: String,
        #[ink(topic)]
        controller: AccountId,
        entity_type: EntityType,
    }

    #[ink(event)]
    pub struct DidUpdated {
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
        controller: AccountId,
        reason: String,
    }

    #[ink(event)]
    pub struct AuthorizationGranted {
        #[ink(topic)]
        did: String,
        #[ink(topic)]
        authorized_account: AccountId,
        #[ink(topic)]
        grantor: AccountId,
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
                vehicle_metadata: Mapping::default(),
                sensor_metadata: Mapping::default(),
                owner_dids: Mapping::default(),
                authorizations: Mapping::default(),
                owner: Self::env().caller(),
                total_dids: 0,
            }
        }

        #[ink(message)]
        pub fn create_vehicle_did(
            &mut self,
            did_id: String,
            public_key: [u8; 32],
            service_endpoint: String,
            metadata: VehicleMetadata,
        ) -> Result<(), String> {
            if !self.is_valid_did_format(&did_id) {
                return Err(String::from("Invalid DID format"));
            }

            if self.dids.contains(&did_id) {
                return Err(String::from("DID already exists"));
            }

            let caller = self.env().caller();
            let timestamp = self.env().block_timestamp();

            let did_doc = DidDocument {
                id: did_id.clone(),
                controller: caller,
                public_key,
                service_endpoint,
                created: timestamp,
                updated: timestamp,
                status: DidStatus::Active,
                entity_type: EntityType::Vehicle,
            };

            self.dids.insert(&did_id, &did_doc);
            self.vehicle_metadata.insert(&did_id, &metadata);

            let mut owner_did_list = self.owner_dids.get(caller).unwrap_or_default();
            owner_did_list.push(did_id.clone());
            self.owner_dids.insert(caller, &owner_did_list);

            self.total_dids = self.total_dids.saturating_add(1);

            self.env().emit_event(DidCreated {
                did: did_id,
                controller: caller,
                entity_type: EntityType::Vehicle,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn create_sensor_did(
            &mut self,
            did_id: String,
            public_key: [u8; 32],
            service_endpoint: String,
            metadata: SensorMetadata,
        ) -> Result<(), String> {
            if !self.is_valid_did_format(&did_id) {
                return Err(String::from("Invalid DID format"));
            }

            if self.dids.contains(&did_id) {
                return Err(String::from("DID already exists"));
            }

            if let Some(ref parent_did) = metadata.parent_vehicle_did {
                if !self.dids.contains(parent_did) {
                    return Err(String::from("Parent vehicle DID not found"));
                }
            }

            let caller = self.env().caller();
            let timestamp = self.env().block_timestamp();

            let did_doc = DidDocument {
                id: did_id.clone(),
                controller: caller,
                public_key,
                service_endpoint,
                created: timestamp,
                updated: timestamp,
                status: DidStatus::Active,
                entity_type: EntityType::Sensor,
            };

            self.dids.insert(&did_id, &did_doc);
            self.sensor_metadata.insert(&did_id, &metadata);

            let mut owner_did_list = self.owner_dids.get(caller).unwrap_or_default();
            owner_did_list.push(did_id.clone());
            self.owner_dids.insert(caller, &owner_did_list);

            self.total_dids = self.total_dids.saturating_add(1);

            self.env().emit_event(DidCreated {
                did: did_id,
                controller: caller,
                entity_type: EntityType::Sensor,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn update_did(
            &mut self,
            did_id: String,
            public_key: [u8; 32],
            service_endpoint: String,
        ) -> Result<(), String> {
            let mut did_doc = self.dids.get(&did_id).ok_or("DID not found")?;
            
            let caller = self.env().caller();
            if did_doc.controller != caller && !self.is_authorized(&did_id, &caller) {
                return Err(String::from("Unauthorized"));
            }

            if did_doc.status != DidStatus::Active {
                return Err(String::from("DID not active"));
            }

            did_doc.public_key = public_key;
            did_doc.service_endpoint = service_endpoint;
            did_doc.updated = self.env().block_timestamp();

            self.dids.insert(&did_id, &did_doc);

            self.env().emit_event(DidUpdated {
                did: did_id,
                controller: caller,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn revoke_did(&mut self, did_id: String, reason: String) -> Result<(), String> {
            let mut did_doc = self.dids.get(&did_id).ok_or("DID not found")?;
            
            let caller = self.env().caller();
            if did_doc.controller != caller && caller != self.owner {
                return Err(String::from("Unauthorized"));
            }

            did_doc.status = DidStatus::Revoked;
            did_doc.updated = self.env().block_timestamp();

            self.dids.insert(&did_id, &did_doc);

            self.env().emit_event(DidRevoked {
                did: did_id,
                controller: caller,
                reason,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn grant_authorization(
            &mut self,
            did_id: String,
            account: AccountId,
        ) -> Result<(), String> {
            let did_doc = self.dids.get(&did_id).ok_or("DID not found")?;
            
            let caller = self.env().caller();
            if did_doc.controller != caller {
                return Err(String::from("Unauthorized"));
            }

            let mut auth_list = self.authorizations.get(&did_id).unwrap_or_default();
            if !auth_list.contains(&account) {
                auth_list.push(account);
                self.authorizations.insert(&did_id, &auth_list);

                self.env().emit_event(AuthorizationGranted {
                    did: did_id,
                    authorized_account: account,
                    grantor: caller,
                });
            }

            Ok(())
        }

        #[ink(message)]
        pub fn revoke_authorization(
            &mut self,
            did_id: String,
            account: AccountId,
        ) -> Result<(), String> {
            let did_doc = self.dids.get(&did_id).ok_or("DID not found")?;
            
            let caller = self.env().caller();
            if did_doc.controller != caller {
                return Err(String::from("Unauthorized"));
            }

            let mut auth_list = self.authorizations.get(&did_id).unwrap_or_default();
            auth_list.retain(|&x| x != account);
            self.authorizations.insert(&did_id, &auth_list);

            Ok(())
        }

        #[ink(message)]
        pub fn get_did(&self, did_id: String) -> Option<DidDocument> {
            self.dids.get(&did_id)
        }

        #[ink(message)]
        pub fn get_vehicle_metadata(&self, did_id: String) -> Option<VehicleMetadata> {
            self.vehicle_metadata.get(&did_id)
        }

        #[ink(message)]
        pub fn get_sensor_metadata(&self, did_id: String) -> Option<SensorMetadata> {
            self.sensor_metadata.get(&did_id)
        }

        #[ink(message)]
        pub fn get_owner_dids(&self, owner: AccountId) -> Vec<String> {
            self.owner_dids.get(owner).unwrap_or_default()
        }

        #[ink(message)]
        pub fn get_total_dids(&self) -> u32 {
            self.total_dids
        }

        #[ink(message)]
        pub fn verify_access(&self, did_id: String, account: AccountId) -> bool {
            if let Some(did_doc) = self.dids.get(&did_id) {
                did_doc.controller == account || self.is_authorized(&did_id, &account)
            } else {
                false
            }
        }

        #[ink(message)]
        pub fn is_did_active(&self, did_id: String) -> bool {
            if let Some(did_doc) = self.dids.get(&did_id) {
                did_doc.status == DidStatus::Active
            } else {
                false
            }
        }

        #[ink(message)]
        pub fn get_authorizations(&self, did_id: String) -> Vec<AccountId> {
            self.authorizations.get(&did_id).unwrap_or_default()
        }

        fn is_valid_did_format(&self, did_id: &str) -> bool {
            did_id.starts_with("did:peaq:") && did_id.len() > 9
        }

        fn is_authorized(&self, did_id: &str, account: &AccountId) -> bool {
            self.authorizations
                .get(did_id)
                .map(|auth_list| auth_list.contains(account))
                .unwrap_or(false)
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
        fn create_vehicle_did_works() {
            let mut registry = DidRegistry::new();
            let did_id = String::from("did:peaq:vehicle:test001");
            let public_key = [1u8; 32];
            let service_endpoint = String::from("https://api.aximobility.com/vehicle/test001");
            
            let metadata = VehicleMetadata {
                vin: String::from("TEST123456789"),
                make: String::from("Tesla"),
                model: String::from("Model 3"),
                year: 2023,
                license_plate: String::from("AXI001"),
                engine_type: EngineType::Electric,
            };

            let result = registry.create_vehicle_did(
                did_id.clone(),
                public_key,
                service_endpoint,
                metadata,
            );

            assert!(result.is_ok());
            assert!(registry.get_did(did_id).is_some());
            assert_eq!(registry.get_total_dids(), 1);
        }

        #[ink::test]
        fn create_sensor_did_works() {
            let mut registry = DidRegistry::new();
            let vehicle_did = String::from("did:peaq:vehicle:test001");
            let sensor_did = String::from("did:peaq:sensor:test001");
            
            let vehicle_metadata = VehicleMetadata {
                vin: String::from("TEST123456789"),
                make: String::from("Tesla"),
                model: String::from("Model 3"),
                year: 2023,
                license_plate: String::from("AXI001"),
                engine_type: EngineType::Electric,
            };

            registry.create_vehicle_did(
                vehicle_did.clone(),
                [1u8; 32],
                String::from("https://api.aximobility.com/vehicle/test001"),
                vehicle_metadata,
            ).unwrap();

            let sensor_metadata = SensorMetadata {
                sensor_type: String::from("GPS"),
                manufacturer: String::from("Bosch"),
                model: String::from("GPS-2023"),
                accuracy: String::from("±1m"),
                parent_vehicle_did: Some(vehicle_did),
            };

            let result = registry.create_sensor_did(
                sensor_did.clone(),
                [2u8; 32],
                String::from("https://api.aximobility.com/sensor/test001"),
                sensor_metadata,
            );

            assert!(result.is_ok());
            assert!(registry.get_did(sensor_did).is_some());
            assert_eq!(registry.get_total_dids(), 2);
        }

        #[ink::test]
        fn duplicate_did_fails() {
            let mut registry = DidRegistry::new();
            let did_id = String::from("did:peaq:vehicle:test001");
            let public_key = [1u8; 32];
            let service_endpoint = String::from("https://api.aximobility.com/vehicle/test001");
            
            let metadata = VehicleMetadata {
                vin: String::from("TEST123456789"),
                make: String::from("Tesla"),
                model: String::from("Model 3"),
                year: 2023,
                license_plate: String::from("AXI001"),
                engine_type: EngineType::Electric,
            };

            let result1 = registry.create_vehicle_did(
                did_id.clone(),
                public_key,
                service_endpoint.clone(),
                metadata.clone(),
            );
            assert!(result1.is_ok());

            let result2 = registry.create_vehicle_did(
                did_id,
                public_key,
                service_endpoint,
                metadata,
            );
            assert!(result2.is_err());
            assert_eq!(result2.unwrap_err(), "DID already exists");
        }

        #[ink::test]
        fn authorization_works() {
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();
            let mut registry = DidRegistry::new();
            let did_id = String::from("did:peaq:vehicle:test001");
            
            let metadata = VehicleMetadata {
                vin: String::from("TEST123456789"),
                make: String::from("Tesla"),
                model: String::from("Model 3"),
                year: 2023,
                license_plate: String::from("AXI001"),
                engine_type: EngineType::Electric,
            };

            registry.create_vehicle_did(
                did_id.clone(),
                [1u8; 32],
                String::from("https://api.aximobility.com/vehicle/test001"),
                metadata,
            ).unwrap();

            registry.grant_authorization(did_id.clone(), accounts.bob).unwrap();
            
            assert!(registry.verify_access(did_id, accounts.bob));
        }

        #[ink::test]
        fn invalid_did_format_fails() {
            let mut registry = DidRegistry::new();
            let invalid_did = String::from("invalid_did_format");
            
            let metadata = VehicleMetadata {
                vin: String::from("TEST123456789"),
                make: String::from("Tesla"),
                model: String::from("Model 3"),
                year: 2023,
                license_plate: String::from("AXI001"),
                engine_type: EngineType::Electric,
            };

            let result = registry.create_vehicle_did(
                invalid_did,
                [1u8; 32],
                String::from("https://api.aximobility.com/vehicle/test001"),
                metadata,
            );

            assert!(result.is_err());
            assert_eq!(result.unwrap_err(), "Invalid DID format");
        }
    }
}