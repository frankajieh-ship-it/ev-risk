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
