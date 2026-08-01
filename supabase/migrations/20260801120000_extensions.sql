-- Core extensions required by the schema.
-- pgcrypto: gen_random_uuid() for primary keys.
-- postgis:  geography(Point, 4326) column + spatial queries on moves.location.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;
