import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** 하단 바(또는 열린 바텀시트)와 토스트 사이 간격(px) */
const GAP_ABOVE_BAR = 10;

/** 화면마다 다른 하단 요소. 바텀시트가 열려 있으면 시트 위가 기준이다. */
const SHEET_SELECTOR = ".app-frame .bottom-sheet";
const BAR_SELECTOR = ".app-frame .detail-actions, .app-frame .bottom-nav, .app-frame .ch-composer";

function isShown(element: Element): boolean {
  return element.getClientRects().length > 0;
}

/**
 * 지금 보이는 하단 요소의 위쪽 모서리에서 창 바닥까지의 거리 + 간격을 잰다.
 * 하단 요소가 없으면 앱 틀 바닥(창 안에서 보이는 부분) 위에 띄운다.
 */
function measureBottomOffset(): number {
  const viewportHeight = window.innerHeight;
  const sheet = [...document.querySelectorAll(SHEET_SELECTOR)].find(isShown);
  const bar = [...document.querySelectorAll(BAR_SELECTOR)].find(isShown);
  const target = sheet ?? bar;
  let top: number;
  if (target) {
    top = target.getBoundingClientRect().top;
  } else {
    const frame = document.querySelector(".app-frame");
    top = frame ? Math.min(viewportHeight, frame.getBoundingClientRect().bottom) : viewportHeight;
  }
  return Math.max(GAP_ABOVE_BAR, Math.round(viewportHeight - top + GAP_ABOVE_BAR));
}

/** 화면 전환·바텀시트 열림·창 크기 변경 때마다 하단 요소 위치를 다시 잰다. */
function useBottomOffset(): number {
  const [offset, setOffset] = useState(GAP_ABOVE_BAR);

  useEffect(() => {
    let frameId = 0;
    const update = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => setOffset(measureBottomOffset()));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    // 바텀시트는 올라오는 애니메이션이 끝나야 최종 위치가 된다.
    document.addEventListener("animationend", update, true);
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", update);
      document.removeEventListener("animationend", update, true);
    };
  }, []);

  return offset;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const bottom = useBottomOffset();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // 이 프로젝트 index.css에는 --popover/--border가 없어 배경이 투명했다. 프로젝트 변수로 바꾼다.
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--line)",
        } as React.CSSProperties
      }
      // 앱 틀은 창 가로 가운데에 있으므로 bottom-center가 곧 앱 틀 가운데다.
      position="bottom-center"
      offset={{ bottom }}
      mobileOffset={{ bottom }}
      {...props}
    />
  );
};

export { Toaster };
