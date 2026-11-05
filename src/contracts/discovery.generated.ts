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
  category1: "community" | "humanities" | "society" | "economy" | "environment" | "agriculture" | "nature" | "technology" | "education" | "sports" | "food_life" | "mind_body" | "entertainment" | "arts" | "other" | "history" | "rights" | "international" | "business" | "industry" | "science" | "health" | "art" | "life";
  subCategory1: "community-01" | "community-02" | "community-03" | "community-04" | "community-05" | "community-06" | "community-urban-living" | "community-crime-prevention" | "humanities-01" | "humanities-02" | "humanities-03" | "humanities-04" | "humanities-05" | "humanities-06" | "society-01" | "society-02" | "society-03" | "society-04" | "society-05" | "society-06" | "society-07" | "economy-01" | "economy-02" | "economy-03" | "economy-04" | "economy-05" | "economy-08" | "environment-01" | "environment-02" | "environment-03" | "environment-04" | "environment-05" | "environment-06" | "agriculture" | "agriculture-01" | "agriculture-02" | "agriculture-03" | "agriculture-04" | "agriculture-05" | "agriculture-06" | "agriculture-07" | "nature-01" | "nature-02" | "nature-03" | "nature-04" | "nature-05" | "nature-06" | "nature-07" | "technology-01" | "technology-02" | "technology-03" | "technology-04" | "technology-05" | "technology-06" | "technology-07" | "technology-08" | "technology-09" | "technology-10" | "education" | "education-01" | "education-02" | "education-03" | "education-04" | "education-05" | "education-06" | "sports" | "sports-01" | "sports-02" | "sports-03" | "sports-04" | "sports-05" | "food_life-01" | "food_life-02" | "food_life-03" | "food_life-04" | "food_life-05" | "food_life-07" | "food_life-08" | "food_life-09" | "mind_body-01" | "mind_body-02" | "mind_body-03" | "mind_body-04" | "mind_body-nutrition" | "mind_body-body-care" | "mind_body-vision" | "mind_body-06" | "mind_body-07" | "mind_body-08" | "mind_body-09" | "mind_body-growth" | "entertainment-music-culture" | "entertainment-literature" | "entertainment-screen" | "entertainment-stage" | "entertainment-character" | "entertainment-games" | "entertainment-media" | "entertainment-fandom" | "entertainment-leisure" | "entertainment-comedy" | "arts-composition" | "arts-performance" | "arts-music-use" | "arts-drawing" | "arts-appreciation" | "arts-color" | "arts-information-design" | "arts-photography" | "arts-craft" | "disasterPrevention" | "sightseeing" | "traffic" | "communication" | "regionalRevitalization" | "other" | "history" | "foreignLanguage" | "religion" | "psychology" | "philosophy" | "culture" | "literature" | "subculture" | "words" | "rights" | "gender" | "poverty" | "peace" | "diversity" | "difficulties" | "nursing" | "international" | "compareOtherCountries" | "business" | "marketing" | "administration" | "law" | "aquaCulture" | "forestry" | "secondaryIndustry" | "childCare" | "studies" | "ecosystem" | "climateChange" | "pollution" | "recycle" | "otherProblem" | "mathematics" | "chemistry" | "physics" | "ecology" | "geology" | "app" | "architecture" | "manufacturing" | "ictAndAI" | "energy" | "health" | "beauty" | "medicalCare" | "sleep" | "mentalHealth" | "art" | "industryDesign" | "music" | "fashion" | "food" | "schoolLife" | "book" | "lifeHack" | "fragrance" | "pet" | "love" | "enlightenment";
  category2: import("./catalog.generated").CategoryId | "none";
  subCategory2: import("./catalog.generated").SubcategoryId | "none";
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
