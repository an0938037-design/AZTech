import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  Beaker,
  BookOpen,
  Clock,
  Flame,
  FlaskConical,
  RotateCcw,
  Thermometer,
} from "lucide-react";

/* ==========================================================================
   ReactionLab 3D — kệ chất, cốc thuỷ tinh, phản ứng và hiện tượng.
   Người học chọn chất để rót vào cốc; engine nhận diện phản ứng, đổi màu
   dung dịch, tạo khí, kết tủa, ngọn lửa, hơi nước và ghi lại lịch sử.
   ========================================================================== */

type ReagentKind = "acid" | "base" | "salt" | "metal" | "oxide" | "other" | "indicator";
type ReagentState = "dd" | "solid" | "metal" | "indicator";

interface Reagent {
  id: string;
  formula: string;
  name: string;
  kind: ReagentKind;
  state: ReagentState;
  tint?: number;
  solid?: number;
  note?: string;
}

const REAGENTS: Reagent[] = [
  { id: "hcl", formula: "HCl", name: "Axit clohidric", kind: "acid", state: "dd", tint: 0xe5f2fb, note: "Dung dịch axit mạnh, không màu." },
  { id: "h2so4", formula: "H₂SO₄", name: "Axit sunfuric", kind: "acid", state: "dd", tint: 0xf0ecfc, note: "Axit mạnh, háo nước và toả nhiệt khi pha loãng." },

  { id: "naoh", formula: "NaOH", name: "Natri hidroxit", kind: "base", state: "dd", tint: 0xe9f3f9, note: "Bazơ mạnh, còn gọi là xút ăn da." },
  { id: "koh", formula: "KOH", name: "Kali hidroxit", kind: "base", state: "dd", tint: 0xe9f3f9, note: "Bazơ mạnh, tan tốt trong nước." },

  { id: "cuso4", formula: "CuSO₄", name: "Đồng(II) sunfat", kind: "salt", state: "dd", tint: 0x2f8fd8, note: "Dung dịch xanh lam đặc trưng." },
  { id: "fecl3", formula: "FeCl₃", name: "Sắt(III) clorua", kind: "salt", state: "dd", tint: 0xc27b2e, note: "Dung dịch vàng nâu." },
  { id: "agno3", formula: "AgNO₃", name: "Bạc nitrat", kind: "salt", state: "dd", tint: 0xf1f4f7, note: "Thuốc thử nhận biết ion clorua." },
  { id: "nacl", formula: "NaCl", name: "Natri clorua", kind: "salt", state: "dd", tint: 0xe9f2f8, note: "Muối ăn, dung dịch không màu." },
  { id: "na2co3", formula: "Na₂CO₃", name: "Natri cacbonat", kind: "salt", state: "dd", tint: 0xe9f3f8, note: "Soda, tạo khí CO₂ khi gặp axit." },
  { id: "cacl2", formula: "CaCl₂", name: "Canxi clorua", kind: "salt", state: "dd", tint: 0xeaf3f7, note: "Muối tan, tạo kết tủa với cacbonat." },

  { id: "zn", formula: "Zn", name: "Kẽm", kind: "metal", state: "metal", solid: 0x9aa3b5, note: "Kim loại hoạt động trung bình." },
  { id: "fe", formula: "Fe", name: "Sắt", kind: "metal", state: "metal", solid: 0x6d6f78, note: "Kim loại hoạt động, đẩy được đồng khỏi muối." },
  { id: "cu", formula: "Cu", name: "Đồng", kind: "metal", state: "metal", solid: 0xb96a3c, note: "Kim loại kém hoạt động, không tan trong HCl." },
  { id: "na", formula: "Na", name: "Natri", kind: "metal", state: "metal", solid: 0xd9dde8, note: "Kim loại kiềm, phản ứng mãnh liệt với nước." },

  { id: "cao", formula: "CaO", name: "Canxi oxit (vôi sống)", kind: "oxide", state: "solid", solid: 0xf1efe8, note: "Oxit bazơ, toả nhiều nhiệt khi gặp nước." },
  { id: "cuo", formula: "CuO", name: "Đồng(II) oxit", kind: "oxide", state: "solid", solid: 0x1f2229, note: "Chất rắn màu đen, tan trong axit." },
  { id: "caco3", formula: "CaCO₃", name: "Canxi cacbonat (đá vôi)", kind: "oxide", state: "solid", solid: 0xe7e4d8, note: "Đá vôi, bị phân huỷ khi nung nóng." },
  { id: "mno2", formula: "MnO₂", name: "Mangan(IV) oxit", kind: "oxide", state: "solid", solid: 0x2a2b31, note: "Chất xúc tác cho phản ứng phân huỷ H₂O₂." },

  { id: "h2o2", formula: "H₂O₂", name: "Hiđro peoxit", kind: "other", state: "dd", tint: 0xeff8fb, note: "Chất oxi hoá, dễ phân huỷ tạo khí oxi." },

  { id: "phenolphthalein", formula: "PP", name: "Phenolphthalein", kind: "indicator", state: "indicator", tint: 0xf5f0ff, note: "Chỉ thị không màu trong axit, hồng trong bazơ." },
];

const REAGENT_MAP = new Map(REAGENTS.map((reagent) => [reagent.id, reagent]));
const WATER_COLOR = 0x86cfe3;

const KIND_LABEL: Record<ReagentKind, string> = {
  acid: "AXIT",
  base: "BAZƠ",
  salt: "MUỐI TAN",
  metal: "KIM LOẠI",
  oxide: "OXIT & ĐÁ VÔI",
  other: "CHẤT OXI HOÁ",
  indicator: "CHỈ THỊ",
};

const KIND_ORDER: ReagentKind[] = ["acid", "base", "salt", "metal", "oxide", "other", "indicator"];

const KIND_SHORT: Record<ReagentKind, string> = {
  acid: "AXIT",
  base: "BAZƠ",
  salt: "MUỐI",
  metal: "KIM LOẠI",
  oxide: "OXIT",
  other: "OXI HOÁ",
  indicator: "CHỈ THỊ",
};

const STATE_LABEL: Record<ReagentState, string> = {
  dd: "dd",
  solid: "rắn",
  metal: "kim loại",
  indicator: "chỉ thị",
};

interface Species {
  formula: string;
  name: string;
  solid?: boolean;
  stay?: boolean;
  gas?: boolean;
  color?: number;
}

const SPECIES: Record<string, Species> = {};

for (const reagent of REAGENTS) {
  SPECIES[reagent.id] = {
    formula: reagent.formula,
    name: reagent.name,
    solid: reagent.state === "solid" || reagent.state === "metal",
    stay: true,
    color: reagent.solid ?? reagent.tint,
  };
}

Object.assign(SPECIES, {
  na2so4: { formula: "Na₂SO₄", name: "Natri sunfat", color: 0xdcecf7 },
  kcl: { formula: "KCl", name: "Kali clorua", color: 0xe6f1f7 },
  k2so4: { formula: "K₂SO₄", name: "Kali sunfat", color: 0xe6f1f7 },
  nano3: { formula: "NaNO₃", name: "Natri nitrat", color: 0xe6f1f7 },
  hno3: { formula: "HNO₃", name: "Axit nitric", color: 0xe6f1f7 },
  cacl2: { formula: "CaCl₂", name: "Canxi clorua", color: 0xe6f1f7 },
  caso4: { formula: "CaSO₄", name: "Canxi sunfat (thạch cao)", solid: true, color: 0xe8e5da },
  zncl2: { formula: "ZnCl₂", name: "Kẽm clorua", color: 0xe4eff4 },
  znso4: { formula: "ZnSO₄", name: "Kẽm sunfat", color: 0xe4eff4 },
  fecl2: { formula: "FeCl₂", name: "Sắt(II) clorua", color: 0xcfe8c8 },
  feso4: { formula: "FeSO₄", name: "Sắt(II) sunfat", color: 0xcfe8c8 },
  cucl2: { formula: "CuCl₂", name: "Đồng(II) clorua", color: 0x2ea3b5 },
  cu_no32: { formula: "Cu(NO₃)₂", name: "Đồng(II) nitrat", color: 0x2f8fd8 },
  ca_oh2: { formula: "Ca(OH)₂", name: "Canxi hidroxit (vôi tôi)", solid: true, color: 0xf3f1e9 },
  cu_oh2: { formula: "Cu(OH)₂", name: "Đồng(II) hidroxit", solid: true, color: 0x5fb7e6 },
  fe_oh3: { formula: "Fe(OH)₃", name: "Sắt(III) hidroxit", solid: true, color: 0xa4552f },
  fe_oh2: { formula: "Fe(OH)₂", name: "Sắt(II) hidroxit", solid: true, color: 0x8fbf9a },
  zn_oh2: { formula: "Zn(OH)₂", name: "Kẽm hidroxit", solid: true, color: 0xf0f0e8 },
  agcl: { formula: "AgCl", name: "Bạc clorua", solid: true, color: 0xe4e5dd },
  ag: { formula: "Ag", name: "Bạc", solid: true, color: 0xd7dbe2 },
  h2o: { formula: "H₂O", name: "Nước", stay: false, color: 0xbfe4f2 },
  co2: { formula: "CO₂", name: "Cacbon đioxit", stay: false, gas: true, color: 0xeaf4f8 },
  h2: { formula: "H₂", name: "Hiđro", stay: false, gas: true, color: 0xeaf4f8 },
  o2: { formula: "O₂", name: "Oxi", stay: false, gas: true, color: 0xeaf4f8 },
});

function speciesOf(id: string): Species {
  return SPECIES[id] ?? { formula: id, name: id, stay: true };
}

function productState(id: string, species: Species): string {
  if (species.gas) return "khí ↑";
  if (id === "h2o") return "lỏng";
  if (id === "ca_oh2") return "huyền phù";
  if (id === "agcl" || id === "cu_oh2" || id === "fe_oh3" || id === "fe_oh2" || id === "zn_oh2" || id === "caso4" || id === "caco3") {
    return "kết tủa";
  }
  if (species.solid) return "rắn";
  return "dung dịch";
}

