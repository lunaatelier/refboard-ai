// tsc의 "paths"(@/* -> ./*)는 타입 체크에만 적용되고 컴파일된 JS의 require() 문자열은
// 그대로 남는다 — Node가 실행할 때 "@/lib/masking/apply" 같은 require를 풀 방법이
// 없어서 여기서 tsconfig-paths로 런타임 매핑을 등록한다(P2.1, 컴포넌트 테스트 도입).
// 컴파일 산출물이 .test-dist 아래 원본과 동일한 구조로 미러링되므로, @/* 를 소스가
// 아니라 .test-dist/* 로 매핑해야 한다.
const path = require("path");
const { register } = require("tsconfig-paths");

register({
  baseUrl: path.join(__dirname, "..", ".test-dist"),
  paths: { "@/*": ["*"] },
});
