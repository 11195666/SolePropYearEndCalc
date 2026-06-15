// pages/index/index.js
import { calculateAnnualTax } from '../../utils/taxLogic';

Page({
  data: {
    showMoreDeductions: false,
    
    housingOptions: [
      { name: '不涉及 / 无', val: 0 },
      { name: '住房贷款利息 (1000元/月)', val: 1000 },
      { name: '租房-省会/直辖市 (1500元/月)', val: 1500 },
      { name: '租房-人口超100万 (1100元/月)', val: 1100 },
      { name: '租房-人口百万以下 (800元/月)', val: 800 }
    ],
    housingIndex: 0,

    form: {
      revenue: '', cost: '', vatRate: '1', socialSecurity: '',
      childFullCount: '', childHalfCount: '',
      isOnlyChild: false, elderlyShareAmt: '',
      hasCert: false, degreeMonths: '',
      medicalSelfPay: ''
    },

    result: null
  },

  toggleMore() {
    this.setData({ showMoreDeductions: !this.data.showMoreDeductions });
  },

  onVatChange(e) {
    this.setData({ 'form.vatRate': e.detail.value });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    let val = e.detail.value;

    // 整数字段列表 (人数、月数等)
    const intFields = ['childFullCount', 'childHalfCount', 'degreeMonths'];

    if (intFields.includes(field)) {
      // 整数校验：只允许数字
      val = val.replace(/\D/g, '');
    } else {
      // 金额字段：只允许数字和小数点，且仅保留第一个小数点
      val = val.replace(/[^\d.]/g, '');
      const dotIndex = val.indexOf('.');
      if (dotIndex !== -1) {
        val = val.substring(0, dotIndex + 1) + val.substring(dotIndex + 1).replace(/\./g, '');
      }
      val = val.replace(/^(\d+)\.(\d\d).*$/, '$1.$2'); // 限制2位小数
    }

    // 业务校验
    if (field === 'elderlyShareAmt' && val > 1500) {
      wx.showToast({ title: '分摊上限为1500元', icon: 'none' });
      val = 1500;
    }
    if (field === 'degreeMonths') {
      if (val > 12) {
        wx.showToast({ title: '一年最多12个月', icon: 'none' });
        val = 12;
      }
    }

    this.setData({ [`form.${field}`]: val });
  },

  onSwitchChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onHousingChange(e) {
    this.setData({ housingIndex: e.detail.value });
  },

  getCalculatedParams() {
    const { form, housingIndex, housingOptions } = this.data;
    const parse = (v) => parseFloat(v) || 0;

    const childrenTotal = (parse(form.childFullCount) * 2000 + parse(form.childHalfCount) * 1000) * 12;

    let elderlyTotal = 0;
    if (form.isOnlyChild) {
      elderlyTotal = 3000 * 12;
    } else {
      elderlyTotal = parse(form.elderlyShareAmt) * 12;
    }

    const housingTotal = housingOptions[housingIndex].val * 12;

    let eduTotal = 0;
    if (form.hasCert) eduTotal += 3600;
    eduTotal += (parse(form.degreeMonths) * 400);

    let medicalTotal = parse(form.medicalSelfPay) - 15000;
    if (medicalTotal < 0) medicalTotal = 0;
    if (medicalTotal > 80000) medicalTotal = 80000;

    return {
      ...form,
      deduction_children: childrenTotal,
      deduction_elderly: elderlyTotal,
      deduction_housing: housingTotal,
      deduction_edu: eduTotal,
      deduction_medical: medicalTotal
    };
  },

  handleCalculate() {
    const revenue = parseFloat(this.data.form.revenue);
    if (!revenue) {
      wx.showToast({ title: '请输入年度收入', icon: 'none' });
      return;
    }
    
    // 智能提示(不阻断)
    const vatRate = parseFloat(this.data.form.vatRate);
    if (revenue < 1200000 && vatRate > 0) {
      wx.showToast({ title: '月销10万以下通常免增值税', icon: 'none', duration: 3000 });
    }

    const params = this.getCalculatedParams();
    const res = calculateAnnualTax(params);
    this.setData({ result: res });

    if(this.data.showMoreDeductions) {
       wx.pageScrollTo({ scrollTop: 2000, duration: 300 });
    }
  },

  handleReset() {
    this.setData({
      form: {
        revenue: '', cost: '', vatRate: '1', socialSecurity: '',
        childFullCount: '', childHalfCount: '',
        isOnlyChild: false, elderlyShareAmt: '',
        hasCert: false, degreeMonths: '',
        medicalSelfPay: ''
      },
      housingIndex: 0,
      result: null,
      showMoreDeductions: false
    });
  },

  // === 新增：点击查看详细计算过程 ===
  showDetail(e) {
    const type = e.currentTarget.dataset.type;
    const { result, form } = this.data;
    if (!result) return;

    let title = '';
    let content = '';

    if (type === 'vat') {
      title = '增值税计算过程';
      content = `营业收入：¥${form.revenue}\n`;
      content += `适用税率：${form.vatRate}%\n`;
      content += `计算公式：收入 × 税率\n`;
      content += `------------------\n`;
      content += `计算结果：${form.revenue} × ${form.vatRate}% = ¥${result.vat}`;
    } 
    else if (type === 'surcharge') {
      title = '附加税费计算过程';
      content = `基础税基：增值税额 (¥${result.vat})\n`;
      content += `法定税率：12% (城建7%+教育3%+地教2%)\n`;
      content += `优惠政策：六税两费减半征收 (50%)\n`;
      content += `------------------\n`;
      content += `计算结果：${result.vat} × 12% × 50% = ¥${result.surcharge}`;
    } 
    else if (type === 'pit') {
      title = '个人所得税计算过程';
      // 1. 算出应纳税所得额
      content += `1. 确定应纳税所得额：\n`;
      content += `   收入 - 成本 - 附加税 - 各项扣除\n`;
      content += `   ¥${form.revenue} - ${form.cost} - ${result.surcharge} - ${result.totalDeduction}\n`;
      content += `   = ¥${result.taxableIncome} (所得额)\n\n`;

      // 2. 找税率
      content += `2. 匹配税率表 (级数${result.bracket.level})：\n`;
      content += `   税率：${result.bracket.rate * 100}%\n`;
      content += `   速算扣除数：${result.bracket.deduction}\n\n`;

      // 3. 算税
      content += `3. 计算应纳税额：\n`;
      content += `   ${result.taxableIncome} × ${result.bracket.rate} - ${result.bracket.deduction}\n`;
      const baseTax = result.isHalved ? (result.pit * 2).toFixed(2) : result.pit.toFixed(2);
      content += `   = ¥${baseTax}\n\n`;

      // 4. 减半政策
      if (result.isHalved) {
        content += `4. 优惠政策 (年所得≤200万)：\n`;
        content += `   享受减半征收\n`;
        content += `   最终个税：${baseTax} ÷ 2 = ¥${result.pit}`;
      } else {
        content += `4. 最终个税：\n`;
        content += `   ¥${result.pit}`;
      }
    }

    wx.showModal({
      title: title,
      content: content,
      showCancel: false,
      confirmText: '看懂了',
      confirmColor: '#0052d9'
    });
  }
});