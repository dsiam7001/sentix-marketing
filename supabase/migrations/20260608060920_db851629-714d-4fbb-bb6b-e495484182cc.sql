
CREATE POLICY "users read own refs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'creative-references' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users upload own refs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'creative-references' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users delete own refs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'creative-references' AND (storage.foldername(name))[1] = auth.uid()::text);
