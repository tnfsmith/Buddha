-- #70 / ADR 0002: loạt, phần, thứ tự và chương; cột nullable tương thích Worker cũ.
ALTER TABLE content_item ADD COLUMN meta TEXT;
