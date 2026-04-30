/**
 * Curated Wikimedia Commons vehicle photos + lookup helper.
 *
 * Used by:
 *   - app/api/photos/route.ts  (standalone photo endpoint)
 *   - app/api/receipt/fetch/route.ts  (fallback when Auto.dev returns no photos)
 *
 * All URLs are stable Wikimedia CDN thumb URLs (Creative Commons licensed).
 * Keys are lowercase normalized model names (make prefix stripped, trim stripped).
 */

export const STATIC_PHOTO_MAP: Record<string, string> = {
  // Hyundai
  "ioniq 5": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Hyundai_Ioniq_5_1X7A7085.jpg/960px-Hyundai_Ioniq_5_1X7A7085.jpg",
  "ioniq 6": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Hyundai_Ioniq_6_1X7A7258.jpg/960px-Hyundai_Ioniq_6_1X7A7258.jpg",
  "kona electric": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/2024_Hyundai_Kona_Electric_%28GK%29%2C_front_8.27.24.jpg/960px-2024_Hyundai_Kona_Electric_%28GK%29%2C_front_8.27.24.jpg",
  "kona": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/2024_Hyundai_Kona_Electric_%28GK%29%2C_front_8.27.24.jpg/960px-2024_Hyundai_Kona_Electric_%28GK%29%2C_front_8.27.24.jpg",
  // Kia
  "ev6": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Kia_EV6_GT_IMG_8171.jpg/960px-Kia_EV6_GT_IMG_8171.jpg",
  "ev9": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Kia_EV9_MV1_Aurora_Black_Pearl_%285%29.jpg/960px-Kia_EV9_MV1_Aurora_Black_Pearl_%285%29.jpg",
  "niro ev": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Kia_Niro_EV_%282023%29_%2852920493406%29.jpg/960px-Kia_Niro_EV_%282023%29_%2852920493406%29.jpg",
  "niro": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Kia_Niro_EV_%282023%29_%2852920493406%29.jpg/960px-Kia_Niro_EV_%282023%29_%2852920493406%29.jpg",
  "soul ev": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Kia_Soul_EV_auto_z%C3%BCrich_2023.jpg/960px-Kia_Soul_EV_auto_z%C3%BCrich_2023.jpg",
  "soul": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Kia_Soul_EV_auto_z%C3%BCrich_2023.jpg/960px-Kia_Soul_EV_auto_z%C3%BCrich_2023.jpg",
  // Tesla
  "model 3": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Tesla_Model_3_%282023%29_IMG_9488_%28cropped%29.jpg/960px-Tesla_Model_3_%282023%29_IMG_9488_%28cropped%29.jpg",
  "model y": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Tesla_Model_in_M%C3%BCnchen.jpg/960px-Tesla_Model_in_M%C3%BCnchen.jpg",
  "model s": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Tesla_Model_S_%282023%29_Motorworld_Munich_1X7A0025.jpg/960px-Tesla_Model_S_%282023%29_Motorworld_Munich_1X7A0025.jpg",
  "model x": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Tesla_Model_X_100D_1X7A6736.jpg/960px-Tesla_Model_X_100D_1X7A6736.jpg",
  "cybertruck": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/2024_Tesla_Cybertruck_Foundation_Series_IMG_0634_%28cropped%29.jpg/960px-2024_Tesla_Cybertruck_Foundation_Series_IMG_0634_%28cropped%29.jpg",
  // Chevrolet
  "bolt ev": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Chevrolet_Bolt_EV_Black.jpg/960px-Chevrolet_Bolt_EV_Black.jpg",
  "bolt euv": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/2022-2024_Chevrolet_Bolt_EUV_%C3%89nergir.JPG/960px-2022-2024_Chevrolet_Bolt_EUV_%C3%89nergir.JPG",
  "equinox ev": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Chevrolet_Equinox_EV_002.jpg/960px-Chevrolet_Equinox_EV_002.jpg",
  "blazer ev": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Chevrolet_Blazer_EV_%28LT%2C_Riptide_Blue%29_-_badge_closeup.jpg/960px-Chevrolet_Blazer_EV_%28LT%2C_Riptide_Blue%29_-_badge_closeup.jpg",
  "silverado ev": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/2024_Chevrolet_Silverado_EV_Work_Truck%2C_front_8.20.22.jpg/960px-2024_Chevrolet_Silverado_EV_Work_Truck%2C_front_8.20.22.jpg",
  "spark": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Chevrolet_Spark_EV_%26_Bolt_EV_CRI_02_2023_1899.jpg/960px-Chevrolet_Spark_EV_%26_Bolt_EV_CRI_02_2023_1899.jpg",
  // Nissan
  "leaf": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/2023_Nissan_Leaf_Tekna.jpg/960px-2023_Nissan_Leaf_Tekna.jpg",
  "leaf s": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/2023_Nissan_Leaf_Tekna.jpg/960px-2023_Nissan_Leaf_Tekna.jpg",
  "leaf sv": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/2023_Nissan_Leaf_Tekna.jpg/960px-2023_Nissan_Leaf_Tekna.jpg",
  "leaf sl": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/2023_Nissan_Leaf_Tekna.jpg/960px-2023_Nissan_Leaf_Tekna.jpg",
  "leaf plus": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/2023_Nissan_Leaf_Tekna.jpg/960px-2023_Nissan_Leaf_Tekna.jpg",
  "ariya": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nissan_Ariya_IAA_2023_1X7A0455.jpg/960px-Nissan_Ariya_IAA_2023_1X7A0455.jpg",
  // Ford
  "mustang mach-e": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Ford_Mustang_Mach-E_Rally_Auto_Zuerich_2023_1X7A1182.jpg/960px-Ford_Mustang_Mach-E_Rally_Auto_Zuerich_2023_1X7A1182.jpg",
  "f-150 lightning": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Ford_F-150_Lightning_IAA_2023_1X7A0596.jpg/960px-Ford_F-150_Lightning_IAA_2023_1X7A0596.jpg",
  "focus electric": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Ford_Focus_Electric_C346_%28Facelift%2C_2014%29_front.jpg/960px-Ford_Focus_Electric_C346_%28Facelift%2C_2014%29_front.jpg",
  "focus": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Ford_Focus_Electric_C346_%28Facelift%2C_2014%29_front.jpg/960px-Ford_Focus_Electric_C346_%28Facelift%2C_2014%29_front.jpg",
  // Rivian
  "r1t": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Rivian_R1T_-_2nd_Row_07.png/960px-Rivian_R1T_-_2nd_Row_07.png",
  "r1s": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Rivian_R1S_-_3.jpg/960px-Rivian_R1S_-_3.jpg",
  // Volkswagen
  "id.4": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/VW_ID4_CRI_03_2023_2386.jpg/960px-VW_ID4_CRI_03_2023_2386.jpg",
  "id4": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/VW_ID4_CRI_03_2023_2386.jpg/960px-VW_ID4_CRI_03_2023_2386.jpg",
  "id.3": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/2020_Volkswagen_ID.3_1st_Edition_in_Blue%2C_front_8.18.20.jpg/960px-2020_Volkswagen_ID.3_1st_Edition_in_Blue%2C_front_8.18.20.jpg",
  "e-golf": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Volkswagen_e-Golf_IMG_8133.jpg/960px-Volkswagen_e-Golf_IMG_8133.jpg",
  // BMW
  "ix": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/2023_BMW_iX_12_2022_CRI_0831.jpg/960px-2023_BMW_iX_12_2022_CRI_0831.jpg",
  "i4": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/BMW_i4_CRI_02_2023_1881.jpg/960px-BMW_i4_CRI_02_2023_1881.jpg",
  "i5": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/BMW_i5_M60_xDrive_%28G60%2C_2024%29_%2853767149083%29.jpg/960px-BMW_i5_M60_xDrive_%28G60%2C_2024%29_%2853767149083%29.jpg",
  "i7": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/BMW_G70E_i7_xDrive60_Design_Pure_Excellence_BMW_Individual_Oxide_Grey_Tanzanite_Blue_Metallic_%2830%29.jpg/960px-BMW_G70E_i7_xDrive60_Design_Pure_Excellence_BMW_Individual_Oxide_Grey_Tanzanite_Blue_Metallic_%2830%29.jpg",
  "i3": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/D%C3%BClmen%2C_Hausd%C3%BClmen%2C_Sandstra%C3%9Fe%2C_BMW_i3_--_2016_--_1748-54.jpg/960px-D%C3%BClmen%2C_Hausd%C3%BClmen%2C_Sandstra%C3%9Fe%2C_BMW_i3_--_2016_--_1748-54.jpg",
  // Polestar
  "polestar 2": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Polestar_2_BST_Edition_230_Auto_Zuerich_2023_1X7A1303.jpg/960px-Polestar_2_BST_Edition_230_Auto_Zuerich_2023_1X7A1303.jpg",
  "2": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Polestar_2_CMA_Space_%282%29.jpg/960px-Polestar_2_CMA_Space_%282%29.jpg",
  // Lucid
  "air": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Lucid_Air_Dream_edition%2C_IAA_Open_Space_2023%2C_Munich_%28P1120054%29.jpg/960px-Lucid_Air_Dream_edition%2C_IAA_Open_Space_2023%2C_Munich_%28P1120054%29.jpg",
  // Mercedes / Mercedes-Benz
  "eqs": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Mercedes-Benz_EQS_450%2B%2C_IAA_Open_Space_2023%2C_Munich_%28P1120197%29.jpg/960px-Mercedes-Benz_EQS_450%2B%2C_IAA_Open_Space_2023%2C_Munich_%28P1120197%29.jpg",
  "eqe": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Mercedes-Benz_EQE_350%2B_IAA_2021.jpg/960px-Mercedes-Benz_EQE_350%2B_IAA_2021.jpg",
  "eqb": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Mercedes-Benz_EQB_300_4MATIC_IMG_8002.jpg/960px-Mercedes-Benz_EQB_300_4MATIC_IMG_8002.jpg",
  "eqa": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Mercedes-Benz_EQA_250_H243_IMG_8110.jpg/960px-Mercedes-Benz_EQA_250_H243_IMG_8110.jpg",
  // Genesis
  "gv60": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Genesis_GV60_Classic-Gala_2022_1X7A0354.jpg/960px-Genesis_GV60_Classic-Gala_2022_1X7A0354.jpg",
  "gv70": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Genesis_Electrified_GV70_1X7A6390.jpg/960px-Genesis_Electrified_GV70_1X7A6390.jpg",
  "gv70 electrified": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Genesis_Electrified_GV70_1X7A6390.jpg/960px-Genesis_Electrified_GV70_1X7A6390.jpg",
  "g80 electrified": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Genesis_Electrified_G80_Auto_Zuerich_2023_1X7A1133.jpg/960px-Genesis_Electrified_G80_Auto_Zuerich_2023_1X7A1133.jpg",
  // Cadillac
  "lyriq": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/2023_Cadillac_Lyriq_Luxury_1%2C_front_right%2C_08-22-2024.jpg/960px-2023_Cadillac_Lyriq_Luxury_1%2C_front_right%2C_08-22-2024.jpg",
  "optiq": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/2023_Cadillac_Lyriq_Luxury_1%2C_front_right%2C_08-22-2024.jpg/960px-2023_Cadillac_Lyriq_Luxury_1%2C_front_right%2C_08-22-2024.jpg",
  // Volvo
  "c40 recharge": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Volvo_C40_Recharge_P8_AWD_IMG_4802.jpg/960px-Volvo_C40_Recharge_P8_AWD_IMG_4802.jpg",
  "c40": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Volvo_C40_Recharge_P8_AWD_IMG_4802.jpg/960px-Volvo_C40_Recharge_P8_AWD_IMG_4802.jpg",
  "xc40 recharge": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Volvo_XC40_Recharge_Facelift_IMG_8127.jpg/960px-Volvo_XC40_Recharge_Facelift_IMG_8127.jpg",
  "xc40": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Volvo_XC40_Recharge_Facelift_IMG_8127.jpg/960px-Volvo_XC40_Recharge_Facelift_IMG_8127.jpg",
  // Audi
  "e-tron": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/2019_Audi_e-tron_55_quattro%2C_front_8.1.19.jpg/960px-2019_Audi_e-tron_55_quattro%2C_front_8.1.19.jpg",
  "e-tron gt": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Audi_e-tron_GT_IAA_2021_IMG_2040.jpg/960px-Audi_e-tron_GT_IAA_2021_IMG_2040.jpg",
  "q4 e-tron": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Audi_Q4_e-tron_IAA_2021_IMG_2048.jpg/960px-Audi_Q4_e-tron_IAA_2021_IMG_2048.jpg",
  "q8 e-tron": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Audi_Q8_e-tron_55_quattro_IAA_2023_IMG_0432.jpg/960px-Audi_Q8_e-tron_55_quattro_IAA_2023_IMG_0432.jpg",
  "rs e-tron gt": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Audi_e-tron_GT_IAA_2021_IMG_2040.jpg/960px-Audi_e-tron_GT_IAA_2021_IMG_2040.jpg",
  // Mini
  "countryman": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/2024_Mini_Countryman_SE_All4_Electric_%28F66%29%2C_front_8.9.24.jpg/960px-2024_Mini_Countryman_SE_All4_Electric_%28F66%29%2C_front_8.9.24.jpg",
  "cooper se": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/2020_MINI_Cooper_SE_%28facelift%2C_blue%29%2C_front_8.11.20.jpg/960px-2020_MINI_Cooper_SE_%28facelift%2C_blue%29%2C_front_8.11.20.jpg",
  "cooper": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/2020_MINI_Cooper_SE_%28facelift%2C_blue%29%2C_front_8.11.20.jpg/960px-2020_MINI_Cooper_SE_%28facelift%2C_blue%29%2C_front_8.11.20.jpg",
  // Porsche
  "taycan": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Porsche_Taycan_IAA_2023_1X7A0387.jpg/960px-Porsche_Taycan_IAA_2023_1X7A0387.jpg",
  "macan": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Porsche_Macan_Electric_IAA_2023_1X7A0476.jpg/960px-Porsche_Macan_Electric_IAA_2023_1X7A0476.jpg",
  // Jaguar
  "i-pace": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Jaguar_I-PACE_EV400_IAA_2023_1X7A0302.jpg/960px-Jaguar_I-PACE_EV400_IAA_2023_1X7A0302.jpg",
  // Toyota / Subaru
  "bz4x": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/2023_Toyota_bZ4X_XLE_AWD_in_Supersonic_Red%2C_front_left.jpg/960px-2023_Toyota_bZ4X_XLE_AWD_in_Supersonic_Red%2C_front_left.jpg",
  "solterra": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/2023_Subaru_Solterra_in_Ice_Silver_%26_Magnetite_Gray%2C_front_left.jpg/960px-2023_Subaru_Solterra_in_Ice_Silver_%26_Magnetite_Gray%2C_front_left.jpg",
};

