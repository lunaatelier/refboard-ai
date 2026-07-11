// Phase 5(디자인 MD 렌더러) 개발·테스트용 목업 데이터.
// 실제 Phase 4 컨셉 생성도 ConceptOption.designBasis를 채운다. 이 파일은
// 외부 AI 호출 없이 Phase 5 렌더러를 검증하기 위한 고정 fixture다.
//
// ⚠️ 이 파일은 프로덕션 경로에서 import되지 않는다. Phase 5 렌더러 작업 시 fixture로만 사용할 것.

import type {
  ConceptJsonWithDesignBasis,
  ConceptOptionWithDesignBasis,
  ConceptOutputSelection,
} from "./types";
import type { Palette } from "../reference/types";

const trustLightPalette: Palette = {
  mode: "light",
  primary: "#2563EB",
  secondary: "#64748B",
  accent: "#0EA5E9",
  background: "#FFFFFF",
  surface: "#F7F8FA",
  text: "#1C1F24",
  navigation: "#FFFFFF",
};

const dashboardDarkPalette: Palette = {
  mode: "dark",
  primary: "#3B82F6",
  secondary: "#94A3B8",
  accent: "#38BDF8",
  background: "#0F1115",
  surface: "#171A21",
  text: "#E8EAED",
  navigation: "#12151B",
};

const minimalLightPalette: Palette = {
  mode: "light",
  primary: "#334155",
  secondary: "#94A3B8",
  accent: "#2563EB",
  background: "#FFFFFF",
  surface: "#F8FAFC",
  text: "#1C1F24",
  navigation: "#FFFFFF",
};

const outputSelection: ConceptOutputSelection = {
  visualRepresentativePageId: "p1",
  contentRepresentativePageId: "p2",
  includedSubPageIds: ["p3"],
  outputPreset: "proposal",
};

const optionA: ConceptOptionWithDesignBasis = {
  optionId: "opt-1",
  label: "A안 — 신뢰의 블루",
  conceptKeywords: [
    {
      no: "01",
      title: "사용성 (Usability)",
      category: "UX Strategy | 사용자 경험 중심",
      description:
        "핵심 태스크(포털 로그인 후 결재·일정 확인)까지의 클릭 수를 최소화해 임직원이 바로 업무에 진입하게 한다.",
    },
    {
      no: "02",
      title: "일관성 (Consistency)",
      category: "Design System | 컴포넌트 재사용",
      description: "카드·배지·버튼 스타일을 전 화면에 동일한 토큰으로 통일한다.",
    },
    {
      no: "03",
      title: "신뢰감 (Trust)",
      category: "Visual Identity | 안정감 있는 블루 계열",
      description: "채도 있는 블루를 주조색으로 사용해 공적 신뢰감을 형성한다.",
    },
  ],
  designBasis: {
    palette: trustLightPalette,
    moodKeywords: ["신뢰감 있는", "정돈된", "차분한"],
    typographyDirection: "굵은 제목 + 중립적인 산세리프 본문, 여백을 넉넉히",
  },
  uiStructure: {
    mode: "light",
    navPosition: "top",
    infoStructure: "GNB 상단 고정 + 대시보드 카드 그리드",
    layoutConcept: "밝은 배경에 카드 단위로 정보를 나누는 정돈형 레이아웃",
  },
  keyVisual: {
    imageTone: "밝고 채도 있는 블루 톤",
    illustrationStyle: "플랫 일러스트",
    backgroundPattern: "옅은 그리드 패턴",
    decorativeElements: "둥근 모서리 카드, 얇은 보더",
  },
  pages: [
    {
      pageId: "p1",
      pageTitle: "표지",
      sections: [
        {
          sectionId: "p1-s1",
          sectionTitle: "표지",
          contentType: "hero",
          layoutPattern: "hero",
          contentMapping: {
            maskedContent: "[회사A] 사내 포털 리뉴얼",
            sourceSectionId: "p1-s1",
            targetArea: "hero-title",
          },
        },
      ],
    },
    {
      pageId: "p2",
      pageTitle: "대시보드",
      sections: [
        {
          sectionId: "p2-s1",
          sectionTitle: "대시보드 화면",
          contentType: "feature",
          layoutPattern: "card-grid",
          contentMapping: {
            maskedContent:
              "공지사항·결재 현황·일정·조직도 바로가기 4개 위젯을 드래그로 재배치 가능한 카드 그리드",
            sourceSectionId: "p2-s1",
            targetArea: "feature-card",
          },
        },
      ],
    },
    {
      pageId: "p3",
      pageTitle: "결재",
      sections: [
        {
          sectionId: "p3-s1",
          sectionTitle: "결재 시스템",
          contentType: "feature",
          layoutPattern: "table",
          contentMapping: {
            maskedContent: "기안함·결재함·참조함 3탭 + 상태별 필터링",
            sourceSectionId: "p3-s1",
            targetArea: "table",
          },
        },
      ],
    },
  ],
};