interface Effect {
  liquid?: number;
  cloudy?: number;
  gas?: number;
  gasColor?: number;
  precip?: number;
  precipAmount?: number;
  flame?: number;
  smoke?: number;
  heat?: number;
}

interface Reaction {
  id: string;
  name: string;
  reactants: string[];
  products: string[];
  equation: string;
  phenomenon: string;
  condition?: string;
  heat?: boolean;
  catalyst?: string[];
  effect: Effect;
  tags: string[];
}

const REACTIONS: Reaction[] = [
  {
    id: "hcl_naoh",
    name: "Trung hoà axit clohidric bằng natri hidroxit",
    reactants: ["hcl", "naoh"],
    products: ["nacl", "h2o"],
    equation: "HCl + NaOH → NaCl + H₂O",
    phenomenon: "Dung dịch trong suốt và nóng lên nhẹ. Không có khí thoát ra, không tạo kết tủa.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xdfeff8, heat: 0.35 },
    tags: ["TRUNG HOÀ", "TOẢ NHIỆT"],
  },
  {
    id: "h2so4_naoh",
    name: "Trung hoà axit sunfuric bằng natri hidroxit",
    reactants: ["h2so4", "naoh"],
    products: ["na2so4", "h2o"],
    equation: "H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O",
    phenomenon: "Phản ứng trung hoà toả nhiệt; dung dịch vẫn trong suốt, không có khí.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xdfeff8, heat: 0.4 },
    tags: ["TRUNG HOÀ", "TOẢ NHIỆT"],
  },
  {
    id: "hcl_koh",
    name: "Trung hoà axit clohidric bằng kali hidroxit",
    reactants: ["hcl", "koh"],
    products: ["kcl", "h2o"],
    equation: "HCl + KOH → KCl + H₂O",
    phenomenon: "Dung dịch nóng lên nhẹ, trong suốt. Không có hiện tượng khí hay kết tủa.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xdfeff8, heat: 0.35 },
    tags: ["TRUNG HOÀ", "TOẢ NHIỆT"],
  },
  {
    id: "h2so4_koh",
    name: "Trung hoà axit sunfuric bằng kali hidroxit",
    reactants: ["h2so4", "koh"],
    products: ["k2so4", "h2o"],
    equation: "H₂SO₄ + 2KOH → K₂SO₄ + 2H₂O",
    phenomenon: "Toả nhiệt, dung dịch trong suốt, không tạo khí hoặc kết tủa.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xdfeff8, heat: 0.4 },
    tags: ["TRUNG HOÀ", "TOẢ NHIỆT"],
  },
  {
    id: "hno3_naoh",
    name: "Trung hoà axit nitric bằng natri hidroxit",
    reactants: ["hno3", "naoh"],
    products: ["nano3", "h2o"],
    equation: "HNO₃ + NaOH → NaNO₃ + H₂O",
    phenomenon: "Phản ứng trung hoà toả nhiệt, dung dịch trong suốt.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xe6f2f8, heat: 0.35 },
    tags: ["TRUNG HOÀ"],
  },
  {
    id: "hcl_na2co3",
    name: "Axit clohidric tác dụng với natri cacbonat",
    reactants: ["hcl", "na2co3"],
    products: ["nacl", "h2o", "co2"],
    equation: "2HCl + Na₂CO₃ → 2NaCl + H₂O + CO₂↑",
    phenomenon: "Sủi bọt khí mạnh, khí CO₂ không màu thoát ra khỏi cốc. Dung dịch trong suốt trở lại.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xdfeff8, gas: 1, gasColor: 0xf2fbff },
    tags: ["AXIT + MUỐI", "KHÍ CO₂"],
  },
  {
    id: "h2so4_na2co3",
    name: "Axit sunfuric tác dụng với natri cacbonat",
    reactants: ["h2so4", "na2co3"],
    products: ["na2so4", "h2o", "co2"],
    equation: "H₂SO₄ + Na₂CO₃ → Na₂SO₄ + H₂O + CO₂↑",
    phenomenon: "Cốc sủi bọt mạnh, khí CO₂ thoát ra; dung dịch không màu.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xdfeff8, gas: 1, gasColor: 0xf2fbff },
    tags: ["AXIT + MUỐI", "KHÍ CO₂"],
  },
  {
    id: "hcl_caco3",
    name: "Axit clohidric hoà tan đá vôi",
    reactants: ["hcl", "caco3"],
    products: ["cacl2", "h2o", "co2"],
    equation: "2HCl + CaCO₃ → CaCl₂ + H₂O + CO₂↑",
    phenomenon: "Đá vôi tan dần, sủi bọt khí CO₂ rất mạnh. Chất rắn trắng biến mất, dung dịch trong suốt.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xdfeff8, gas: 1, gasColor: 0xf2fbff, cloudy: 0.12 },
    tags: ["AXIT + CACBONAT", "KHÍ CO₂"],
  },
  {
    id: "h2so4_caco3",
    name: "Axit sunfuric tác dụng với đá vôi",
    reactants: ["h2so4", "caco3"],
    products: ["caso4", "h2o", "co2"],
    equation: "H₂SO₄ + CaCO₃ → CaSO₄ + H₂O + CO₂↑",
    phenomenon: "Đá vôi tan dần và sủi bọt; thạch cao ít tan tạo lớp váng trắng, làm chậm phản ứng.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xedf3f3, gas: 0.8, gasColor: 0xf2fbff, cloudy: 0.42 },
    tags: ["AXIT + CACBONAT", "KẾT TỦA"],
  },
  {
    id: "hcl_zn",
    name: "Kẽm tác dụng với axit clohidric",
    reactants: ["zn", "hcl"],
    products: ["zncl2", "h2"],
    equation: "Zn + 2HCl → ZnCl₂ + H₂↑",
    phenomenon: "Bọt khí H₂ bám lên bề mặt kẽm và thoát ra mạnh. Kẽm tan dần.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xe4f1f5, gas: 0.82, gasColor: 0xf2fbff },
    tags: ["KIM LOẠI + AXIT", "KHÍ H₂"],
  },
  {
    id: "h2so4_zn",
    name: "Kẽm tác dụng với axit sunfuric",
    reactants: ["zn", "h2so4"],
    products: ["znso4", "h2"],
    equation: "Zn + H₂SO₄ → ZnSO₄ + H₂↑",
    phenomenon: "Kẽm tan dần, sủi bọt khí hiđro. Dung dịch thu được không màu.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xe4f1f5, gas: 0.82, gasColor: 0xf2fbff },
    tags: ["KIM LOẠI + AXIT", "KHÍ H₂"],
  },
  {
    id: "hcl_fe",
    name: "Sắt tác dụng với axit clohidric",
    reactants: ["fe", "hcl"],
    products: ["fecl2", "h2"],
    equation: "Fe + 2HCl → FeCl₂ + H₂↑",
    phenomenon: "Sắt tan dần, sủi bọt khí. Dung dịch chuyển sang màu xanh lục nhạt của FeCl₂.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xcfe8c8, gas: 0.7, gasColor: 0xf2fbff },
    tags: ["KIM LOẠI + AXIT", "KHÍ H₂"],
  },
  {
    id: "h2so4_fe",
    name: "Sắt tác dụng với axit sunfuric",
    reactants: ["fe", "h2so4"],
    products: ["feso4", "h2"],
    equation: "Fe + H₂SO₄ → FeSO₄ + H₂↑",
    phenomenon: "Sắt tan, sủi bọt khí; dung dịch có màu xanh lục nhạt.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xcfe8c8, gas: 0.7, gasColor: 0xf2fbff },
    tags: ["KIM LOẠI + AXIT", "KHÍ H₂"],
  },
  {
    id: "hcl_cuo",
    name: "Đồng(II) oxit tan trong axit clohidric",
    reactants: ["cuo", "hcl"],
    products: ["cucl2", "h2o"],
    equation: "CuO + 2HCl → CuCl₂ + H₂O",
    phenomenon: "Chất rắn đen tan dần, dung dịch chuyển sang màu xanh lam của muối đồng(II).",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0x2ea3b5, cloudy: 0.08 },
    tags: ["OXIT BAZƠ + AXIT", "ĐỔI MÀU"],
  },
  {
    id: "h2so4_cuo",
    name: "Đồng(II) oxit tan trong axit sunfuric",
    reactants: ["cuo", "h2so4"],
    products: ["cuso4", "h2o"],
    equation: "CuO + H₂SO₄ → CuSO₄ + H₂O",
    phenomenon: "Chất rắn đen tan hết, dung dịch xanh lam đặc trưng của CuSO₄ xuất hiện.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0x2f8fd8, cloudy: 0.06 },
    tags: ["OXIT BAZƠ + AXIT", "ĐỔI MÀU"],
  },
  {
    id: "hcl_cao",
    name: "Vôi sống tác dụng với axit clohidric",
    reactants: ["cao", "hcl"],
    products: ["cacl2", "h2o"],
    equation: "CaO + 2HCl → CaCl₂ + H₂O",
    phenomenon: "Vôi sống tan nhanh, phản ứng toả nhiệt mạnh; dung dịch trong suốt.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xe6f2f7, heat: 0.65 },
    tags: ["OXIT BAZƠ + AXIT", "TOẢ NHIỆT"],
  },
  {
    id: "h2so4_cao",
    name: "Vôi sống tác dụng với axit sunfuric",
    reactants: ["cao", "h2so4"],
    products: ["caso4", "h2o"],
    equation: "CaO + H₂SO₄ → CaSO₄ + H₂O",
    phenomenon: "Vôi sống tan, toả nhiệt; thạch cao ít tan tạo huyền phù trắng đục.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xedf3f3, cloudy: 0.5, heat: 0.55 },
    tags: ["OXIT BAZƠ + AXIT", "KẾT TỦA"],
  },
  {
    id: "cuso4_naoh",
    name: "Đồng(II) sunfat tác dụng với natri hidroxit",
    reactants: ["cuso4", "naoh"],
    products: ["cu_oh2", "na2so4"],
    equation: "CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄",
    phenomenon: "Xuất hiện kết tủa xanh lam keo của Cu(OH)₂. Màu xanh của dung dịch đồng nhạt dần.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xdfeff8, precip: 0x5fb7e6, precipAmount: 0.82, cloudy: 0.16 },
    tags: ["KẾT TỦA", "MUỐI + BAZƠ"],
  },
  {
    id: "cuso4_koh",
    name: "Đồng(II) sunfat tác dụng với kali hidroxit",
    reactants: ["cuso4", "koh"],
    products: ["cu_oh2", "k2so4"],
    equation: "CuSO₄ + 2KOH → Cu(OH)₂↓ + K₂SO₄",
    phenomenon: "Kết tủa xanh lam Cu(OH)₂ tạo thành và lắng xuống đáy cốc.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xdfeff8, precip: 0x5fb7e6, precipAmount: 0.82, cloudy: 0.16 },
    tags: ["KẾT TỦA", "MUỐI + BAZƠ"],
  },
  {
    id: "fecl3_naoh",
    name: "Sắt(III) clorua tác dụng với natri hidroxit",
    reactants: ["fecl3", "naoh"],
    products: ["fe_oh3", "nacl"],
    equation: "FeCl₃ + 3NaOH → Fe(OH)₃↓ + 3NaCl",
    phenomenon: "Xuất hiện kết tủa nâu đỏ keo của Fe(OH)₃; màu vàng nâu của dung dịch biến mất.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xf2e9dc, precip: 0xa4552f, precipAmount: 0.86, cloudy: 0.2 },
    tags: ["KẾT TỦA", "MUỐI + BAZƠ"],
  },
  {
    id: "fecl3_koh",
    name: "Sắt(III) clorua tác dụng với kali hidroxit",
    reactants: ["fecl3", "koh"],
    products: ["fe_oh3", "kcl"],
    equation: "FeCl₃ + 3KOH → Fe(OH)₃↓ + 3KCl",
    phenomenon: "Kết tủa nâu đỏ Fe(OH)₃ tạo thành, dung dịch mất màu vàng nâu.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xf2e9dc, precip: 0xa4552f, precipAmount: 0.86, cloudy: 0.2 },
    tags: ["KẾT TỦA", "MUỐI + BAZƠ"],
  },
  {
    id: "agno3_nacl",
    name: "Bạc nitrat tác dụng với natri clorua",
    reactants: ["agno3", "nacl"],
    products: ["agcl", "nano3"],
    equation: "AgNO₃ + NaCl → AgCl↓ + NaNO₃",
    phenomenon: "Kết tủa trắng vón cục AgCl tạo thành, lắng xuống đáy cốc.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xf1f4f4, precip: 0xe4e5dd, precipAmount: 0.72, cloudy: 0.38 },
    tags: ["KẾT TỦA TRẮNG", "NHẬN BIẾT Cl⁻"],
  },
  {
    id: "agno3_hcl",
    name: "Bạc nitrat tác dụng với axit clohidric",
    reactants: ["agno3", "hcl"],
    products: ["agcl", "hno3"],
    equation: "AgNO₃ + HCl → AgCl↓ + HNO₃",
    phenomenon: "Kết tủa trắng AgCl xuất hiện ngay; dung dịch còn lại chứa axit nitric.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xf1f4f4, precip: 0xe4e5dd, precipAmount: 0.72, cloudy: 0.38 },
    tags: ["KẾT TỦA TRẮNG", "NHẬN BIẾT Cl⁻"],
  },
  {
    id: "fecl2_naoh",
    name: "Sắt(II) clorua tác dụng với natri hidroxit",
    reactants: ["fecl2", "naoh"],
    products: ["fe_oh2", "nacl"],
    equation: "FeCl₂ + 2NaOH → Fe(OH)₂↓ + 2NaCl",
    phenomenon: "Kết tủa trắng xanh Fe(OH)₂ tạo thành; trong không khí kết tủa dần chuyển nâu đỏ.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xeaf2ea, precip: 0x8fbf9a, precipAmount: 0.62, cloudy: 0.18 },
    tags: ["KẾT TỦA", "MUỐI + BAZƠ"],
  },
  {
    id: "znso4_naoh",
    name: "Kẽm sunfat tác dụng với natri hidroxit",
    reactants: ["znso4", "naoh"],
    products: ["zn_oh2", "na2so4"],
    equation: "ZnSO₄ + 2NaOH → Zn(OH)₂↓ + Na₂SO₄",
    phenomenon: "Kết tủa trắng keo Zn(OH)₂ xuất hiện; kết tủa tan nếu cho dư NaOH.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xeaf2f2, precip: 0xf0f0e8, precipAmount: 0.66, cloudy: 0.28 },
    tags: ["KẾT TỦA TRẮNG", "MUỐI + BAZƠ"],
  },
  {
    id: "cacl2_na2co3",
    name: "Canxi clorua tác dụng với natri cacbonat",
    reactants: ["cacl2", "na2co3"],
    products: ["caco3", "nacl"],
    equation: "CaCl₂ + Na₂CO₃ → CaCO₃↓ + 2NaCl",
    phenomenon: "Kết tủa trắng CaCO₃ (đá vôi) tạo thành và lắng xuống đáy cốc.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xf0f3f2, precip: 0xefece1, precipAmount: 0.72, cloudy: 0.32 },
    tags: ["KẾT TỦA TRẮNG", "MUỐI + MUỐI"],
  },
  {
    id: "cucl2_naoh",
    name: "Đồng(II) clorua tác dụng với natri hidroxit",
    reactants: ["cucl2", "naoh"],
    products: ["cu_oh2", "nacl"],
    equation: "CuCl₂ + 2NaOH → Cu(OH)₂↓ + 2NaCl",
    phenomenon: "Kết tủa xanh lam Cu(OH)₂ tạo thành, dung dịch mất màu xanh.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xdfeff8, precip: 0x5fb7e6, precipAmount: 0.82, cloudy: 0.16 },
    tags: ["KẾT TỦA", "MUỐI + BAZƠ"],
  },
  {
    id: "fe_cuso4",
    name: "Sắt đẩy đồng khỏi dung dịch đồng(II) sunfat",
    reactants: ["fe", "cuso4"],
    products: ["feso4", "cu"],
    equation: "Fe + CuSO₄ → FeSO₄ + Cu↓",
    phenomenon: "Màu xanh lam nhạt dần; đồng đỏ bám lên bề mặt sắt, dung dịch chuyển xanh lục nhạt.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xcfe8c8, precip: 0xb06a3a, precipAmount: 0.48, cloudy: 0.1 },
    tags: ["ĐẨY KIM LOẠI", "OXI HOÁ – KHỬ"],
  },
  {
    id: "zn_cuso4",
    name: "Kẽm đẩy đồng khỏi dung dịch đồng(II) sunfat",
    reactants: ["zn", "cuso4"],
    products: ["znso4", "cu"],
    equation: "Zn + CuSO₄ → ZnSO₄ + Cu↓",
    phenomenon: "Màu xanh lam biến mất, đồng đỏ bám lên kẽm; dung dịch gần như không màu.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xe4f0f3, precip: 0xb06a3a, precipAmount: 0.48, cloudy: 0.1 },
    tags: ["ĐẨY KIM LOẠI", "OXI HOÁ – KHỬ"],
  },
  {
    id: "cu_agno3",
    name: "Đồng đẩy bạc khỏi dung dịch bạc nitrat",
    reactants: ["cu", "agno3"],
    products: ["cu_no32", "ag"],
    equation: "Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag↓",
    phenomenon: "Dung dịch không màu chuyển dần sang xanh lam; bạc sáng kết tinh trên bề mặt đồng.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0x2f8fd8, precip: 0xd7dbe2, precipAmount: 0.46, cloudy: 0.12 },
    tags: ["ĐẨY KIM LOẠI", "KẾT TINH BẠC"],
  },
  {
    id: "cao_h2o",
    name: "Vôi sống tác dụng với nước",
    reactants: ["cao", "h2o"],
    products: ["ca_oh2"],
    equation: "CaO + H₂O → Ca(OH)₂",
    phenomenon: "Vôi sống sôi sùng sục, toả rất nhiều nhiệt và bốc hơi trắng; tạo huyền phù vôi tôi.",
    condition: "Nhiệt độ phòng · toả nhiệt mạnh",
    effect: { liquid: 0xf4f2e8, cloudy: 0.82, heat: 1, smoke: 0.72 },
    tags: ["TOẢ NHIỆT MẠNH", "OXIT BAZƠ + NƯỚC"],
  },
  {
    id: "na_h2o",
    name: "Natri tác dụng với nước",
    reactants: ["na", "h2o"],
    products: ["naoh", "h2"],
    equation: "2Na + 2H₂O → 2NaOH + H₂↑",
    phenomenon: "Natri nóng chảy thành giọt tròn, chạy trên mặt nước, sủi bọt mãnh liệt và có thể bốc cháy.",
    condition: "Nhiệt độ phòng · phản ứng rất mạnh",
    effect: { liquid: 0xe8f2fa, gas: 1, gasColor: 0xf2fbff, flame: 0xffb347, heat: 0.9, smoke: 0.22 },
    tags: ["KIM LOẠI KIỀM", "TOẢ NHIỆT", "NGUY HIỂM"],
  },
  {
    id: "h2o2_mno2",
    name: "Phân huỷ hiđro peoxit với xúc tác MnO₂",
    reactants: ["h2o2", "mno2"],
    products: ["h2o", "o2"],
    equation: "2H₂O₂ —MnO₂→ 2H₂O + O₂↑",
    phenomenon: "Sủi bọt khí oxi rất mạnh, dung dịch nóng lên. MnO₂ vẫn còn sau phản ứng.",
    condition: "MnO₂ xúc tác · toả nhiệt",
    effect: { liquid: 0xeaf6fb, gas: 1, gasColor: 0xf2fbff, heat: 0.55 },
    catalyst: ["mno2"],
    tags: ["XÚC TÁC", "KHÍ O₂"],
  },
  {
    id: "caco3_heat",
    name: "Nhiệt phân đá vôi",
    reactants: ["caco3"],
    products: ["cao", "co2"],
    equation: "CaCO₃ —t°→ CaO + CO₂↑",
    phenomenon: "Đá vôi bị nung đỏ, khí CO₂ thoát ra; chất rắn chuyển thành vôi sống CaO.",
    condition: "Nung nóng trên 900°C",
    heat: true,
    effect: { gas: 0.55, gasColor: 0xf2fbff, cloudy: 0.24 },
    tags: ["NHIỆT PHÂN", "KHÍ CO₂"],
  },
  {
    id: "cu_oh2_heat",
    name: "Nhiệt phân đồng(II) hidroxit",
    reactants: ["cu_oh2"],
    products: ["cuo", "h2o"],
    equation: "Cu(OH)₂ —t°→ CuO + H₂O",
    phenomenon: "Kết tủa xanh lam dần chuyển sang màu đen của CuO; hơi nước thoát ra.",
    condition: "Đun nóng",
    heat: true,
    effect: { liquid: 0xe8f4f8, precip: 0x24262d, precipAmount: 0.8, smoke: 0.45 },
    tags: ["NHIỆT PHÂN", "ĐỔI MÀU"],
  },
  {
    id: "ca_oh2_hcl",
    name: "Vôi tôi tác dụng với axit clohidric",
    reactants: ["ca_oh2", "hcl"],
    products: ["cacl2", "h2o"],
    equation: "Ca(OH)₂ + 2HCl → CaCl₂ + 2H₂O",
    phenomenon: "Huyền phù vôi trong dần, dung dịch trở nên trong suốt và nóng lên.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xe6f2f7, cloudy: 0.08, heat: 0.4 },
    tags: ["BAZƠ + AXIT", "TRUNG HOÀ"],
  },
  {
    id: "ca_oh2_h2so4",
    name: "Vôi tôi tác dụng với axit sunfuric",
    reactants: ["ca_oh2", "h2so4"],
    products: ["caso4", "h2o"],
    equation: "Ca(OH)₂ + H₂SO₄ → CaSO₄ + 2H₂O",
    phenomenon: "Thạch cao trắng ít tan tạo thành, dung dịch đục và nóng lên.",
    condition: "Nhiệt độ phòng",
    effect: { liquid: 0xedf3f3, cloudy: 0.55, heat: 0.4 },
    tags: ["BAZƠ + AXIT", "KẾT TỦA"],
  },
];

