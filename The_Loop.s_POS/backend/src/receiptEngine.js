// The Loop.s POS — 80mm Thermal Receipt Formatter & Print Engine
function generateThermalReceipt(order, lines, payments, storeInfo = {}) {
  const storeName = storeInfo.name || "THE LOOP.S";
  const branchName = storeInfo.branch || "Sisowat HighSchool Flagship";
  const taxId = storeInfo.taxId || "VAT-90248812";
  const phone = storeInfo.phone || "+855 (0) 23 999 888";

  const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString() : new Date().toLocaleString();
  const exchangeRate = Number(order.exchangeRate) || 4000;

  return {
    header: {
      storeName,
      branchName,
      address: "Preah Sisowath Blvd, Phnom Penh",
      phone,
      taxId
    },
    meta: {
      orderNumber: order.orderNumber,
      registerCode: order.registerCode || "REG-01",
      cashierName: order.cashierName || "Dara Chea",
      timestamp: dateStr,
      customerName: order.customerName || "Walk-in Retail Guest",
      exchangeRate: `1 USD = ${exchangeRate.toLocaleString()} KHR`
    },
    items: lines.map(l => ({
      title: l.itemTitle,
      sku: l.variantSku,
      quantity: l.quantity,
      unitPrice: Number(l.unitPrice).toFixed(2),
      unitPriceKhr: Math.round(Number(l.unitPrice) * exchangeRate).toLocaleString() + " ៛",
      discount: Number(l.lineDiscount) > 0 ? Number(l.lineDiscount).toFixed(2) : null,
      total: Number(l.lineTotal).toFixed(2),
      totalKhr: Math.round(Number(l.lineTotal) * exchangeRate).toLocaleString() + " ៛"
    })),
    summary: {
      subtotal: Number(order.subtotal).toFixed(2),
      subtotalKhr: Math.round(Number(order.subtotal) * exchangeRate).toLocaleString() + " ៛",
      discountTotal: Number(order.discountTotal).toFixed(2),
      taxTotal: Number(order.taxTotal).toFixed(2),
      totalAmount: Number(order.totalAmount).toFixed(2),
      exchangeRate,
      khrEquivalent: Math.round(Number(order.totalAmount) * exchangeRate).toLocaleString() + " KHR"
    },
    payments: payments.map(p => ({
      method: p.method,
      amount: Number(p.amount).toFixed(2),
      tendered: Number(p.tenderedAmount || p.amount).toFixed(2),
      change: Number(p.changeGiven || 0).toFixed(2),
      ref: p.referenceCode || null
    })),
    footer: {
      message: "THANK YOU FOR SHOPPING AT THE LOOP.S",
      returnPolicy: "Exchange within 7 days with valid receipt & tags intact.",
      website: "theloops.store"
    }
  };
}

module.exports = {
  generateThermalReceipt
};

