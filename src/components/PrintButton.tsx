"use client";
export default function PrintButton({ label = "🖨 Print / Save as PDF" }: { label?: string }) {
  return (
    <>
      <button className="btn-primary" onClick={() => window.print()}>{label}</button>
      <button className="btn-secondary" onClick={() => history.back()}>←</button>
    </>
  );
}