interface ResultProduct {
  id: string;
  formula: string;
  name: string;
  state: string;
}

interface ResultView {
  kind: "reaction" | "observation" | "indicator";
  name: string;
  equation: string;
  phenomenon: string;
  condition: string;
  products: ResultProduct[];
  tags: string[];
  count?: number;
  steps?: Array<{ equation: string; name: string }>;
  pink?: boolean;
  acid?: boolean;
}

interface HistoryItem {
  key: number;
  name: string;
  equation: string;
}

interface NotebookItem {
  id: string;
  formula: string;
  name: string;
}

function findReaction(contents: string[], heating: boolean, done: string[]): Reaction | undefined {
  const present = new Set(contents);
  present.add("h2o");

  let best: Reaction | undefined;
  for (const reaction of REACTIONS) {
    if (done.includes(reaction.id)) continue;
    if (reaction.heat && !heating) continue;
    if (!reaction.reactants.every((id) => present.has(id))) continue;
    if (!best || reaction.reactants.length > best.reactants.length) best = reaction;
  }
  return best;
}

function applyReaction(contents: string[], reaction: Reaction): string[] {
  const catalysts = new Set(reaction.catalyst ?? []);
  const consumed = new Set(reaction.reactants.filter((id) => !catalysts.has(id)));
  const next = contents.filter((id) => !consumed.has(id));

  for (const id of reaction.products) {
    const species = speciesOf(id);
    if (species.stay !== false && !next.includes(id)) next.push(id);
  }
  return next;
}

