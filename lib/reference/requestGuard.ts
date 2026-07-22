// 늦은 비동기 응답이 최신 상태를 덮어쓰지 않게 막는 공용 가드 (P10-A) — 화면마다
// 따로 hash를 비교하는 대신, "리소스가 통째로 교체될 때마다 오르는 세대 번호
// (epoch)" 하나로 통일한다. key별로 epoch와 in-flight AbortController를 관리한다.
//
// 사용 패턴:
//   const guard = useRef(new RequestGuard()).current;
//   ...
//   const { epoch, signal } = guard.begin("directions"); // 이전 in-flight 취소 + epoch 증가
//   const data = await fetch(url, { signal });
//   if (!guard.isCurrent("directions", epoch)) return; // 늦은 응답 — 조용히 버림
//   setState(data);
//
// 같은 key로 새 begin()이 호출되면(방향 3안 재생성, 커스텀 컬러로 재생성 등
// "리소스 전체 교체" 지점) 이전에 그 key로 캡처된 epoch는 전부 무효가 되고,
// 그 key의 in-flight 요청은 AbortController로 즉시 취소된다(§P10 "대체 요청
// 발생 시 이전 요청 취소").
export class RequestGuard {
  private epochs = new Map<string, number>();
  private controllers = new Map<string, AbortController>();

  begin(key: string): { epoch: number; signal: AbortSignal } {
    this.controllers.get(key)?.abort();
    const controller = new AbortController();
    this.controllers.set(key, controller);
    const next = (this.epochs.get(key) ?? 0) + 1;
    this.epochs.set(key, next);
    return { epoch: next, signal: controller.signal };
  }

  isCurrent(key: string, epoch: number): boolean {
    return epoch === (this.epochs.get(key) ?? 0);
  }

  // 모든 key의 in-flight 요청을 취소하고, 이미 캡처된 epoch를 전부 무효화한다
  // (P10-A 보완) — 컴포넌트가 언마운트될 때(예: 다른 탭으로 이동) useEffect
  // cleanup에서 호출한다. 이걸 안 하면 탭을 떠난 뒤에도 이전 요청이 늦게 도착해
  // onChange로 상위 상태(ReferenceResult)를 조용히 덮어쓸 수 있다 — epoch만
  // 보고 있는 건 "같은 컴포넌트 안에서 새 요청이 시작됐는지"만 판정하지,
  // "컴포넌트 자체가 사라졌는지"는 판정하지 못하기 때문이다.
  cancelAll(): void {
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
    for (const [key, value] of this.epochs) {
      this.epochs.set(key, value + 1);
    }
  }
}
