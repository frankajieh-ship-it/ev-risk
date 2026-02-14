import type { SeoPageContent } from "./types";

export const checklists: Record<string, SeoPageContent> = {
  "underpriced-ev-listing": {
    slug: "underpriced-ev-listing",
    routeType: "checklists",
    title: "Underpriced EV Listing Checklist",
    metaDescription:
      "Found a used EV listing that seems too cheap? Use this free checklist to verify the deal before you message the seller.",
    ogTitle: "Underpriced EV Listing Checklist | OFFO",
    ogDescription:
      "Found a used EV listing that seems too cheap? Use this free checklist to verify the deal before you message the seller.",
    canonical: "/checklists/underpriced-ev-listing",
    headline: "Found a Cheap EV Listing?",
    subheadline:
      "An underpriced EV listing can be a great deal \u2014 or a hidden risk. Run through these 7 checks before you message the seller.",
    badgeText: "Free Verification Checklist",
    bullets: [
      {
        icon: "Battery",
        title: "Battery Health",
        description:
          "Check state-of-health (SoH) percentage and remaining range vs. original EPA rating.",
      },
      {
        icon: "FileWarning",
        title: "Title Status",
        description:
          "Verify clean title \u2014 salvage or rebuilt titles can hide flood, fire, or collision damage.",
      },
      {
        icon: "CarFront",
        title: "Accident History",
        description:
          "Review Carfax or AutoCheck for unreported accidents, frame damage, or airbag deployments.",
      },
      {
        icon: "Zap",
        title: "Charging Capability",
        description:
          "Confirm DC fast charge (DCFC) support and onboard charger kW rating for your driving needs.",
      },
      {
        icon: "Wrench",
        title: "Service History",
        description:
          "Look for regular maintenance records \u2014 especially 12V battery, coolant, and brake fluid service.",
      },
      {
        icon: "DollarSign",
        title: "Price Comparison",
        description:
          "Compare against KBB, Edmunds, and recent sold listings for the same year/model/mileage.",
      },
      {
        icon: "UserCheck",
        title: "Seller Identity",
        description:
          "Private sellers and curbstoners carry different risk profiles than franchise dealers.",
      },
    ],
    faq: [
      {
        question: "Why are some EV listings priced below market?",
        answer:
          "Common reasons include high mileage, degraded battery, salvage title, expiring warranty, or a seller who needs cash fast. Low price alone is not a red flag, but it warrants extra verification.",
      },
      {
        question: "How do I check an EV battery's health?",
        answer:
          "Ask the seller for a battery health report or state-of-health (SoH) reading. Many EVs display this in the infotainment system. Third-party tools like Recurrent or a dealer diagnostic scan can also provide this data.",
      },
      {
        question: "Should I get a pre-purchase inspection for a used EV?",
        answer:
          "Yes. A pre-purchase inspection (PPI) from a mechanic experienced with EVs can catch issues a standard inspection misses, including battery degradation, high-voltage system faults, and suspension wear from heavy battery weight.",
      },
      {
        question: "What is a curbstoner?",
        answer:
          "A curbstoner is an unlicensed dealer who poses as a private seller to flip cars without disclosing known issues. Signs include multiple listings from the same phone number or meeting in a parking lot rather than a home address.",
      },
    ],
    ctaHeadline: "Check a listing now",
    ctaDescription:
      "Paste the listing text below and get an AI-powered deal verdict with risk flags, must-ask questions, and a negotiation opener.",
    ctaButtonText: "Check This Listing",
    ctaPlaceholder:
      "Paste the listing here...\n\nExample:\n2022 Tesla Model 3 Long Range\n28,000 miles \u2014 $24,500\nClean title, 1 owner, private seller\nPhoenix, AZ",
    showSamplePreview: true,
    pageSource: "seo:checklists:underpriced-ev-listing",
    publishedDate: "2025-01-15",
    modifiedDate: "2026-02-13",
  },

  "used-ev-tax-credit-paperwork": {
    slug: "used-ev-tax-credit-paperwork",
    routeType: "checklists",
    title: "Used EV Tax Credit Paperwork Checklist",
    metaDescription:
      "Buying a used EV and want the $4,000 federal tax credit? Verify these paperwork requirements before you close the deal.",
    ogTitle: "Used EV Tax Credit Paperwork Checklist | OFFO",
    ogDescription:
      "Buying a used EV and want the $4,000 federal tax credit? Verify these paperwork requirements before you close the deal.",
    canonical: "/checklists/used-ev-tax-credit-paperwork",
    headline: "Claiming the Used EV Tax Credit?",
    subheadline:
      "The $4,000 federal tax credit for used EVs has strict eligibility rules. Miss one and you lose the credit entirely. Verify these items before you sign.",
    badgeText: "Tax Credit Verification",
    bullets: [
      {
        icon: "DollarSign",
        title: "Sale Price Under $25,000",
        description:
          "The vehicle sale price must be $25,000 or less. This is the actual transaction price, not the listing price or MSRP.",
      },
      {
        icon: "Building",
        title: "Licensed Dealer Required",
        description:
          "The sale must go through a licensed dealer. Private party sales do not qualify for the used EV tax credit.",
      },
      {
        icon: "Calendar",
        title: "Model Year at Least 2 Years Old",
        description:
          "The vehicle model year must be at least 2 years before the calendar year of purchase.",
      },
      {
        icon: "FileCheck",
        title: "First Transfer Only",
        description:
          "The credit applies only to the first transfer of the vehicle. If a previous owner already claimed it, you cannot claim again.",
      },
      {
        icon: "User",
        title: "Income Limits Apply",
        description:
          "Modified AGI must be $75K or less (single), $112.5K (head of household), or $150K (married filing jointly) for the year of purchase.",
      },
      {
        icon: "FileText",
        title: "IRS Form 8936 Required",
        description:
          "File IRS Form 8936 with your tax return. The dealer must also report the sale to the IRS using the Energy Credits Online portal.",
      },
    ],
    faq: [
      {
        question:
          "Can I claim the used EV tax credit on a private party purchase?",
        answer:
          "No. The sale must go through a licensed dealer. If you find a car from a private seller, some dealers offer consignment services that may qualify.",
      },
      {
        question:
          "What if the listing price is over $25,000 but the dealer negotiates down?",
        answer:
          "The actual sale price on the purchase agreement is what matters, not the listing price. If the final transaction price is $25,000 or less, it qualifies.",
      },
      {
        question: "Can I get the tax credit at the point of sale?",
        answer:
          "Starting in 2024, dealers can transfer the credit to you as a discount at the point of sale. The dealer must be registered with the IRS Energy Credits Online portal.",
      },
    ],
    ctaHeadline: "Check your listing",
    ctaDescription:
      "Paste the listing below to verify the deal and get a risk assessment before you commit.",
    ctaButtonText: "Check This Listing",
    ctaPlaceholder:
      "Paste the listing here...\n\nExample:\n2021 Chevrolet Bolt EV LT\n35,000 miles \u2014 $18,900\nDealer, clean title\nAtlanta, GA",
    showSamplePreview: false,
    pageSource: "seo:checklists:used-ev-tax-credit-paperwork",
    publishedDate: "2026-02-13",
  },

  "battery-health-report-what-to-ask": {
    slug: "battery-health-report-what-to-ask",
    routeType: "checklists",
    title: "Battery Health Report \u2014 What to Ask",
    metaDescription:
      "Buying a used EV? Here's exactly what to ask the seller about battery health, degradation, and warranty before you commit.",
    ogTitle: "Battery Health Report \u2014 What to Ask | OFFO",
    ogDescription:
      "Know exactly what to ask about EV battery health before buying a used electric vehicle.",
    canonical: "/checklists/battery-health-report-what-to-ask",
    headline: "What to Ask About Battery Health",
    subheadline:
      "The battery is the most expensive component in any EV. These questions help you understand what you're actually buying.",
    badgeText: "Battery Verification Guide",
    bullets: [
      {
        icon: "Battery",
        title: "State of Health (SoH) Percentage",
        description:
          "Ask for the current SoH reading. Below 80% means noticeably reduced range and potential warranty coverage.",
      },
      {
        icon: "Thermometer",
        title: "Climate and Charging History",
        description:
          "Frequent DC fast charging and extreme heat accelerate degradation. Ask where the car was primarily driven and how it was charged.",
      },
      {
        icon: "ShieldCheck",
        title: "Battery Warranty Status",
        description:
          "Most EV batteries are warrantied for 8 years / 100K miles. Verify remaining coverage and whether any claims have been filed.",
      },
      {
        icon: "Activity",
        title: "Degradation Curve",
        description:
          "Ask for a degradation trend if available. Tools like Recurrent, Geotab, or the OEM app may show historical battery data.",
      },
      {
        icon: "AlertTriangle",
        title: "Battery Management System Faults",
        description:
          "Request a diagnostic scan for BMS fault codes. Even if the battery seems healthy, stored faults can indicate future problems.",
      },
    ],
    faq: [
      {
        question: "What is a normal battery degradation rate for EVs?",
        answer:
          "Most modern EVs lose 2-3% capacity per year under normal conditions. After 5 years, 85-90% SoH is typical. Below 80% is considered significant degradation.",
      },
      {
        question: "Can I test battery health myself?",
        answer:
          "Some OBD-II readers with EV-specific software (like LeafSpy for Nissan Leaf or ABRP for Tesla) can read battery data. For the most accurate reading, a dealer diagnostic scan is recommended.",
      },
      {
        question: "Does DC fast charging really damage the battery?",
        answer:
          "Frequent DC fast charging (especially at high ambient temperatures) can accelerate degradation. Occasional use is fine, but an EV that was fast-charged daily may show more wear.",
      },
    ],
    ctaHeadline: "Check a listing now",
    ctaDescription:
      "Paste a listing to get an AI-powered assessment of the deal, including battery-related risk flags.",
    ctaButtonText: "Check This Listing",
    ctaPlaceholder:
      "Paste the listing here...\n\nExample:\n2020 Nissan Leaf SV Plus\n42,000 miles \u2014 $15,800\nPrivate seller, clean title\nDenver, CO",
    showSamplePreview: true,
    pageSource: "seo:checklists:battery-health-report-what-to-ask",
    publishedDate: "2026-02-13",
  },

  "used-ev-test-drive-checklist": {
    slug: "used-ev-test-drive-checklist",
    routeType: "checklists",
    title: "Used EV Test Drive Checklist",
    metaDescription:
      "Taking a used EV for a test drive? Check these 6 things during the drive to catch issues the listing won't mention.",
    ogTitle: "Used EV Test Drive Checklist | OFFO",
    ogDescription:
      "6 things to verify during a used EV test drive that the listing won't mention.",
    canonical: "/checklists/used-ev-test-drive-checklist",
    headline: "Test Driving a Used EV?",
    subheadline:
      "A test drive is your best chance to catch issues that photos and listings hide. Focus on these 6 areas.",
    badgeText: "Test Drive Checklist",
    bullets: [
      {
        icon: "Gauge",
        title: "Range Estimate vs. Actual",
        description:
          "Note the displayed range at start and end. If the car loses range faster than expected, the battery may be degraded.",
      },
      {
        icon: "Zap",
        title: "Regenerative Braking Feel",
        description:
          "Test regen braking at different speeds. Inconsistent or weak regen can indicate battery or motor controller issues.",
      },
      {
        icon: "Volume2",
        title: "Unusual Noises",
        description:
          "EVs are quiet. Listen for clicking, humming, or whining from the drivetrain, especially during acceleration and braking.",
      },
      {
        icon: "Smartphone",
        title: "Infotainment and Software",
        description:
          "Test all touchscreen functions, navigation, and phone connectivity. Software bugs can be expensive or impossible to fix.",
      },
      {
        icon: "Plug",
        title: "Charge Port Operation",
        description:
          "Open and close the charge port. If possible, plug in to verify the onboard charger works and the car accepts a charge.",
      },
      {
        icon: "CarFront",
        title: "Alignment and Suspension",
        description:
          "EVs are heavy. Check for pulling, uneven tire wear, and suspension noise. Replacing air suspension can cost thousands.",
      },
    ],
    faq: [
      {
        question: "How long should a used EV test drive be?",
        answer:
          "At least 30 minutes covering highway, city, and parking. This gives you time to test range consumption, regen braking, and comfort at different speeds.",
      },
      {
        question: "Should I charge the EV during the test drive?",
        answer:
          "If possible, yes. Plugging in (even briefly) verifies the charge port, onboard charger, and charging display all work correctly.",
      },
      {
        question: "What should I check before the test drive starts?",
        answer:
          "Cold start the car yourself. Check all exterior panels for paint mismatch or uneven gaps (signs of body work). Note the current battery percentage and range estimate.",
      },
    ],
    ctaHeadline: "Verify the listing first",
    ctaDescription:
      "Paste the listing text to get risk flags and must-ask questions before you schedule the test drive.",
    ctaButtonText: "Check This Listing",
    ctaPlaceholder:
      "Paste the listing here...\n\nExample:\n2021 Ford Mustang Mach-E Select\n38,000 miles \u2014 $22,900\n1 owner, clean title\nSeattle, WA",
    showSamplePreview: false,
    pageSource: "seo:checklists:used-ev-test-drive-checklist",
    publishedDate: "2026-02-13",
  },

  "stop-sale-recall-hold-what-to-verify": {
    slug: "stop-sale-recall-hold-what-to-verify",
    routeType: "checklists",
    title: "Stop Sale & Recall Hold \u2014 What to Verify",
    metaDescription:
      "Found a used EV with a stop-sale or open recall? Here's what to check before buying, and when to walk away.",
    ogTitle: "Stop Sale & Recall Hold \u2014 What to Verify | OFFO",
    ogDescription:
      "What to check before buying a used EV with a stop-sale or open recall.",
    canonical: "/checklists/stop-sale-recall-hold-what-to-verify",
    headline: "Stop Sale or Open Recall?",
    subheadline:
      "A stop-sale or open recall does not automatically mean a bad deal. But you need to verify the specifics before buying.",
    badgeText: "Recall Verification",
    bullets: [
      {
        icon: "AlertTriangle",
        title: "Check NHTSA VIN Lookup",
        description:
          "Run the VIN at nhtsa.gov/recalls to see all open recalls. Cross-reference with the manufacturer's recall page for repair status.",
      },
      {
        icon: "Ban",
        title: "Stop-Sale vs. Open Recall",
        description:
          "A stop-sale means the dealer legally cannot sell the car until the fix is applied. An open recall means the fix is available but not yet performed.",
      },
      {
        icon: "Clock",
        title: "Repair Timeline",
        description:
          "Ask when the recall repair will be available. Some fixes take months. If the part is on backorder, you may be waiting indefinitely.",
      },
      {
        icon: "ShieldCheck",
        title: "Warranty Impact",
        description:
          "Recall repairs are free and do not affect your warranty. However, some stop-sale conditions involve fundamental design issues that may recur.",
      },
      {
        icon: "DollarSign",
        title: "Price Impact",
        description:
          "A car under stop-sale is often priced lower. This can be a good deal if the fix is straightforward, but a risk if the issue is systemic.",
      },
    ],
    faq: [
      {
        question: "Can a dealer sell a car with an open recall?",
        answer:
          "Open recalls: yes, dealers can sell the car but must disclose the recall. Stop-sales: no, the dealer must complete the repair before selling.",
      },
      {
        question:
          "Should I buy a used EV with an open recall from a private seller?",
        answer:
          "Private sellers are not required to fix recalls before selling. You can buy the car and have the recall performed at any authorized dealer for free.",
      },
      {
        question: "How do I check if a recall has been completed?",
        answer:
          "Ask the seller for documentation. You can also contact the manufacturer with the VIN to verify repair status.",
      },
    ],
    ctaHeadline: "Check the listing",
    ctaDescription:
      "Paste the listing to see if the price accounts for any known issues and get must-ask questions.",
    ctaButtonText: "Check This Listing",
    ctaPlaceholder:
      "Paste the listing here...\n\nExample:\n2022 Chevrolet Bolt EUV Premier\n22,000 miles \u2014 $19,500\nDealer, stop-sale completed\nChicago, IL",
    showSamplePreview: false,
    pageSource: "seo:checklists:stop-sale-recall-hold-what-to-verify",
    publishedDate: "2026-02-13",
  },

  "dealer-didnt-report-ev-sale-irs": {
    slug: "dealer-didnt-report-ev-sale-irs",
    routeType: "checklists",
    title: "Dealer Didn't Report EV Sale to IRS \u2014 What to Do",
    metaDescription:
      "Bought a used EV but the dealer didn't report the sale for the tax credit? Here's what to verify and how to fix it.",
    ogTitle: "Dealer Didn't Report EV Sale to IRS | OFFO",
    ogDescription:
      "Steps to take when a dealer fails to report your used EV purchase for the federal tax credit.",
    canonical: "/checklists/dealer-didnt-report-ev-sale-irs",
    headline: "Dealer Didn't Report the Sale?",
    subheadline:
      "The $4,000 used EV tax credit requires the dealer to report the sale through the IRS Energy Credits Online portal. If they didn't, you may still be able to fix it.",
    badgeText: "Tax Credit Recovery",
    bullets: [
      {
        icon: "FileCheck",
        title: "Check Your Paperwork",
        description:
          "You should have received a copy of the seller report (Time of Sale Report) from the dealer. If you don't have it, contact the dealer immediately.",
      },
      {
        icon: "Building",
        title: "Confirm Dealer Registration",
        description:
          "The dealer must be registered on the IRS Energy Credits Online portal. Not all dealers are registered \u2014 ask for their registration confirmation.",
      },
      {
        icon: "Phone",
        title: "Contact the Dealer",
        description:
          "Call the dealership's finance department and request they file the Time of Sale Report. They can still submit it after the sale date.",
      },
      {
        icon: "FileText",
        title: "Document Everything",
        description:
          "Keep copies of your purchase agreement, VIN, and any communication with the dealer. You'll need this if you escalate to the IRS.",
      },
      {
        icon: "HelpCircle",
        title: "Contact the IRS if Needed",
        description:
          "If the dealer refuses or is unable to file, contact the IRS directly. The Energy Credits Online helpline can advise on next steps.",
      },
    ],
    faq: [
      {
        question: "Can I still claim the credit if the dealer didn't report?",
        answer:
          "The credit requires the dealer to submit a Time of Sale Report. Without it, the IRS may reject your Form 8936. Contact the dealer to have them file it retroactively.",
      },
      {
        question:
          "What if the dealer went out of business before filing the report?",
        answer:
          "This is a difficult situation. Contact the IRS Energy Credits Online helpline and provide your purchase documentation. They may have options for cases where the dealer is no longer operating.",
      },
      {
        question: "Is there a deadline for the dealer to report?",
        answer:
          "Dealers should report at the time of sale, but late submissions are accepted. The sooner you contact them, the better your chances of resolution.",
      },
    ],
    ctaHeadline: "Planning your next EV purchase?",
    ctaDescription:
      "Paste a listing to check the deal before you buy \u2014 avoid tax credit and pricing surprises.",
    ctaButtonText: "Check This Listing",
    ctaPlaceholder:
      "Paste the listing here...\n\nExample:\n2022 Hyundai Ioniq 5 SE\n30,000 miles \u2014 $23,500\nDealer, clean title\nDallas, TX",
    showSamplePreview: false,
    pageSource: "seo:checklists:dealer-didnt-report-ev-sale-irs",
    publishedDate: "2026-02-13",
  },
};

export function getChecklist(slug: string): SeoPageContent | undefined {
  return checklists[slug];
}

export function getAllChecklistSlugs(): string[] {
  return Object.keys(checklists);
}