function resolveChain(contents: string[], done: string[], heating: boolean) {
  let current = [...contents];
  let nextDone = [...done];
  const results: Reaction[] = [];

  for (let step = 0; step < 5; step += 1) {
    const reaction = findReaction(current, heating, nextDone);
    if (!reaction) break;
    current = applyReaction(current, reaction);
    nextDone = [...nextDone, reaction.id];
    results.push(reaction);
  }

  return { contents: current, done: nextDone, results };
}

function reactionToResult(reaction: Reaction, count: number, chain: Reaction[] = []): ResultView {
  return {
    kind: "reaction",
    name: reaction.name,
    equation: reaction.equation,
    phenomenon: reaction.phenomenon,
    condition: reaction.condition ?? (reaction.heat ? "Đun nóng" : "Nhiệt độ phòng"),
    products: reaction.products.map((id) => {
      const species = speciesOf(id);
      return {
        id,
        formula: species.formula,
        name: species.name,
        state: productState(id, species),
      };
    }),
    tags: reaction.tags,
    count,
    steps: count > 1 ? chain.map((step) => ({ equation: step.equation, name: step.name })) : undefined,
  };
}

function observationResult(reagent: Reagent, contents: string[], heating: boolean): ResultView {
  const liquid = reagent.state === "dd" || reagent.state === "indicator";
  return {
    kind: "observation",
    name: `Đã thêm ${reagent.name.toLowerCase()}`,
    equation: reagent.formula,
    phenomenon: liquid
      ? `Dung dịch ${reagent.name.toLowerCase()} được rót vào cốc. Chưa có phản ứng với ${
          contents.length > 0 ? "các chất đang có" : "nước cất"
        }.`
      : `Cho ${reagent.name.toLowerCase()} vào cốc. Chất rắn chìm xuống đáy, chưa có phản ứng xảy ra.`,
    condition: heating ? "Đang đun nóng" : "Nhiệt độ phòng",
    products: [],
    tags: ["QUAN SÁT"],
  };
}

function indicatorResult(contents: string[]): ResultView | null {
  if (!contents.includes("phenolphthalein")) return null;

  const base = contents.some((id) => id === "naoh" || id === "koh");
  const acid = contents.some((id) => id === "hcl" || id === "h2so4" || id === "hno3");

  if (base && !acid) {
    return {
      kind: "indicator",
      name: "Phenolphthalein trong môi trường bazơ",
      equation: "Phenolphthalein + OH⁻ → dung dịch hồng",
      phenomenon: "Chỉ thị chuyển sang màu hồng cánh sen. Màu càng đậm khi nồng độ bazơ càng lớn.",
      condition: "Nhiệt độ phòng",
      products: [],
      tags: ["CHỈ THỊ MÀU", "MÔI TRƯỜNG BAZƠ"],
      pink: true,
    };
  }

  if (acid && !base) {
    return {
      kind: "indicator",
      name: "Phenolphthalein trong môi trường axit",
      equation: "Phenolphthalein + H⁺ → không màu",
      phenomenon: "Trong môi trường axit, phenolphthalein không màu. Thêm bazơ, màu hồng sẽ xuất hiện trở lại.",
      condition: "Nhiệt độ phòng",
      products: [],
      tags: ["CHỈ THỊ MÀU", "MÔI TRƯỜNG AXIT"],
      acid: true,
    };
  }

  return {
    kind: "indicator",
    name: "Phenolphthalein chưa đổi màu",
    equation: "Phenolphthalein + H₂O → không màu",
    phenomenon: "Trong nước cất hoặc môi trường trung tính, phenolphthalein vẫn không màu.",
    condition: "Nhiệt độ phòng",
    products: [],
    tags: ["CHỈ THỊ MÀU", "TRUNG TÍNH"],
  };
}

interface BubbleState {
  angle: number;
  radius: number;
  y: number;
  speed: number;
  phase: number;
  base: number;
}

interface PrecipState {
  x: number;
  z: number;
  y: number;
  targetY: number;
  speed: number;
  size: number;
  rx: number;
  ry: number;
  rz: number;
}

interface SteamState {
  x: number;
  y: number;
  z: number;
  vy: number;
}

interface PourState {
  x: number;
  z: number;
  offset: number;
}

interface VisualState {
  liquid: THREE.Color;
  liquidTarget: THREE.Color;
  fill: number;
  fillTarget: number;
  cloudy: number;
  cloudyTarget: number;
  gas: number;
  gasColor: THREE.Color;
  precipTarget: number;
  precipColor: THREE.Color;
  flame: number;
  smoke: number;
  heatPulse: number;
  temp: number;
  heating: boolean;
  pour: number;
  pourColor: THREE.Color;
}

