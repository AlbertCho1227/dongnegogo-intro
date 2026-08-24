import styles from "./program-share.module.css";

export function OpenAppButton({ programID }: { programID: string }) {
  return (
    <a className={styles.appButton} href={`/web?program=${encodeURIComponent(programID)}`}>
      <span aria-hidden="true">●</span>
      앱에서 지도로 보기
    </a>
  );
}
