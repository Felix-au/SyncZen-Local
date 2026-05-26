import mariadb from 'mariadb'

let pool: mariadb.Pool | null = null

export function getPool(): mariadb.Pool {
  if (!pool) {
    pool = mariadb.createPool({
      host: '127.0.0.1',
      port: 3307,
      user: 'root',
      password: '',
      database: 'hotel_checkin',
      connectionLimit: 10,
      connectTimeout: 5000,
    })
  }
  return pool
}

export async function initDatabase(): Promise<void> {
  const conn = await getPool().getConnection()
  try {
    // Ensure the database exists
    await conn.query(`CREATE DATABASE IF NOT EXISTS hotel_checkin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    await conn.query(`USE hotel_checkin`)

    // ROOMS table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        room_number  VARCHAR(20)    NOT NULL UNIQUE,
        room_type    VARCHAR(50)    NOT NULL DEFAULT 'Standard',
        floor        INT            NOT NULL DEFAULT 1,
        status       ENUM('available','occupied','maintenance','checkout') NOT NULL DEFAULT 'available',
        price_per_night DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        notes        TEXT,
        created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    // BOOKING_GROUPS table — one per check-in group
    await conn.query(`
      CREATE TABLE IF NOT EXISTS booking_groups (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        booking_reference VARCHAR(20)  NOT NULL UNIQUE,
        check_in_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        check_out_date    DATE         NOT NULL,
        id_proof_path     VARCHAR(500),
        status            ENUM('checked_in','checked_out','cancelled') NOT NULL DEFAULT 'checked_in',
        notes             TEXT,
        created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    // GUESTS table — one per person in the group
    await conn.query(`
      CREATE TABLE IF NOT EXISTS guests (
        id                 INT AUTO_INCREMENT PRIMARY KEY,
        group_id           INT          NOT NULL,
        name               VARCHAR(255) NOT NULL,
        age                INT,
        sex                ENUM('male','female','other'),
        photo_path         VARCHAR(500),
        is_primary_contact BOOLEAN      NOT NULL DEFAULT FALSE,
        created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES booking_groups(id) ON DELETE CASCADE
      )
    `)

    // ROOM_ALLOCATIONS table — links groups to rooms
    await conn.query(`
      CREATE TABLE IF NOT EXISTS room_allocations (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        group_id    INT  NOT NULL,
        room_id     INT  NOT NULL,
        allocated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES booking_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id)  REFERENCES rooms(id) ON DELETE RESTRICT,
        UNIQUE KEY unique_room_booking (room_id, group_id)
      )
    `)

    console.log('[DB] Schema initialized/verified successfully.')
  } finally {
    conn.release()
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
