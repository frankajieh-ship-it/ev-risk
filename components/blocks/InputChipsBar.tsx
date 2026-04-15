"use client";

import type { MinimumViableRoutine } from "@/types/v2";

interface InputChipsBarProps {
  routine: MinimumViableRoutine;
  vehicle?: { make: string; model: string; year: number };
}

export function InputChipsBar({ routine, vehicle }: InputChipsBarProps) {
  const chips: string[] = [];

  if (routine.charging_access === "home") chips.push("Home Charging");
  else if (routine.charging_access === "work") chips.push("Work Charging");
  else chips.push("Public Charging");

  if (routine.commute_miles_roundtrip) {
    chips.push(`~${routine.commute_miles_roundtrip} mi/day commute`);
  } else if (routine.weekly_miles) {
    chips.push(`~${routine.weekly_miles} mi/week`);
  }

  if (routine.climate === "winter") chips.push("Winter Climate");
  else if (routine.climate === "hot") chips.push("Hot Climate");
  else chips.push("Mild Climate");

  if (routine.longest_day_pattern === "once_a_week") chips.push("Weekly long days");
  else if (routine.longest_day_pattern === "monthly_trip") chips.push("Monthly trips");
  else chips.push("Rare road trips");

  if (vehicle) chips.push(`${vehicle.year} ${vehicle.model}`);

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.07] text-white/60 border border-white/10"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}
