-- The vector map: a 2-D PCA of the library's chunk vectors, fitted by `make seed`.
CREATE TABLE map_projection (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    mean double precision[] NOT NULL,
    pc1 double precision[] NOT NULL,
    pc2 double precision[] NOT NULL
);

CREATE TABLE map_points (
    chunk_id bigint PRIMARY KEY REFERENCES chunks (id) ON DELETE CASCADE,
    x double precision NOT NULL,
    y double precision NOT NULL
);
