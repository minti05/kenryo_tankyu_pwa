// Generated public contract. Update through its owner; do not edit by hand.
export interface SearchWorkDto {
  favoriteCount?: number;
  isFavorite?: boolean;
  favoriteRevision?: number;
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
  contractVersion: "1";
  revision: string;
}

export interface SearchPageDto {
  version: "1";
  items: SearchWorkDto[];
  nextCursor: string | null;
  awardOverview?: AwardOverviewDto;
}

export interface SearchHistoryDto {
  id: string;
  parameters: string;
  searchedAt: string;
}

export interface SearchHistoryPageDto {
  version: "1";
  items: SearchHistoryDto[];
}

export interface SearchSuggestionDto {
  label: string;
  parameters: string;
  source: "history" | "theme" | "condition";
}

export interface SearchSuggestionsDto {
  version: "1";
  items: SearchSuggestionDto[];
}

export interface AwardOverviewDto {
  editions: { enterYear: number; count: number; }[];
  prizes: { awardType: number; count: number; }[];
  names: { name: string; count: number; }[];
}
