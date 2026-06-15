// utils/taxLogic.js

// 依据《个人所得税法》第三条，经营所得适用 5%-35% 超额累进税率
// 级数、全年应纳税所得额上限、税率、速算扣除数
const PIT_TABLE = [
  { level: 1, limit: 30000, rate: 0.05, deduction: 0 },
  { level: 2, limit: 90000, rate: 0.10, deduction: 1500 },
  { level: 3, limit: 300000, rate: 0.20, deduction: 10500 },
  { level: 4, limit: 500000, rate: 0.30, deduction: 40500 },
  { level: 5, limit: Infinity, rate: 0.35, deduction: 65500 }
];

export const calculateAnnualTax = (data) => {
  const parse = (val) => parseFloat(val) || 0;

  const revenue = parse(data.revenue);
  const cost = parse(data.cost);
  const vatRate = parse(data.vatRate);
  const socialSecurity = parse(data.socialSecurity);
  const basicDeduction = 60000;

  const specificDeduction = 
    parse(data.deduction_children) + 
    parse(data.deduction_elderly) + 
    parse(data.deduction_housing) + 
    parse(data.deduction_edu) + 
    parse(data.deduction_medical);

  const totalDeduction = basicDeduction + socialSecurity + specificDeduction;

  let result = {
    vat: 0, surcharge: 0, taxableIncome: 0, pit: 0, 
    totalTax: 0, profit: 0, bracket: {}, 
    savedTax: 0, 
    totalDeduction: totalDeduction,
    isHalved: false
  };

  result.vat = revenue * (vatRate / 100);
  
  // 附加税减半
  const surchargeBase = result.vat * 0.12; 
  result.surcharge = result.vat * 0.06;
  const savedSurcharge = surchargeBase - result.surcharge;

  let taxable = revenue - cost - result.surcharge - totalDeduction;
  result.taxableIncome = taxable > 0 ? taxable : 0;

  let level = PIT_TABLE.find(l => result.taxableIncome <= l.limit) || PIT_TABLE[PIT_TABLE.length - 1];
  result.bracket = level;

  let pitBase = (result.taxableIncome * level.rate) - level.deduction;
  pitBase = pitBase > 0 ? pitBase : 0;

  let savedPit = 0;
  if (result.taxableIncome > 0 && result.taxableIncome <= 2000000) {
    result.pit = pitBase * 0.5;
    savedPit = pitBase - result.pit;
    result.isHalved = true;
  } else {
    result.pit = pitBase;
  }

  result.totalTax = result.vat + result.surcharge + result.pit;
  result.profit = revenue - cost - result.totalTax;
  
  result.savedTax = savedSurcharge + savedPit;

  // 明确需要格式化为两位小数的金额字段
  const moneyFields = ['vat', 'surcharge', 'taxableIncome', 'pit', 'totalTax', 'profit', 'savedTax', 'totalDeduction'];
  moneyFields.forEach(k => {
    result[k] = parseFloat(result[k].toFixed(2));
  });

  return result;
};