# PRCS Community Health (CWD)
نظام إدارة خدمات الصحة المجتمعية للهلال الأحمر الفلسطيني، مجهز للنشر على Coolify مع PostgreSQL.

## Included
- Arabic RTL dashboard
- 13 foundational community-health services
- Beneficiaries, tasks and referrals data model
- Dynamic multi-page form builder
- Conditional question/page logic data model
- Immutable form versions and submissions
- Users, roles and permissions foundation
- Docker/Coolify deployment

## Coolify
Set `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `POSTGRES_PASSWORD` as secrets in Coolify. Never commit production secrets.
The application initializes schema and foundational services on startup.