# Roster

دليل الوكالات: حط لينك الشركة، والموقع يسحب الوصف واللوجو والمنصات وأعداد المتابعين وتقييم Sortlist ويصنّفها لوحده.

- **الموقع:** Next.js على Vercel.
- **قاعدة البيانات وتسجيل الدخول:** Supabase.
- **السحب التلقائي:** GitHub Actions.

**كله على خطط مجانية.**

> لو فتحت الموقع قبل ما تربط Supabase، هيشتغل في **وضع العرض** ببيانات تجريبية، عشان تشوف الشكل.

---

## التشغيل لأول مرة (حوالي ٢٠ دقيقة)

### ١) Supabase: قاعدة البيانات

1. اعمل حساب على [supabase.com](https://supabase.com) واضغط **New project**. اختار اسم وباسورد قاعدة بيانات (احفظه)، وأقرب منطقة ليك.
2. من القائمة الجانبية افتح **SQL Editor**، واضغط **New query**.
3. افتح ملف [`supabase/schema.sql`](supabase/schema.sql) من الريبو، وانسخ محتواه كله، والصقه، واضغط **Run**.
4. في نفس المكان اعمل query جديدة بإيميلك إنت، واضغط Run:
   ```sql
   insert into team_members (email) values ('mohamada.designs@gmail.com');
   ```
5. افتح **Project Settings → API Keys** وانسخ حاجتين:
   - **Publishable key** (بيبدأ بـ `sb_publishable_`)
   - **Secret key** (بيبدأ بـ `sb_secret_`). ⚠️ ده سري، ما تحطوش في أي مكان غير GitHub Secrets.
6. انسخ كمان **Project URL** (زي `https://abcd.supabase.co`). هتلاقيه من زرار **Connect** فوق.

### ٢) GitHub: السحب التلقائي

1. في الريبو افتح **Settings → Secrets and variables → Actions**، واضغط **New repository secret**، وضيف اتنين:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | الـ Project URL |
   | `SUPABASE_SECRET_KEY` | الـ Secret key |

2. **اختياري، بس بيحسّن الدقة، وكله ببلاش:**

   | Name | تجيبه منين | فايدته |
   |---|---|---|
   | `YOUTUBE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com): فعّل YouTube Data API، وبعدها Credentials ← Create API key | أعداد مشتركين يوتيوب أدق |
   | `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | تصنيف أذكى للشركات |

3. **تجربة:** افتح تاب **Actions**، واختار **Fetch company data**، واضغط **Run workflow**. لازم يخلص بعلامة ✅.

### ٣) Vercel: نشر الموقع

1. اعمل حساب على [vercel.com](https://vercel.com) بحساب GitHub بتاعك.
2. اضغط **Add New → Project**، واختار الريبو **roster**، واضغط **Import**.
3. قبل Deploy، افتح **Environment Variables** وضيف:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | الـ Project URL |
   | `NEXT_PUBLIC_SUPABASE_KEY` | الـ Publishable key |
   | `GITHUB_REPO` | `mohamada01/roster` |

4. اضغط **Deploy**. هيديك لينك زي `roster-xxx.vercel.app`.

### ٤) خلّي السحب يبدأ فوراً لما تضيف لينك

من غير الخطوة دي، اللينكات الجديدة بتتسحب في التشغيل اليومي (الساعة ٤ الفجر بتوقيت القاهرة).

1. افتح [GitHub → Fine-grained tokens](https://github.com/settings/personal-access-tokens/new).
2. **Repository access:** اختار **Only select repositories**، وبعدها **roster**.
3. **Permissions → Repository permissions → Actions:** اختار **Read and write**.
4. اعمل التوكن وانسخه.
5. في Vercel افتح **Settings → Environment Variables**، وضيف `GITHUB_DISPATCH_TOKEN` وقيمته التوكن.
6. افتح **Deployments**، واضغط ⋯ على آخر نشر، واختار **Redeploy**.

### ٥) لينك تسجيل الدخول

1. في Supabase افتح **Authentication → URL Configuration**.
2. **Site URL:** حط لينك Vercel بتاعك.
3. **Redirect URLs:** ضيف نفس اللينك، وبعده `/**` (مثلاً `https://roster-xxx.vercel.app/**`).

**خلاص.** افتح الموقع، وادخل بإيميلك، وروح **لوحة التحكم**، والصق اللينكات.

---

## إزاي بيشتغل

1. تلصق اللينك في لوحة التحكم، فيتسجّل في قاعدة البيانات «في الطابور»، وGitHub Actions يبدأ.
2. السحب بيمشي على خمس مراحل:
   - **الموقع:** الاسم، والوصف **حرفياً** من meta description، واللوجو، ولينكات المنصات، والدولة، وسنة التأسيس. لو الموقع بيتحمّل بالجافاسكريبت، بيتقري بمتصفح كامل (Chromium).
   - **المنصات:** لينكات المنصات من الموقع.
   - **المتابعين:** من الصفحات العامة لكل منصة.
   - **Sortlist:** من لينك الشركة، أو من صفحة الوكالة لو لقاها بالاسم واتأكد إنها بتشاور على نفس الدومين.
   - **التصنيف:** من كلمات الموقع، أو من Gemini لو ضفت المفتاح.
3. **كل تحديث بيحفظ لقطة لأعداد المتابعين.** من اللقطات دي بيتحسب نمو ٣٠ يوم والرسم البياني، فالرقمين دول بيظهروا بعد كام تحديث.

## Instagram بالطريقة الرسمية (اختياري، ببلاش)

إنستجرام بيمنع أي قراءة آلية لصفحاته، والسيستم **مش بيحاول يتخطى ده**. الطريقة المجانية والمسموحة هي **Instagram Graph API** من Meta، وتحديداً ميزة Business Discovery. بتجيب عدد المتابعين والاسم والبايو والصورة لأي حساب Business أو Creator، وده حال أغلب الوكالات.

**المطلوب مرة واحدة:**
1. يكون عندك حساب Instagram **Professional** (Business أو Creator) ومربوط بصفحة Facebook.
2. اعمل App على [developers.facebook.com](https://developers.facebook.com/apps) من نوع Business، وضيف له منتج **Instagram Graph API**.
3. من [Graph API Explorer](https://developers.facebook.com/tools/explorer/) اعمل Access Token بالصلاحيات: `instagram_basic` و `pages_show_list` و `business_management`.
   - التوكن العادي بيخلص بعد ٦٠ يوم.
   - التوكن الدائم بيتعمل من **Business Settings ← System users**.
4. هات **Instagram Business Account ID** بتاعك من Graph API Explorer، بالطلب ده: `me/accounts?fields=instagram_business_account`.
5. ضيفهم في GitHub Secrets:
   - `INSTAGRAM_ACCESS_TOKEN`
   - `INSTAGRAM_BUSINESS_ID`

**بدون الخطوات دي:** عدد متابعين إنستجرام بيتكتب يدوي من «تعديل».

## حدود لازم تعرفها

- **أعداد المتابعين ببلاش، بس مش مضمونة ١٠٠٪.**
  - إنستجرام بيتقري بالـ API الرسمي بس (شوف القسم اللي فوق). فيسبوك ولينكدإن بيتقروا من الصفحة العامة لو متاحة.
  - لو موقع الشركة واقف أو معروض للبيع أو عليه حماية ضد البرامج الآلية، الاسم والنبذة واللوجو بييجوا من حساباتها على LinkedIn وTikTok وغيرهم.
  - X مفيش ليه طريقة مجانية خالص.
  - لو رقم ما اتسحبش، الشركة بتتعلّم «ناقصة»، وتقدر تكتب الرقم يدوي من **تعديل**. الرقم اليدوي بيتعلّم، والتحديث التلقائي مش بيكتب فوقه.
- **Supabase المجاني** بيوقف المشروع بعد ٧ أيام من غير أي نشاط. السحب اليومي بيلمس قاعدة البيانات كل يوم، فده مش هيحصل.
- **GitHub** بيوقف الجدولة اليومية في الريبوهات العامة بعد ٦٠ يوم من غير أي commit. هيبعتلك إيميل قبلها، وتشغّلها تاني بضغطة من تاب Actions.
- **خطة Vercel المجانية (Hobby)** مخصصة للاستخدام الشخصي وغير التجاري. لو الموقع بقى منتج تجاري للعامة، يا إما تنقل لخطة Pro، يا إما تنشره على Netlify أو Cloudflare Pages، والكود هو هو.
- **إيميلات الدخول** في Supabase المجاني ليها حد بسيط في الساعة. ده كفاية لتيم صغير.

## فتح الدليل للعامة

من لوحة التحكم، فعّل **«الدليل مفتوح للعامة»**.

أي حد معاه اللينك هيشوف الشركات المكتملة من غير دخول. لوحة التحكم والتعديل يفضلوا للتيم بس، وده مضمون من قاعدة البيانات نفسها (Row Level Security).

---

## For developers

```
app/                Next.js 14 App Router (directory, /company/[slug], /dashboard, /api/dispatch)
components/         UI (React, plain CSS in app/globals.css, Arabic RTL + English, dark/light)
lib/                i18n, types, link normalisation, Supabase client, demo data
supabase/schema.sql tables + RLS (team_members, settings, companies, snapshots, favorites)
scraper/            Node 22 scraper run by .github/workflows/fetch.yml
  site.mjs          homepage parser (cheerio) with Playwright fallback
  platforms.mjs     best-effort follower counts per platform
  sortlist.mjs      rating/reviews from JSON-LD
  classify.mjs      keyword classifier, optional Gemini
  run.mjs           MODE=queued|scheduled|all, COMPANY_ID=…
```

- Run locally: `npm install && npm run dev`. Without env vars the site runs in demo mode.
- Scraper tests: `cd scraper && npm install && npm test`.
- Descriptions are always stored verbatim. Manual edits live in `companies.overrides` and are never touched by the scraper.