const optionB: ConceptOptionWithDesignBasis = {
  optionId: "opt-2",
  label: "B안 — 다크 대시보드",
  conceptKeywords: [
    {
      no: "01",
      title: "몰입감 (Focus)",
      category: "UX Strategy | 장시간 모니터링",
      description: "어두운 배경으로 시각적 피로를 낮추고 데이터 시각화 요소를 강조한다.",
    },
    {
      no: "02",
      title: "정보 밀도 (Density)",
      category: "Layout | 집약형",
      description: "여러 위젯을 한 화면에 밀도 있게 배치해 스크롤을 최소화한다.",
    },
    {
      no: "03",
      title: "즉시성 (Immediacy)",
      category: "Visual Identity | 하이라이트 컬러",
      description: "경고·상태 뱃지 색을 배경과 강하게 대비시켜 즉각 인지되게 한다.",
    },
  ],
  designBasis: {
    palette: dashboardDarkPalette,
    moodKeywords: ["몰입감 있는", "집약적인", "선명한"],
    typographyDirection: "숫자·지표 강조용 모노스페이스 보조 서체, 본문은 산세리프",
  },
  uiStructure: {
    mode: "dark",
    navPosition: "left",
    infoStructure: "좌측 LNB 고정 + 우측 위젯 스택",
    layoutConcept: "어두운 배경에 위젯을 밀도 있게 배치하는 집약형 레이아웃",
  },
  keyVisual: {
    imageTone: "짙은 남색 배경에 하이라이트 블루",
    illustrationStyle: "3D",
    backgroundPattern: "미세한 그리드 라인",
    decorativeElements: "네온톤 상태 뱃지, 그로우 효과",
  },
  pages: [
    {
      pageId: "p1",
      pageTitle: "표지",
      sections: [
        {
          sectionId: "p1-s1",
          sectionTitle: "표지",
          contentType: "hero",
          layoutPattern: "hero",
          contentMapping: {
            maskedContent: "[회사A] 사내 포털 리뉴얼",
            sourceSectionId: "p1-s1",
            targetArea: "hero-title",
          },
        },
      ],
    },
    {
      pageId: "p2",
      pageTitle: "대시보드",
      sections: [
        {
          sectionId: "p2-s1",
          sectionTitle: "대시보드 화면",
          contentType: "feature",
          layoutPattern: "stat-band",
          contentMapping: {
            maskedContent: "결재 대기·금일 일정·조직 공지 수치를 상단 스탯 밴드로 요약",
            sourceSectionId: "p2-s1",
            targetArea: "stat-band",
          },
        },
      ],
    },
    {
      pageId: "p3",
      pageTitle: "결재",
      sections: [
        {
          sectionId: "p3-s1",
          sectionTitle: "결재 시스템",
          contentType: "feature",
          layoutPattern: "table",
          contentMapping: {
            maskedContent: "기안함·결재함·참조함 3탭 + 상태별 필터링",
            sourceSectionId: "p3-s1",
            targetArea: "table",
          },
        },
      ],
    },
  ],
};

const optionC: ConceptOptionWithDesignBasis = {
  optionId: "opt-3",
  label: "C안 — 미니멀 그레이스케일",
  conceptKeywords: [
    {
      no: "01",
      title: "절제 (Restraint)",
      category: "Visual Identity | 저채도 중심",
      description: "채도를 낮춘 뉴트럴 톤을 기본으로 하고 포인트 컬러만 절제해 사용한다.",
    },
    {
      no: "02",
      title: "가독성 (Readability)",
      category: "Typography | 여백 중심",
      description: "넉넉한 여백과 명확한 위계로 텍스트 가독성을 우선한다.",
    },
    {
      no: "03",
      title: "확장성 (Scalability)",
      category: "Design System | 컴포넌트 최소화",
      description: "컴포넌트 종류를 최소화해 신규 화면 추가 시 일관성을 유지하기 쉽게 한다.",
    },
  ],
  designBasis: {
    palette: minimalLightPalette,
    moodKeywords: ["절제된", "차분한", "군더더기 없는"],
    typographyDirection: "타이틀·본문 모두 중립 산세리프, 굵기 대비로만 위계 구분",
  },
  uiStructure: {
    mode: "light",
    navPosition: "top",
    infoStructure: "GNB 상단 + 여백 중심 리스트형",
    layoutConcept: "저채도 뉴트럴 톤에 포인트 컬러를 절제해 쓰는 미니멀 레이아웃",
  },
  keyVisual: {
    imageTone: "그레이스케일 + 블루 포인트",
    illustrationStyle: "사진",
    backgroundPattern: "무지",
    decorativeElements: "얇은 디바이더, 최소 아이콘",
  },
  pages: [
    {
      pageId: "p1",
      pageTitle: "표지",
      sections: [
        {
          sectionId: "p1-s1",
          sectionTitle: "표지",
          contentType: "hero",
          layoutPattern: "hero",
          contentMapping: {
            maskedContent: "[회사A] 사내 포털 리뉴얼",
            sourceSectionId: "p1-s1",
            targetArea: "hero-title",
          },
        },
      ],
    },
    {
      pageId: "p2",
      pageTitle: "대시보드",
      sections: [
        {
          sectionId: "p2-s1",
          sectionTitle: "대시보드 화면",
          contentType: "feature",
          layoutPattern: "text-list",
          contentMapping: {
            maskedContent: "공지·결재·일정·조직도 바로가기를 여백 중심 리스트로 정렬",
            sourceSectionId: "p2-s1",
            targetArea: "feature-card",
          },
        },
      ],
    },
    {
      pageId: "p3",
      pageTitle: "결재",
      sections: [
        {
          sectionId: "p3-s1",
          sectionTitle: "결재 시스템",
          contentType: "feature",
          layoutPattern: "table",
          contentMapping: {
            maskedContent: "기안함·결재함·참조함 3탭 + 상태별 필터링",
            sourceSectionId: "p3-s1",
            targetArea: "table",
          },
        },
      ],
    },
  ],
};

export const mockConceptJson: ConceptJsonWithDesignBasis = {
  projectTitle: "[회사A] 사내 포털 리뉴얼",
  options: [optionA, optionB, optionC],
  outputSelection,
};
