CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE organization (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    short_name TEXT,
    ogrn VARCHAR(15) UNIQUE NOT NULL,
    legal_address TEXT NOT NULL,
    postal_address TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_organization_updated
BEFORE UPDATE ON organization
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =========================
-- Руководитель организации
-- =========================
CREATE TABLE leader (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organization(id) ON DELETE CASCADE,

    position TEXT NOT NULL,
    last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT,

    initials_name_im TEXT,
    initials_name_dat TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_leader_updated
BEFORE UPDATE ON leader
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================
-- Проверка
-- =========================
CREATE TABLE inspection (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organization(id) ON DELETE CASCADE,

    inspection_type TEXT NOT NULL CHECK (
        inspection_type IN (
            'плановая документарная',
            'плановая выездная',
            'внеплановая документарная',
            'внеплановая выездная'
        )
    ),

    minzdrav_order_number TEXT,
    minzdrav_order_date DATE,
    minzdrav_order_name TEXT,

    chomiaz_order_number TEXT,
    chomiaz_order_date DATE,

    letter_number TEXT,
    letter_date DATE,

    inspection_number TEXT,
    date_start DATE,
    date_end DATE,
    date_early_end DATE,
    duration_work_days INTEGER,

    representative_document TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_inspection_updated
BEFORE UPDATE ON inspection
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =========================
-- Адреса проведения проверки
-- =========================
CREATE TABLE inspection_addresses (
    id SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL REFERENCES inspection(id) ON DELETE CASCADE,
    address TEXT NOT NULL
);

-- =========================
-- Уполномоченные на проведение проверки
-- =========================
CREATE TABLE inspection_authorized_persons (
    id SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL REFERENCES inspection(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL
);

-- =========================
-- Подписанты из числа уполномоченных
-- =========================
CREATE TABLE inspection_signatories (
    id SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL REFERENCES inspection(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL
);

-- =========================
-- Представители учреждения
-- =========================
CREATE TABLE inspection_representatives (
    id SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL REFERENCES inspection(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL
);
