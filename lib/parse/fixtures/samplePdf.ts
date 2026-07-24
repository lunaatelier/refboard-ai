// 실제 파싱 가능한 최소 PDF 합성기 — pdf.test.ts/동등성 테스트에서 진짜
// unpdf(pdf.js) 경로를 통과시켜보기 위한 것. 바이트 오프셋을 손으로 세면
// xref 테이블이 어긋나기 쉬워서, 각 오브젝트를 이어붙이며 실제 길이로
// 오프셋을 계산한다(표준적인 방법).
export function buildSamplePdf(text = "Hello PDF"): ArrayBuffer {
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objects[3] =
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const streamContent = `BT /F1 24 Tf 20 100 Td (${text}) Tj ET`;
  objects[5] = `<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 1; i <= 5; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += xref;
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf).buffer as ArrayBuffer;
}
