-- Tìm lời mời theo tuần và hai phía khi xuất dữ liệu (#105).
CREATE INDEX attestation_owner_week ON attestation (user_id, cycle, week);
CREATE INDEX attestation_witness ON attestation (attester_id) WHERE attester_id IS NOT NULL;
