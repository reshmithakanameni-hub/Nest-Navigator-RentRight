'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

// Database initialization and seed data are isolated from HTTP routing.
const ROOT = path.resolve(__dirname, '..');
const DB_FILE = path.resolve(process.env.DB_PATH || path.join(ROOT, 'data', 'nestnavigator.sqlite'));
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, area TEXT NOT NULL, city TEXT NOT NULL,
    rent INTEGER NOT NULL CHECK(rent >= 0), deposit INTEGER NOT NULL CHECK(deposit >= 0),
    bhk INTEGER NOT NULL CHECK(bhk BETWEEN 1 AND 5), furnishing TEXT NOT NULL,
    pets INTEGER NOT NULL DEFAULT 0, parking INTEGER NOT NULL DEFAULT 0,
    maintenance INTEGER NOT NULL DEFAULT 0 CHECK(maintenance >= 0), size INTEGER NOT NULL DEFAULT 0,
    image TEXT NOT NULL, description TEXT NOT NULL, owner_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    role TEXT NOT NULL CHECK(role IN ('tenant','owner')), salt TEXT NOT NULL,
    password_hash TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY, property_id INTEGER NOT NULL, name TEXT NOT NULL,
    email TEXT NOT NULL, visit_date TEXT NOT NULL, visit_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'REQUESTED'
      CHECK(status IN ('REQUESTED','CONFIRMED','DECLINED','COMPLETED')),
    created_at TEXT NOT NULL, updated_at TEXT,
    FOREIGN KEY(property_id) REFERENCES properties(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS shortlists (
    user_id TEXT NOT NULL, property_id INTEGER NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(user_id, property_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(property_id) REFERENCES properties(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS rate_limits (
    bucket_hash TEXT PRIMARY KEY, window_start INTEGER NOT NULL,
    request_count INTEGER NOT NULL CHECK(request_count > 0)
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, actor_id TEXT,
    detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(event, created_at);
  -- Two live requests cannot hold the same property/date/time slot, even under concurrent writers.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_active_slot
    ON visits(property_id, visit_date, visit_time) WHERE status IN ('REQUESTED','CONFIRMED');
  CREATE INDEX IF NOT EXISTS idx_properties_area ON properties(area);
  CREATE INDEX IF NOT EXISTS idx_properties_rent ON properties(rent);
  CREATE INDEX IF NOT EXISTS idx_visits_property ON visits(property_id);
  CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
`);
// The schema is idempotent; version 1 is the relational baseline, version 2 adds
// persistent hashed request counters shared by processes using this SQLite file,
// version 3 adds an append-only security audit log, and version 4 adds a
// unique index so the database itself prevents double-booked visit slots.
// Version 5 adds single-use password reset tokens (stored as SHA-256 digests) and
// version 6 adds latitude/longitude so listings can be searched on a map.
const propertyColumns = db.prepare('PRAGMA table_info(properties)').all().map(column => column.name);
if (!propertyColumns.includes('lat')) db.exec('ALTER TABLE properties ADD COLUMN lat REAL');
if (!propertyColumns.includes('lng')) db.exec('ALTER TABLE properties ADD COLUMN lng REAL');
db.exec('INSERT OR IGNORE INTO schema_migrations(version) VALUES (1), (2), (3), (4), (5), (6)');
db.exec('PRAGMA user_version = 6');
const seed = [
[1,'The Fern Residence','Whitefield','Bengaluru',25000,100000,2,'Semi-furnished',1,1,3000,1120,'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80','Bright living room and a practical kitchen.'],
[2,'Olive Grove Apartments','Sarjapur Road','Bengaluru',32000,128000,3,'Furnished',0,1,3500,1450,'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80','Family apartment with generous daylight.'],
[3,'The Courtyard Studio','Kondapur','Hyderabad',14500,45000,1,'Furnished',1,0,1200,620,'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80','Compact studio for simple city living.'],
[4,'Maple Heights','Gachibowli','Hyderabad',28000,90000,2,'Semi-furnished',0,1,2500,1180,'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80','Spacious two-bedroom home near offices.'],
[5,'Palm Springs Home','Miyapur','Hyderabad',19000,60000,2,'Unfurnished',1,1,1800,980,'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80','Airy apartment with room to personalize.'],
[6,'Cedar Park Living','Hitech City','Hyderabad',38000,150000,3,'Furnished',1,1,4000,1580,'https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=900&q=80','Larger furnished home with ample storage.'],
[7,'Lakeview Nest','Manikonda','Hyderabad',22000,70000,2,'Semi-furnished',0,1,2000,1050,'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80','Calm residential setting and useful layout.'],
[8,'The Urban Nook','Madhapur','Hyderabad',17000,55000,1,'Semi-furnished',0,0,1500,700,'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=900&q=80','Neat one-bedroom city base.'],
[9,'Sandalwood Enclave','Nallagandla','Hyderabad',30000,110000,3,'Semi-furnished',1,1,2800,1370,'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80','Family-sized apartment with balanced rooms.'],
[10,'Amber House','Kukatpally','Hyderabad',12500,40000,1,'Unfurnished',1,0,1000,580,'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80','Budget-friendly one-bedroom option.'],
[11,'Willow Court','Jubilee Hills','Hyderabad',42000,180000,3,'Furnished',0,1,4500,1650,'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80','Premium furnished residence.'],
[12,'Meadow Lane','Chandanagar','Hyderabad',16000,50000,2,'Unfurnished',1,1,1400,900,'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80','Practical two-bedroom home.']
];
const count = db.prepare('SELECT COUNT(*) AS n FROM properties').get().n;
if (!count) {
  const insert = db.prepare(`INSERT INTO properties
    (id,name,area,city,rent,deposit,bhk,furnishing,pets,parking,maintenance,size,image,description)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN IMMEDIATE');
  try { seed.forEach(row => insert.run(...row)); db.exec('COMMIT'); }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

// Approximate neighbourhood centres for the sample listings (not exact addresses).
const COORDINATES = { 1: [12.9698, 77.7500], 2: [12.9100, 77.6870], 3: [17.4600, 78.3570], 4: [17.4401, 78.3489],
  5: [17.4967, 78.3590], 6: [17.4435, 78.3772], 7: [17.4047, 78.3869], 8: [17.4485, 78.3908],
  9: [17.4730, 78.3070], 10: [17.4948, 78.3996], 11: [17.4326, 78.4071], 12: [17.4940, 78.3250] };
const setCoordinates = db.prepare('UPDATE properties SET lat = ?, lng = ? WHERE id = ? AND lat IS NULL');
for (const [id, [lat, lng]] of Object.entries(COORDINATES)) setCoordinates.run(lat, lng, Number(id));

module.exports = { db, DB_FILE };