// Suffix stripping order matters: longest strings first, short/ambiguous ones last.
// " ev" / " electric" come before " se" / " sel" so "Niro EV" is checked before further stripping.
const TRIM_STRIP_SUFFIXES = [
  " sel long range", " se standard range plus", " se long range", " se standard",
  " long range plus", " long range", " standard range plus", " standard range",
  " extended range", " premium awd", " premium rwd", " premium",
  " select rwd", " select",
  " gt-line awd", " gt-line rwd", " gt-line", " gt line", " gt awd", " gt",
  " pro s", " pro", " plus s", " plus",
  " large pack", " max pack", " adventure",
  " light long range", " light",
  " all4", " se all4",
  " awd", " rwd", " fwd", " 4wd", " 4matic", " e-4wd",
  " xdrive60", " xdrive50", " xdrive40", " edrive40", " edrive35", " m50",
  " twin ultimate eawd", " twin ultimate", " twin",
  " single motor eawd", " single motor",
  " recharge",
  " 450+", " 580", " 350+", " pure",
  " 1lt", " 1", " lt", " premier",
  // Tesla battery capacity (e.g. "Model S 75 RWD" → "Model S")
  " p100d", " p90d", " p85d", " p85+", " p85",
  " 100d", " 90d", " 85d", " 75d", " 70d", " 60d",
  " 75", " 100", " 90", " 85", " 70", " 60",
  // Performance tiers
  " performance", " plaid+", " plaid",
  " turbo s", " turbo", " 4s",
  " cross turismo", " sport turismo",
  " grand touring+", " grand touring",
  // OEM trim levels
  " touring", " sport", " limited", " base",
  " ex-l", " ex", " lx",
  " wind", " earth",
  " advanced", " blue",
  " electrified",
  // Ford Mach-E
  " california route 1", " california route",
  // Body styles
  " hatchback", " sedan", " suv", " crossover", " coupe", " convertible", " wagon",
  // Electric-specific (before short single-letter trims)
  " electric", " ev",
  // Short single-word trims — last to avoid false positives
  " sl", " sv", " se", " sel", " s",
];

