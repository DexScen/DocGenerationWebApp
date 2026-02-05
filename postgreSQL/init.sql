CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE organizations (
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
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =========================
-- Руководитель организации
-- =========================
CREATE TABLE leader (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

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
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

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

-----------------------------

INSERT INTO organizations (full_name, short_name, ogrn, legal_address, postal_address)
VALUES
(
    'Государственное бюджетное учреждение здравоохранения "Городская клиническая больница №1"',
    'ГБУЗ ГКБ №1',
    '1027400000001',
    'г. Челябинск, ул. Ленина, д. 10',
    '454000, г. Челябинск, а/я 10'
),
(
    'Государственное автономное учреждение здравоохранения "Областной онкологический диспансер"',
    'ГАУЗ ООД',
    '1027400000002',
    'г. Челябинск, ул. Свободы, д. 45',
    '454090, г. Челябинск, ул. Свободы, д. 45'
);


INSERT INTO leader (
    organization_id,
    position,
    last_name,
    first_name,
    middle_name,
    initials_name_im,
    initials_name_dat
)
VALUES
(
    1,
    'Главный врач',
    'Иванов',
    'Сергей',
    'Петрович',
    'С.П. Иванов',
    'С.П. Иванову'
),
(
    2,
    'Директор',
    'Смирнова',
    'Елена',
    'Владимировна',
    'Е.В. Смирнова',
    'Е.В. Смирновой'
);

INSERT INTO inspection (
    organization_id,
    inspection_type,

    minzdrav_order_number,
    minzdrav_order_date,
    minzdrav_order_name,

    chomiaz_order_number,
    chomiaz_order_date,

    letter_number,
    letter_date,

    inspection_number,
    date_start,
    date_end,
    duration_work_days,

    representative_document
)
VALUES
(
    1,
    'плановая документарная',
    '123-ОД',
    '2025-03-01',
    'О проведении плановой проверки',

    '45-П',
    '2025-03-05',

    '01-12/456',
    '2025-02-20',

    'ПР-2025-001',
    '2025-03-10',
    '2025-03-20',
    8,

    'Доверенность №12 от 01.03.2025'
),
(
    2,
    'внеплановая выездная',
    '789-ОД',
    '2025-04-10',
    'О проведении внеплановой выездной проверки',

    '77-П',
    '2025-04-12',

    '02-34/789',
    '2025-04-05',

    'ПР-2025-002',
    '2025-04-15',
    '2025-04-25',
    7,

    'Приказ о назначении представителя №5 от 10.04.2025'
);

INSERT INTO inspection_addresses (inspection_id, address)
VALUES
(1, 'г. Челябинск, ул. Ленина, д. 10'),
(1, 'г. Челябинск, ул. Кирова, д. 15'),
(2, 'г. Челябинск, ул. Свободы, д. 45');

INSERT INTO inspection_authorized_persons (inspection_id, full_name)
VALUES
(1, 'Петров Алексей Николаевич'),
(1, 'Сидорова Мария Ивановна'),
(2, 'Кузнецов Дмитрий Сергеевич');

INSERT INTO inspection_signatories (inspection_id, full_name)
VALUES
(1, 'Петров Алексей Николаевич'),
(2, 'Кузнецов Дмитрий Сергеевич');

INSERT INTO inspection_representatives (inspection_id, full_name)
VALUES
(1, 'Иванов Сергей Петрович'),
(2, 'Смирнова Елена Владимировна');
