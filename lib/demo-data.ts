/**
 * Demo Sandbox Data
 *
 * Pre-computed sample EV risk reports for demo/sandbox mode.
 * These allow users to see OFFO's analysis instantly without needing real VIN/listing data.
 *
 * 5 Scenarios covering edge cases:
 * 1. Tesla Model 3 (Green) - Best case: home charging, moderate use
 * 2. Nissan Leaf (Yellow) - Public charging dependency
 * 3. Chevy Bolt (Red) - High mileage + no home charging
 * 4. Ford Mach-E (Yellow) - Winter climate edge case
 * 5. Tesla Model Y (Yellow) - Long commute scenario
 */

import type { EvRiskReportV2Contract } from "@/types/v2-contract";

export const DEMO_REPORTS: Record<string, EvRiskReportV2Contract> = {
  "tesla-model-3-green": {
    report_id: "demo-tesla-model-3-green",
    scenario_id: "demo-scenario-1",
    scenario_slug: "tesla-model-3-green",
    region: "US",

    default_view: {
      fit_verdict: {
        label: "Good Fit",
        one_liner: "Your routine aligns well with this vehicle's capabilities — minimal friction expected"
      },
      fallback_plan: {
        primary: "Daily home charging after work (6-8 hours Level 2)",
        backup: "Level 2 charging at workplace parking garage if home charger unavailable",
        trigger: "If home charger installation is delayed or you forget to plug in overnight"
      },
      stress_flags: [
        {
          title: "Ideal Setup — Low Mental Load",
          because: "Home charging + moderate daily miles (30 mi/day) + mild climate",
          impact: "You'll rarely think about range. Charge overnight, wake up to full battery."
        }
      ],
      one_followup_question: "Have you confirmed your electrical panel can handle a Level 2 charger (240V, 40A+)?",
      confidence: {
        routine_confidence_pct: 85,
        routine_confidence_label: "High",
        ownership_confidence_pct: 90,
        ownership_confidence_label: "High"
      }
    },

    appendix: {
      buyer_diligence: {
        battery: {
          summary: "2023 Model 3 Long Range uses LG/Panasonic cells with minimal degradation reports at this age",
          asks: [
            "Request Supercharger history from Tesla app (shows fast-charge frequency)",
            "Verify battery coolant level was checked at last service",
            "Ask if car was regularly charged to 100% (reduces longevity)"
          ]
        },
        warranty_recalls: {
          summary: "Tesla 8yr/120k mi battery warranty still active. Check recall status via VIN.",
          checks: [
            "Verify VIN not affected by 2023 seat belt recall (NHTSA 23V-395)",
            "Confirm latest software version installed (OTA updates required)",
            "Check service history for 12V battery replacement (common at 3+ years)"
          ]
        },
        walk_away_triggers: [
          "Estimated range < 250 mi at 100% charge (indicates battery degradation)",
          "Accident history with frame/battery damage",
          "Missing service records for 2+ years",
          "Seller unwilling to provide Supercharger history screenshot"
        ]
      },
      cost_estimates: {
        notes: "5-year ownership cost estimate: $42k (purchase) + $6k (charging) + $4k (insurance) + $2k (maintenance) = $54k total"
      },
      dealer_questions: [
        "Can you provide a battery health report showing current capacity percentage?",
        "Has this vehicle ever been Supercharged more than 2x/week on average?",
        "What's the tire tread depth? (EVs wear tires faster due to instant torque)",
        "Are you including both key fobs? Replacements cost $300+",
        "Can you demonstrate all Autopilot features are functional?"
      ]
    },

    missing_data_loop: {
      current_confidence: 85,
      target_confidence: 95,
      next_best_step: {
        label: "Get battery health report to reach 95% confidence",
        steps: [
          { action: "Request Tesla app screenshot showing battery capacity %", unlocks: ["Precise degradation estimate", "Warranty claim eligibility"] },
          { action: "Run OBD-II scan for battery codes", unlocks: ["Hidden cell imbalance warnings"] }
        ],
        cta: { type: "SAVE_SCENARIO", enabled: true }
      }
    },

    computed: {
      range_adequacy: {
        status: "computed",
        result: "adequate",
        inputs_used: ["real_world_range_mi: 310", "daily_miles: 30", "charging_access: home"]
      }
    },

    _internal: {
      routine_fit: {
        score_0_100: 92,
        label: "Great Fit",
        mental_load: "low",
        stress_flags: [],
        breakpoints_ranked: [],
        confidence: {
          level: "high",
          note: "High confidence based on routine and vehicle specs",
          has_vehicle_data: true,
          has_battery_data: false
        }
      },
      ownership_risk: {
        overall_risk_label: "Low ownership friction",
        modules: [
          {
            module_id: "battery",
            status: "green",
            label: "Battery Health",
            summary: "2023 vehicle with minimal expected degradation",
            data_available: true
          },
          {
            module_id: "recall",
            status: "green",
            label: "Recall Status",
            summary: "No active recalls affecting safety systems",
            data_available: true
          },
          {
            module_id: "warranty",
            status: "green",
            label: "Warranty Coverage",
            summary: "Tesla 8yr/120k mi battery warranty active",
            data_available: true
          }
        ]
      },
      vehicle: {
        make: "Tesla",
        model: "Model 3 Long Range",
        year: 2023,
        mileage: 15000
      },
      routine: {
        charging_access: "home",
        weekly_miles: 210,
        commute_miles_roundtrip: 30,
        climate: "mild",
        longest_day_pattern: "rare_road_trip",
        region: "US"
      }
    }
  },

  "nissan-leaf-yellow": {
    report_id: "demo-nissan-leaf-yellow",
    scenario_id: "demo-scenario-2",
    scenario_slug: "nissan-leaf-yellow",
    region: "US",

    default_view: {
      fit_verdict: {
        label: "Mixed Fit",
        one_liner: "This vehicle can work for your routine, but requires weekly planning around public charging"
      },
      fallback_plan: {
        primary: "Plan 2-3 weekly DC fast charge stops (30 min each) at mapped reliable stations",
        backup: "Identify Level 2 chargers near home/work for overnight top-ups when DC unavailable",
        trigger: "If your primary DC fast charger is occupied or broken, have 2 backup locations memorized"
      },
      stress_flags: [
        {
          title: "Public Charging Dependency",
          because: "No home charging + 40 mi/day commute requires 2-3 charge stops/week",
          impact: "Adds 30-60 min/week of planning. Mental load: Medium. Doable but not effortless."
        },
        {
          title: "Range Buffer Tight on Long Days",
          because: "226 mi range (real-world) vs. 280 mi worst-case day = 80% daily usage",
          impact: "Long days require charge planning. Cannot skip charging multiple days in a row."
        }
      ],
      one_followup_question: "Have you mapped 3+ reliable DC fast chargers within 2 miles of your regular routes?",
      confidence: {
        routine_confidence_pct: 70,
        routine_confidence_label: "Medium",
        ownership_confidence_pct: 65,
        ownership_confidence_label: "Medium"
      }
    },

    appendix: {
      buyer_diligence: {
        battery: {
          summary: "2020 Leaf uses air-cooled battery (degrades faster than liquid-cooled). Expect 15-20% loss at 4 years.",
          asks: [
            "Request battery capacity bars screenshot (12 bars = 100%, 11 bars = ~85%, 10 bars = warranty claim)",
            "Verify car has never lived in Arizona/Texas (heat accelerates degradation)",
            "Ask how many DC fast charges per month (frequent fast charging degrades air-cooled batteries faster)"
          ]
        },
        warranty_recalls: {
          summary: "Nissan 8yr/100k mi battery warranty. Check if capacity < 75% for replacement eligibility.",
          checks: [
            "Verify VIN not affected by 2020 Leaf battery connector recall (NHTSA 20V-461)",
            "Check if ProPILOT Assist works (sensor failures common after 3+ years)",
            "Confirm CHAdeMO port not damaged (Tesla adapter won't fix broken pins)"
          ]
        },
        walk_away_triggers: [
          "Battery capacity bars < 11 (indicates >15% degradation)",
          "Car was previously in hot climate state (AZ, NV, TX, FL)",
          "CHAdeMO port shows burn marks or damaged pins",
          "Seller has no DC fast charge history (suggests they avoided fast charging due to degradation)"
        ]
      },
      cost_estimates: {
        notes: "5-year ownership cost estimate: $22k (purchase) + $4k (charging) + $3k (insurance) + $2k (maintenance) = $31k total"
      },
      dealer_questions: [
        "How many battery capacity bars are showing? (Must be 11+ for purchase)",
        "Can you provide LeafSpy screenshot showing State of Health (SOH%)?",
        "What's the DC fast charge history? (Too frequent = degradation risk)",
        "Is the CHAdeMO port in good condition? (Check for burn marks)",
        "Has the 12V battery been replaced? (Common failure point)"
      ]
    },

    missing_data_loop: {
      current_confidence: 68,
      target_confidence: 85,
      next_best_step: {
        label: "Get LeafSpy battery report to reach 85% confidence",
        steps: [
          { action: "Request LeafSpy app screenshot showing SOH% and Hx values", unlocks: ["Precise degradation state", "Warranty claim eligibility check"] },
          { action: "Map 3+ DC fast chargers near your routes", unlocks: ["Charging logistics confidence"] }
        ],
        cta: { type: "UPLOAD_SOH", enabled: true }
      }
    },

    computed: {
      range_adequacy: {
        status: "computed",
        result: "marginal",
        inputs_used: ["real_world_range_mi: 226", "daily_miles: 40", "charging_access: public"]
      }
    },

    _internal: {
      routine_fit: {
        score_0_100: 68,
        label: "Mixed Fit",
        mental_load: "medium",
        stress_flags: [
          { id: "public-charge", label: "Public Charging Dependency", severity: "medium", routine_citation: "No home charging" },
          { id: "range-tight", label: "Range Buffer Tight on Long Days", severity: "medium", routine_citation: "40 mi/day + 226 mi range" }
        ],
        breakpoints_ranked: [
          {
            id: "bp-long-day",
            title: "Long Day Charging Required",
            break_point: "If daily miles exceed 180 mi",
            trigger: "Once a week",
            evidence: [
              { label: "Longest day pattern", value: "once_a_week" },
              { label: "Daily range usage", value: "~50%" }
            ],
            impact: "Medium",
            fallback_plan_b: {
              anchor: "Home charging",
              backup: "Identify Level 2 chargers for overnight top-up",
              buffer_rule: "Charge to 90% instead of 80% on long days"
            }
          }
        ],
        confidence: {
          level: "medium",
          note: "Medium confidence — battery degradation unknown",
          has_vehicle_data: true,
          has_battery_data: false
        }
      },
      ownership_risk: {
        overall_risk_label: "Moderate ownership friction",
        modules: [
          {
            module_id: "battery",
            status: "yellow",
            label: "Battery Health",
            summary: "Air-cooled battery, 4 years old, unknown SOH",
            detail: "Nissan LEAF air-cooled batteries are known for faster degradation in hot climates",
            data_available: true
          },
          {
            module_id: "recall",
            status: "green",
            label: "Recall Status",
            summary: "Check CHAdeMO port recall status",
            data_available: true
          },
          {
            module_id: "warranty",
            status: "yellow",
            label: "Warranty Coverage",
            summary: "Warranty active but degradation may be near threshold",
            detail: "8yr/100k mi battery warranty covers capacity loss below 9 bars",
            data_available: true
          }
        ]
      },
      vehicle: {
        make: "Nissan",
        model: "Leaf S Plus",
        year: 2020,
        mileage: 42000
      },
      routine: {
        charging_access: "public",
        weekly_miles: 280,
        commute_miles_roundtrip: 40,
        climate: "mild",
        longest_day_pattern: "once_a_week",
        region: "US"
      }
    }
  },

  "chevy-bolt-red": {
    report_id: "demo-chevy-bolt-red",
    scenario_id: "demo-scenario-3",
    scenario_slug: "chevy-bolt-red",
    region: "US",

    default_view: {
      fit_verdict: {
        label: "High Friction",
        one_liner: "This setup creates significant daily stress — public charging + high mileage + winter climate compound"
      },
      fallback_plan: {
        primary: "Mandatory daily 30min Level 2 charge stop (cannot skip even one day)",
        backup: "Keep 2+ DC fast chargers mapped as emergency backstop if Level 2 occupied",
        trigger: "If you miss a charge session, next day becomes high-stress scramble"
      },
      stress_flags: [
        {
          title: "High Mileage Battery Degradation Risk",
          because: "120k miles on 2017 Bolt (6+ years old) — likely 20-30% capacity loss",
          impact: "Advertised 238 mi range likely down to 165-190 mi real-world. Range anxiety daily."
        },
        {
          title: "No Home Charging + Long Commute",
          because: "60 mi/day commute with public-only charging requires perfect execution",
          impact: "One missed charge = stranded risk. Mental load: High. Not sustainable long-term."
        },
        {
          title: "Winter Range Loss Compounds Stress",
          because: "Winter climate reduces range 20-30% (down to 115-135 mi worst case)",
          impact: "Winter days require mid-day charge stop. Planning becomes constant."
        }
      ],
      one_followup_question: "Can you confirm a Level 2 charger within 0.5 miles of your home/work that's available 7 days/week?",
      confidence: {
        routine_confidence_pct: 45,
        routine_confidence_label: "Low",
        ownership_confidence_pct: 40,
        ownership_confidence_label: "Low"
      }
    },

    appendix: {
      buyer_diligence: {
        battery: {
          summary: "2017 Bolt affected by LG recall (fire risk). Verify battery replacement completed. High mileage = degradation.",
          asks: [
            "**CRITICAL**: Confirm battery was replaced under GM recall (TSB 21-EV-006). Do not buy if not replaced.",
            "Request GOM (Guess-O-Meter) screenshot showing estimated range at 100% charge",
            "Ask seller for winter range experience (should be honest about degradation)",
            "Verify battery capacity via OBD-II scan (should show kWh available)"
          ]
        },
        warranty_recalls: {
          summary: "GM 8yr/100k mi battery warranty — EXPIRED on mileage. Recall battery replacement may reset warranty.",
          checks: [
            "**WALK AWAY** if battery not replaced under recall (fire risk + no warranty)",
            "Verify recall completion certificate from GM dealership",
            "Check for shift-to-park recall (NHTSA 18V-336) — software fix required",
            "Confirm no open recalls via VIN lookup"
          ]
        },
        walk_away_triggers: [
          "**CRITICAL**: Battery not replaced under LG recall (TSB 21-EV-006) — WALK AWAY",
          "Real-world range < 160 mi at 100% charge (severe degradation)",
          "No service records for 2+ years (suggests neglect)",
          "Seller unwilling to show current range estimate",
          "Battery warranty expired + no recall replacement = uninsurable risk"
        ]
      },
      cost_estimates: {
        notes: "5-year ownership cost estimate: $12k (purchase) + $5k (charging) + $2.5k (insurance) + $3k (maintenance + battery risk reserve) = $22.5k total"
      },
      dealer_questions: [
        "**MUST ASK**: Has the battery been replaced under the GM/LG recall? Need proof.",
        "What's the current real-world range at 100% charge in mild weather?",
        "What's the winter range you've experienced?",
        "Can you provide battery capacity reading from OBD-II scan?",
        "Why are you selling? (High mileage suggests trade-up time)"
      ]
    },

    missing_data_loop: {
      current_confidence: 42,
      target_confidence: 70,
      next_best_step: {
        label: "Verify recall completion + get battery scan to reach 70% confidence",
        steps: [
          { action: "Request GM recall completion certificate", unlocks: ["Fire risk eliminated", "Possible warranty reset"] },
          { action: "Get OBD-II battery capacity scan", unlocks: ["Exact degradation state", "Insurance decision"] },
          { action: "Test drive in winter conditions", unlocks: ["Real-world range validation"] }
        ],
        cta: { type: "ENTER_VIN", enabled: true }
      }
    },

    computed: {
      range_adequacy: {
        status: "computed",
        result: "inadequate",
        inputs_used: ["real_world_range_mi: 165 (degraded)", "daily_miles: 60", "charging_access: public", "climate: winter"]
      }
    },

    _internal: {
      routine_fit: {
        score_0_100: 42,
        label: "High Friction",
        mental_load: "high",
        stress_flags: [
          { id: "degradation", label: "High Mileage Battery Degradation Risk", severity: "high", routine_citation: "120k miles, 6+ years old" },
          { id: "no-home", label: "No Home Charging + Long Commute", severity: "high", routine_citation: "60 mi/day, public charging only" },
          { id: "winter", label: "Winter Range Loss Compounds Stress", severity: "high", routine_citation: "Winter climate + degraded battery" }
        ],
        breakpoints_ranked: [
          {
            id: "bp-daily",
            title: "Daily Charging Mandatory",
            break_point: "Cannot skip a single day",
            trigger: "Every day",
            evidence: [
              { label: "Daily miles", value: "60 mi" },
              { label: "Degraded range", value: "~165 mi" },
              { label: "Daily usage", value: "36%" }
            ],
            impact: "High",
            fallback_plan_b: {
              anchor: "Home L1 charging",
              backup: "Keep DC fast charger as emergency backup",
              buffer_rule: "Never drop below 30% SOC"
            }
          },
          {
            id: "bp-winter",
            title: "Winter Mid-Day Charge Required",
            break_point: "Winter range drops to 115-135 mi",
            trigger: "November-March",
            evidence: [
              { label: "Climate", value: "winter" },
              { label: "Battery condition", value: "degraded" },
              { label: "Winter range", value: "115-135 mi" }
            ],
            impact: "High",
            fallback_plan_b: {
              anchor: "Work charging",
              backup: "Plan 30min mid-day charge stop",
              buffer_rule: "Charge to 100% for winter days"
            }
          }
        ],
        confidence: {
          level: "low",
          note: "Low confidence — battery replacement status unknown, degradation severe",
          has_vehicle_data: true,
          has_battery_data: false
        }
      },
      ownership_risk: {
        overall_risk_label: "High ownership friction",
        modules: [
          {
            module_id: "battery",
            status: "red",
            label: "Battery Health",
            summary: "120k miles, 6+ years, likely 20-30% loss",
            detail: "High mileage and age indicate significant capacity degradation",
            data_available: true
          },
          {
            module_id: "recall",
            status: "red",
            label: "Recall Status",
            summary: "CRITICAL: Must verify LG recall battery replacement",
            detail: "2017-2019 Bolts had fire risk from LG battery defects. Battery replacement mandatory.",
            data_available: true
          },
          {
            module_id: "warranty",
            status: "red",
            label: "Warranty Coverage",
            summary: "Warranty expired on mileage (100k limit)",
            detail: "Original 8yr/100k mi warranty exceeded. No coverage for battery issues.",
            data_available: true
          }
        ]
      },
      vehicle: {
        make: "Chevrolet",
        model: "Bolt EV",
        year: 2017,
        mileage: 120000
      },
      routine: {
        charging_access: "public",
        weekly_miles: 420,
        commute_miles_roundtrip: 60,
        climate: "winter",
        longest_day_pattern: "once_a_week",
        region: "US"
      }
    }
  },

  "chevy-bolt-ev-green": {
    report_id: "demo-chevy-bolt-ev-green",
    scenario_id: "demo-scenario-bolt-green",
    scenario_slug: "chevy-bolt-ev-green",
    region: "US",

    default_view: {
      fit_verdict: {
        label: "Good Fit",
        one_liner: "Home charging + mild climate + moderate miles — this Bolt EV fits your routine with low daily friction"
      },
      fallback_plan: {
        primary: "Daily overnight Level 2 home charging (6-8 hours, wake up to full battery)",
        backup: "Workplace Level 2 charger or nearby public charger as backup on high-mileage days",
        trigger: "If you forget to plug in overnight, top up at work or nearby Level 2 during the day"
      },
      stress_flags: [
        {
          title: "Home Charging Handles Your Routine Comfortably",
          because: "200 mi/wk with home charging and mild climate = ~29 mi/day average. Bolt's 259 mi EPA range is nearly 9x your daily average.",
          impact: "You'll rarely drop below 50% SOC. Charging is a plug-in-at-night routine, not a logistics problem."
        },
        {
          title: "Public Charging Dependency Risk on Long Days",
          because: "If any day exceeds ~130 mi (rare with 200 mi/wk average), a mid-day charge may be needed",
          impact: "Low probability — but map a backup Level 2 near your longest route just in case."
        }
      ],
      one_followup_question: "Does your home have a 240V outlet or are you planning to install a Level 2 charger?",
      confidence: {
        routine_confidence_pct: 88,
        routine_confidence_label: "High",
        ownership_confidence_pct: 82,
        ownership_confidence_label: "High"
      }
    },

    appendix: {
      buyer_diligence: {
        battery: {
          summary: "2023 Bolt EV uses updated LG Chemistry cells (not the recalled modules). Battery replacement recall resolved for 2022+ models.",
          asks: [
            "Confirm 2023 model year (not affected by 2017-2022 LG recall)",
            "Request GOM screenshot showing estimated range at 100% charge (should be 240-259 mi)",
            "Ask seller how often they use DC fast charging (frequent DCFC degrades cells faster)",
            "Verify battery has no visible damage via pre-purchase inspection"
          ]
        },
        warranty_recalls: {
          summary: "GM 8yr/100k mi battery warranty active on 2023 model (under 30k miles). No active safety recalls.",
          checks: [
            "Confirm VIN not affected by any open recalls via NHTSA VIN lookup",
            "Verify GM Battery Assurance warranty documentation is transferable",
            "Check for Shift-to-Park software updates (resolved in 2022+)",
            "Confirm 12V battery health (common replacement at 3-4 years)"
          ]
        },
        walk_away_triggers: [
          "Estimated range < 220 mi at 100% charge (indicates early degradation)",
          "Any accident history involving underbody or battery compartment",
          "Seller cannot confirm 2023 model year (2017-2022 recall risk)",
          "More than 3x/week DC fast charge history (accelerates degradation)",
          "Missing service records"
        ]
      },
      cost_estimates: {
        notes: "5-year ownership cost estimate: $27k (purchase) + $3.5k (charging at home) + $4k (insurance) + $1.5k (maintenance) = $36k total — strong value for the category"
      },
      dealer_questions: [
        "Can you confirm this is a 2023 model year and show the build sheet?",
        "What's the current estimated range at 100% charge shown on the dash?",
        "How often was DC fast charging used? (prefer < 3x/week average)",
        "Is the original battery warranty documentation available to transfer?",
        "Any issues with the Shift-to-Park feature? (resolved in 2022+ but worth confirming)"
      ]
    },

    missing_data_loop: {
      current_confidence: 85,
      target_confidence: 93,
      next_best_step: {
        label: "Confirm range and charging history to reach 93% confidence",
        steps: [
          { action: "Request GOM screenshot at 100% charge", unlocks: ["Verify battery capacity is healthy", "Confirm 240+ mi range"] },
          { action: "Ask for DC fast charge frequency from seller", unlocks: ["Degradation risk assessment", "Long-term battery projection"] }
        ],
        cta: { type: "SAVE_SCENARIO", enabled: true }
      }
    },

    computed: {
      range_adequacy: {
        status: "computed",
        result: "adequate",
        inputs_used: ["real_world_range_mi: 240", "daily_miles: 29", "charging_access: home", "climate: mild"]
      }
    },

    _internal: {
      routine_fit: {
        score_0_100: 86,
        label: "Good Fit",
        mental_load: "low",
        stress_flags: [
          { id: "home-charging-fits", label: "Home Charging Handles Your Routine Comfortably", severity: "low", routine_citation: "Home charging + 200 mi/wk + mild climate" },
          { id: "long-day-buffer", label: "Public Charging Dependency Risk on Long Days", severity: "low", routine_citation: "Occasional long days beyond daily average" }
        ],
        breakpoints_ranked: [
          {
            id: "bp-long-day",
            title: "Long Day Range Buffer",
            break_point: "Days exceeding ~130 mi may need a mid-day top-up",
            trigger: "Rare — requires 4.5x your average daily distance",
            evidence: [
              { label: "Daily average", value: "~29 mi" },
              { label: "Real-world range", value: "~240 mi" },
              { label: "Buffer to empty", value: "~211 mi margin" }
            ],
            impact: "Low",
            fallback_plan_b: {
              anchor: "Overnight home Level 2 charging",
              backup: "Public Level 2 near longest route",
              buffer_rule: "Keep above 20% SOC as daily habit"
            }
          }
        ],
        confidence: {
          level: "high",
          note: "High confidence — home charging + mild climate + moderate miles is the ideal Bolt EV use case",
          has_vehicle_data: true,
          has_battery_data: false
        }
      },
      ownership_risk: {
        overall_risk_label: "Low ownership friction",
        modules: [
          {
            module_id: "battery",
            status: "green",
            label: "Battery Health",
            summary: "2023 model uses updated cells — not affected by LG recall",
            detail: "GM resolved the Bolt battery recall for 2022+ models. 2023 Bolt EV has updated LG chemistry with no known safety issues.",
            data_available: true
          },
          {
            module_id: "recall",
            status: "green",
            label: "Recall Status",
            summary: "No active recalls on 2023 Bolt EV",
            detail: "The 2017-2022 LG battery recall does not apply to 2023 model year. Verify via NHTSA VIN lookup to confirm.",
            data_available: true
          },
          {
            module_id: "warranty",
            status: "green",
            label: "Warranty Coverage",
            summary: "GM 8yr/100k mi battery warranty active",
            detail: "Under 30k miles — well within GM's battery warranty coverage window.",
            data_available: true
          }
        ]
      },
      vehicle: {
        make: "Chevrolet",
        model: "Bolt EV",
        year: 2023,
        mileage: 28000
      },
      routine: {
        charging_access: "home",
        weekly_miles: 200,
        commute_miles_roundtrip: 29,
        climate: "mild",
        longest_day_pattern: "once_a_week",
        region: "US"
      }
    }
  },

  "ford-mach-e-winter": {
    report_id: "demo-ford-mach-e-winter",
    scenario_id: "demo-scenario-4",
    scenario_slug: "ford-mach-e-winter",
    region: "US",

    default_view: {
      fit_verdict: {
        label: "Mixed Fit",
        one_liner: "Solid match overall, but winter conditions create temporary friction 4-5 months/year"
      },
      fallback_plan: {
        primary: "Precondition cabin while plugged in before departure (saves 10-15% range)",
        backup: "Keep minimum 30% SOC buffer Nov-Mar instead of usual 20%",
        trigger: "When overnight temps drop below 25°F, add extra SOC cushion"
      },
      stress_flags: [
        {
          title: "Cold Weather Range Loss",
          because: "Extended Range RWD drops from 312 mi (EPA) to ~220 mi real-world in winter",
          impact: "Range anxiety spikes in winter. Need to plan charging more carefully Nov-Mar."
        },
        {
          title: "Outdoor Parking + No Preconditioning",
          because: "Street parking prevents cabin preconditioning while plugged in",
          impact: "Extra 10-15% range loss from cold battery starts. Consider heated garage access."
        }
      ],
      one_followup_question: "Do you have access to a garage or covered parking during winter months?",
      confidence: {
        routine_confidence_pct: 72,
        routine_confidence_label: "Medium",
        ownership_confidence_pct: 80,
        ownership_confidence_label: "High"
      }
    },

    appendix: {
      buyer_diligence: {
        battery: {
          summary: "2022 Mach-E uses LG Chem/SK Innovation cells with good thermal management. Minimal degradation expected.",
          asks: [
            "Request Ford Pass app screenshot showing 12V battery status (common failure point)",
            "Verify DCFC charging curve hasn't degraded (should hit 150kW peak)",
            "Ask about OTA update history (Ford has had software bugs)",
            "Check if ever stuck in deep snow (battery heater stress)"
          ]
        },
        warranty_recalls: {
          summary: "Ford 8yr/100k mi battery warranty active. Check for BlueScreen recall fix.",
          checks: [
            "Verify VIN not affected by 2022 BlueScreen recall (NHTSA 22V-012) or software updated",
            "Check for subframe bolt recall (NHTSA 22V-034) — critical safety fix",
            "Confirm glass roof bonding inspected (22V-715)",
            "Verify all OTA updates installed via Ford Pass app"
          ]
        },
        walk_away_triggers: [
          "BlueScreen recall not fixed (safety-critical software bug)",
          "Winter range reports < 200 mi at 90% charge (abnormal degradation)",
          "12V battery warning lights (expensive dealer-only replacement)",
          "Subframe bolt recall incomplete (structural safety issue)"
        ]
      },
      cost_estimates: {
        notes: "5-year ownership cost estimate: $38k (purchase) + $5k (charging) + $4k (insurance) + $3k (maintenance) = $50k total"
      },
      dealer_questions: [
        "Has the BlueScreen recall software update been applied?",
        "What's your real-world winter range experience? (Looking for honesty)",
        "Can you show Ford Pass app with 12V battery status?",
        "Has the vehicle ever been unable to charge due to software bug?",
        "Are all OTA updates installed? (Check version number)"
      ]
    },

    missing_data_loop: {
      current_confidence: 76,
      target_confidence: 90,
      next_best_step: {
        label: "Test winter range to reach 90% confidence",
        steps: [
          { action: "Request seller's winter range experience (Nov-Mar)", unlocks: ["Real-world validation", "Battery health proxy"] },
          { action: "Verify all recall fixes via VIN", unlocks: ["Safety confirmation"] }
        ],
        cta: { type: "ENTER_VIN", enabled: true }
      }
    },

    computed: {
      range_adequacy: {
        status: "computed",
        result: "marginal",
        inputs_used: ["real_world_range_mi: 270 (summer), 220 (winter)", "daily_miles: 45", "climate: winter"]
      }
    },

    _internal: {
      routine_fit: {
        score_0_100: 72,
        label: "Good Fit",
        mental_load: "medium",
        stress_flags: [
          { id: "winter", label: "Cold Weather Range Loss", severity: "medium", routine_citation: "Winter climate + outdoor parking" },
          { id: "parking", label: "Outdoor Parking + No Preconditioning", severity: "medium", routine_citation: "Street parking" }
        ],
        breakpoints_ranked: [
          {
            id: "bp-winter",
            title: "Winter SOC Buffer Increase",
            break_point: "Keep 30% minimum SOC instead of 20%",
            trigger: "Nov-Mar when temps < 30°F",
            evidence: [
              { label: "Climate", value: "winter" },
              { label: "Parking", value: "street exposure" },
              { label: "Cold soak impact", value: "-15% range" }
            ],
            impact: "Medium",
            fallback_plan_b: {
              anchor: "Home charging",
              backup: "Add mid-week top-up charge session",
              buffer_rule: "Maintain 30% minimum SOC in winter"
            }
          }
        ],
        confidence: {
          level: "medium",
          note: "Medium confidence — winter performance uncertain",
          has_vehicle_data: true,
          has_battery_data: false
        }
      },
      ownership_risk: {
        overall_risk_label: "Low ownership friction",
        modules: [
          {
            module_id: "battery",
            status: "green",
            label: "Battery Health",
            summary: "2022 vehicle with good thermal management",
            detail: "Active liquid thermal management system preserves battery health",
            data_available: true
          },
          {
            module_id: "recall",
            status: "yellow",
            label: "Recall Status",
            summary: "Check BlueScreen and subframe recalls",
            detail: "Some 2021-2022 Mach-Es affected by infotainment and subframe issues",
            data_available: true
          },
          {
            module_id: "warranty",
            status: "green",
            label: "Warranty Coverage",
            summary: "Ford 8yr/100k mi warranty active",
            data_available: true
          }
        ]
      },
      vehicle: {
        make: "Ford",
        model: "Mustang Mach-E Extended Range RWD",
        year: 2022,
        mileage: 28000
      },
      routine: {
        charging_access: "home",
        weekly_miles: 315,
        commute_miles_roundtrip: 45,
        climate: "winter",
        longest_day_pattern: "monthly_trip",
        parking_exposure: "street",
        region: "US"
      }
    }
  },

  "tesla-model-y-commute": {
    report_id: "demo-tesla-model-y-commute",
    scenario_id: "demo-scenario-5",
    scenario_slug: "tesla-model-y-commute",
    region: "US",

    default_view: {
      fit_verdict: {
        label: "Mixed Fit",
        one_liner: "Vehicle works for your routine, but longest days create range pressure — Plan B required"
      },
      fallback_plan: {
        primary: "Charge to 90% nightly at home (enough for 95% of days)",
        backup: "Map 2 Superchargers along longest-day route for 15min top-up if needed",
        trigger: "When longest day (120 mi) approaches, top up to 100% the night before"
      },
      stress_flags: [
        {
          title: "Range Buffer Tight on Longest Days",
          because: "120 mi longest day vs 279 mi usable range (after 20% buffer) = 43% usage",
          impact: "Once a week you'll think about range. Not a dealbreaker, but noticeable mental load."
        }
      ],
      one_followup_question: "Can you shift your longest day trips to start with 100% charge instead of 80%?",
      confidence: {
        routine_confidence_pct: 75,
        routine_confidence_label: "Medium",
        ownership_confidence_pct: 85,
        ownership_confidence_label: "High"
      }
    },

    appendix: {
      buyer_diligence: {
        battery: {
          summary: "2023 Model Y Long Range uses 4680 or 2170 cells (check via VIN). Minimal degradation at 1 year old.",
          asks: [
            "Request Tesla app screenshot showing battery capacity bars",
            "Verify Supercharger history (frequent fast charging reduces longevity)",
            "Ask about typical charging pattern (to 80% vs 100%)",
            "Check if car was used for Uber/Lyft (higher degradation if true)"
          ]
        },
        warranty_recalls: {
          summary: "Tesla 8yr/120k mi battery warranty active. Virtually no recalls for 2023 Model Y.",
          checks: [
            "Verify latest software version via Tesla app",
            "Check for Autopilot camera calibration issues (rare but reported)",
            "Confirm no open service items in Tesla app",
            "Test all seat heaters (common failure in Teslas)"
          ]
        },
        walk_away_triggers: [
          "Estimated range < 300 mi at 100% charge (abnormal for 1-year-old car)",
          "Autopilot disabled or camera errors showing",
          "Commercial use history (Uber/Lyft degrades faster)",
          "Missing service records or proof of tire rotation"
        ]
      },
      cost_estimates: {
        notes: "5-year ownership cost estimate: $48k (purchase) + $7k (charging) + $5k (insurance) + $3k (maintenance) = $63k total"
      },
      dealer_questions: [
        "Can you show Tesla app battery % bars and max range estimate?",
        "What's the Supercharger usage history? (Should be < 20% of total charging)",
        "Has this car been used for ride-sharing or commercial purposes?",
        "Are you including the Mobile Connector charging cable? ($275 value)",
        "Can you demonstrate all cameras and Autopilot features work?"
      ]
    },

    missing_data_loop: {
      current_confidence: 80,
      target_confidence: 92,
      next_best_step: {
        label: "Map Superchargers on longest route to reach 92% confidence",
        steps: [
          { action: "Identify 2 Superchargers along 120mi route", unlocks: ["Longest day safety net", "Mental load reduction"] },
          { action: "Test 100% charge overnight capacity", unlocks: ["Validate max range meets needs"] }
        ],
        cta: { type: "SAVE_SCENARIO", enabled: true }
      }
    },

    computed: {
      range_adequacy: {
        status: "computed",
        result: "marginal",
        inputs_used: ["real_world_range_mi: 310", "daily_miles: 70", "longest_day_miles: 120", "soc_buffer: 20%"]
      }
    },

    _internal: {
      routine_fit: {
        score_0_100: 74,
        label: "Good Fit",
        mental_load: "medium",
        stress_flags: [
          { id: "longest-day", label: "Range Buffer Tight on Longest Days", severity: "medium", routine_citation: "120 mi longest day, once/week" }
        ],
        breakpoints_ranked: [
          {
            id: "bp-long-day",
            title: "Longest Day Requires 100% Charge",
            break_point: "Charge to 100% night before longest day",
            trigger: "Once a week",
            evidence: [
              { label: "Longest day miles", value: "120 mi" },
              { label: "Frequency", value: "once_a_week" },
              { label: "Range buffer", value: "10 mi remaining" }
            ],
            impact: "Medium",
            fallback_plan_b: {
              anchor: "Home charging to 100%",
              backup: "Map 2 Superchargers for 15min top-up if needed",
              buffer_rule: "Charge to 100% night before long days"
            }
          }
        ],
        confidence: {
          level: "medium",
          note: "Medium confidence — longest day logistics need validation",
          has_vehicle_data: true,
          has_battery_data: false
        }
      },
      ownership_risk: {
        overall_risk_label: "Low ownership friction",
        modules: [
          {
            module_id: "battery",
            status: "green",
            label: "Battery Health",
            summary: "2023 vehicle with minimal expected degradation",
            data_available: true
          },
          {
            module_id: "recall",
            status: "green",
            label: "Recall Status",
            summary: "No active recalls for 2023 Model Y",
            data_available: true
          },
          {
            module_id: "warranty",
            status: "green",
            label: "Warranty Coverage",
            summary: "Tesla 8yr/120k mi warranty active",
            data_available: true
          }
        ]
      },
      vehicle: {
        make: "Tesla",
        model: "Model Y Long Range",
        year: 2023,
        mileage: 18000
      },
      routine: {
        charging_access: "home",
        weekly_miles: 490,
        commute_miles_roundtrip: 70,
        longest_day_miles: 120,
        climate: "mild",
        longest_day_pattern: "once_a_week",
        min_comfortable_soc: 20,
        region: "US"
      }
    }
  }
};

