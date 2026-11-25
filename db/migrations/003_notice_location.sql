-- ApplyHome can supply a street address without a district code.
ALTER TABLE complexes ALTER COLUMN district_id DROP NOT NULL;
