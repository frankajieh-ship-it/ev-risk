import type { SeoPageContent } from "./types";

export const guides: Record<string, SeoPageContent> = {
  "no-home-charging-weekly-plan": {
    slug: "no-home-charging-weekly-plan",
    routeType: "guides",
    title: "No Home Charging? Weekly Plan That Works",
    metaDescription:
      "Don't have a home charger? This weekly charging plan shows apartment and condo EV owners how to stay charged without stress.",
    ogTitle: "No Home Charging Weekly Plan | OFFO",
    ogDescription:
      "A realistic weekly charging plan for EV owners without home charging access.",
    canonical: "/guides/no-home-charging-weekly-plan",
    headline: "No Home Charger? Here's a Weekly Plan.",
    subheadline:
      "Apartment and condo EV owners make it work every day. The key is a predictable routine, not a charger in your garage.",
    badgeText: "Charging Guide",
    bullets: [
      {
        icon: "MapPin",
        title: "Map Your Charging Options",
        description:
          "Identify 2-3 reliable chargers near your home, workplace, and regular errands. Apps like PlugShare and A Better Route Planner help.",
      },
      {
        icon: "Calendar",
        title: "Pick Two Charging Days",
        description:
          "Most EVs need charging 1-2 times per week. Pick consistent days (e.g., Tuesday evening and Saturday morning) to build the habit.",
      },
      {
        icon: "Coffee",
        title: "Pair Charging with Errands",
        description:
          "Charge while grocery shopping, at the gym, or during a coffee stop. 30-45 minutes at a Level 2 charger adds meaningful range.",
      },
      {
        icon: "Zap",
        title: "Use DC Fast Charging Strategically",
        description:
          "DCFC is your backup, not your daily plan. Use it for quick top-ups when you're behind, not as your primary charging method.",
      },
      {
        icon: "Battery",
        title: "Keep Buffer Above 20%",
        description:
          "Don't run to near-empty. Keeping a 20% buffer prevents range anxiety and avoids situations where your only option is a broken charger.",
      },
      {
        icon: "Snowflake",
        title: "Adjust for Cold Weather",
        description:
          "In winter, range drops 20-30%. Add an extra charging session to your weekly plan during cold months.",
      },
    ],
    faq: [
      {
        question: "Can I really own an EV without home charging?",
        answer:
          "Yes. Millions of EV owners charge exclusively at public chargers, workplace chargers, or destination chargers. The key is building a consistent routine.",
      },
      {
        question: "How much does public charging cost compared to home?",
        answer:
          "Public Level 2 is typically $0.20-0.35/kWh. DC fast charging is $0.30-0.60/kWh. Home charging (where available) is usually $0.10-0.15/kWh. The convenience trade-off is often worth it.",
      },
      {
        question: "What if my apartment adds EV chargers later?",
        answer:
          "Great \u2014 you'll save time and money. In the meantime, your public charging routine means you're never dependent on a single charger.",
      },
    ],
    ctaHeadline: "Shopping for an EV?",
    ctaDescription:
      "Paste a listing to check the deal and get risk flags specific to your situation.",
    ctaButtonText: "Check a Listing",
    ctaPlaceholder:
      "Paste the listing here...\n\nExample:\n2022 Chevrolet Bolt EV 2LT\n25,000 miles \u2014 $19,800\nClean title, 1 owner\nSan Francisco, CA",
    showSamplePreview: false,
    pageSource: "seo:guides:no-home-charging-weekly-plan",
    publishedDate: "2026-02-13",
  },

  "two-ev-household-one-charger-rules": {
    slug: "two-ev-household-one-charger-rules",
    routeType: "guides",
    title: "Two EVs, One Charger \u2014 Rules That Work",
    metaDescription:
      "Running two EVs on one home charger? These scheduling rules prevent morning surprises and keep both cars ready.",
    ogTitle: "Two EVs, One Charger Rules | OFFO",
    ogDescription:
      "Practical scheduling rules for households with two EVs and one charger.",
    canonical: "/guides/two-ev-household-one-charger-rules",
    headline: "Two EVs, One Charger?",
    subheadline:
      "It works \u2014 with simple rules. Most two-EV households don't need a second charger. They need a charging schedule.",
    badgeText: "Household Guide",
    bullets: [
      {
        icon: "Clock",
        title: "Alternate Nights",
        description:
          "The simplest rule: Car A charges on even nights, Car B on odd nights. Both stay topped up without conflicts.",
      },
      {
        icon: "ArrowLeftRight",
        title: "Swap at a Set Time",
        description:
          "If both cars need a charge the same night, swap at a set time (e.g., 11 PM). Most Level 2 chargers add 25+ miles per hour.",
      },
      {
        icon: "Battery",
        title: "Priority Goes to Lowest Battery",
        description:
          "When in doubt, plug in whichever car has the lower percentage. The other car can wait or use a public charger.",
      },
      {
        icon: "Calendar",
        title: "Plan Around Commutes",
        description:
          "The car with the longer commute gets priority. A 20-mile commuter needs less frequent charging than a 60-mile commuter.",
      },
      {
        icon: "Plug",
        title: "Consider a Smart Splitter",
        description:
          "Products like the NeoCharge or Dryer Buddy let two EVs share one outlet. The cars alternate automatically.",
      },
    ],
    faq: [
      {
        question: "Do I need a second charger for two EVs?",
        answer:
          "Usually not. Most households drive less than 40 miles per car per day. A Level 2 charger adds 25-30 miles per hour, so one overnight session easily covers a typical day's driving.",
      },
      {
        question: "What if both cars need a full charge the same night?",
        answer:
          "Set a timer or use the car's built-in scheduling to swap at midnight. One car charges from 8 PM to midnight, the other from midnight to 6 AM. Both get a full charge.",
      },
      {
        question: "Can I plug both cars into regular outlets?",
        answer:
          "A standard 120V outlet (Level 1) adds about 4-5 miles per hour. If both cars have access to separate outlets, overnight Level 1 charging may be enough for short commutes.",
      },
    ],
    ctaHeadline: "Shopping for a second EV?",
    ctaDescription:
      "Paste a listing to check the deal before you add another EV to the household.",
    ctaButtonText: "Check a Listing",
    ctaPlaceholder:
      "Paste the listing here...\n\nExample:\n2023 Hyundai Ioniq 6 SE\n18,000 miles \u2014 $27,500\nClean title, 1 owner\nPortland, OR",
    showSamplePreview: false,
    pageSource: "seo:guides:two-ev-household-one-charger-rules",
    publishedDate: "2026-02-13",
  },

  "cold-week-buffer-rule": {
    slug: "cold-week-buffer-rule",
    routeType: "guides",
    title: "The Cold Week Buffer Rule for EVs",
    metaDescription:
      "EV range drops in cold weather. The buffer rule keeps you from getting stranded during the worst week of winter.",
    ogTitle: "Cold Week Buffer Rule for EVs | OFFO",
    ogDescription:
      "How to handle EV range loss during cold weather with a simple buffer rule.",
    canonical: "/guides/cold-week-buffer-rule",
    headline: "The Cold Week Buffer Rule",
    subheadline:
      "EV range drops 20-30% in freezing weather. One simple rule prevents the worst-case scenario: never start the week below 50%.",
    badgeText: "Winter Driving Guide",
    bullets: [
      {
        icon: "Snowflake",
        title: "Expect 20-30% Range Loss",
        description:
          "Cold batteries charge slower and discharge faster. Plan for 70-80% of your rated range during cold spells.",
      },
      {
        icon: "Battery",
        title: "Start Monday Above 50%",
        description:
          "Charge over the weekend so you start the work week with margin. This absorbs unexpected detours and cold-snap range loss.",
      },
      {
        icon: "Thermometer",
        title: "Precondition While Plugged In",
        description:
          "Warm the cabin and battery while still connected to the charger. This uses grid power instead of battery power.",
      },
      {
        icon: "Gauge",
        title: "Lower Your Speed on Highways",
        description:
          "Aerodynamic drag increases range consumption at highway speeds. Dropping from 75 to 65 mph can add 10-15% range in cold weather.",
      },
      {
        icon: "MapPin",
        title: "Know Your Backup Chargers",
        description:
          "Identify DCFC locations along your regular routes. If you dip below your buffer, you know exactly where to stop.",
      },
    ],
    faq: [
      {
        question: "Why does cold weather reduce EV range so much?",
        answer:
          "Three factors: the battery chemistry is less efficient when cold, cabin heating uses significant energy, and regenerative braking is reduced until the battery warms up.",
      },
      {
        question: "Does preconditioning really help?",
        answer:
          "Yes. Preconditioning while plugged in can save 10-15% range by warming the battery and cabin using grid power instead of stored energy.",
      },
      {
        question: "At what temperature does range loss start?",
        answer:
          "Noticeable range loss begins around 40\u00b0F (4\u00b0C). Below 20\u00b0F (-7\u00b0C), expect 25-30% range reduction on most EVs.",
      },
    ],
    ctaHeadline: "Shopping for a cold-weather EV?",
    ctaDescription:
      "Paste a listing to check the deal and see if the range works for your climate.",
    ctaButtonText: "Check a Listing",
    ctaPlaceholder:
      "Paste the listing here...\n\nExample:\n2023 Tesla Model Y Long Range\n15,000 miles \u2014 $32,000\nAWD, clean title\nMinneapolis, MN",
    showSamplePreview: false,
    pageSource: "seo:guides:cold-week-buffer-rule",
    publishedDate: "2026-02-13",
  },

  "when-ev-ownership-feels-easy-what-changes": {
    slug: "when-ev-ownership-feels-easy-what-changes",
    routeType: "guides",
    title: "When EV Ownership Feels Easy \u2014 What Changes",
    metaDescription:
      "Most new EV owners stress about range and charging for the first month. Here's what shifts when it finally clicks.",
    ogTitle: "When EV Ownership Feels Easy | OFFO",
    ogDescription:
      "What changes when EV ownership stops feeling stressful and starts feeling easy.",
    canonical: "/guides/when-ev-ownership-feels-easy-what-changes",
    headline: "When Does EV Ownership Get Easy?",
    subheadline:
      "The first month is the hardest. You check the battery constantly, plan every trip around chargers, and wonder if you made a mistake. Then something shifts.",
    badgeText: "Ownership Guide",
    bullets: [
      {
        icon: "Brain",
        title: "You Stop Checking the Battery",
        description:
          "Once you know your car's real-world range, you stop obsessing over the number. You just know you're fine.",
      },
      {
        icon: "MapPin",
        title: "Charging Becomes Invisible",
        description:
          "You plug in at the same 2-3 places every week. It's not a task \u2014 it's part of your routine, like stopping for gas used to be.",
      },
      {
        icon: "Smile",
        title: "Range Anxiety Becomes Range Awareness",
        description:
          "You still know how far you can go, but it doesn't stress you. You plan around it automatically, the way you plan around a gas tank.",
      },
      {
        icon: "DollarSign",
        title: "You Notice the Savings",
        description:
          "After a few months, you realize you haven't been to a gas station. The savings are real and they compound.",
      },
      {
        icon: "Heart",
        title: "You Stop Explaining Yourself",
        description:
          "You stop defending EVs to skeptics. You just drive. The car speaks for itself.",
      },
    ],
    faq: [
      {
        question: "How long does the adjustment period typically last?",
        answer:
          "Most owners report feeling comfortable within 2-4 weeks. The first road trip is usually the turning point \u2014 once you've done one successfully, the anxiety drops significantly.",
      },
      {
        question: "What if I still have range anxiety after a month?",
        answer:
          "Consider whether your EV's range actually matches your daily needs. If you're routinely draining below 20%, the car may not be the right fit for your commute. OFFO's receipt can help you evaluate this before buying.",
      },
      {
        question: "Is EV ownership easier with home charging?",
        answer:
          "It's more convenient, but not required. Millions of EV owners charge exclusively at public or workplace chargers. The key is a consistent routine, not a specific setup.",
      },
    ],
    ctaHeadline: "Thinking about going electric?",
    ctaDescription:
      "Paste a listing to get an honest assessment of the deal before you commit.",
    ctaButtonText: "Check a Listing",
    ctaPlaceholder:
      "Paste the listing here...\n\nExample:\n2022 Kia EV6 Wind RWD\n28,000 miles \u2014 $25,900\nClean title, 1 owner\nAustin, TX",
    showSamplePreview: false,
    pageSource: "seo:guides:when-ev-ownership-feels-easy-what-changes",
    publishedDate: "2026-02-13",
  },

  // === HUB GUIDES (pillar pages) ===

  "no-home-charging": {
    slug: "no-home-charging",
    routeType: "guides",
    pillar: "no-home-charging",
    ctaType: "evfit",
    title: "The No Home Charging Survival Guide",
    metaDescription:
      "Living in an apartment or condo without a home charger? This guide covers everything you need to make EV ownership work without a private outlet.",
    ogTitle: "No Home Charging Survival Guide | OFFO",
    ogDescription:
      "How to own an EV without home charging — apartment strategies, workplace charging, and weekly plans that actually work.",
    canonical: "/guides/no-home-charging",
    headline: "The No Home Charging Survival Guide",
    subheadline:
      "Millions of EV owners charge exclusively at public and workplace chargers. The trick isn't finding a home charger — it's building a routine that works without one.",
    badgeText: "Apartment EV Guide",
    bullets: [
      {
        icon: "MapPin",
        title: "Scout Your Top 3 Chargers",
        description:
          "Identify reliable Level 2 chargers near your home, workplace, and regular stops. Use PlugShare to filter for always-available stations.",
      },
      {
        icon: "Calendar",
        title: "Build a Two-Day Charging Week",
        description:
          "Most EVs need 1-2 charges per week for a typical commute. Anchor charging sessions to recurring events — grocery runs, gym visits, evening errands.",
      },
      {
        icon: "Coffee",
        title: "Pair Charging with Activities",
        description:
          "30-45 minutes at a Level 2 charger adds 20-35 miles of range. The car charges while you do something you'd already be doing.",
      },
      {
        icon: "Zap",
        title: "Use DCFC as Backup Only",
        description:
          "DC fast charging is expensive and not great for long-term battery health. Reserve it for catch-up sessions when you're low, not routine charging.",
      },
      {
        icon: "Battery",
        title: "Never Go Below 20%",
        description:
          "With a 20% floor you always have options. Below that, you're dependent on whatever charger is nearest — which may be broken or occupied.",
      },
      {
        icon: "Plug",
        title: "Lobby Your Building",
        description:
          "Many apartments qualify for rebates and charging infrastructure grants. A written request with cost breakdowns has worked for many tenants.",
      },
    ],
    faq: [
      {
        question: "Can you really own an EV without home charging?",
        answer:
          "Yes — and many people do. Urban EV owners in cities like New York, Chicago, and LA routinely rely on public and workplace chargers. The key is predictable access, not a private outlet.",
      },
      {
        question: "What type of charger should I use most?",
        answer:
          "Level 2 (J1772) is your workhorse. It adds 20-30 miles per hour, is widely available at gyms, malls, and workplaces, and costs less than DC fast charging.",
      },
      {
        question: "How much more expensive is public charging vs home?",
        answer:
          "Home charging typically costs $0.10-0.15/kWh. Public Level 2 runs $0.20-0.35/kWh. DCFC can hit $0.40-0.60/kWh. Budget roughly 1.5-2x the cost of home charging.",
      },
      {
        question: "What if I need to charge during a cold snap?",
        answer:
          "Cold weather cuts range 20-30%. Add an extra charging session per week in winter and keep your minimum buffer at 30% instead of 20%.",
      },
    ],
    ctaHeadline: "Does an EV fit your situation?",
    ctaDescription:
      "Answer 8 quick questions and get a personalized fit score for your commute and charging access.",
    ctaButtonText: "Run Your EV Fit Check",
    ctaPlaceholder: "",
    showSamplePreview: false,
    pageSource: "seo:guides:no-home-charging",
    publishedDate: "2026-03-01",
  },

  "winter-ev-routine": {
    slug: "winter-ev-routine",
    routeType: "guides",
    pillar: "winter-ev-routine",
    ctaType: "evfit",
    title: "Winter EV Routine Playbook",
    metaDescription:
      "Cold weather kills EV range. This playbook gives you a concrete winter routine — preconditioning, charging buffers, and tips that actually work when it's freezing.",
    ogTitle: "Winter EV Routine Playbook | OFFO",
    ogDescription:
      "A practical winter EV routine: preconditioning, range buffers, and cold-weather charging habits that prevent surprises.",
    canonical: "/guides/winter-ev-routine",
    headline: "Winter EV Routine Playbook",
    subheadline:
      "Cold weather is the #1 source of EV surprises. A winter routine takes 5 minutes to build and eliminates 90% of cold-weather range anxiety.",
    badgeText: "Winter EV Guide",
    bullets: [
      {
        icon: "Snowflake",
        title: "Assume 70% of Rated Range",
        description:
          "In temperatures below 32°F, plan for 70-80% of your car's EPA range. Below 10°F, assume 60-65% on some models.",
      },
      {
        icon: "Thermometer",
        title: "Precondition While Plugged In",
        description:
          "Set a departure time in your car's app so it warms the cabin and battery on grid power, not battery power. This alone recovers 10-15% range.",
      },
      {
        icon: "Battery",
        title: "Start Every Monday at 70%+",
        description:
          "The weekly buffer rule: never start the work week below 70% in winter. Cold snaps and unexpected detours eat into your margin fast.",
      },
      {
        icon: "Gauge",
        title: "Drop Highway Speed to 65 mph",
        description:
          "Aerodynamic drag rises sharply above 65 mph in cold air. Slowing from 75 to 65 mph can add 10-15% effective range.",
      },
      {
        icon: "MapPin",
        title: "Map Your Cold-Weather Backup Chargers",
        description:
          "Identify two DC fast chargers along your regular routes before winter. You may never need them — but knowing they're there eliminates anxiety.",
      },
      {
        icon: "Plug",
        title: "Charge to 90% on Frigid Nights",
        description:
          "You don't need to charge above 80% in summer, but on nights before sub-freezing days, bumping to 90% gives you a meaningful buffer.",
      },
    ],
    faq: [
      {
        question: "How much range do EVs lose in winter?",
        answer:
          "Real-world data from AAA and Recurrent shows 20-40% range loss at 20°F compared to 70°F. Some models handle cold better than others — heat pump-equipped vehicles (Model Y, Ioniq 5, EV6) fare significantly better.",
      },
      {
        question: "Does cold weather damage the battery long-term?",
        answer:
          "Normal cold-weather use doesn't cause lasting damage. The battery management system protects the cells. What can cause wear is repeatedly fast-charging a very cold battery — preconditioning before DCFC mitigates this.",
      },
      {
        question: "Should I keep the car plugged in when parked in winter?",
        answer:
          "Yes, if possible. The BMS uses a small amount of energy to keep the battery from getting too cold. Staying plugged in means that energy comes from the grid, not the battery.",
      },
    ],
    ctaHeadline: "Will an EV work for your winter commute?",
    ctaDescription:
      "Get a personalized fit score that accounts for your climate and daily mileage.",
    ctaButtonText: "Run Your EV Fit Check",
    ctaPlaceholder: "",
    showSamplePreview: false,
    pageSource: "seo:guides:winter-ev-routine",
    publishedDate: "2026-03-01",
  },

  "budget-evs": {
    slug: "budget-evs",
    routeType: "guides",
    pillar: "budget-evs",
    ctaType: "evfit",
    title: "Budget EVs That Won't Be Annoying",
    metaDescription:
      "Not every cheap EV is a good deal. This guide covers which budget EVs under $25K actually work in real life — and which ones to avoid.",
    ogTitle: "Budget EVs That Won't Be Annoying | OFFO",
    ogDescription:
      "Which budget EVs under $25K are actually worth it — and which ones will frustrate you every week.",
    canonical: "/guides/budget-evs",
    headline: "Budget EVs That Won't Be Annoying",
    subheadline:
      "A cheap EV that doesn't fit your routine isn't a bargain. These picks have the range, charging speed, and reliability to work in real life.",
    badgeText: "Budget EV Guide",
    bullets: [
      {
        icon: "DollarSign",
        title: "Chevy Bolt EV / EUV — The Benchmark",
        description:
          "259-mile range, 11.5 kW onboard charger, and years of reliability data. Used 2022-2023 Bolts can be found for $16-21K after incentives. The best value in the segment.",
      },
      {
        icon: "Zap",
        title: "Nissan Leaf (40 kWh) — Know the Caveats",
        description:
          "The Leaf is affordable but uses CHAdeMO fast charging (being phased out) and has no active thermal management. Great for short commutes in mild climates. Avoid for road trips or hot/cold regions.",
      },
      {
        icon: "Battery",
        title: "Hyundai Kona Electric — Underrated Pick",
        description:
          "258-mile range, CCS charging, and a proven thermal system. Used 2022 Konas are competitive with Bolts and hold up better in cold weather.",
      },
      {
        icon: "AlertTriangle",
        title: "Avoid Low-Range Models for Anything But Urban Use",
        description:
          "Sub-150 mile EVs (older Leafs, Mini Cooper SE) work fine as a second car or city-only commuter. They're frustrating as a sole vehicle.",
      },
      {
        icon: "Wrench",
        title: "Check Battery Health Before Buying Used",
        description:
          "For any used EV under $20K, request a battery health report or use OBD2 + LeafSpy / BatteryView to check actual capacity vs. rated capacity.",
      },
      {
        icon: "ShieldCheck",
        title: "Verify Remaining Warranty Coverage",
        description:
          "Federal law requires an 8-year/100K-mile battery warranty on EVs. Check the original purchase date, not the odometer, to see what's left.",
      },
    ],
    faq: [
      {
        question: "What's the best EV under $20K?",
        answer:
          "A used 2022-2023 Chevy Bolt EV. It has 259 miles of EPA range, Level 2 home charging at 11.5 kW, CCS fast charging, and GM's battery recall replacements are largely complete. Look for a CPO option if budget allows.",
      },
      {
        question: "Are there new EVs under $25K?",
        answer:
          "The 2025 Chevy Equinox EV starts at $35K but qualifies for the full $7,500 federal tax credit, bringing the effective cost to $27,500. The Nissan Leaf is available new under $30K before incentives.",
      },
      {
        question: "Is the Nissan Leaf still worth buying?",
        answer:
          "For a short urban commute with mild weather, yes. The 40 kWh version has enough range for most city commutes and Level 2 charging is fine. Avoid it if you need consistent fast charging or live somewhere very hot or cold.",
      },
    ],
    ctaHeadline: "Will a budget EV fit your commute?",
    ctaDescription:
      "Run a quick fit check before you shop — know your range needs and charging situation before you fall in love with a listing.",
    ctaButtonText: "Run Your EV Fit Check",
    ctaPlaceholder: "",
    showSamplePreview: false,
    pageSource: "seo:guides:budget-evs",
    publishedDate: "2026-03-01",
  },

  "used-ev-proof-checklist": {
    slug: "used-ev-proof-checklist",
    routeType: "guides",
    pillar: "used-ev-proof-checklist",
    ctaType: "evfit",
    title: "Used EV Proof Checklist",
    metaDescription:
      "Before you buy a used EV, run through this checklist. Battery health, charging history, recall status, and 7 more things most buyers miss.",
    ogTitle: "Used EV Proof Checklist | OFFO",
    ogDescription:
      "10-point checklist for buying a used EV — covers battery health, charging speed, recall status, software, and more.",
    canonical: "/guides/used-ev-proof-checklist",
    headline: "Used EV Proof Checklist",
    subheadline:
      "A used EV with a degraded battery or missing warranty can cost $8,000+ to fix. These 10 checks take under an hour and protect you from the biggest risks.",
    badgeText: "Used EV Checklist",
    bullets: [
      {
        icon: "Battery",
        title: "Check Battery State of Health",
        description:
          "Use OBD2 + app (LeafSpy for Leaf, BatteryView for others) or request a dealership report. Above 85% SOH is acceptable; below 75% is a red flag.",
      },
      {
        icon: "Zap",
        title: "Test DC Fast Charging Speed",
        description:
          "Take it to a DCFC station. If a car rated for 100 kW peaks at 50 kW, the battery or charging hardware has degraded.",
      },
      {
        icon: "FileCheck",
        title: "Run a VIN Check for Open Recalls",
        description:
          "NHTSA.gov shows open recalls by VIN. Many older EVs (Bolt, Leaf, Hyundai/Kia) have had battery-related recalls — verify they're closed.",
      },
      {
        icon: "FileText",
        title: "Request Charging History",
        description:
          "Many EVs log charging events. Frequent DCFC sessions (especially >80%) accelerate degradation. Ask what the primary charging method was.",
      },
      {
        icon: "Smartphone",
        title: "Check OTA Software Version",
        description:
          "Verify the car has the latest software. Major updates can affect range, efficiency, and charging behavior. Outdated software = outdated performance.",
      },
      {
        icon: "ShieldCheck",
        title: "Confirm Battery Warranty Remaining",
        description:
          "Federal law mandates 8 years / 100K miles for the battery. Calculate from the original purchase date (not odometer) to know what's covered.",
      },
      {
        icon: "Wrench",
        title: "Inspect 12V Auxiliary Battery",
        description:
          "EVs have a small 12V battery that powers accessories. Failure strands you even if the main pack is full. If it's original on a 4+ year old car, budget for replacement.",
      },
      {
        icon: "Activity",
        title: "Check Regen Braking Strength",
        description:
          "Test one-pedal driving at low speed. Weak or inconsistent regen can indicate battery or inverter issues.",
      },
    ],
    faq: [
      {
        question: "How do I check battery health without tools?",
        answer:
          "Ask the seller to show you the battery health screen in the car's settings (most modern EVs display this). For third-party verification, a pre-purchase inspection at a dealership or EV-certified shop costs $100-150.",
      },
      {
        question: "What battery health percentage should I require?",
        answer:
          "For a primary vehicle, look for 85%+ SOH. For a secondary or urban-only car, 80%+ is workable. Below 75% means significantly reduced range and you should negotiate the price accordingly or walk away.",
      },
      {
        question: "Do I need a mechanic for a used EV inspection?",
        answer:
          "A standard mechanic can inspect the body, suspension, and 12V system. For battery and charging system checks, use an EV-certified technician or the dealership for that brand.",
      },
    ],
    ctaHeadline: "Know your fit before you buy",
    ctaDescription:
      "Check if an EV matches your commute and charging situation — before you fall in love with a listing.",
    ctaButtonText: "Run Your EV Fit Check",
    ctaPlaceholder: "",
    showSamplePreview: false,
    pageSource: "seo:guides:used-ev-proof-checklist",
    publishedDate: "2026-03-01",
  },

  // === SUPPORTING POSTS ===

  "apartment-ev-charging-plan": {
    slug: "apartment-ev-charging-plan",
    routeType: "guides",
    pillar: "no-home-charging",
    ctaType: "evfit",
    title: "Apartment EV Charging Plan: How to Make It Work",
    metaDescription:
      "No outlet in your apartment parking? Here's a concrete charging plan for apartment EV owners — workplace charging, nearby Level 2, and weekly routines.",
    ogTitle: "Apartment EV Charging Plan | OFFO",
    ogDescription:
      "How to charge an EV when you live in an apartment with no home charging access.",
    canonical: "/guides/apartment-ev-charging-plan",
    headline: "Apartment EV Charging Plan",
    subheadline:
      "No garage outlet? No problem — if you have a plan. Here's how apartment EV owners make it work without stressing about range every day.",
    badgeText: "Apartment Charging Guide",
    bullets: [
      {
        icon: "MapPin",
        title: "Start With Workplace Charging",
        description:
          "If your employer has Level 2 chargers, your charging problem is solved. Even 4 hours at 7 kW adds 25-35 miles — more than most daily commutes.",
      },
      {
        icon: "Coffee",
        title: "Use Destination Charging",
        description:
          "Hotels, malls, gyms, and grocery stores often have free or low-cost Level 2 chargers. Build charging into stops you'd already be making.",
      },
      {
        icon: "Calendar",
        title: "Plan Two Weekly Charging Windows",
        description:
          "Pick two consistent times per week — Tuesday morning at the gym, Saturday at the grocery store. Consistency beats scrambling for chargers.",
      },
      {
        icon: "Building",
        title: "Request Charging from Your Landlord",
        description:
          "Many states have EV charging rights laws that prevent landlords from unreasonably refusing tenant charger requests. Look up your state's law before asking.",
      },
      {
        icon: "Plug",
        title: "Consider a Portable EVSE",
        description:
          "A portable Level 1 EVSE plugs into any standard 120V outlet. If you can access any outlet near your parking spot, you can charge overnight (adds ~40 miles).",
      },
      {
        icon: "Battery",
        title: "Keep a 30% Floor on Weekdays",
        description:
          "Without home charging, your buffer is your safety net. A 30% minimum ensures you always have options and never need an emergency DCFC stop.",
      },
    ],
    faq: [
      {
        question: "What if my apartment has no chargers and no outlets near parking?",
        answer:
          "Your main options are workplace charging, nearby public Level 2, and DC fast charging for top-ups. If none of these are reliably accessible, an EV may be more friction than it's worth until your situation changes.",
      },
      {
        question: "Can I run an extension cord from my apartment to the car?",
        answer:
          "Not safely. Standard extension cords are not rated for the sustained draw of EV charging and can be a fire hazard. Use a proper EVSE on a dedicated outlet.",
      },
      {
        question: "What states have EV charging rights laws for renters?",
        answer:
          "California, Colorado, Florida, and several other states have laws limiting landlords' ability to refuse reasonable EV charger requests. Check your state's utility commission or an EV advocacy org for current rules.",
      },
    ],
    ctaHeadline: "Will an EV work in your apartment?",
    ctaDescription:
      "Answer 8 quick questions to find out if an EV fits your charging access and commute.",
    ctaButtonText: "Run Your EV Fit Check",
    ctaPlaceholder: "",
    showSamplePreview: false,
    pageSource: "seo:guides:apartment-ev-charging-plan",
    publishedDate: "2026-03-01",
  },

  "two-drivers-one-charger": {
    slug: "two-drivers-one-charger",
    routeType: "guides",
    pillar: "no-home-charging",
    ctaType: "evfit",
    title: "Two Drivers, One Charger: Household EV Scheduling",
    metaDescription:
      "Two EVs and one home charger? These scheduling rules prevent morning surprises and keep both drivers happy.",
    ogTitle: "Two Drivers, One Charger | OFFO",
    ogDescription:
      "How two-EV households share a single home charger without conflict — scheduling rules, apps, and smart splitters.",
    canonical: "/guides/two-drivers-one-charger",
    headline: "Two Drivers, One Home Charger",
    subheadline:
      "Sharing a home charger works fine — as long as you have rules. These scheduling habits prevent the morning surprise of an empty battery.",
    badgeText: "Household EV Guide",
    bullets: [
      {
        icon: "Clock",
        title: "Alternate Nights by Default",
        description:
          "Car A charges Monday/Wednesday/Friday. Car B charges Tuesday/Thursday/Saturday. One car always has a full charge in the morning.",
      },
      {
        icon: "Battery",
        title: "Priority Goes to Lowest SOC",
        description:
          "On conflict nights, the car with the lower battery gets priority. The other driver uses public charging or waits for the overnight slot.",
      },
      {
        icon: "Plug",
        title: "Try a Smart Charger Splitter",
        description:
          "Products like NeoCharge split one 240V outlet between two cars. They alternate automatically so both cars charge every night at reduced speed.",
      },
      {
        icon: "Smartphone",
        title: "Use Scheduled Charging",
        description:
          "Set both cars to start charging at midnight. The one plugged in first charges first. Unplug and swap at a set time if both need significant charge.",
      },
      {
        icon: "Calendar",
        title: "Plan for High-Demand Weeks",
        description:
          "Road trips, cold snaps, and unexpected detours increase charging demand. Add a public charging session mid-week as a buffer.",
      },
    ],
    faq: [
      {
        question: "Do we need a second charger with two EVs?",
        answer:
          "Usually not. Most households drive less than 40 miles per car per day. One Level 2 charger adding 25-30 miles per hour can handle both cars on alternating nights.",
      },
      {
        question: "What's a smart charger splitter?",
        answer:
          "Devices like NeoCharge or Dryer Buddy tap a 240V outlet and connect two EVs. They alternate which car draws power, so both charge overnight without a second EVSE installation.",
      },
      {
        question: "What if both cars need a full charge the same night?",
        answer:
          "Set a timer: Car A charges from 8 PM to midnight, Car B from midnight to 6 AM. At 25+ miles per hour of Level 2 charging, both get meaningful charge overnight.",
      },
    ],
    ctaHeadline: "Planning to add a second EV?",
    ctaDescription:
      "Check if it fits your household's commute patterns and charging setup.",
    ctaButtonText: "Run Your EV Fit Check",
    ctaPlaceholder: "",
    showSamplePreview: false,
    pageSource: "seo:guides:two-drivers-one-charger",
    publishedDate: "2026-03-01",
  },

  "ev-winter-range-reality": {
    slug: "ev-winter-range-reality",
    routeType: "guides",
    pillar: "winter-ev-routine",
    ctaType: "evfit",
    title: "EV Winter Range Reality: What Actually Happens",
    metaDescription:
      "EPA range numbers mean nothing in winter. Here's what real EV owners actually experience at 20°F, 10°F, and below zero — by model.",
    ogTitle: "EV Winter Range Reality | OFFO",
    ogDescription:
      "Real-world EV range in winter — what to expect at different temperatures and which models handle cold best.",
    canonical: "/guides/ev-winter-range-reality",
    headline: "EV Winter Range Reality",
    subheadline:
      "EPA range is measured at 75°F. In a Minneapolis January, that number is fiction. Here's what actually happens to EV range in cold weather.",
    badgeText: "Winter EV Reality",
    bullets: [
      {
        icon: "Snowflake",
        title: "20°F: Expect 75-80% of EPA Range",
        description:
          "At 20°F (-7°C), most EVs deliver 75-80% of their EPA range. A 250-mile car becomes a 190-200 mile car in moderate cold.",
      },
      {
        icon: "Thermometer",
        title: "Below 10°F: Down to 60-70% Is Common",
        description:
          "Below 10°F (-12°C), range loss accelerates. Older or less insulated battery packs (Nissan Leaf, older Model S) see the biggest drops.",
      },
      {
        icon: "Activity",
        title: "Heat Pump vs. Resistance Heating",
        description:
          "Heat pump-equipped EVs (Model Y 2021+, Ioniq 5, EV6, Ioniq 6) use significantly less energy for cabin heat, recovering 5-15% range compared to resistance heaters.",
      },
      {
        icon: "Gauge",
        title: "Preconditioning Recovers 10-15%",
        description:
          "Warming the cabin and battery on grid power before departure (using the car's app) recovers roughly 10-15% of cold-weather range loss.",
      },
      {
        icon: "Battery",
        title: "Charging Speed Drops Too",
        description:
          "Cold batteries accept DC fast charging more slowly. Preconditioning before a DCFC stop — some cars do this automatically when you navigate to a charger — speeds up the session.",
      },
      {
        icon: "MapPin",
        title: "Worst Models for Cold: Nissan Leaf 40 kWh",
        description:
          "The Leaf lacks active thermal management. Range loss at 20°F is among the highest of any modern EV — 30-40% is common. Bad choice for cold climates.",
      },
    ],
    faq: [
      {
        question: "Which EV handles cold weather best?",
        answer:
          "Heat pump models with active battery thermal management perform best: Tesla Model Y (2021+), Hyundai Ioniq 5, Kia EV6, Hyundai Ioniq 6, and Rivian R1T/R1S. All retain 85%+ range at 20°F in real-world testing.",
      },
      {
        question: "Does cold weather permanently damage EV batteries?",
        answer:
          "Normal cold-weather use doesn't cause permanent degradation. Repeated DC fast charging of a very cold (unpreconditioned) battery can cause minor long-term wear, but most BMS systems limit charge rate automatically.",
      },
      {
        question: "How much does preconditioning help?",
        answer:
          "Measured real-world improvement is 10-20 miles of effective range on a 250-mile car at 20°F. On a car with resistance heating (no heat pump), it makes a bigger difference because the cabin heat draw is higher.",
      },
    ],
    ctaHeadline: "Does an EV work for your winter commute?",
    ctaDescription:
      "Get a fit score that factors in your climate and daily mileage before you decide.",
    ctaButtonText: "Run Your EV Fit Check",
    ctaPlaceholder: "",
    showSamplePreview: false,
    pageSource: "seo:guides:ev-winter-range-reality",
    publishedDate: "2026-03-01",
  },

  "public-charging-cost-vs-gas": {
    slug: "public-charging-cost-vs-gas",
    routeType: "guides",
    pillar: "no-home-charging",
    ctaType: "evfit",
    title: "Public EV Charging Cost vs. Gas: The Real Math",
    metaDescription:
      "No home charger? Here's what public EV charging actually costs vs. gas — broken down by charger type and compared to a gas car.",
    ogTitle: "Public EV Charging Cost vs. Gas | OFFO",
    ogDescription:
      "Real cost comparison: public EV charging (Level 2 and DCFC) vs. filling up at a gas station.",
    canonical: "/guides/public-charging-cost-vs-gas",
    headline: "Public Charging vs. Gas: The Real Math",
    subheadline:
      "Home charging is cheaper than gas in almost every case. Public charging is more complicated. Here's what you'll actually pay if you charge exclusively in public.",
    badgeText: "Charging Cost Guide",
    bullets: [
      {
        icon: "DollarSign",
        title: "Home Charging: ~$0.03-0.05 Per Mile",
        description:
          "At $0.12/kWh average and 3.5 miles/kWh, home charging costs about $0.03-0.04/mile — far cheaper than any other option.",
      },
      {
        icon: "Plug",
        title: "Public Level 2: ~$0.06-0.10 Per Mile",
        description:
          "At $0.25-0.35/kWh, Level 2 public charging runs $0.07-0.10/mile. Still cheaper than gas in most cases, especially for fuel-efficient ICE cars.",
      },
      {
        icon: "Zap",
        title: "DC Fast Charging: ~$0.10-0.18 Per Mile",
        description:
          "At $0.40-0.60/kWh (or per-minute pricing), DCFC can approach or exceed the cost of a 35 mpg gas car at $3.50/gallon.",
      },
      {
        icon: "Gauge",
        title: "Gas Benchmark: ~$0.09-0.13 Per Mile",
        description:
          "A 30 mpg car at $3.50/gallon costs $0.117/mile. A 25 mpg car at $4/gallon costs $0.16/mile. Level 2 public charging typically beats this.",
      },
      {
        icon: "AlertTriangle",
        title: "DCFC Reliance Closes the Gap",
        description:
          "If you charge exclusively at DC fast chargers, your fuel costs may only be 10-20% lower than a comparable gas car — or even equal on some networks.",
      },
      {
        icon: "Brain",
        title: "The Real Win Is Time, Not Just Money",
        description:
          "Charging at work or during errands means you're not making dedicated fuel stops. Even if the per-mile cost is similar, you're recovering time.",
      },
    ],
    faq: [
      {
        question: "Is it worth owning an EV if I can only charge in public?",
        answer:
          "Financially, Level 2 public charging still saves money over gas for most drivers. The bigger question is convenience — if public chargers are readily available at your regular stops, the friction is low. If you're making dedicated charging trips, the math changes.",
      },
      {
        question: "How does Electrify America pricing work?",
        answer:
          "Electrify America charges per kWh (around $0.48/kWh as of 2025) for non-members, or $0.36/kWh with a $4/month membership. At $0.48/kWh and 3.5 mi/kWh, that's $0.137/mile — comparable to a 25 mpg car at $3.42/gallon.",
      },
      {
        question: "Do workplace chargers usually cost money?",
        answer:
          "Many employers offer free Level 2 charging as a benefit. Some charge a flat daily fee ($1-3). If you have free workplace charging, your fuel cost drops dramatically even without home charging.",
      },
    ],
    ctaHeadline: "Is an EV the right financial move for you?",
    ctaDescription:
      "Your fit score includes a cost estimate based on your commute and likely charging mix.",
    ctaButtonText: "Run Your EV Fit Check",
    ctaPlaceholder: "",
    showSamplePreview: false,
    pageSource: "seo:guides:public-charging-cost-vs-gas",
    publishedDate: "2026-03-01",
  },

  "best-used-ev-under-15k": {
    slug: "best-used-ev-under-15k",
    routeType: "guides",
    pillar: "budget-evs",
    ctaType: "evfit",
    title: "Best Used EVs Under $15K (That Actually Work)",
    metaDescription:
      "Used EVs under $15K can be excellent — or a disaster. Here's which models to target, what to check, and what to avoid in the budget EV market.",
    ogTitle: "Best Used EVs Under $15K | OFFO",
    ogDescription:
      "Which used EVs under $15K are worth it and which to avoid — real ranges, common issues, and what to inspect.",
    canonical: "/guides/best-used-ev-under-15k",
    headline: "Best Used EVs Under $15K",
    subheadline:
      "The sub-$15K EV market has excellent options and landmines. Knowing which is which saves you from a frustrating first EV experience.",
    badgeText: "Budget EV Guide",
    bullets: [
      {
        icon: "DollarSign",
        title: "Chevy Bolt EV (2019-2021) — Best Bang for Buck",
        description:
          "Pre-recall Bolts with completed battery replacements sell for $12-15K. You get 259 miles of range, a real fast charger, and years of data. Verify the battery was replaced.",
      },
      {
        icon: "Battery",
        title: "Nissan Leaf (40 kWh, 2019-2021) — Good for Short Commutes",
        description:
          "Real-world range in mild weather: 140-170 miles. Avoid hot climates (no thermal management), avoid highway-heavy commutes. Fine for urban driving under 50 miles/day.",
      },
      {
        icon: "Zap",
        title: "BMW i3 (2017-2020) — Surprisingly Great",
        description:
          "Quirky but reliable. The 94 Ah models have 130-150 mile real-world range. CCS fast charging (on i3s trim). Lower maintenance costs than expected.",
      },
      {
        icon: "AlertTriangle",
        title: "Avoid: Pre-Recall Bolts Without Battery Replacement",
        description:
          "The original 2017-2022 Bolt batteries had a fire risk. Only buy if you can confirm the recall battery replacement is complete via Carfax or GM service records.",
      },
      {
        icon: "Wrench",
        title: "Always Check Battery Health",
        description:
          "Budget EVs have often lived harder lives. Get a battery health report or use OBD2 + app. Below 80% SOH means meaningful range loss and harder resale.",
      },
      {
        icon: "ShieldCheck",
        title: "Confirm Warranty Status",
        description:
          "At $15K and 4-6 years old, most battery warranties are still active. Check the original purchase date — not mileage — to see remaining coverage.",
      },
    ],
    faq: [
      {
        question: "What's the best EV you can buy for $15K?",
        answer:
          "A 2019-2021 Chevy Bolt with completed recall battery replacement. It's the most range per dollar in this price range, charges reliably at DCFC, and has an established reliability record.",
      },
      {
        question: "Is the Nissan Leaf worth buying at this price?",
        answer:
          "For urban commuting in a mild climate, yes. For anything involving highway driving, cold weather, or lots of DC fast charging, no. The lack of thermal management is a real limitation.",
      },
      {
        question: "Are there reliable used EVs from non-mainstream brands?",
        answer:
          "The BMW i3 is a solid choice despite its quirky design. The Fiat 500e and Smart EQ are fine as pure city cars but impractical as primary vehicles.",
      },
    ],
    ctaHeadline: "Will a budget EV fit your routine?",
    ctaDescription:
      "Check your commute and charging situation before you commit to a used EV.",
    ctaButtonText: "Run Your EV Fit Check",
    ctaPlaceholder: "",
    showSamplePreview: false,
    pageSource: "seo:guides:best-used-ev-under-15k",
    publishedDate: "2026-03-01",
  },

  "what-to-ask-seller-used-ev": {
    slug: "what-to-ask-seller-used-ev",
    routeType: "guides",
    pillar: "used-ev-proof-checklist",
    ctaType: "evfit",
    title: "What to Ask a Seller When Buying a Used EV",
    metaDescription:
      "These 10 questions separate motivated sellers from problem sellers when buying a used EV. Ask them before you visit.",
    ogTitle: "What to Ask a Seller When Buying a Used EV | OFFO",
    ogDescription:
      "10 questions to ask before meeting a used EV seller — battery health, charging history, recall status, and more.",
    canonical: "/guides/what-to-ask-seller-used-ev",
    headline: "What to Ask a Seller When Buying a Used EV",
    subheadline:
      "A seller who can't answer basic questions about a used EV is either uninformed or hiding something. These questions tell you which one you're dealing with.",
    badgeText: "Used EV Buying Guide",
    bullets: [
      {
        icon: "Battery",
        title: "\"What's the current battery state of health?\"",
        description:
          "A good seller knows the answer or can show you the screen. Anything below 85% warrants a price negotiation or walk-away.",
      },
      {
        icon: "Zap",
        title: "\"How did you primarily charge it — home, work, or DCFC?\"",
        description:
          "Heavy DCFC use (>80% of sessions) accelerates degradation over time. Home or workplace Level 2 charging is ideal.",
      },
      {
        icon: "FileCheck",
        title: "\"Have any recalls been completed? Can I see service records?\"",
        description:
          "Battery recalls on Bolt, Leaf, and Hyundai/Kia EVs are significant. Verify recall status via NHTSA VIN lookup and confirm the fix was completed.",
      },
      {
        icon: "Wrench",
        title: "\"When was the 12V battery last replaced?\"",
        description:
          "12V batteries in EVs typically last 3-5 years. An aging 12V battery is a common cause of no-start events even with a full main pack.",
      },
      {
        icon: "Smartphone",
        title: "\"Is the car running the latest software?\"",
        description:
          "Outdated software can limit charging speed and range efficiency. Ask them to show you the current software version in settings.",
      },
      {
        icon: "FileText",
        title: "\"What charging equipment comes with the car?\"",
        description:
          "Many used EVs are sold without the original portable EVSE. Replacement units cost $200-400. It's a fair negotiating point.",
      },
      {
        icon: "DollarSign",
        title: "\"Has the car been used for rideshare or rental?\"",
        description:
          "Rideshare and rental EVs often have heavy DCFC usage and higher mileage than their age suggests. This accelerates wear.",
      },
      {
        icon: "ShieldCheck",
        title: "\"When was it originally purchased new?\"",
        description:
          "This determines remaining battery warranty coverage (8 years from original sale date). Critical for cars that have changed hands multiple times.",
      },
    ],
    faq: [
      {
        question: "What if the seller can't answer these questions?",
        answer:
          "It depends on the question. Not knowing the software version is understandable. Not knowing if battery recalls were completed is a red flag. Use your judgment about which gaps are forgivable.",
      },
      {
        question: "Should I get a pre-purchase inspection for a used EV?",
        answer:
          "For any EV over $15K or over 50K miles, yes. An EV-certified inspection costs $100-150 and can surface issues the seller either doesn't know about or isn't disclosing.",
      },
      {
        question: "How do I check if recalls are open?",
        answer:
          "Go to nhtsa.gov/recalls, enter the VIN, and look for open safety recalls. Cross-reference with the service records the seller provides.",
      },
    ],
    ctaHeadline: "Know what fits before you shop",
    ctaDescription:
      "Run your EV fit check to understand what range and charging you actually need — before you start evaluating listings.",
    ctaButtonText: "Run Your EV Fit Check",
    ctaPlaceholder: "",
    showSamplePreview: false,
    pageSource: "seo:guides:what-to-ask-seller-used-ev",
    publishedDate: "2026-03-01",
  },

  "how-to-write-a-reddit-post-that-gets-useful-car-advice": {
    slug: "how-to-write-a-reddit-post-that-gets-useful-car-advice",
    routeType: "guides",
    title: "How to Write a Reddit Post That Gets Useful Car Advice",
    metaDescription:
      "Most Reddit car-buying posts get ignored or trolled. This template gets you real answers from people who know.",
    ogTitle: "Write a Reddit Post That Gets Car Advice | OFFO",
    ogDescription:
      "A template for writing Reddit car-buying posts that actually get helpful replies.",
    canonical:
      "/guides/how-to-write-a-reddit-post-that-gets-useful-car-advice",
    headline: "Get Real Answers on Reddit",
    subheadline:
      'Most car-buying posts on Reddit get ignored, trolled, or answered with "just get a Corolla." The difference is how you ask.',
    badgeText: "Reddit Guide",
    bullets: [
      {
        icon: "Target",
        title: "Lead With One Specific Question",
        description:
          'Don\'t ask "is this a good deal?" Ask "is $24K fair for a 2022 Model 3 with 47K miles and no service records in Phoenix?"',
      },
      {
        icon: "FileText",
        title: "Include the Key Numbers",
        description:
          "Year, make, model, trim, mileage, price, location, seller type. Missing any of these forces responders to guess.",
      },
      {
        icon: "AlertTriangle",
        title: "State Your One Worry",
        description:
          'Instead of a wall of text, name the one thing that concerns you most. "The price seems $3K below market \u2014 what am I missing?" gets better replies.',
      },
      {
        icon: "MessageSquare",
        title: "Use the Right Subreddit",
        description:
          "r/whatcarshouldIbuy for general advice, the model-specific subreddit (r/TeslaModel3, r/BoltEV, etc.) for detailed questions.",
      },
      {
        icon: "ThumbsUp",
        title: "Reply to Every Commenter",
        description:
          "Engagement signals to the algorithm that your post is worth showing. Thank people, ask follow-ups, and the thread grows.",
      },
    ],
    faq: [
      {
        question: "What subreddit should I post in?",
        answer:
          "For general buying advice: r/whatcarshouldIbuy. For used EV specific: r/electricvehicles. For model-specific questions, find the dedicated subreddit (r/BoltEV, r/TeslaModel3, r/ioniq5, etc.).",
      },
      {
        question: 'Why do most "is this a good deal?" posts get ignored?',
        answer:
          "Because they require the reader to do all the work. When you include the specific numbers and ask a focused question, you make it easy for knowledgeable people to give a quick, helpful answer.",
      },
      {
        question: "Should I include the listing link in my Reddit post?",
        answer:
          "Some subreddits don't allow links. Instead, paste the key details (year, make, model, trim, mileage, price, location, title status) as text. This also prevents the listing from being taken down before people can help.",
      },
    ],
    ctaHeadline: "Get your analysis before posting",
    ctaDescription:
      "Paste the listing here first \u2014 OFFO generates the risk flags and a ready-to-post Reddit draft for you.",
    ctaButtonText: "Generate Receipt + Reddit Draft",
    ctaPlaceholder:
      "Paste the listing here...\n\nExample:\n2021 Volkswagen ID.4 Pro S\n33,000 miles \u2014 $21,500\nPrivate seller, clean title\nDenver, CO",
    showSamplePreview: true,
    pageSource:
      "seo:guides:how-to-write-a-reddit-post-that-gets-useful-car-advice",
    publishedDate: "2026-02-13",
  },
};

export function getGuide(slug: string): SeoPageContent | undefined {
  return guides[slug];
}

export function getAllGuideSlugs(): string[] {
  return Object.keys(guides);
}
