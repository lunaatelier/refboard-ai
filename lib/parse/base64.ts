// Uint8Array → base64. btoa는 브라우저/Worker/Node(18+) 어디서나 전역으로
// 존재해 별도 폴리필 없이 isomorphic하게 쓸 수 있다.
// String.fromCharCode(...bytes)를 통짜로 넘기면 큰 배열에서 콜스택 한도에
// 걸릴 수 있어 청크로 나눠 누적한다.
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
