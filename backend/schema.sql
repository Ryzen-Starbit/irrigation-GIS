CREATE TABLE villages (
  id TEXT PRIMARY KEY,            
  name TEXT NOT NULL,
  census_code TEXT,
  taluka TEXT, district TEXT
);

CREATE TABLE wuas (
  id TEXT PRIMARY KEY,            
  name TEXT NOT NULL,
  name_mr TEXT
);

CREATE TABLE canals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('main','branch','distributary','minor','subminor')),
  parent_id TEXT REFERENCES canals(id),
  offtake_rd_m REAL,             
  length_m REAL,
  geom TEXT
);

CREATE TABLE outlets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,             
  canal_id TEXT REFERENCES canals(id),
  chainage_m REAL,
  chak_no INTEGER UNIQUE,        
  wua_id TEXT REFERENCES wuas(id),
  is_tail INTEGER DEFAULT 0,
  reach TEXT,                     
  geom TEXT
);

CREATE TABLE gats (
  id TEXT PRIMARY KEY,           
  village_id TEXT REFERENCES villages(id),
  gat_no TEXT NOT NULL,
  in_command INTEGER DEFAULT 0,
  total_ha REAL, gca_ha REAL, pot_kharab_ha REAL, cca_ha REAL, ica_ha REAL,
  map_area_ha REAL,               
  shape_approx INTEGER DEFAULT 0, 
  record_pdf TEXT,               
  nearest_canal_id TEXT,          
  nearest_canal_m REAL,
  nearest_outlet_chak INTEGER,
  nearest_outlet_m REAL,
  geom TEXT
);

CREATE TABLE gat_chaks (
  gat_id TEXT REFERENCES gats(id),
  chak_no INTEGER REFERENCES outlets(chak_no),
  total_ha REAL, gca_ha REAL, pot_kharab_ha REAL, cca_ha REAL, ica_ha REAL,
  PRIMARY KEY (gat_id, chak_no)
);

CREATE TABLE owners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gat_id TEXT REFERENCES gats(id),
  name TEXT NOT NULL,             
  name_en TEXT,                   
  area_ha REAL,
  share_note TEXT,
  active INTEGER DEFAULT 1,       
  valid_from TEXT, valid_to TEXT
);

CREATE TABLE crops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gat_id TEXT REFERENCES gats(id),
  year TEXT NOT NULL,            
  season TEXT NOT NULL CHECK (season IN ('Kharif','Rabi','Hot weather')),
  crop TEXT NOT NULL,
  area_ha REAL,
  irrigation TEXT CHECK (irrigation IN ('Canal','Well','Rainfed')),
  data_source TEXT DEFAULT 'entered'  
);

CREATE TABLE structures (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,            
  name TEXT,
  canal_id TEXT REFERENCES canals(id),
  chainage_m REAL,
  year_built INTEGER,
  built_by TEXT,
  owner_office TEXT,
  cost_lakh REAL,
  condition TEXT CHECK (condition IN ('Good','Needs Repair','Damaged')),
  photo TEXT,
  location_source TEXT,           
  details_source TEXT,           
  geom TEXT
);

CREATE TABLE inspections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  structure_id TEXT REFERENCES structures(id),
  date TEXT NOT NULL,
  finding TEXT,
  repair_done TEXT,
  condition_after TEXT CHECK (condition_after IN ('Good','Needs Repair','Damaged')),
  inspected_by TEXT,
  data_source TEXT DEFAULT 'entered'
);

CREATE TABLE change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT DEFAULT (datetime('now')),
  entity TEXT, entity_id TEXT, action TEXT, detail TEXT
);

CREATE INDEX idx_crops_gat ON crops(gat_id, year, season);
CREATE INDEX idx_owners_gat ON owners(gat_id);
CREATE INDEX idx_gat_chaks_chak ON gat_chaks(chak_no);
