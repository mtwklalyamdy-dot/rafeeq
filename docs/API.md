# واجهة رفيقي البرمجية

جميع الاستجابات JSON عدا تنزيل الملفات. المصادقة cookie باسم `rafeeq_session`، HttpOnly وSameSite=Lax. أخطاء الصلاحية 401/403، التحقق 400، التعارض 409، ومحدودية المعدل 429.

## الحساب
- `POST /api/auth/register`: الاسم والبريد وكلمتا المرور والجامعة والكلية والتخصص والمستوى والفصل ونوع الحساب.
- `POST /api/auth/verify`: البريد وOTP والغرض.
- `POST /api/auth/resend`, `/forgot-password`, `/reset-password`, `/login`, `/logout`.
- `GET /api/auth/me` و`GET|PUT|DELETE /api/profile`.

## الدراسة
- `GET|POST /api/courses`؛ POST للإدارة.
- `GET /api/content?q=&courseId=&kind=`.
- `GET /api/assignments` و`POST /api/assignments/:id/submit`.
- `GET /api/exams` و`GET|POST /api/exams/:id/attempt`.
- `GET /api/grades`, `GET|POST /api/calendar`, `GET /api/telegram`.
- `GET|POST /api/dictionary`؛ POST للإدارة.

## الملفات والمزامنة
- `POST /api/files` multipart باسم `file`، حد 12MB.
- `GET /api/files/:id` بعد فحص الملكية/النشر.
- `GET|POST /api/notes`, `PUT|DELETE /api/notes/:id`.
- `POST /api/sync` حتى 50 عملية ومعرف UUID ثابت لكل عملية.

## المجتمع والدعم
- `GET|POST /api/community`; تفاصيل وتعديل المنشور `/api/community/posts/:id`.
- الردود `/comments` والإعجاب والحفظ والحل والبلاغ `/actions`.
- `GET|POST /api/support/tickets` و`GET|POST /api/support/conversations`.

## AI
- `POST /api/ai/chat`: رسالة ونوع `academic|accounting|support`.
- `POST /api/ai/summarize`: نص أو `fileId` مملوك ونوع الملخص.
- `POST /api/ai/transcribe`: `fileId` صوتي مملوك واللغة.

لا تعيد المسارات نتيجة مصطنعة عند غياب Gemini؛ تعيد 503. ولا يظهر OTP في أي استجابة.

## الأدوار
- `/api/admin*`: مدير فقط.
- `/api/representative*`: مندوب موثق ومعتمد؛ يستطيع إنشاء مادة مرتبطة بمستواه أو العمل على مادة مسندة. النشر تحت `/publish` والتعديل تحت `/manage`، مع منع الدرجات والحسابات.
- الطالب لا يستطيع درجات الآخرين أو حلولهم أو محادثات دعمهم.