/**
 * Look up a curated Wikimedia Commons photo for a make/model.
 * Strips make prefix and trim suffixes to find the base model key.
 * Returns a URL if matched, otherwise null.
 */
export function getStaticPhotoUrl(
  make: string | undefined,
  model: string | undefined
): string | null {
  if (!make || !model) return null;

  // Normalize: remove commas (e.g. "Niro EV S, EX" → "Niro EV S EX")
  let m = model.trim().replace(/,/g, "");

  // Strip make prefix (e.g. "Hyundai Ioniq 5 SEL" → "Ioniq 5 SEL")
  if (m.toLowerCase().startsWith(make.toLowerCase() + " ")) {
    m = m.slice(make.length + 1).trim();
  }

  // Exact match first (handles "niro ev", "focus electric", "cooper se", etc.)
  if (STATIC_PHOTO_MAP[m.toLowerCase()]) return STATIC_PHOTO_MAP[m.toLowerCase()];

  // Strip suffixes iteratively, checking the map after each strip
  let stripped = true;
  while (stripped) {
    stripped = false;
    const mLow = m.toLowerCase();
    for (const suf of TRIM_STRIP_SUFFIXES) {
      if (mLow.endsWith(suf)) {
        m = m.slice(0, m.length - suf.length).trim();
        if (STATIC_PHOTO_MAP[m.toLowerCase()]) return STATIC_PHOTO_MAP[m.toLowerCase()];
        stripped = true;
        break;
      }
    }
  }

  return STATIC_PHOTO_MAP[m.toLowerCase()] ?? null;
}
