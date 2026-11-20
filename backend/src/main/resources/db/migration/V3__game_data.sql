-- Game data. Every import is kept as a parsed "source set"; a data version is built by merging the
-- latest source set of each source (DESIGN.md 5.2) plus manual overrides into game_entity rows.

CREATE TABLE source_import (
    id          BIGSERIAL PRIMARY KEY,
    source      VARCHAR(16)  NOT NULL CHECK (source IN ('BATTLESCRIBE', 'WAHAPEDIA', 'MFM', 'MANUAL')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  BIGINT       REFERENCES app_user (id),
    files       JSONB        NOT NULL DEFAULT '[]',
    payload     BYTEA        NOT NULL, -- gzipped JSON of the parsed SourceSet
    report      JSONB        NOT NULL DEFAULT '{}'
);

CREATE TABLE data_version (
    id            BIGSERIAL PRIMARY KEY,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by    BIGINT      REFERENCES app_user (id),
    status        VARCHAR(16) NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    activated_at  TIMESTAMPTZ,
    source_files  JSONB       NOT NULL DEFAULT '[]',
    import_ids    JSONB       NOT NULL DEFAULT '{}', -- source -> source_import.id used for this build
    report        JSONB       NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX data_version_one_active ON data_version (status) WHERE status = 'ACTIVE';

CREATE TABLE game_entity (
    id               BIGSERIAL PRIMARY KEY,
    data_version_id  BIGINT       NOT NULL REFERENCES data_version (id) ON DELETE CASCADE,
    type             VARCHAR(32)  NOT NULL,
    key              VARCHAR(300) NOT NULL,
    faction_key      VARCHAR(120),
    parent_key       VARCHAR(300),
    name             VARCHAR(300) NOT NULL,
    source           VARCHAR(16)  NOT NULL,
    provenance       JSONB        NOT NULL DEFAULT '{}', -- field -> source that won the merge
    external_ids     JSONB        NOT NULL DEFAULT '{}', -- source -> original id (BattleScribe, Wahapedia)
    data             JSONB        NOT NULL
);
CREATE UNIQUE INDEX game_entity_key_uq ON game_entity (data_version_id, type, key);
CREATE INDEX game_entity_faction_idx ON game_entity (data_version_id, type, faction_key);
CREATE INDEX game_entity_parent_idx ON game_entity (data_version_id, parent_key);
CREATE INDEX game_entity_name_idx ON game_entity (data_version_id, type, lower(name));

-- Hand fixes, applied on top of every build so a re-import never wipes them.
-- field = '*' with a JSON object value creates a whole entity (for data no import provides, like battle sizes).
CREATE TABLE manual_override (
    id           BIGSERIAL PRIMARY KEY,
    entity_type  VARCHAR(32)  NOT NULL,
    entity_key   VARCHAR(300) NOT NULL,
    field        VARCHAR(100) NOT NULL,
    value        JSONB        NOT NULL,
    note         TEXT         NOT NULL DEFAULT '',
    created_by   BIGINT       REFERENCES app_user (id),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX manual_override_uq ON manual_override (entity_type, entity_key, field);
