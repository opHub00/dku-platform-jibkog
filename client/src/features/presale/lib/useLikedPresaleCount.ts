import { useEffect, useState } from "react";
import { presaleRepository } from "../api/presaleRepository";

/** presale 저장소에서 찜한 분양권 매물 수를 센다. 찜이 바뀌면 다시 센다. */
export function useLikedPresaleCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () => {
      void presaleRepository.listListings({ includeHidden: true }).then((listings) => {
        if (active) setCount(listings.filter((listing) => listing.liked).length);
      });
    };
    load();
    const unsubscribe = presaleRepository.subscribe(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return count;
}
