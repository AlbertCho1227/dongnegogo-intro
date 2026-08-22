export type BlogFact = {
  label: string;
  value: string;
};

export type BlogSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  dek: string;
  category: "교육" | "문화·전시" | "체육";
  region: string;
  audience: string;
  readingMinutes: number;
  publishedAt: string;
  modifiedAt: string;
  sourceCheckedAt: string;
  programId: string;
  programName: string;
  programStatus: string;
  officialUrl: string;
  sourceName: string;
  accent: "lime" | "violet" | "blue";
  iconPath: string;
  imageAlt: string;
  intro: string[];
  facts: BlogFact[];
  takeaway: string;
  sections: BlogSection[];
  tags: string[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "bupyeong-free-kids-ai-coding-class",
    title: "인천 부평 무료 어린이 AI 코딩 강좌, 레고로 시작하는 첫 코딩",
    seoTitle: "인천 부평 무료 어린이 AI 코딩 강좌 신청 가이드 | 동네고고",
    description: "부평도서관에서 열리는 무료 어린이 AI 코딩 강좌의 대상, 일정, 신청 마감일과 보호자가 확인할 준비 사항을 한눈에 정리했습니다.",
    dek: "화면 속 문법부터 외우는 수업보다, 손으로 조립한 결과물이 움직이는 경험이 먼저 필요한 아이에게 어울리는 무료 강좌를 살펴봅니다.",
    category: "교육",
    region: "인천 부평구",
    audience: "아동·보호자",
    readingMinutes: 4,
    publishedAt: "2026-08-22T09:10:00+09:00",
    modifiedAt: "2026-08-22T09:10:00+09:00",
    sourceCheckedAt: "2026-08-22",
    programId: "program:lifelong_standard:b3e1e044badc7e8e",
    programName: "레고 스파티크프라임과 알티노라이트로 배우는 AI 코딩",
    programStatus: "접수중",
    officialUrl: "https://lib.ice.go.kr/bupyeong",
    sourceName: "전국평생학습강좌표준데이터",
    accent: "lime",
    iconPath: "/markers/icon_digital.png",
    imageAlt: "어린이 디지털 교육을 상징하는 동네고고 아이콘",
    intro: [
      "아이의 첫 코딩 수업을 찾을 때 가장 먼저 볼 것은 ‘어떤 언어를 배우나’보다 ‘직접 만들어 보는 시간이 충분한가’입니다. 인천광역시교육청 부평도서관에서 열리는 이 강좌는 레고 스파이크 프라임과 알티노라이트를 활용해 작품을 만들고 코딩으로 완성하는 오프라인 수업입니다.",
      "동네고고에 등록된 공개 정보를 기준으로 수강료는 무료, 대상은 아동, 정원은 10명입니다. 소규모 수업을 찾는 보호자에게 특히 눈에 띄지만, 연령 범위와 준비물은 신청 전에 운영기관 공지를 한 번 더 확인하는 편이 안전합니다.",
    ],
    facts: [
      { label: "장소", value: "인천광역시교육청 부평도서관 나래울실" },
      { label: "수업 기간", value: "2026년 9월 3일~10월 29일" },
      { label: "수업 시간", value: "매주 목요일 16:00~18:00" },
      { label: "신청 마감", value: "2026년 8월 28일 23:59 예정" },
      { label: "대상·정원", value: "아동 · 10명" },
      { label: "비용", value: "무료" },
    ],
    takeaway: "무료·소규모·오프라인이라는 세 조건이 장점입니다. 아이가 목요일 오후에 꾸준히 참여할 수 있는지부터 확인하세요.",
    sections: [
      {
        heading: "이 강좌가 첫 코딩에 잘 맞는 이유",
        paragraphs: [
          "처음 코딩을 접하는 아이는 화면의 정답보다 자신이 만든 구조물이 실제로 반응하는 순간에 더 쉽게 몰입합니다. 레고 조립과 코딩을 연결하면 ‘명령을 바꾸면 결과도 달라진다’는 원리를 눈으로 확인할 수 있습니다. 결과물이 바로 보이기 때문에 틀리는 과정도 실패라기보다 다음 시도를 위한 단서가 됩니다.",
          "다만 교구를 쓴다는 이유만으로 모든 아이에게 쉬운 것은 아닙니다. 두 시간 수업에 집중할 수 있는지, 조립 활동을 좋아하는지, 여러 주 동안 같은 요일에 참여할 수 있는지를 함께 살펴보면 중도 이탈 가능성을 줄일 수 있습니다.",
        ],
      },
      {
        heading: "보호자가 신청 전에 확인할 네 가지",
        paragraphs: [
          "공개 데이터에는 핵심 일정과 대상이 담겨 있지만, 실제 접수 화면에는 학년 기준이나 결석 규정처럼 더 구체적인 조건이 추가될 수 있습니다. 신청 버튼을 누르기 전에 아래 항목을 확인해 두세요.",
        ],
        bullets: [
          "정확한 참여 학년과 보호자 동반 여부",
          "레고 교구 제공 여부와 개인 준비물",
          "총 수업 횟수, 휴강일, 결석 시 보강 가능 여부",
          "도서관 회원가입이나 별도 본인인증 필요 여부",
        ],
      },
      {
        heading: "이런 아이에게 추천해요",
        paragraphs: [
          "블록 조립을 좋아하지만 코딩 학원은 아직 부담스러운 아이, 화면 수업보다 손으로 만드는 활동에 오래 집중하는 아이, 완성품보다 시행착오 자체를 즐기는 아이에게 좋은 출발점이 될 수 있습니다. 반대로 정해진 순서대로 조립하는 활동을 답답해하거나 목요일 오후 일정이 자주 바뀌는 가정이라면 단기 체험형 수업부터 시작하는 편이 낫습니다.",
          "검색할 때는 ‘부평 어린이 코딩’만 입력하기보다 ‘인천 무료 어린이 코딩’, ‘부평도서관 초등 AI 강좌’처럼 지역·비용·대상을 함께 넣으면 비슷한 프로그램을 더 빠르게 비교할 수 있습니다. 동네고고 지도에서도 교육 아이콘과 무료 조건을 함께 보면 이동 가능한 후보를 좁히기 쉽습니다.",
        ],
      },
    ],
    tags: ["인천 어린이 코딩", "부평도서관 강좌", "무료 AI 교육", "초등 코딩"],
  },
  {
    slug: "cheongju-picture-book-garden-exhibition-guide",
    title: "청주 무료 그림책 전시, 《빛나는 아이들, 이수지의 그림책》 관람 가이드",
    seoTitle: "청주 무료 그림책 전시 관람 가이드 | 그림책정원1937 | 동네고고",
    description: "청주 그림책정원1937에서 진행 중인 무료 기획전시의 기간, 위치와 아이와 함께 보기 전 알아둘 관람 포인트를 정리했습니다.",
    dek: "아이와 무엇을 봐야 할지 미리 정답을 만들기보다, 한 장면 앞에서 서로 다른 이야기를 발견하는 시간을 준비해 보세요.",
    category: "문화·전시",
    region: "충북 청주시",
    audience: "가족·그림책 독자",
    readingMinutes: 5,
    publishedAt: "2026-08-22T10:20:00+09:00",
    modifiedAt: "2026-08-22T10:20:00+09:00",
    sourceCheckedAt: "2026-08-22",
    programId: "program:cultureinfo_events:8757defd82494239",
    programName: "그림책정원1937 2026년 1차 기획전시 《빛나는 아이들, 이수지의 그림책》",
    programStatus: "진행중",
    officialUrl: "https://www.cbfc.or.kr/home/sub.php?menukey=6444&mod=view&no=2335867",
    sourceName: "한국문화정보원 한눈에 보는 문화정보",
    accent: "violet",
    iconPath: "/markers/icon_exhibition.png",
    imageAlt: "문화 전시를 상징하는 동네고고 아이콘",
    intro: [
      "그림책 전시는 ‘아이를 위한 전시’로만 생각하기 쉽지만, 같은 장면을 어른과 아이가 전혀 다르게 읽는다는 점에서 가족 대화의 좋은 출발점이 됩니다. 청주 그림책정원1937에서는 2026년 첫 기획전시로 《빛나는 아이들, 이수지의 그림책》을 진행하고 있습니다.",
      "동네고고가 확인한 공개 정보상 전시는 8월 4일부터 11월 8일까지이며 관람료는 무료입니다. 전시의 세부 구성과 휴관일, 입장 가능 시간은 방문일에 따라 달라질 수 있으므로 출발 전 공식 안내를 확인하세요.",
    ],
    facts: [
      { label: "장소", value: "그림책정원1937" },
      { label: "주소", value: "충북 청주시 상당구 상당로 82" },
      { label: "전시 기간", value: "2026년 8월 4일~11월 8일" },
      { label: "상태", value: "진행중" },
      { label: "관람료", value: "무료" },
      { label: "문의", value: "043-299-9366" },
    ],
    takeaway: "무료로 여유 있게 볼 수 있는 장기 전시입니다. 휴관일과 당일 운영시간만 확인하면 가족 나들이 일정에 넣기 좋습니다.",
    sections: [
      {
        heading: "그림책 전시는 어떻게 보면 좋을까요?",
        paragraphs: [
          "책을 읽을 때는 페이지 순서가 관람의 리듬을 정하지만, 전시장에서는 관람자가 순서와 거리를 선택합니다. 아이가 한 장면 앞에 오래 머물면 다음 작품으로 재촉하기보다 ‘무엇이 먼저 보였어?’라고 물어보세요. 작품의 의미를 맞히는 질문보다 관찰한 것을 말하게 하는 질문이 더 오래 기억에 남습니다.",
          "전시 제목에 담긴 ‘빛나는 아이들’이라는 표현도 좋은 대화 소재입니다. 전시장에 들어가기 전 아이에게 빛난다는 말이 어떤 색과 표정으로 떠오르는지 묻고, 관람 뒤 답이 달라졌는지 비교해 보세요. 작품의 세부 내용을 미리 단정하지 않으면서도 관람 경험을 풍성하게 만드는 방법입니다.",
        ],
      },
      {
        heading: "아이와 갈 때 챙기면 좋은 것",
        paragraphs: [
          "무료 전시는 예약 없이 갈 수 있는 경우가 많지만, 단체 관람이나 특별 프로그램이 있는 날에는 동선이 달라질 수 있습니다. 유아와 함께라면 관람 시간도 길게 잡기보다 짧은 집중 시간을 여러 번 나누는 편이 편안합니다.",
        ],
        bullets: [
          "방문 당일 운영시간과 휴관 여부",
          "주차장 또는 대중교통 하차 지점",
          "유모차 이동 가능 구간과 물품 보관 공간",
          "연계 체험·도슨트 프로그램의 별도 예약 여부",
        ],
      },
      {
        heading: "전시 뒤에도 경험을 이어가는 방법",
        paragraphs: [
          "관람을 마친 뒤에는 가장 마음에 든 장면을 서로 한 문장으로 말해 보세요. 아이가 고른 장면을 어른이 다시 설명하고, 어른이 고른 장면을 아이가 설명하게 하면 같은 전시가 두 개의 이야기로 남습니다. 집에 돌아와 ‘오늘 본 전시의 다음 페이지’를 한 장 그려 보는 것도 부담 없는 후속 활동입니다.",
          "청주에서 다른 가족 문화행사까지 함께 찾고 싶다면 ‘청주 무료 전시’, ‘청주 아이와 갈 만한 곳’, ‘상당구 문화행사’처럼 지역과 방문 목적을 조합해 보세요. 동네고고에서는 전시·미술 아이콘을 중심으로 주변 프로그램과 거리를 함께 비교할 수 있습니다.",
        ],
      },
    ],
    tags: ["청주 무료 전시", "그림책정원1937", "아이와 청주", "이수지 그림책"],
  },
  {
    slug: "seoul-junggu-chungmu-swimming-pool-checklist",
    title: "서울 중구 수영장 찾기, 충무스포츠센터 접수 전 확인할 6가지",
    seoTitle: "서울 중구 충무스포츠센터 수영장 접수 가이드 | 동네고고",
    description: "충무스포츠센터 수영장 이용을 알아보는 분을 위해 접수 기간, 위치, 비용 확인법과 강습 선택 체크리스트를 정리했습니다.",
    dek: "가까운 수영장을 발견한 다음에는 시간표, 비용, 강습 단계와 이동 시간을 함께 비교해야 실제로 꾸준히 다닐 수 있습니다.",
    category: "체육",
    region: "서울 중구",
    audience: "생활체육 입문자",
    readingMinutes: 4,
    publishedAt: "2026-08-22T11:30:00+09:00",
    modifiedAt: "2026-08-22T11:30:00+09:00",
    sourceCheckedAt: "2026-08-22",
    programId: "program:reservations:57d9eeabbbe79473",
    programName: "[서울 중구] 충무스포츠센터 수영장",
    programStatus: "접수중",
    officialUrl: "https://www.e-junggu.or.kr/fmcs/314?action=list&facilities_type=C&base_date=20260701&center=JUNGGU01&type=&part=02&place=6",
    sourceName: "서울시 공공서비스예약(종합) 정보",
    accent: "blue",
    iconPath: "/markers/icon_swimming.png",
    imageAlt: "수영 생활체육을 상징하는 동네고고 아이콘",
    intro: [
      "수영장은 집이나 직장에서 가깝다는 이유만으로 고르기 어렵습니다. 원하는 시간대에 자리가 있는지, 자유수영인지 강습인지, 내 수준에 맞는 반이 있는지를 함께 봐야 등록 뒤에도 꾸준히 다닐 수 있습니다.",
      "동네고고 공개 데이터에서 충무스포츠센터 수영장은 현재 접수중으로 확인되며, 이용 기간은 2026년 8월 31일까지로 표시되어 있습니다. 비용은 유료이지만 강습별 금액과 잔여 인원은 공식 예약 화면에서 최종 확인해야 합니다.",
    ],
    facts: [
      { label: "시설", value: "충무스포츠센터 수영장" },
      { label: "지역", value: "서울 중구" },
      { label: "이용 기간", value: "2026년 7월 21일~8월 31일" },
      { label: "접수 마감", value: "2026년 8월 31일 00:00 예정" },
      { label: "대상", value: "제한없음으로 등록" },
      { label: "비용", value: "유료 · 반별 금액 확인 필요" },
    ],
    takeaway: "접수중 표시는 출발점입니다. 원하는 반의 잔여석·정확한 시간·월 이용료를 공식 페이지에서 확인한 뒤 결제하세요.",
    sections: [
      {
        heading: "등록 전에 꼭 비교할 여섯 가지",
        paragraphs: [
          "생활체육은 프로그램의 유명세보다 생활 동선과의 궁합이 중요합니다. 지도상 거리가 짧아도 환승이나 퇴근 시간 혼잡 때문에 체감 이동 시간이 길 수 있습니다. 아래 항목을 한 화면에 적어 두면 비슷한 시설을 비교하기 쉬워집니다.",
        ],
        bullets: [
          "자유수영·강습 구분과 초급·중급 등 난이도",
          "입수 시간뿐 아니라 탈의·샤워 시간을 포함한 전체 소요시간",
          "월 이용료, 등록 수수료, 할인 대상과 증빙서류",
          "신규 회원 접수일과 기존 회원 재등록 기간",
          "준비물, 수영모 규정, 개인 사물함 이용 조건",
          "집·직장에서 실제 출발 시간 기준 대중교통과 도보 거리",
        ],
      },
      {
        heading: "‘대상 제한없음’이 모든 반에 적용되지는 않아요",
        paragraphs: [
          "공공 데이터의 대상 항목은 시설 전체를 넓게 설명하는 경우가 있습니다. 실제 강습은 연령, 수영 수준, 성별 또는 이용 시간에 따라 반이 나뉠 수 있습니다. ‘제한없음’만 보고 바로 결제하지 말고 선택한 반의 상세 조건을 확인하세요.",
          "처음 배우는 경우에는 수업 이름보다 진도 기준을 물어보는 것이 정확합니다. 물 적응부터 시작하는지, 자유형 호흡을 어느 정도 할 수 있어야 하는지, 첫날 레벨 확인이 있는지를 문의하면 자신에게 맞지 않는 반을 고를 가능성이 줄어듭니다.",
        ],
      },
      {
        heading: "가까운 수영장을 더 잘 찾는 검색법",
        paragraphs: [
          "‘서울 수영장’처럼 넓게 검색하면 결과가 너무 많습니다. ‘중구 저녁 수영 강습’, ‘충무스포츠센터 자유수영’, ‘퇴근 후 수영장’처럼 지역·시간·이용 방식을 함께 입력하세요. 후보가 두세 곳으로 줄면 거리순보다 실제 출발 시간 기준의 이동 시간을 비교하는 것이 좋습니다.",
          "동네고고 지도에서는 수영 아이콘을 선택한 뒤 현재 위치와 시설 간 거리를 확인할 수 있습니다. 접수 상태가 바뀌거나 정원이 먼저 찰 수 있으므로, 마음에 드는 프로그램은 공식 페이지에서 즉시 잔여석을 확인하는 습관이 가장 확실합니다.",
        ],
      },
    ],
    tags: ["서울 중구 수영장", "충무스포츠센터", "생활체육", "수영 강습"],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function koreanDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function blogPostUrl(post: BlogPost): string {
  return `https://www.dongnegogo.com/blog/${post.slug}`;
}