/**
 * Demo Metadata - Used for demo landing page cards
 */
export interface DemoMetadata {
  title: string;
  vehicle: string;
  routine: string;
  expected_verdict: "Good Fit" | "Mixed Fit" | "High Friction";
  use_case: string;
  key_insight: string;
}

export const DEMO_METADATA: Record<string, DemoMetadata> = {
  "tesla-model-3-green": {
    title: "Best Case - Home Charging Setup",
    vehicle: "2023 Tesla Model 3 Long Range",
    routine: "30 mi/day commute, home charging, mild climate",
    expected_verdict: "Good Fit",
    use_case: "See what an ideal EV match looks like",
    key_insight: "Low mental load — charge overnight, rarely think about range"
  },

  "nissan-leaf-yellow": {
    title: "Public Charging Dependency",
    vehicle: "2020 Nissan Leaf S Plus",
    routine: "40 mi/day, public charging only, moderate climate",
    expected_verdict: "Mixed Fit",
    use_case: "How OFFO handles real-world constraints",
    key_insight: "Doable but requires weekly charge planning — medium mental load"
  },

  "chevy-bolt-red": {
    title: "High Mileage + No Home Charging",
    vehicle: "2017 Chevy Bolt EV (120k miles)",
    routine: "60 mi/day, no home charging, winter climate",
    expected_verdict: "High Friction",
    use_case: "See OFFO's risk assessment in action",
    key_insight: "Multiple stress factors compound — daily charging mandatory"
  },

  "ford-mach-e-winter": {
    title: "Winter Climate Edge Case",
    vehicle: "2022 Ford Mustang Mach-E Extended Range",
    routine: "45 mi/day, home charging, outdoor parking, winter",
    expected_verdict: "Mixed Fit",
    use_case: "Climate-specific analysis demonstration",
    key_insight: "Seasonal friction — range drops 30% in cold weather"
  },

  "tesla-model-y-commute": {
    title: "Long Commute Scenario",
    vehicle: "2023 Tesla Model Y Long Range",
    routine: "70 mi/day average, 120 mi longest day, home charging",
    expected_verdict: "Mixed Fit",
    use_case: "Daily usage pattern deep-dive",
    key_insight: "Longest days require planning — 100% charge needed weekly"
  },

  "chevy-bolt-ev-green": {
    title: "Good Fit - Home Charging, Mild Climate",
    vehicle: "2023 Chevy Bolt EV",
    routine: "~29 mi/day, home charging, mild climate",
    expected_verdict: "Good Fit",
    use_case: "See how a well-matched Bolt EV setup looks",
    key_insight: "Home charging + moderate miles = low mental load, rarely drops below 50% SOC"
  }
};

/**
 * Helper to get all demo slugs
 */
export const DEMO_SLUGS = Object.keys(DEMO_REPORTS);

/**
 * Helper to validate demo slug
 */
export function isDemoSlug(slug: string): slug is keyof typeof DEMO_REPORTS {
  return slug in DEMO_REPORTS;
}
