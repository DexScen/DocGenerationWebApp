CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- Таблица act
-- =========================================

CREATE TABLE act (
    id SERIAL PRIMARY KEY,

    -- Организация
    organization_full_name TEXT NOT NULL,
    organization_short_name TEXT,
    organization_ogrn VARCHAR(15) NOT NULL,
    organization_legal_address TEXT NOT NULL,
    organization_postal_address TEXT,

    -- Руководитель
    leader_position TEXT NOT NULL,
    leader_last_name TEXT NOT NULL,
    leader_first_name TEXT NOT NULL,
    leader_middle_name TEXT,
    leader_initials_name_im TEXT,
    leader_initials_name_dat TEXT,

    -- Основные поля проверки
    inspection_type TEXT NOT NULL CHECK (
        inspection_type IN (
            'плановая документарная',
            'плановая выездная',
            'внеплановая документарная',
            'внеплановая выездная'
        )
    ),

    minzdrav_order_number TEXT,
    minzdrav_order_date TIMESTAMPTZ,
    minzdrav_order_name TEXT,

    chomiaz_order_number TEXT,
    chomiaz_order_date TIMESTAMPTZ,

    letter_number TEXT,
    letter_date TIMESTAMPTZ,

    inspection_number TEXT,
    date_start TIMESTAMPTZ,
    date_end TIMESTAMPTZ,
    date_early_end TIMESTAMPTZ,
    duration_work_days INTEGER,

    representative_document TEXT,

    -- Массивы
    addresses TEXT[] DEFAULT '{}'::TEXT[],
    authorized_persons TEXT[] DEFAULT '{}'::TEXT[],
    signatories TEXT[] DEFAULT '{}'::TEXT[],
    representatives TEXT[] DEFAULT '{}'::TEXT[],

    -- Конкурентный доступ
    created_by TEXT,
    updated_by TEXT,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_at TIMESTAMPTZ,
    locked_by TEXT,

    -- Временные метки
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Триггер на updated_at
CREATE TRIGGER trg_act_updated
BEFORE UPDATE ON act
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    fio TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE info (
    shortcut TEXT,
    definition TEXT,
    description TEXT,
    templates TEXT[] DEFAULT '{}'::TEXT[]
);

CREATE TABLE field (
    act_id INTEGER NOT NULL REFERENCES act(id) ON DELETE CASCADE,
    field1 TEXT,
    field2 TEXT,
    field3 TEXT,
    field4 TEXT
);

INSERT INTO users (fio, login, password, role)
VALUES
('Администратор', 'admin', 'admin', 'admin'),
('Петрова Анна Сергеевна', 'petrova', 'user123', 'user');

INSERT INTO act (
    organization_full_name,
    organization_short_name,
    organization_ogrn,
    organization_legal_address,
    organization_postal_address,
    leader_position,
    leader_last_name,
    leader_first_name,
    leader_middle_name,
    inspection_type,
    minzdrav_order_number,
    minzdrav_order_date,
    inspection_number,
    date_start,
    date_end,
    duration_work_days,
    letter_number,
    letter_date,
    representative_document,
    addresses,
    authorized_persons,
    signatories,
    representatives,
    created_by,
    updated_by
)
VALUES
(
    'Тест 1',
    'Тест 1',
    'Тест 1',
    'Тест 1',
    'Тест 1',
    'Главный врач',
    'Тест 1',
    'Тест 1',
    'Тест 1',
    'плановая документарная',
    '123-ОД',
    '2025-03-01',
    'ПР-2025-001',
    '2025-03-10',
    '2025-03-20',
    8,
    'Тест 1',
    '2025-02-20',
    'Тест 1',
    ARRAY['Тест 1'],
    ARRAY['Петров Алексей Николаевич', 'Сидорова Мария Ивановна'],
    ARRAY['Петров Алексей Николаевич'],
    ARRAY['Иванов Сергей Петрович'],
    'Иванов Иван Иванович',
    'Иванов Иван Иванович'
),
(
    'Тест 2',
    'Тест 2',
    'Тест 2',
    'Тест 2',
    'Тест 2',
    'Главный врач',
    'Тест 2',
    'Тест 2',
    'Тест 2',
    'плановая документарная',
    '123-ОД',
    '2025-04-10',
    'ПР-2025-002',
    '2025-04-15',
    '2025-04-25',
    7,
    '02-34/789',
    '2025-04-05',
    'Тест 2',
    ARRAY['Тест 2'],
    ARRAY['Кузнецов Дмитрий Сергеевич'],
    ARRAY['Кузнецов Дмитрий Сергеевич'],
    ARRAY['Смирнова Елена Владимировна'],
    'Петрова Анна Сергеевна',
    'Петрова Анна Сергеевна'
);
