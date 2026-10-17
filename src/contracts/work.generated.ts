// Generated public contract. Update through its owner; do not edit by hand.
export const CONTRACT_VERSION = "1" as const;
export type DocumentType = "slide" | "report" | "poster" | "thesis";
export interface WorkDto {
  contractVersion: "1";
  likes: number;
  revision: string;
  documentID: string;
  title: string;
  author: string;
  enterYear: number;
  course: "tankyu" | "general";
  eventName: "localLearning" | "individualTankyu";
  category1: "society" | "other" | "history" | "rights" | "international" | "business" | "industry" | "education" | "environment" | "science" | "technology" | "health" | "art" | "life";
  subCategory1: "disasterPrevention" | "sightseeing" | "traffic" | "communication" | "regionalRevitalization" | "other" | "history" | "foreignLanguage" | "religion" | "psychology" | "philosophy" | "culture" | "literature" | "subculture" | "words" | "rights" | "gender" | "poverty" | "peace" | "diversity" | "difficulties" | "nursing" | "international" | "compareOtherCountries" | "business" | "marketing" | "administration" | "law" | "agriculture" | "aquaCulture" | "forestry" | "secondaryIndustry" | "education" | "sports" | "childCare" | "studies" | "ecosystem" | "climateChange" | "pollution" | "recycle" | "otherProblem" | "mathematics" | "chemistry" | "physics" | "ecology" | "geology" | "app" | "architecture" | "manufacturing" | "ictAndAI" | "energy" | "health" | "beauty" | "medicalCare" | "sleep" | "mentalHealth" | "art" | "industryDesign" | "music" | "fashion" | "food" | "schoolLife" | "book" | "lifeHack" | "fragrance" | "pet" | "love" | "enlightenment";
  category2: "society" | "other" | "history" | "rights" | "international" | "business" | "industry" | "education" | "environment" | "science" | "technology" | "health" | "art" | "life" | "none";
  subCategory2: "disasterPrevention" | "sightseeing" | "traffic" | "communication" | "regionalRevitalization" | "other" | "history" | "foreignLanguage" | "religion" | "psychology" | "philosophy" | "culture" | "literature" | "subculture" | "words" | "rights" | "gender" | "poverty" | "peace" | "diversity" | "difficulties" | "nursing" | "international" | "compareOtherCountries" | "business" | "marketing" | "administration" | "law" | "agriculture" | "aquaCulture" | "forestry" | "secondaryIndustry" | "education" | "sports" | "childCare" | "studies" | "ecosystem" | "climateChange" | "pollution" | "recycle" | "otherProblem" | "mathematics" | "chemistry" | "physics" | "ecology" | "geology" | "app" | "architecture" | "manufacturing" | "ictAndAI" | "energy" | "health" | "beauty" | "medicalCare" | "sleep" | "mentalHealth" | "art" | "industryDesign" | "music" | "fashion" | "food" | "schoolLife" | "book" | "lifeHack" | "fragrance" | "pet" | "love" | "enlightenment" | "none";
  existsSlide: boolean;
  existsReport: boolean;
  existsPoster: boolean;
  existsThesis: boolean;
  awardType?: 1 | 2 | 3 | 4;
  awardName?: string;
  summary?: string;
}
