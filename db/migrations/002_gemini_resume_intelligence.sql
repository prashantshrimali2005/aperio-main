ALTER TABLE resumes ADD COLUMN IF NOT EXISTS document_type text;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS validation_confidence numeric(4,3);
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS parsed_data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS processing_provider text NOT NULL DEFAULT 'local';
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS processing_warnings jsonb NOT NULL DEFAULT '[]'::jsonb;
