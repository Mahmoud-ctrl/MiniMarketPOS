export interface ReceiptItem {
  name:       string;
  unit_price: number;
  quantity:   number;
}

export interface ReceiptData {
  saleId:        number;
  cashierName:   string;
  items:         ReceiptItem[];
  subtotal:      number;
  discount:      number;
  tva:           number;
  total:         number;
  payMethod:     string;
  paidPrimary:   string;
  paidSecondary: string;
  changeAmt:     number;
  isPending:     boolean;
  fmt:           (n: number) => string;
  fmtAlt:        (n: number) => string;
  symbol:        string;
  altSymbol:     string;
  storeName:     string;
  storeAddress:  string;
  storePhone:    string;
  storeTagline:  string;
  storeLogo:     string;
}

export function buildReceiptHtml(p: ReceiptData): string {
  const rows = p.items.map(i =>
    `<tr>
      <td style="padding:3px 0;font-size:12px">${i.name}</td>
      <td style="text-align:right;white-space:nowrap;padding:3px 8px;font-size:12px">${p.fmt(i.unit_price)}×${i.quantity}</td>
      <td style="text-align:right;font-weight:bold;padding:3px 0;font-size:12px">${p.fmt(i.unit_price * i.quantity)}</td>
    </tr>`
  ).join("");

  const changeRow = p.changeAmt > 0
    ? p.isPending
      ? `<tr><td style="color:#d97706;font-weight:bold">Change owed</td><td></td>
          <td style="text-align:right;color:#d97706;font-weight:bold">${p.fmt(p.changeAmt)}<br>
          <span style="font-size:11px">${p.fmtAlt(p.changeAmt)}</span></td></tr>`
      : `<tr><td style="font-weight:bold">Change</td><td></td>
          <td style="text-align:right;font-weight:bold">${p.fmt(p.changeAmt)}<br>
          <span style="font-size:11px;color:#555">${p.fmtAlt(p.changeAmt)}</span></td></tr>`
    : "";

  const date = new Date().toLocaleString();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt #${p.saleId}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;width:300px;padding:12px;font-size:13px;color:#000}.c{text-align:center}.b{font-weight:bold}.hr{border-top:1px dashed #000;margin:6px 0}table{width:100%;border-collapse:collapse}@media print{body{width:100%}}</style>
</head><body>
${p.storeLogo ? `<div class="c" style="margin-bottom:6px"><img src="${p.storeLogo}" style="max-width:80px;max-height:60px;object-fit:contain"/></div>` : ""}
<div class="c b" style="font-size:16px">${p.storeName || "Mini Market"}</div>
${p.storeAddress ? `<div class="c" style="font-size:11px;margin-top:2px;white-space:pre-line">${p.storeAddress}</div>` : ""}
${p.storePhone ? `<div class="c" style="font-size:11px">${p.storePhone}</div>` : ""}
<div class="hr"></div>
<div style="display:flex;justify-content:space-between;font-size:11px"><span>Receipt #${p.saleId}</span><span>${date}</span></div>
<div style="font-size:11px">Served by: ${p.cashierName}</div>
<div class="hr"></div>
<table>${rows}</table>
<div class="hr"></div>
<table>
  ${p.subtotal !== p.total ? `<tr><td>Subtotal</td><td></td><td style="text-align:right">${p.fmt(p.subtotal)}</td></tr>` : ""}
  ${p.discount > 0 ? `<tr><td>Discount</td><td></td><td style="text-align:right">−${p.fmt(p.discount)}</td></tr>` : ""}
  ${p.tva > 0 ? `<tr><td>TVA</td><td></td><td style="text-align:right">${p.fmt(p.tva)}</td></tr>` : ""}
  <tr><td class="b" style="font-size:15px">TOTAL</td><td></td>
      <td style="text-align:right;font-weight:bold;font-size:15px">${p.fmt(p.total)}<br>
      <span style="font-size:11px;font-weight:normal;color:#555">${p.fmtAlt(p.total)}</span></td></tr>
  <tr><td style="font-size:11px;color:#555;text-transform:capitalize;padding-top:4px">${p.payMethod}</td><td></td>
      <td style="text-align:right;font-size:11px;color:#555">
        ${[p.paidPrimary ? `${p.symbol} ${p.paidPrimary}` : "", p.paidSecondary ? `${p.altSymbol} ${p.paidSecondary}` : ""].filter(Boolean).join(" + ")}
      </td></tr>
  ${changeRow}
</table>
<div class="hr"></div>
${p.storeTagline ? `<div class="c" style="font-size:11px;font-style:italic">${p.storeTagline}</div>` : ""}
<div class="c" style="font-size:10px;margin-top:4px;color:#666">Thank you for your visit!</div>
</body></html>`;
}

export function doPrint(html: string) {
  const win = window.open("", "_blank", "width=420,height=720");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 300);
}
