#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![allow(clippy::arithmetic_side_effects)]
#![allow(clippy::cast_possible_truncation)]

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
        pub last_processed_block: u32,
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
        pub data_hash: [u8; 32],
        pub quality_score: u8,
        pub processed: bool,
        pub validated: bool,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct BatchRecord {
        pub batch_id: [u8; 32],
        pub record_count: u16,
        pub merkle_root: [u8; 32],
        pub processed_count: u16,
        pub timestamp: u64,
        pub status: BatchStatus,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub enum BatchStatus {
        Pending,
        Processing,
        Completed,
        Failed,
    }

    #[ink(storage)]
    pub struct TelemetryProcessor {
        stats: ProcessingStats,
        owner: AccountId,
        processing_enabled: bool,
        authorized_vehicles: Mapping<[u8; 32], bool>,
        records: Mapping<[u8; 32], TelemetryRecord>,
        batches: Mapping<[u8; 32], BatchRecord>,
        vehicle_counters: Mapping<[u8; 32], u32>,
    }

    #[ink(event)]
    pub struct RecordProcessed {
        #[ink(topic)]
        record_id: [u8; 32],
        #[ink(topic)]
        vehicle_hash: [u8; 32],
        sensor_type: u8,
        quality_score: u8,
    }

    #[ink(event)]
    pub struct BatchProcessed {
        #[ink(topic)]
        batch_id: [u8; 32],
        record_count: u16,
        processed_count: u16,
        status: BatchStatus,
    }

    #[ink(event)]
    pub struct VehicleAuthorized {
        #[ink(topic)]
        vehicle_hash: [u8; 32],
        #[ink(topic)]
        authorized_by: AccountId,
    }

    #[ink(event)]
    pub struct AnomalyDetected {
        #[ink(topic)]
        record_id: [u8; 32],
        #[ink(topic)]
        vehicle_hash: [u8; 32],
        anomaly_type: u8,
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
                batches: Mapping::default(),
                vehicle_counters: Mapping::default(),
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

            if !self.authorized_vehicles.get(vehicle_hash).unwrap_or(false) {
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

            if self.records.contains(record_id) {
                return Err(String::from("Duplicate record"));
            }

            let record = TelemetryRecord {
                id: record_id,
                vehicle_hash,
                sensor_type,
                timestamp,
                data_hash,
                quality_score,
                processed: true,
                validated: false,
            };

            self.records.insert(record_id, &record);

            self.stats.total_records = self.stats.total_records.saturating_add(1);
            self.stats.valid_records = self.stats.valid_records.saturating_add(1);
            self.stats.last_processed_block = block_number;

            if self.stats.valid_records > 0 {
                let total_quality = (self.stats.avg_quality_score as u64)
                    .saturating_mul(self.stats.valid_records.saturating_sub(1))
                    .saturating_add(quality_score as u64);
                
                let new_avg = total_quality.saturating_div(self.stats.valid_records);
                self.stats.avg_quality_score = (new_avg.min(u16::MAX as u64)) as u16;
            }

            let current_counter = self.vehicle_counters.get(vehicle_hash).unwrap_or(0);
            self.vehicle_counters.insert(vehicle_hash, &(current_counter.saturating_add(1)));

            self.env().emit_event(RecordProcessed {
                record_id,
                vehicle_hash,
                sensor_type,
                quality_score,
            });

            if quality_score < 30 || sensor_type > 10 {
                self.env().emit_event(AnomalyDetected {
                    record_id,
                    vehicle_hash,
                    anomaly_type: if quality_score < 30 { 1 } else { 2 },
                });
            }

            Ok(record_id)
        }

        #[ink(message)]
        #[allow(clippy::cast_possible_truncation)]
        pub fn process_batch(
            &mut self,
            batch_id: [u8; 32],
            records: ink::prelude::vec::Vec<(
                [u8; 32], // vehicle_hash
                u8,       // sensor_type
                [u8; 32], // data_hash
                u8,       // quality_score
            )>,
            merkle_root: [u8; 32],
        ) -> Result<u16, String> {
            if !self.processing_enabled {
                return Err(String::from("Processing disabled"));
            }

            if records.len() > 1000 {
                return Err(String::from("Batch too large"));
            }

            if self.batches.contains(batch_id) {
                return Err(String::from("Batch already exists"));
            }

            let timestamp = self.env().block_timestamp();
            let block_number = self.env().block_number();

            let mut batch = BatchRecord {
                batch_id,
                record_count: records.len().min(u16::MAX as usize) as u16,
                merkle_root,
                processed_count: 0,
                timestamp,
                status: BatchStatus::Processing,
            };

            let mut processed_count = 0u16;
            let mut total_quality = 0u32;

            for (vehicle_hash, sensor_type, data_hash, quality_score) in records {
                if !self.authorized_vehicles.get(vehicle_hash).unwrap_or(false) {
                    continue;
                }

                if quality_score < 50 {
                    continue;
                }

                let record_id = self.env().hash_encoded::<ink::env::hash::Sha2x256, _>(&(
                    &vehicle_hash,
                    sensor_type,
                    block_number,
                    timestamp,
                    processed_count,
                ));

                if self.records.contains(record_id) {
                    continue;
                }

                let record = TelemetryRecord {
                    id: record_id,
                    vehicle_hash,
                    sensor_type,
                    timestamp,
                    data_hash,
                    quality_score,
                    processed: true,
                    validated: true,
                };

                self.records.insert(record_id, &record);
                processed_count = processed_count.saturating_add(1);
                total_quality = total_quality.saturating_add(quality_score as u32);

                let current_counter = self.vehicle_counters.get(vehicle_hash).unwrap_or(0);
                self.vehicle_counters.insert(vehicle_hash, &(current_counter.saturating_add(1)));
            }

            batch.processed_count = processed_count;
            batch.status = if processed_count > 0 {
                BatchStatus::Completed
            } else {
                BatchStatus::Failed
            };

            self.batches.insert(batch_id, &batch);

            self.stats.total_records = self.stats.total_records.saturating_add(processed_count as u64);
            self.stats.valid_records = self.stats.valid_records.saturating_add(processed_count as u64);
            self.stats.last_processed_block = block_number;

            // Fixed: collapsed the nested if statement
            if processed_count > 0 && self.stats.valid_records > 0 {
                let avg_quality = total_quality.saturating_div(processed_count as u32);
                let current_total = (self.stats.avg_quality_score as u64)
                    .saturating_mul(self.stats.valid_records.saturating_sub(processed_count as u64))
                    .saturating_add(avg_quality.saturating_mul(processed_count as u32) as u64);
                
                let new_avg = current_total.saturating_div(self.stats.valid_records);
                self.stats.avg_quality_score = (new_avg.min(u16::MAX as u64)) as u16;
            }

            self.env().emit_event(BatchProcessed {
                batch_id,
                record_count: batch.record_count,
                processed_count,
                status: batch.status.clone(),
            });

            Ok(processed_count)
        }

        #[ink(message)]
        pub fn authorize_vehicle(&mut self, vehicle_hash: [u8; 32]) -> Result<(), String> {
            if self.env().caller() != self.owner {
                return Err(String::from("Unauthorized"));
            }
            
            self.authorized_vehicles.insert(vehicle_hash, &true);

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
            
            self.authorized_vehicles.insert(vehicle_hash, &false);
            Ok(())
        }

        #[ink(message)]
        pub fn validate_record(&mut self, record_id: [u8; 32]) -> Result<(), String> {
            if self.env().caller() != self.owner {
                return Err(String::from("Unauthorized"));
            }

            let mut record = self.records.get(record_id).ok_or("Record not found")?;
            
            if record.validated {
                return Err(String::from("Already validated"));
            }

            record.validated = true;
            self.records.insert(record_id, &record);

            Ok(())
        }

        #[ink(message)]
        pub fn is_vehicle_authorized(&self, vehicle_hash: [u8; 32]) -> bool {
            self.authorized_vehicles.get(vehicle_hash).unwrap_or(false)
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
            self.records.get(record_id)
        }

        #[ink(message)]
        pub fn get_batch(&self, batch_id: [u8; 32]) -> Option<BatchRecord> {
            self.batches.get(batch_id)
        }

        #[ink(message)]
        pub fn get_vehicle_counter(&self, vehicle_hash: [u8; 32]) -> u32 {
            self.vehicle_counters.get(vehicle_hash).unwrap_or(0)
        }

        #[ink(message)]
        pub fn is_processing_enabled(&self) -> bool {
            self.processing_enabled
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

        #[ink::test]
        fn batch_processing_works() {
            let mut processor = TelemetryProcessor::new();
            let vehicle_hash = [1u8; 32];
            let batch_id = [3u8; 32];
            let merkle_root = [4u8; 32];
            
            processor.authorize_vehicle(vehicle_hash).unwrap();
            
            let records = ink::prelude::vec![
                (vehicle_hash, 1, [5u8; 32], 80),
                (vehicle_hash, 2, [6u8; 32], 85),
                (vehicle_hash, 3, [7u8; 32], 90),
            ];
            
            let result = processor.process_batch(batch_id, records, merkle_root);
            assert!(result.is_ok());
            assert_eq!(result.unwrap(), 3);
        }

        #[ink::test]
        fn unauthorized_vehicle_fails() {
            let mut processor = TelemetryProcessor::new();
            let vehicle_hash = [1u8; 32];
            let data_hash = [2u8; 32];
            
            let result = processor.process_record(vehicle_hash, 1, data_hash, 80);
            assert!(result.is_err());
            assert_eq!(result.unwrap_err(), "Vehicle not authorized");
        }

        #[ink::test]
        fn low_quality_fails() {
            let mut processor = TelemetryProcessor::new();
            let vehicle_hash = [1u8; 32];
            let data_hash = [2u8; 32];
            
            processor.authorize_vehicle(vehicle_hash).unwrap();
            let result = processor.process_record(vehicle_hash, 1, data_hash, 30);
            assert!(result.is_err());
            assert_eq!(result.unwrap_err(), "Quality score too low");
        }
    }
}