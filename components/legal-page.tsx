import Link from "next/link";
import type { ReactNode } from "react";

const legalLinks = [
  ["이용약관", "/terms"],
  ["개인정보처리방침", "/privacy"],
  ["위치기반서비스 이용약관", "/location-terms"],
  ["공공데이터 이용정책", "/public-data"],
  ["계정·데이터 삭제", "/account-deletion"],
] as const;

export function LegalPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link href="/" className="legal-brand" aria-label="동네고고 홈">
          {/* A same-origin brand asset is intentionally served directly by Sites. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/uploads/dongnegogo_1024.png" alt="" width="36" height="36" />
          <span>동네고고</span>
        </Link>
        <Link href="/" className="legal-home-link">서비스 소개로 돌아가기</Link>
      </header>

      <main className="legal-main">
        <div className="legal-hero">
          <p className="legal-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="legal-status" role="note">
            <strong>운영자 정보</strong>
            <span>포레스트 이음(Forest Ieum) · 대표 정재은 · 사업자등록번호 689-01-03864</span>
          </div>
        </div>

        <nav className="legal-nav" aria-label="정책 문서">
          {legalLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>

        <article className="legal-article">{children}</article>
      </main>

      <footer className="legal-footer">
        <span>© 2026 포레스트 이음 · 동네고고</span>
        <a href="mailto:forestieum@gmail.com">forestieum@gmail.com</a>
      </footer>
    </div>
  );
}

export function LegalMeta({ children }: { children: ReactNode }) {
  return <p className="legal-meta">{children}</p>;
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return <section id={id} className="legal-section"><h2>{title}</h2>{children}</section>;
}

export function Flow({
  label,
  steps,
}: {
  label: string;
  steps: Array<{ title: string; body: string }>;
}) {
  return (
    <ol className="legal-flow" aria-label={label}>
      {steps.map((step, index) => (
        <li key={`${index}-${step.title}`}>
          <span>{index + 1}</span>
          <div><strong>{step.title}</strong><p>{step.body}</p></div>
        </li>
      ))}
    </ol>
  );
}

export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="legal-table-wrap">
      <table className="legal-table">
        <thead><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => (
          <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return <div className="legal-callout">{children}</div>;
}
