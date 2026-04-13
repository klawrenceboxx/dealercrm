/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import {
  DEFAULT_SHIFT_TIMEZONE,
  parseTimeInputToMinutes,
} from "./shiftAssignments";

const ProfileContext = createContext(null);

export function ProfileProvider({ user, children }) {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadProfile() {
      setProfileLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, role, active, rr_order, suspended_at, created_at, shift_start_minutes, shift_end_minutes, shift_timezone")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      if (data) {
        setProfile(data);
      } else if (error?.code === "PGRST116") {
        const newProfile = {
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email.split("@")[0],
          role: "rep",
          active: true,
          rr_order: 0,
          shift_start_minutes: parseTimeInputToMinutes("09:00"),
          shift_end_minutes: parseTimeInputToMinutes("17:00"),
          shift_timezone: DEFAULT_SHIFT_TIMEZONE,
        };
        const { data: created } = await supabase
          .from("profiles")
          .insert(newProfile)
          .select("id, full_name, phone, role, active, rr_order, suspended_at, created_at, shift_start_minutes, shift_end_minutes, shift_timezone")
          .single();
        if (!cancelled) {
          setProfile(created || null);
        }
      } else {
        setProfile(null);
      }

      if (!cancelled) {
        setProfileLoading(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <ProfileContext.Provider value={{ profile, setProfile, profileLoading }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
