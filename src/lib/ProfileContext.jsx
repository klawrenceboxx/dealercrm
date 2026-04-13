import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const ProfileContext = createContext(null);

export function ProfileProvider({ user, children }) {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!user) { setProfileLoading(false); return; }

    async function loadProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
      } else {
        // Auto-create on first login with safe defaults
        const newProfile = {
          id: user.id,
          name: user.email.split("@")[0],
          role: "rep",
          active: true,
        };
        const { data: created } = await supabase
          .from("profiles")
          .insert(newProfile)
          .select()
          .single();
        setProfile(created);
      }
      setProfileLoading(false);
    }

    loadProfile();
  }, [user?.id]);

  return (
    <ProfileContext.Provider value={{ profile, setProfile, profileLoading }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
