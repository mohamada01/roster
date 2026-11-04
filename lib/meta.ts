export type Lang = 'ar' | 'en';
type L = Record<Lang, string>;

export const CATS: Record<string, L> = {
  creative: { ar: 'وكالة إبداعية متكاملة', en: 'Full-service Creative' },
  performance: { ar: 'تسويق رقمي وأداء', en: 'Digital & Performance' },
  branding: { ar: 'هوية وبراندينج', en: 'Branding & Identity' },
  video: { ar: 'إنتاج فيديو', en: 'Video Production' },
  web: { ar: 'مواقع ومنتجات رقمية', en: 'Web & Product' },
  social: { ar: 'سوشيال ميديا', en: 'Social Media' },
  pr: { ar: 'علاقات عامة', en: 'PR & Comms' },
  none: { ar: 'لم تُصنّف بعد', en: 'Not classified yet' }
};

export const COUNTRIES: Record<string, L> = {
  EG: { ar: 'مصر', en: 'Egypt' }, SA: { ar: 'السعودية', en: 'Saudi Arabia' }, AE: { ar: 'الإمارات', en: 'UAE' },
  GB: { ar: 'بريطانيا', en: 'UK' }, QA: { ar: 'قطر', en: 'Qatar' }, KW: { ar: 'الكويت', en: 'Kuwait' },
  JO: { ar: 'الأردن', en: 'Jordan' }, LB: { ar: 'لبنان', en: 'Lebanon' }, BH: { ar: 'البحرين', en: 'Bahrain' },
  OM: { ar: 'عُمان', en: 'Oman' }, MA: { ar: 'المغرب', en: 'Morocco' }, US: { ar: 'أمريكا', en: 'USA' }
};
export const countryName = (k: string, lang: Lang) => (COUNTRIES[k] ? COUNTRIES[k][lang] : k);

export const PLATS: Record<string, { ab: string; n: string }> = {
  linkedin: { ab: 'in', n: 'LinkedIn' }, instagram: { ab: 'IG', n: 'Instagram' }, facebook: { ab: 'f', n: 'Facebook' },
  x: { ab: 'X', n: 'X' }, tiktok: { ab: 'TT', n: 'TikTok' }, youtube: { ab: 'YT', n: 'YouTube' },
  behance: { ab: 'Bē', n: 'Behance' }, dribbble: { ab: 'Dr', n: 'Dribbble' }
};
export const PLAT_KEYS = Object.keys(PLATS);

export const ISSUES: Record<string, L> = {
  site_unreachable: { ar: 'الموقع ما فتحش، حتى بالمتصفح الكامل.', en: 'The website would not load, even in a full browser.' },
  site_no_description: { ar: 'الموقع ما فيهوش وصف مكتوب في الصفحة.', en: 'The website has no description in its page.' },
  no_website: { ar: 'مفيش موقع للشركة، وإنستجرام منع قراءة البايو. اضغط «تعديل» وحط لينك الموقع في خانة «الموقع».', en: 'No website found, and Instagram blocked reading the bio. Click Edit and put the site link in the Website field.' },
  followers_blocked: { ar: 'المنصات منعت قراءة أعداد المتابعين. تقدر تكتبها يدوي من «تعديل».', en: 'The platforms blocked reading follower counts. You can type them in from Edit.' },
  followers_some_missing: { ar: 'بعض المنصات ما رجّعتش عدد المتابعين. تقدر تكتبه يدوي من «تعديل».', en: 'Some platforms did not return a follower count. You can type it in from Edit.' },
  site_parked: { ar: 'الدومين معروض للبيع ومش موقع الشركة. البيانات اتاخدت من حساباتها على السوشيال.', en: 'The domain is parked or for sale, not the company site. Data was taken from its social profiles.' },
  site_blocked: { ar: 'الموقع عليه حماية ضد البرامج الآلية، فما قريناهوش. البيانات اتاخدت من حساباتها على السوشيال.', en: 'The website has bot protection, so we did not read it. Data was taken from its social profiles.' },
  site_down: { ar: 'الموقع واقف أو بيرجّع خطأ. البيانات اتاخدت من حساباتها على السوشيال.', en: 'The website is down or returns an error. Data was taken from its social profiles.' },
  site_empty: { ar: 'الموقع لسه «قريباً» ومفيهوش محتوى. البيانات اتاخدت من حساباتها على السوشيال.', en: 'The website is a "coming soon" page. Data was taken from its social profiles.' },
  error: { ar: 'حصل خطأ غير متوقع أثناء السحب. جرّب تاني.', en: 'Something went wrong while fetching. Try again.' }
};

export const DEMO_REASON: L = {
  ar: 'ده وضع العرض. لما تربط Supabase، البيانات هتتسحب من اللينك ده بجد.',
  en: 'This is demo mode. Once Supabase is connected, data will be fetched from this link for real.'
};