function makeSoftTexture(): THREE.Texture {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.65)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function cssColor(raw: string, fallback: number): THREE.Color {
  const value = raw.trim();
  if (!/^#([0-9a-f]{3,8})|^rgba?\(|^hsla?\(/i.test(value)) return new THREE.Color(fallback);
  const color = new THREE.Color();
  color.setStyle(value);
  return color;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

let randomSeed = 0x2f6e2b1;
function random(): number {
  randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
  return randomSeed / 4294967296;
}

export default function ReactionLab() {
  const [contents, setContents] = useState<string[]>([]);
  const [done, setDone] = useState<string[]>([]);
  const [heating, setHeating] = useState(false);
  const [result, setResult] = useState<ResultView | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [notebook, setNotebook] = useState<NotebookItem[]>([]);
  const [temperature, setTemperature] = useState(25);
  const [notice, setNotice] = useState<{ text: string; key: number } | null>(null);
  const [pulse, setPulse] = useState(0);
  const [filterKind, setFilterKind] = useState<ReagentKind | "all">("all");

  const hostRef = useRef<HTMLDivElement>(null);
  const liquidRef = useRef<THREE.Mesh | null>(null);
  const surfaceRef = useRef<THREE.Mesh | null>(null);
  const liquidMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const surfaceMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const bubbleMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const bubblesRef = useRef<THREE.Mesh[]>([]);
  const bubbleStatesRef = useRef<BubbleState[]>([]);
  const precipRef = useRef<THREE.InstancedMesh | null>(null);
  const precipStatesRef = useRef<PrecipState[]>([]);
  const chunksRef = useRef<THREE.Group | null>(null);
  const steamRef = useRef<THREE.Points | null>(null);
  const steamMatRef = useRef<THREE.PointsMaterial | null>(null);
  const steamStatesRef = useRef<SteamState[]>([]);
  const flameRef = useRef<THREE.Group | null>(null);
  const flameLightRef = useRef<THREE.PointLight | null>(null);
  const heatLightRef = useRef<THREE.PointLight | null>(null);
  const plateTopMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const plateRingMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const pourMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const pourDropsRef = useRef<THREE.Mesh[]>([]);
  const pourStatesRef = useRef<PourState[]>([]);
  const historyKeyRef = useRef(0);
  const noticeKeyRef = useRef(0);

  const vis = useRef<VisualState>({
    liquid: new THREE.Color(WATER_COLOR),
    liquidTarget: new THREE.Color(WATER_COLOR),
    fill: 0.82,
    fillTarget: 0.82,
    cloudy: 0.08,
    cloudyTarget: 0.08,
    gas: 0,
    gasColor: new THREE.Color(0xf2fbff),
    precipTarget: 0,
    precipColor: new THREE.Color(0xe4e5dd),
    flame: 0,
    smoke: 0,
    heatPulse: 0,
    temp: 25,
    heating: false,
    pour: 0,
    pourColor: new THREE.Color(0xdceff5),
  });

  const groups = useMemo(
    () =>
      KIND_ORDER.map((kind) => ({
        kind,
        label: KIND_LABEL[kind],
        items: REAGENTS.filter((reagent) => reagent.kind === kind),
      })).filter((group) => group.items.length > 0),
    []
  );

  const contentSet = useMemo(() => new Set(contents), [contents]);

  const notify = (text: string) => {
    noticeKeyRef.current += 1;
    setNotice({ text, key: noticeKeyRef.current });
  };

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    vis.current.heating = heating;
  }, [heating]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = Math.round(vis.current.temp);
      setTemperature((previous) => (previous === next ? previous : next));
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const dropPrecipitate = (color: number, amount: number) => {
    const state = vis.current;
    state.precipTarget = amount;
    state.precipColor.set(color);

    const mesh = precipRef.current;
    if (!mesh) return;
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.color.set(color);
    mesh.visible = true;
    mesh.count = Math.max(12, Math.round(90 * amount));

    const particles = precipStatesRef.current;
    for (let index = 0; index < mesh.count; index += 1) {
      const particle = particles[index];
      if (!particle) continue;
      particle.y = 0.22 + random() * Math.max(0.25, state.fill * 0.9);
      particle.targetY = 0.19 + random() * 0.16;
      particle.speed = 0.18 + random() * 0.5;
    }
  };

  const applyVisualEffect = (effect: Effect) => {
    const state = vis.current;
    if (effect.liquid !== undefined) {
      const next = new THREE.Color(effect.liquid);
      // Dung dịch gần như không màu vẫn giữ một chút sắc nước để dễ đọc trên nền tối.
      if (next.b >= next.r && next.b >= next.g && next.r > 0.75) {
        next.lerp(new THREE.Color(WATER_COLOR), 0.6);
      }
      state.liquidTarget.copy(next);
    }
    if (effect.cloudy !== undefined) state.cloudyTarget = effect.cloudy;
    if (effect.gas) {
      state.gas = Math.max(state.gas, effect.gas);
      state.gasColor.set(effect.gasColor ?? 0xf2fbff);
    }
    if (effect.precip !== undefined) {
      dropPrecipitate(effect.precip, effect.precipAmount ?? 0.65);
    }
    if (effect.flame) state.flame = Math.max(state.flame, 1);
    if (effect.smoke) state.smoke = Math.max(state.smoke, effect.smoke);
    if (effect.heat) {
      state.heatPulse = Math.max(state.heatPulse, effect.heat);
      state.temp = Math.min(100, Math.max(state.temp, 52 + effect.heat * 48));
    }
  };

  const recordReactions = (results: Reaction[]) => {
    if (results.length === 0) return;

    const entries: HistoryItem[] = [];
    for (const reaction of results) {
      historyKeyRef.current += 1;
      entries.push({ key: historyKeyRef.current, name: reaction.name, equation: reaction.equation });
    }
    const newestFirst = [...entries].reverse();
    setHistory((previous) => [...newestFirst, ...previous].slice(0, 5));

    setNotebook((previous) => {
      const map = new Map(previous.map((item) => [item.id, item]));
      for (const reaction of results) {
        for (const id of reaction.products) {
          const species = speciesOf(id);
          if (species.stay === false || id === "h2o") continue;
          if (!map.has(id)) map.set(id, { id, formula: species.formula, name: species.name });
        }
      }
      return [...map.values()];
    });
  };

  const addReagent = (reagent: Reagent) => {
    if (contents.includes(reagent.id)) {
      notify(`${reagent.formula} đã có trong cốc.`);
      return;
    }

    const state = vis.current;
    if (reagent.state === "dd" || reagent.state === "indicator") {
      state.fillTarget = clamp(state.fillTarget + 0.055, 0.82, 1.9);
      if (reagent.tint !== undefined) state.liquidTarget.lerp(new THREE.Color(reagent.tint), 0.42);
    } else {
      state.fillTarget = clamp(state.fillTarget + 0.02, 0.82, 1.9);
      state.cloudyTarget = Math.min(0.3, state.cloudyTarget + 0.035);
    }

    state.pour = 1;
    state.pourColor.set(reagent.tint ?? reagent.solid ?? 0xe8f0f5);

    const next = resolveChain([...contents, reagent.id], done, heating);
    setContents(next.contents);
    setDone(next.done);

    if (next.results.length > 0) {
      for (const reaction of next.results) applyVisualEffect(reaction.effect);
      const last = next.results[next.results.length - 1];
      setResult(reactionToResult(last, next.results.length, next.results));
      recordReactions(next.results);
      setPulse((value) => value + 1);
      notify(
        next.results.length > 1
          ? `${next.results.length} phản ứng liên tiếp đã xảy ra.`
          : `${last.name} đã xảy ra.`
      );
      return;
    }

    const indicator = indicatorResult(next.contents);
    if (indicator) {
      setResult(indicator);
      if (indicator.pink) {
        state.liquidTarget.set(0xe0448e);
        state.cloudyTarget = Math.max(0.08, state.cloudyTarget);
      } else if (indicator.acid) {
        state.liquidTarget.set(0xe8f3f8);
      }
      return;
    }

    setResult(observationResult(reagent, next.contents, heating));
  };

  const toggleHeat = () => {
    const nextHeating = !heating;
    setHeating(nextHeating);
    vis.current.heating = nextHeating;
    applyVisualEffect({ heat: nextHeating ? 0.35 : 0 });

    if (!nextHeating) {
      notify("Đã tắt đèn đun. Cốc đang nguội dần.");
      return;
    }

    const next = resolveChain(contents, done, true);
    setContents(next.contents);
    setDone(next.done);

    if (next.results.length > 0) {
      for (const reaction of next.results) applyVisualEffect(reaction.effect);
      const last = next.results[next.results.length - 1];
      setResult(reactionToResult(last, next.results.length, next.results));
      recordReactions(next.results);
      setPulse((value) => value + 1);
      notify(
        next.results.length > 1
          ? `${next.results.length} phản ứng liên tiếp đã xảy ra khi đun nóng.`
          : `${last.name} đã xảy ra khi đun nóng.`
      );
    } else {
      notify("Đang gia nhiệt cho cốc. Chưa có phản ứng nhiệt phân.");
    }
  };

  const reset = () => {
    setContents([]);
    setDone([]);
    setResult(null);
    setHeating(false);
    setPulse(0);

    const state = vis.current;
    state.heating = false;
    state.fillTarget = 0.82;
    state.cloudyTarget = 0.08;
    state.liquidTarget.set(WATER_COLOR);
    state.gas = 0;
    state.flame = 0;
    state.smoke = 0;
    state.heatPulse = 0;
    state.temp = 25;
    state.pour = 0;
    state.precipTarget = 0;
    if (precipRef.current) precipRef.current.visible = false;
    setTemperature(25);
    notify("Đã rửa cốc. Sẵn sàng thí nghiệm mới.");
  };

  const clearLog = () => {
    setHistory([]);
    setNotebook([]);
    notify("Đã xoá lịch sử và sổ tay sản phẩm.");
  };

  // Dựng toàn bộ cảnh Three.js một lần.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0.35, 2.55, 6.35);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.className = "rxn-canvas";
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = environment.texture;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.05, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 4.2;
    controls.maxDistance = 9;
    controls.minPolarAngle = 0.72;
    controls.maxPolarAngle = 1.44;
    controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotateSpeed = 0.28;
    controls.update();

    const stopAutoRotate = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener("start", stopAutoRotate);

    const rootStyle = getComputedStyle(document.documentElement);
    const accent = cssColor(rootStyle.getPropertyValue("--accent"), 0x8b5cf6);
    const accent2 = cssColor(rootStyle.getPropertyValue("--accent-2"), 0x22d3ee);
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    let lightMode = isLight;
    const lightScale = isLight ? 0.8 : 1;
    renderer.toneMappingExposure = isLight ? 0.98 : 1.08;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x11131b, 1.35 * lightScale);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.3 * lightScale);
    keyLight.position.set(4.5, 7, 5.5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(accent, 2.1 * lightScale);
    rimLight.position.set(-5, 4, -3.5);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(accent2, 3.4 * lightScale, 13);
    fillLight.position.set(3.3, 2.5, 2.7);
    scene.add(fillLight);

    const heatLight = new THREE.PointLight(0xff7a35, 0, 8);
    heatLight.position.set(0, 0.05, 0);
    scene.add(heatLight);
    heatLightRef.current = heatLight;

    const flameLight = new THREE.PointLight(0xffb347, 0, 7);
    flameLight.position.set(0, 2.5, 0);
    scene.add(flameLight);
    flameLightRef.current = flameLight;

    const softTexture = makeSoftTexture();

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: isLight ? 0xe9edf5 : 0x0b0d12,
      metalness: 0.18,
      roughness: 0.72,
      transparent: true,
      opacity: isLight ? 0.35 : 0.58,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 80), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    scene.add(floor);

    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: softTexture,
      color: 0x000000,
      transparent: true,
      opacity: isLight ? 0.22 : 0.48,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), shadowMaterial);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -0.085;
    scene.add(contactShadow);

    const glowMaterial = new THREE.MeshBasicMaterial({
      map: softTexture,
      color: accent,
      transparent: true,
      opacity: isLight ? 0.1 : 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 5.8), glowMaterial);
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.y = -0.075;
    scene.add(floorGlow);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (const radius of [2.4, 3.2, 4.15]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.012, 96), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.08;
      scene.add(ring);
    }

    const dustPositions = new Float32Array(70 * 3);
    for (let index = 0; index < 70; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 0.8 + random() * 2.6;
      dustPositions[index * 3] = Math.cos(angle) * radius;
      dustPositions[index * 3 + 1] = 0.4 + random() * 4.2;
      dustPositions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      color: accent,
      size: 0.045,
      map: softTexture,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dust);

    // Bếp điện
    const plateGroup = new THREE.Group();
    const plateMaterial = new THREE.MeshStandardMaterial({
      color: 0x191c25,
      metalness: 0.55,
      roughness: 0.52,
      envMapIntensity: 0.32,
    });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.62, 0.16, 72), plateMaterial);
    plate.position.y = 0.01;
    plateGroup.add(plate);

    const plateTopMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1e27,
      metalness: 0.18,
      roughness: 0.74,
      envMapIntensity: 0.1,
      emissive: new THREE.Color(0xff6b2c),
      emissiveIntensity: 0,
    });
    plateTopMatRef.current = plateTopMaterial;
    const plateTop = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.36, 0.022, 72), plateTopMaterial);
    plateTop.position.y = 0.1;
    plateGroup.add(plateTop);

    const plateRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8a3d,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    plateRingMatRef.current = plateRingMaterial;
    const plateRing = new THREE.Mesh(new THREE.TorusGeometry(1.29, 0.02, 8, 96), plateRingMaterial);
    plateRing.rotation.x = Math.PI / 2;
    plateRing.position.y = 0.116;
    plateGroup.add(plateRing);

    const knobMaterial = new THREE.MeshStandardMaterial({ color: 0x3b4150, metalness: 0.8, roughness: 0.3 });
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 28), knobMaterial);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(1.05, 0.06, 1.22);
    plateGroup.add(knob);

    scene.add(plateGroup);

    // Cốc thuỷ tinh
    const beaker = new THREE.Group();
    scene.add(beaker);

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdff3ff,
      metalness: 0.04,
      roughness: 0.055,
      transparent: true,
      opacity: isLight ? 0.13 : 0.23,
      clearcoat: 1,
      clearcoatRoughness: 0.055,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: isLight ? 0.75 : 0.7,
    });

    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.15, 2.2, 96, 1, true), glassMaterial);
    wall.position.y = 1.22;
    wall.renderOrder = 8;
    beaker.add(wall);

    const bottomMaterial = glassMaterial.clone();
    bottomMaterial.opacity = isLight ? 0.12 : 0.1;
    bottomMaterial.envMapIntensity = isLight ? 0.4 : 0.2;
    bottomMaterial.clearcoat = 0.15;
    bottomMaterial.clearcoatRoughness = 0.5;
    bottomMaterial.roughness = 0.32;
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.06, 72), bottomMaterial);
    bottom.position.y = 0.15;
    bottom.renderOrder = 7;
    beaker.add(bottom);

    const rimMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.12,
      roughness: 0.08,
      transparent: true,
      opacity: 0.58,
      clearcoat: 1,
      depthWrite: false,
    });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.03, 10, 96), rimMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 2.32;
    rim.renderOrder = 9;
    beaker.add(rim);

    const tickMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.36 });
    for (let index = 0; index < 5; index += 1) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(index % 2 === 0 ? 0.2 : 0.12, 0.008, 0.008), tickMaterial);
      tick.position.set(-0.56, 0.52 + index * 0.35, 1.14);
      beaker.add(tick);
    }

    const liquidMaterial = new THREE.MeshPhysicalMaterial({
      color: WATER_COLOR,
      transparent: true,
      opacity: isLight ? 0.34 : 0.26,
      roughness: isLight ? 0.3 : 0.3,
      metalness: 0,
      clearcoat: isLight ? 0.28 : 0.32,
      clearcoatRoughness: isLight ? 0.32 : 0.28,
      side: THREE.FrontSide,
      depthWrite: false,
      envMapIntensity: isLight ? 0.35 : 0.3,
      emissive: new THREE.Color(WATER_COLOR),
      emissiveIntensity: isLight ? 0.03 : 0.06,
    });
    liquidMatRef.current = liquidMaterial;
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(1.085, 1.06, 1, 72, 1, true), liquidMaterial);
    liquid.scale.y = vis.current.fill;
    liquid.position.y = 0.19 + vis.current.fill / 2;
    liquid.renderOrder = 3;
    beaker.add(liquid);
    liquidRef.current = liquid;

    const surfaceMaterial = new THREE.MeshPhysicalMaterial({
      color: WATER_COLOR,
      transparent: true,
      opacity: isLight ? 0.42 : 0.3,
      roughness: isLight ? 0.3 : 0.32,
      metalness: 0,
      clearcoat: isLight ? 0.4 : 0.25,
      side: THREE.FrontSide,
      depthWrite: false,
      envMapIntensity: isLight ? 0.3 : 0.18,
    });
    surfaceMatRef.current = surfaceMaterial;
    const surface = new THREE.Mesh(new THREE.CircleGeometry(1.082, 72), surfaceMaterial);
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.19 + vis.current.fill + 0.006;
    surface.renderOrder = 5;
    beaker.add(surface);
    surfaceRef.current = surface;

    const bubbleGeometry = new THREE.SphereGeometry(1, 10, 10);
    const bubbleMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      roughness: 0.06,
      metalness: 0,
      emissive: new THREE.Color(0xa8d8ff),
      emissiveIntensity: 0.36,
      depthWrite: false,
    });
    bubbleMatRef.current = bubbleMaterial;

    for (let index = 0; index < 42; index += 1) {
      const mesh = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
      const base = 0.016 + random() * 0.034;
      mesh.scale.setScalar(base);
      mesh.visible = false;
      mesh.renderOrder = 4;
      beaker.add(mesh);
      bubblesRef.current.push(mesh);
      bubbleStatesRef.current.push({
        angle: random() * Math.PI * 2,
        radius: random() * 0.82,
        y: 0.2 + random() * 0.8,
        speed: 0.35 + random() * 0.7,
        phase: random() * 10,
        base,
      });
    }

    const precipGeometry = new THREE.SphereGeometry(1, 8, 8);
    const precipMaterial = new THREE.MeshBasicMaterial({
      color: 0xe4e5dd,
    });
    const precip = new THREE.InstancedMesh(precipGeometry, precipMaterial, 90);
    precip.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    precip.count = 0;
    precip.visible = false;
    precip.renderOrder = 2;
    beaker.add(precip);
    precipRef.current = precip;

    for (let index = 0; index < 90; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * 0.92;
      precipStatesRef.current.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        y: 0.25,
        targetY: 0.19 + random() * 0.16,
        speed: 0.18 + random() * 0.5,
        size: 0.022 + random() * 0.034,
        rx: random() * Math.PI,
        ry: random() * Math.PI,
        rz: random() * Math.PI,
      });
    }

    const chunks = new THREE.Group();
    beaker.add(chunks);
    chunksRef.current = chunks;

    const steamCount = 60;
    const steamGeometry = new THREE.BufferGeometry();
    const steamPositions = new Float32Array(steamCount * 3);
    for (let index = 0; index < steamCount; index += 1) {
      steamPositions[index * 3] = 0;
      steamPositions[index * 3 + 1] = -1;
      steamPositions[index * 3 + 2] = 0;
      steamStatesRef.current.push({
        x: 0,
        y: -1,
        z: 0,
        vy: 0.3 + random() * 0.45,
      });
    }
    steamGeometry.setAttribute("position", new THREE.BufferAttribute(steamPositions, 3));
    const steamMaterial = new THREE.PointsMaterial({
      color: 0xf7fbff,
      size: 0.17,
      map: softTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    });
    steamMatRef.current = steamMaterial;
    const steam = new THREE.Points(steamGeometry, steamMaterial);
    steam.renderOrder = 10;
    scene.add(steam);
    steamRef.current = steam;

    const flameGroup = new THREE.Group();
    const outerFlameMaterial = new THREE.MeshBasicMaterial({
      color: 0xff7a2f,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const innerFlameMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe18a,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 18, 1, true), outerFlameMaterial);
    outerFlame.position.y = 0.42;
    const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.56, 16, 1, true), innerFlameMaterial);
    innerFlame.position.y = 0.26;
    flameGroup.add(outerFlame, innerFlame);
    flameGroup.visible = false;
    flameGroup.renderOrder = 11;
    beaker.add(flameGroup);
    flameRef.current = flameGroup;

    const pourMaterial = new THREE.MeshStandardMaterial({
      color: 0xdceff5,
      transparent: true,
      opacity: 0.9,
      roughness: 0.12,
      metalness: 0,
      emissive: new THREE.Color(0xdceff5),
      emissiveIntensity: 0.12,
    });
    pourMatRef.current = pourMaterial;
    const dropGeometry = new THREE.SphereGeometry(1, 8, 8);
    for (let index = 0; index < 10; index += 1) {
      const drop = new THREE.Mesh(dropGeometry, pourMaterial);
      drop.scale.setScalar(0.045);
      drop.visible = false;
      drop.renderOrder = 6;
      beaker.add(drop);
      pourDropsRef.current.push(drop);
      pourStatesRef.current.push({
        x: 0.48 + random() * 0.42,
        z: (random() - 0.5) * 0.22,
        offset: index * 0.24,
      });
    }

    const dummy = new THREE.Object3D();
    const clock = new THREE.Clock();
    let frame = 0;

    const animate = () => {
      frame = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      const state = vis.current;

      const targetTemp = state.heating ? 100 : 25;
      const heatRate = state.heating ? 0.55 : 0.34;
      state.temp += (targetTemp - state.temp) * (1 - Math.exp(-delta * heatRate));
      if (Math.abs(state.temp - targetTemp) < 0.15) state.temp = targetTemp;

      state.gas = Math.max(0, state.gas - delta * 0.16);
      state.flame = Math.max(0, state.flame - delta * 0.55);
      state.smoke = Math.max(0, state.smoke - delta * 0.32);
      state.heatPulse = Math.max(0, state.heatPulse - delta * 0.4);
      state.pour = Math.max(0, state.pour - delta * 1.35);

      state.liquid.lerp(state.liquidTarget, 1 - Math.exp(-delta * 3.2));
      state.fill += (state.fillTarget - state.fill) * (1 - Math.exp(-delta * 3));
      state.cloudy += (state.cloudyTarget - state.cloudy) * (1 - Math.exp(-delta * 2.2));

      const surfaceY = 0.19 + state.fill;

      if (liquidRef.current) {
        liquidRef.current.scale.y = state.fill;
        liquidRef.current.position.y = 0.19 + state.fill / 2;
      }
      if (liquidMatRef.current) {
        liquidMatRef.current.color.copy(state.liquid);
        liquidMatRef.current.emissive.copy(state.liquid);
        liquidMatRef.current.opacity = (lightMode ? 0.34 : 0.26) + state.cloudy * 0.34;
        liquidMatRef.current.roughness = 0.2 + state.cloudy * 0.42;
      }
      if (surfaceRef.current && surfaceMatRef.current) {
        surfaceRef.current.position.y = surfaceY + 0.006;
        surfaceMatRef.current.color.copy(state.liquid);
        surfaceMatRef.current.opacity = (lightMode ? 0.42 : 0.3) + state.cloudy * 0.32;
        surfaceMatRef.current.roughness = 0.14 + state.cloudy * 0.46;
      }

      const boil = state.temp > 90 ? Math.min(0.42, ((state.temp - 90) / 10) * 0.42) : 0;
      const gasPower = Math.max(state.gas, boil);
      if (bubbleMatRef.current) {
        bubbleMatRef.current.color.copy(state.gasColor);
        bubbleMatRef.current.opacity = 0.32 + Math.min(0.45, gasPower * 0.45);
      }

      for (let index = 0; index < bubblesRef.current.length; index += 1) {
        const mesh = bubblesRef.current[index];
        const bubble = bubbleStatesRef.current[index];
        if (!mesh || !bubble) continue;
        if (gasPower < 0.02 || state.fill < 0.1) {
          mesh.visible = false;
          continue;
        }
        bubble.y += (0.22 + bubble.speed * (0.4 + gasPower)) * delta;
        if (bubble.y > surfaceY - 0.02) {
          bubble.y = 0.2 + random() * 0.08;
          bubble.angle = random() * Math.PI * 2;
          bubble.radius = random() * 0.8;
        }
        mesh.visible = true;
        mesh.position.set(
          Math.cos(bubble.angle + time * 0.5) * bubble.radius,
          bubble.y,
          Math.sin(bubble.angle + time * 0.5) * bubble.radius
        );
        mesh.scale.setScalar(
          bubble.base * (0.55 + gasPower * 0.75) * (0.85 + Math.sin(time * 3 + bubble.phase) * 0.15)
        );
      }

      if (chunksRef.current) {
        chunksRef.current.children.forEach((child, index) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.rotation.y += delta * 0.22;
          const baseY = (child.userData.baseY as number | undefined) ?? 0.25;
          child.position.y = baseY + Math.sin(time * 1.1 + index * 1.7) * 0.008 + gasPower * 0.01 * Math.sin(time * 7 + index);
        });
      }

      const precip = precipRef.current;
      if (precip) {
        const visible = state.precipTarget > 0.02;
        precip.visible = visible;
        if (visible) {
          for (let index = 0; index < precip.count; index += 1) {
            const particle = precipStatesRef.current[index];
            if (!particle) continue;
            if (particle.y > particle.targetY) {
              particle.y = Math.max(particle.targetY, particle.y - particle.speed * delta);
            }
            dummy.position.set(particle.x, particle.y, particle.z);
            dummy.rotation.set(particle.rx, particle.ry, particle.rz);
            dummy.scale.setScalar(particle.size);
            dummy.updateMatrix();
            precip.setMatrixAt(index, dummy.matrix);
          }
          precip.instanceMatrix.needsUpdate = true;
        }
      }

      const steam = steamRef.current;
      const steamMaterialRef = steamMatRef.current;
      const steamPower = clamp(Math.max((state.temp - 55) / 45, state.smoke), 0, 1);
      if (steam && steamMaterialRef) {
        steamMaterialRef.opacity = 0.3 * steamPower;
        steam.visible = steamPower > 0.02;
        if (steam.visible) {
          const position = steam.geometry.getAttribute("position") as THREE.BufferAttribute;
          for (let index = 0; index < steamStatesRef.current.length; index += 1) {
            const particle = steamStatesRef.current[index];
            if (particle.y < 0.5) {
              if (random() < steamPower * 0.006) {
                particle.x = (random() - 0.5) * 1.15;
                particle.z = (random() - 0.5) * 0.9;
                particle.y = 2.12 + random() * 0.28;
                particle.vy = 0.3 + random() * 0.5;
              } else {
                continue;
              }
            }
            particle.y += (particle.vy + steamPower * 0.25) * delta;
            particle.x += Math.sin(time * 1.4 + index) * 0.035 * delta;
            if (particle.y > 4.3) particle.y = -1;
            position.setXYZ(index, particle.x, particle.y, particle.z);
          }
          position.needsUpdate = true;
        }
      }

      if (flameRef.current) {
        flameRef.current.visible = state.flame > 0.02;
        if (flameRef.current.visible) {
          flameRef.current.position.y = surfaceY + 0.01;
          const flicker = 0.88 + Math.sin(time * 15) * 0.1 + Math.sin(time * 25) * 0.05;
          flameRef.current.scale.set(flicker, 1 + state.flame * 0.32, flicker);
          flameRef.current.rotation.y = time * 0.6;
        }
      }
      if (flameLightRef.current) flameLightRef.current.intensity = state.flame * 2.6;

      const heatPower = Math.max(state.heating ? 0.92 : 0, state.heatPulse);
      if (heatLightRef.current) heatLightRef.current.intensity = heatPower * 2.3 + state.flame * 0.7;
      if (plateTopMatRef.current) plateTopMatRef.current.emissiveIntensity = heatPower * 0.9;
      if (plateRingMatRef.current) {
        plateRingMatRef.current.opacity = heatPower > 0.01 ? 0.48 + Math.sin(time * 3.2) * 0.12 : 0;
      }

      if (pourMatRef.current && pourDropsRef.current.length > 0) {
        if (state.pour > 0.01) {
          pourMatRef.current.opacity = 0.9 * state.pour;
          pourMatRef.current.color.copy(state.pourColor);
          pourMatRef.current.emissive.copy(state.pourColor);
          const fall = (time * 1.7) % 2.5;
          pourDropsRef.current.forEach((drop, index) => {
            const pour = pourStatesRef.current[index];
            if (!pour) return;
            const y = 3.4 - ((fall + pour.offset) % 2.5);
            drop.position.set(pour.x + Math.sin(time * 2 + index) * 0.02, y, pour.z);
            drop.visible = y > surfaceY + 0.02;
          });
        } else {
          pourDropsRef.current.forEach((drop) => {
            drop.visible = false;
          });
        }
      }

      dust.rotation.y = time * 0.028;
      controls.update();
      renderer.render(scene, camera);
    };

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    renderer.setSize(1, 1, false);
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const themeObserver = new MutationObserver(() => {
      const style = getComputedStyle(document.documentElement);
      const nextAccent = cssColor(style.getPropertyValue("--accent"), 0x8b5cf6);
      rimLight.color.copy(nextAccent);
      ringMaterial.color.copy(nextAccent);
      glowMaterial.color.copy(nextAccent);
      dustMaterial.color.copy(nextAccent);
      fillLight.color.copy(cssColor(style.getPropertyValue("--accent-2"), 0x22d3ee));
      const light = document.documentElement.getAttribute("data-theme") === "light";
      lightMode = light;
      const scale = light ? 0.8 : 1;
      hemiLight.intensity = 1.35 * scale;
      keyLight.intensity = 2.3 * scale;
      rimLight.intensity = 2.1 * scale;
      fillLight.intensity = 3.4 * scale;
      renderer.toneMappingExposure = light ? 0.98 : 1.08;
      liquidMaterial.opacity = light ? 0.34 : 0.26;
      liquidMaterial.clearcoat = light ? 0.28 : 0.32;
      liquidMaterial.clearcoatRoughness = light ? 0.32 : 0.28;
      liquidMaterial.envMapIntensity = light ? 0.35 : 0.3;
      liquidMaterial.emissiveIntensity = light ? 0.03 : 0.06;
      surfaceMaterial.opacity = light ? 0.42 : 0.3;
      surfaceMaterial.envMapIntensity = light ? 0.3 : 0.18;
      floorMaterial.color.set(light ? 0xe9edf5 : 0x0b0d12);
      floorMaterial.opacity = light ? 0.35 : 0.58;
      glowMaterial.opacity = light ? 0.1 : 0.24;
      shadowMaterial.opacity = light ? 0.22 : 0.48;
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-palette", "style"],
    });

    animate();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      controls.removeEventListener("start", stopAutoRotate);
      controls.dispose();

      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.InstancedMesh) {
          geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of objectMaterials) materials.add(material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => {
        const values = Object.values(material as unknown as Record<string, unknown>);
        for (const value of values) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        material.dispose();
      });
      softTexture.dispose();
      scene.environment = null;
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();

      liquidRef.current = null;
      surfaceRef.current = null;
      liquidMatRef.current = null;
      surfaceMatRef.current = null;
      bubbleMatRef.current = null;
      bubblesRef.current = [];
      bubbleStatesRef.current = [];
      precipRef.current = null;
      precipStatesRef.current = [];
      chunksRef.current = null;
      steamRef.current = null;
      steamMatRef.current = null;
      steamStatesRef.current = [];
      flameRef.current = null;
      flameLightRef.current = null;
      heatLightRef.current = null;
      plateTopMatRef.current = null;
      plateRingMatRef.current = null;
      pourMatRef.current = null;
      pourDropsRef.current = [];
      pourStatesRef.current = [];
    };
  }, []);

  // Cập nhật các cục chất rắn đang có trong cốc.
  useEffect(() => {
    const group = chunksRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children.pop();
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const material = child.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      }
    }

    const solids = contents
      .filter((id) => {
        const reagent = REAGENT_MAP.get(id);
        return Boolean(reagent && (reagent.state === "solid" || reagent.state === "metal"));
      })
      .slice(0, 8);

    solids.forEach((id, index) => {
      const species = speciesOf(id);
      const geometry = new THREE.DodecahedronGeometry(0.11 + random() * 0.055, 0);
      const material = new THREE.MeshStandardMaterial({
        color: species.color ?? 0xd8d8d8,
        roughness: 0.46,
        metalness: 0.22,
      });
      const mesh = new THREE.Mesh(geometry, material);
      const angle = (index / Math.max(1, solids.length)) * Math.PI * 2 + random() * 0.5;
      const radius = 0.24 + random() * 0.58;
      mesh.position.set(Math.cos(angle) * radius, 0.24 + random() * 0.06, Math.sin(angle) * radius);
      mesh.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      mesh.userData.baseY = mesh.position.y;
      group.add(mesh);
    });
  }, [contents]);

  const heatingStatus = heating ? "ĐANG GIA NHIỆT" : null;
  const statusText = heatingStatus
    ? heatingStatus
    : result?.kind === "reaction"
      ? "PHẢN ỨNG ĐÃ XẢY RA"
      : result?.kind === "indicator"
        ? "ĐỔI MÀU CHỈ THỊ"
        : contents.length > 0
          ? "ĐANG QUAN SÁT"
          : "SẴN SÀNG";
  const statusClass = heating
    ? "is-heat"
    : result?.kind === "reaction"
      ? "is-live"
      : result?.kind === "indicator"
        ? "is-indicator"
        : "";

  const statusTag =
    result?.kind === "reaction"
      ? result.count && result.count > 1
        ? `CHUỖI ${result.count} PHẢN ỨNG`
        : "PHẢN ỨNG"
      : result?.kind === "indicator"
        ? "CHỈ THỊ MÀU"
        : "QUAN SÁT";

  return (
    <div className="lab-workspace rxn-layout">
      <aside className="rxn-panel" data-kind={filterKind}>
        <header className="rxn-head">
          <span className="rxn-mark">
            <FlaskConical size={16} />
          </span>
          <div>
            <strong>KỆ CHẤT</strong>
            <span>CHỌN CHẤT · QUAN SÁT</span>
          </div>
          <span className="rxn-count" aria-label={`${contents.length} chất trong cốc`}>
            {contents.length}
          </span>
        </header>

        <div className="rxn-filter" role="group" aria-label="Lọc chất theo nhóm">
          <button
            type="button"
            className={filterKind === "all" ? "is-active" : ""}
            onClick={() => setFilterKind("all")}
          >
            TẤT CẢ
          </button>
          {groups.map((group) => (
            <button
              key={group.kind}
              type="button"
              className={filterKind === group.kind ? "is-active" : ""}
              onClick={() => setFilterKind(group.kind)}
            >
              {KIND_SHORT[group.kind]}
            </button>
          ))}
        </div>

        <div className="rxn-scroll">
          <div className="rxn-contents">
            <div className="rxn-mini-title">TRONG CỐC</div>
            <div className="rxn-chips">
              <span className="rxn-chip is-water">
                <b>H₂O</b>
                <span>Nước cất</span>
              </span>
              {contents.map((id) => {
                const species = speciesOf(id);
                const isProduct = !REAGENT_MAP.has(id);
                return (
                  <span className={`rxn-chip ${isProduct ? "is-product" : ""}`} key={id}>
                    <b>{species.formula}</b>
                    <span>{species.name}</span>
                  </span>
                );
              })}
              {contents.length === 0 && <span className="rxn-empty">Chưa thêm chất nào.</span>}
            </div>
          </div>

          {groups.map((group) => (
            <div className="rxn-group" key={group.kind} data-kind={group.kind}>
              <div className="rxn-mini-title">
                {group.label}
                <span>{group.items.length}</span>
              </div>
              <div className="rxn-reagents">
                {group.items.map((reagent) => {
                  const inBeaker = contentSet.has(reagent.id);
                  return (
                    <button
                      key={reagent.id}
                      type="button"
                      className={`rxn-reagent ${inBeaker ? "is-in" : ""}`}
                      onClick={() => addReagent(reagent)}
                      aria-pressed={inBeaker}
                      title={reagent.note}
                    >
                      <span className="rxn-reagent-formula">{reagent.formula}</span>
                      <span className="rxn-reagent-name">{reagent.name}</span>
                      <span className="rxn-reagent-tag">{inBeaker ? "trong cốc" : STATE_LABEL[reagent.state]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rxn-history">
          <div className="rxn-history-head">
            <Clock size={11} />
            LỊCH SỬ
            <span>{history.length}</span>
            <button type="button" className="rxn-clear" onClick={clearLog}>
              XOÁ
            </button>
          </div>
          <div className="rxn-history-list">
            {history.length === 0 ? (
              <span className="rxn-history-empty">Chưa có phản ứng nào.</span>
            ) : (
              history.slice(0, 3).map((item) => (
                <div className="rxn-history-row" key={item.key}>
                  <i className="rxn-history-dot" />
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.equation}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      <section className="rxn-main">
        <div className="rxn-stage">
          <div ref={hostRef} className="rxn-host" aria-label="Cốc thuỷ tinh 3D và phản ứng hoá học" />

          <div className="rxn-overlay rxn-overlay-top">
            <div className={`rxn-status ${statusClass}`}>
              <i />
              {statusText}
              <span className="rxn-temp">
                <Thermometer size={11} />
                {temperature}°C
              </span>
            </div>
            <div className="rxn-tools">
              <button
                type="button"
                className={`chem-tool rxn-heat ${heating ? "is-on" : ""}`}
                onClick={toggleHeat}
                aria-pressed={heating}
              >
                <Flame size={13} />
                {heating ? "ĐANG ĐUN" : "ĐUN NÓNG"}
              </button>
              <button type="button" className="chem-tool" onClick={reset}>
                <RotateCcw size={13} />
                RỬA CỐC
              </button>
            </div>
          </div>

          <div className="rxn-overlay rxn-overlay-bottom">
            <span className="rxn-hint">NHẤN CHẤT ĐỂ RÓT VÀO CỐC · KÉO ĐỂ XOAY</span>
            {notice && (
              <span className="rxn-notice" key={notice.key}>
                {notice.text}
              </span>
            )}
          </div>

          {pulse > 0 && <span className="rxn-flash" key={pulse} />}
        </div>

        <div className={`rxn-result ${result ? "has-result" : ""}`}>
          {result ? (
            <>
              <div className="rxn-result-top">
                <span className="rxn-tag">{statusTag}</span>
                <span className="rxn-condition">{result.condition}</span>
              </div>
              <div className="rxn-eq">{result.equation}</div>
              <div className="rxn-title">{result.name}</div>
              {result.steps && result.steps.length > 1 && (
                <div className="rxn-steps">
                  {result.steps.map((step, index) => (
                    <span key={`${step.equation}-${index}`}>
                      <b>{index + 1}</b>
                      {step.equation}
                    </span>
                  ))}
                </div>
              )}
              {result.tags.length > 0 && (
                <div className="rxn-tags">
                  {result.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
              <p className="rxn-phenomenon">{result.phenomenon}</p>
              {result.products.length > 0 && (
                <div className="rxn-products">
                  {result.products.map((product) => (
                    <span className="rxn-product" key={product.id}>
                      <b>{product.formula}</b>
                      <span>{product.name}</span>
                      <em>{product.state}</em>
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="rxn-idle">
              <span className="rxn-idle-icon">
                <Beaker size={26} />
              </span>
              <div>
                <strong>CHỌN CHẤT ĐỂ BẮT ĐẦU</strong>
                <p>
                  Thêm axit, bazơ, muối hoặc kim loại vào cốc. Chất tạo thành ở lại trong cốc và có thể
                  tiếp tục phản ứng; bấm ĐUN NÓNG để mở khoá phản ứng nhiệt phân.
                </p>
              </div>
            </div>
          )}

          <div className="rxn-result-foot">
            <span className="rxn-foot-label">
              <BookOpen size={11} />
              ĐÃ ĐIỀU CHẾ
              <b>{notebook.length}</b>
            </span>
            <div className="rxn-notebook">
              {notebook.length === 0 ? (
                <span className="rxn-foot-empty">chưa có sản phẩm</span>
              ) : (
                notebook.slice(-7).map((item) => (
                  <span className="rxn-notebook-chip" key={item.id} title={item.name}>
                    {item.formula}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
