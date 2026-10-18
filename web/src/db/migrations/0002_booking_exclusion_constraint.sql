ALTER TABLE booking_resources
  ADD CONSTRAINT booking_resources_no_overlap
  EXCLUDE USING gist (resource_id WITH =, during WITH &&) WHERE (active);
