import { useEffect, useState } from "react";
import { profileRepository } from "../api/profileRepository";
import { DEFAULT_PROFILE } from "../data/options";
import type { UserProfile } from "../types";

/** 내 정보와, 저장소에서 다 읽었는지(loaded) 여부 */
export function useProfileState(): { profile: UserProfile; loaded: boolean } {
  const [state, setState] = useState<{ profile: UserProfile; loaded: boolean }>({ profile: DEFAULT_PROFILE, loaded: false });

  useEffect(() => {
    let active = true;
    const load = () => {
      void profileRepository.getProfile().then((loaded) => {
        if (active) setState({ profile: loaded, loaded: true });
      });
    };
    load();
    const unsubscribe = profileRepository.subscribe(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}

/** 내 정보를 읽고, 저장되면 다시 읽는다. 첫 렌더에는 기본값을 쓴다. */
export function useProfile(): UserProfile {
  return useProfileState().profile;
}
