-- بيانات إعداد موثقة من مواصفات مشروع رفيقي. لا يتضمن الملف محتوى أكاديميًا تجريبيًا.
INSERT INTO levels (name_ar, sort_order)
SELECT v.name_ar, v.sort_order
FROM (VALUES ('المستوى الأول', 1), ('المستوى الثاني', 2), ('المستوى الثالث', 3), ('المستوى الرابع', 4)) AS v(name_ar, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM levels l WHERE l.sort_order = v.sort_order);

INSERT INTO community_categories (name_ar, slug, description)
SELECT v.name_ar, v.slug, v.description
FROM (VALUES
  ('أسئلة عامة', 'general', 'الأسئلة الأكاديمية العامة'),
  ('المحاسبة', 'accounting', 'مناقشات مواد المحاسبة'),
  ('الاقتصاد', 'economics', 'مناقشات الاقتصاد'),
  ('الإدارة', 'management', 'مناقشات الإدارة'),
  ('التسويق', 'marketing', 'مناقشات التسويق'),
  ('الرياضيات التجارية', 'business-math', 'مناقشات الرياضيات التجارية'),
  ('مناقشات حسب المستوى', 'levels', 'مناقشات المستويات الدراسية'),
  ('مناقشات حسب المادة', 'courses', 'مناقشات المواد'),
  ('مشاركة الملخصات', 'summaries', 'مشاركة الملخصات الدراسية'),
  ('المراجع التعليمية', 'references', 'مراجع ومصادر تعليمية'),
  ('الاستفسارات الأكاديمية', 'academic-questions', 'استفسارات أكاديمية منظمة')
) AS v(name_ar, slug, description)
WHERE NOT EXISTS (SELECT 1 FROM community_categories c WHERE c.slug = v.slug);

INSERT INTO telegram_channels (level_id, title, description, url, verified_at)
SELECT l.id, 'قناة ملخصات المستوى الأول', 'لم يُوفر رابط للمستوى الأول بعد.', NULL, NULL
FROM levels l WHERE l.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM telegram_channels t WHERE t.level_id = l.id);

INSERT INTO telegram_channels (level_id, title, description, url, verified_at)
SELECT l.id, 'قناة ملخصات المستوى الثاني', 'قناة Telegram المقدمة لطلاب المستوى الثاني.', 'https://t.me/USF_Hodida_accounting_2', NOW()
FROM levels l WHERE l.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM telegram_channels t WHERE t.level_id = l.id);

INSERT INTO telegram_channels (level_id, title, description, url, verified_at)
SELECT l.id, 'قناة ملخصات المستوى الثالث', 'قناة Telegram المقدمة لطلاب المستوى الثالث.', 'https://t.me/USF_Hodida_accounting_33', NOW()
FROM levels l WHERE l.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM telegram_channels t WHERE t.level_id = l.id);

INSERT INTO telegram_channels (level_id, title, description, url, verified_at)
SELECT l.id, 'قناة ملخصات المستوى الرابع', 'قناة Telegram المقدمة لطلاب المستوى الرابع.', 'https://t.me/USF_Hodida_accounting_4', NOW()
FROM levels l WHERE l.sort_order = 4
AND NOT EXISTS (SELECT 1 FROM telegram_channels t WHERE t.level_id = l.id);

INSERT INTO app_settings (key, value, is_public)
VALUES
  ('support_contact', '{"owner":"فاروق مقبول الوصابي","whatsapp":"+967781504539","email":"mtwklalyamdy@gmail.com"}'::jsonb, true),
  ('copyright', '{"text":"© 2026 فاروق مقبول الوصابي — جميع الحقوق محفوظة"}'::jsonb, true),
  ('external_services', '{"push":"not_configured","ai":"requires_GEMINI_API_KEY","email":"requires_SMTP","speech":"uses_Gemini_when_configured"}'::jsonb, false)
ON CONFLICT (key) DO NOTHING;
