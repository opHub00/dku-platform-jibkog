import { StatusPill } from "@/components/common/StatusPill";
import "../presale.css";

/** 서버가 만든 예시(시드) 매물 표시. docs/api-catalog.md 6절 */
export function DemoListingPill() {
  return (
    <span className="ps-demo-pill">
      <StatusPill tone="sand">시연용 예시 매물</StatusPill>
    </span>
  );
}
