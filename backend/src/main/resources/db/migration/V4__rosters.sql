-- Full roster model. Game data is referenced by stable keys plus the data version the list was built on.

ALTER TABLE roster
    ADD COLUMN faction_key        VARCHAR(120),
    ADD COLUMN data_version_id    BIGINT REFERENCES data_version (id),
    ADD COLUMN battle_size_key    VARCHAR(300),
    ADD COLUMN faction_options    JSONB   NOT NULL DEFAULT '{}',
    ADD COLUMN force_disposition  VARCHAR(300),
    ADD COLUMN flags              JSONB   NOT NULL DEFAULT '{}',
    ADD COLUMN points_total       INT     NOT NULL DEFAULT 0,
    ADD COLUMN legal              BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE roster_detachment (
    roster_id       BIGINT       NOT NULL REFERENCES roster (id) ON DELETE CASCADE,
    detachment_key  VARCHAR(300) NOT NULL,
    position        INT          NOT NULL,
    PRIMARY KEY (roster_id, detachment_key)
);

CREATE TABLE roster_entry (
    id               BIGSERIAL PRIMARY KEY,
    roster_id        BIGINT       NOT NULL REFERENCES roster (id) ON DELETE CASCADE,
    datasheet_key    VARCHAR(300) NOT NULL,
    size_key         VARCHAR(300) NOT NULL,
    wargear          JSONB        NOT NULL DEFAULT '[]',
    enhancement_key  VARCHAR(300),
    warlord          BOOLEAN      NOT NULL DEFAULT FALSE,
    attached_to      BIGINT       REFERENCES roster_entry (id) ON DELETE SET NULL,
    sort_order       INT          NOT NULL
);
CREATE INDEX roster_entry_roster_idx ON roster_entry (roster_id, sort_order);

CREATE TABLE user_prefs (
    user_id     BIGINT PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    prefs       JSONB       NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE export_preset (
    id          BIGSERIAL PRIMARY KEY,
    owner_id    BIGINT       NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    settings    JSONB        NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (owner_id, name)
);
