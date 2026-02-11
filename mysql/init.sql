SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE act (
    id INT AUTO_INCREMENT PRIMARY KEY,

    created_by TEXT,
    updated_by TEXT,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE act_organization (
    act_id INT PRIMARY KEY,

    organization_full_name TEXT NOT NULL,
    organization_short_name TEXT,
    organization_ogrn VARCHAR(15) NOT NULL,
    organization_legal_address TEXT NOT NULL,
    organization_postal_address TEXT,

    CONSTRAINT fk_act_organization
        FOREIGN KEY (act_id) REFERENCES act(id) ON DELETE CASCADE
);

CREATE TABLE act_head (
    act_id INT PRIMARY KEY,

    leader_position TEXT NOT NULL,
    leader_last_name TEXT NOT NULL,
    leader_first_name TEXT NOT NULL,
    leader_middle_name TEXT,
    leader_initials_name_im TEXT,
    leader_initials_name_dat TEXT,

    CONSTRAINT fk_act_head
        FOREIGN KEY (act_id) REFERENCES act(id) ON DELETE CASCADE
);

CREATE TABLE act_inspection (
    act_id INT PRIMARY KEY,

    inspection_type ENUM(
        'плановая документарная',
        'плановая выездная',
        'внеплановая документарная',
        'внеплановая выездная'
    ) NOT NULL,

    minzdrav_order_number TEXT,
    minzdrav_order_date DATETIME,
    minzdrav_order_name TEXT,

    chomiaz_order_number TEXT,
    chomiaz_order_date DATETIME,

    letter_number TEXT,
    letter_date DATETIME,

    inspection_number TEXT,
    date_start DATETIME,
    date_end DATETIME,
    date_early_end DATETIME,
    duration_work_days INT,

    representative_document TEXT,

    -- JSON-массивы
    addresses JSON NOT NULL DEFAULT (JSON_ARRAY()),
    authorized_persons JSON NOT NULL DEFAULT (JSON_ARRAY()),
    signatories JSON NOT NULL DEFAULT (JSON_ARRAY()),
    representatives JSON NOT NULL DEFAULT (JSON_ARRAY()),

    CONSTRAINT fk_act_inspection
        FOREIGN KEY (act_id) REFERENCES act(id) ON DELETE CASCADE
);

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fio TEXT NOT NULL,
    login VARCHAR(255) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'user'
);

CREATE TABLE employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fio TEXT NOT NULL
);

CREATE TABLE info (
    shortcut TEXT,
    definition TEXT,
    description TEXT,
    templates JSON NOT NULL DEFAULT (JSON_ARRAY())
);

CREATE TABLE field (
    act_id INT NOT NULL,
    field1 TEXT,
    field2 TEXT,
    field3 TEXT,
    field4 TEXT,
    CONSTRAINT fk_field_act
        FOREIGN KEY (act_id) REFERENCES act(id) ON DELETE CASCADE
);

CREATE TABLE verification_areas_store (
    id INT PRIMARY KEY,
    payload JSON NOT NULL DEFAULT (JSON_ARRAY()),
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO users (fio, login, password, role)
VALUES
('Администратор', 'admin', 'admin', 'admin'),
('Петрова Анна Сергеевна', 'petrova', 'user123', 'user');
