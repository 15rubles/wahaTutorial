-- Keys are built from source names; keep them unbounded in the database (slugs are capped in code).
ALTER TABLE game_entity ALTER COLUMN key TYPE TEXT, ALTER COLUMN parent_key TYPE TEXT, ALTER COLUMN name TYPE TEXT;
ALTER TABLE manual_override ALTER COLUMN entity_key TYPE TEXT;
ALTER TABLE roster_entry ALTER COLUMN datasheet_key TYPE TEXT, ALTER COLUMN size_key TYPE TEXT, ALTER COLUMN enhancement_key TYPE TEXT;
ALTER TABLE roster_detachment ALTER COLUMN detachment_key TYPE TEXT;
ALTER TABLE roster ALTER COLUMN battle_size_key TYPE TEXT, ALTER COLUMN force_disposition TYPE TEXT;
