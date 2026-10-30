export interface PortfolioProject {
  id: string;
  title: string;
  titleAm?: string | null;
  platform: "YouTube" | "Reel";
  description?: string;
  descriptionAm?: string | null;
  thumbnailUrl: string;
  videoUrl?: string;
  youtubeId?: string;
  linkUrl?: string;
}

export const LONG_FORM_PROJECTS: PortfolioProject[] = [
  {
    id: "lf-4",
    title: "ከ 8 ወር ቦሀላ የምወደው ሀገር ተመለስኩ",
    titleAm: "ከ 8 ወር ቦሀላ የምወደው ሀገር ተመለስኩ",
    platform: "YouTube",
    description:
      "Returned to his beloved homeland after eight months abroad — a quiet homecoming told through familiar places.",
    descriptionAm:
      "ከ ሰሜን ዓለም 8 ወር ከ ቍጣው በኋላ ለዘላለሙ ለሀገሩ ተመለሱ፣ በተማሪነት በጥላ እና በደስታ እንደተመለሱ ታሪክ።",
    thumbnailUrl: "https://i.ytimg.com/vi/Jx8sE6lVu3A/hqdefault.jpg",
    youtubeId: "Jx8sE6lVu3A",
    linkUrl: "https://youtu.be/Jx8sE6lVu3A",
  },
  {
    id: "lf-1",
    title: "በ 17 አመቴ የራሴን ብራንድ መሰረትኩ 🤩 / Clothing Brand",
    titleAm: "በ 17 አመት የራሱን ብራንድ መሰረት / Clothing Brand",
    platform: "YouTube",
    description:
      "A founder story following a 17-year-old from the first idea to the launch of his clothing brand.",
    descriptionAm:
      "ተማሪ ከተመረገዘ 17 ዓመት ደግሞ ከመጀመሪያ የሚያስቡት እስከ አድራጊቱ እስከ በትር ተማሪው ብራንዱ.",
    thumbnailUrl: "https://i.ytimg.com/vi/sncn1ALnzW8/hqdefault.jpg",
    youtubeId: "sncn1ALnzW8",
    linkUrl: "https://youtu.be/sncn1ALnzW8",
  },
  {
    id: "lf-2",
    title: "48 Hours in Arba Minch 🐊",
    titleAm: "48 ሰዓት በአርባ ምንጭ",
    platform: "YouTube",
    description:
      "A two-day trip through Arba Minch, shaped into a fast-moving travel story.",
    descriptionAm: "ሁለት ቀን በአርባ ምንጭ የተነሳሽ ባህላዊ ተማሪ ታሪክ.",
    thumbnailUrl: "https://i.ytimg.com/vi/5LEJMiHsOAs/hqdefault.jpg",
    youtubeId: "5LEJMiHsOAs",
    linkUrl: "https://youtu.be/5LEJMiHsOAs",
  },
  {
    id: "lf-3",
    title: "ልብስ ሸመታ ከጀማው ጋር ft. Nahom Astu",
    titleAm: "ልብስ ሸመታ ከጀማው ጋር ft. Nahom Astu",
    platform: "YouTube",
    description:
      "A community give-back with Nahom Astu, captured through interviews and street footage.",
    descriptionAm:
      "በንሆም አስቱው ጋር የሕዝብ ዝቅተኛ ድርጊት፣ በመድኃኒትና በገበራ ተማሪ የተገለጹትን ቪዲዮ.",
    thumbnailUrl: "https://i.ytimg.com/vi/OJpFNPgr06Q/hqdefault.jpg",
    youtubeId: "OJpFNPgr06Q",
    linkUrl: "https://youtu.be/OJpFNPgr06Q",
  },
];
