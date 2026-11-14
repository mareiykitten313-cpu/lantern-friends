CREATE POLICY "Members view chat photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-photos' AND public.is_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "Members upload chat photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-photos' AND owner = auth.uid() AND public.is_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "Owners delete chat photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-photos' AND owner = auth.uid());