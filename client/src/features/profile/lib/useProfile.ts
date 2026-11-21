import { useEffect, useState } from "react";
import { profileRepository } from "../api/profileRepository";
import { DEFAULT_PROFILE } from "../data/options";
import type { UserProfile } from "../types";

/** 내 정보를 읽고, 저장되면 다시 읽는다. 첫 렌더에는 기본값을 쓴다. */
export function useProfile(): UserProfile {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    let active = true;
    const load = () => {
      void profileRepository.getProfile().then((loaded) => {
        if (active) setProfile(loaded);
      });
    };
    load();
    const unsubscribe = profileRepository.subscribe(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return profile;
}
