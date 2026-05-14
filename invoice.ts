import { Order } from "../types";
import { formatMoney, showToast } from "./utils";
import html2canvas from "html2canvas";

export const exportInvoice = async (
  order: Order,
  setIsExporting: (val: boolean) => void
) => {
  setIsExporting(true);
  try {
    const invoiceElement = document.createElement("div");
    invoiceElement.style.position = "absolute";
    invoiceElement.style.top = "-99999px";
    invoiceElement.style.left = "0";
    invoiceElement.style.width = "540px";
    invoiceElement.style.height = "auto";
    invoiceElement.style.backgroundColor = "white";
    invoiceElement.style.padding = "20px";

    const subtotal = order.products.reduce((acc, p) => acc + p.price * p.qty, 0);
    const discountText =
      order.discount.type === "amount"
        ? `-${formatMoney(order.discount.val)}`
        : `- ${order.discount.val}%`;

    const invoiceHTML = `
      <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          .export-invoice-wrap { font-family: 'Inter', sans-serif; box-sizing: border-box; background: white; }
          .export-invoice-wrap * { box-sizing: border-box; }
          .export-invoice-wrap .invoice-container { max-width: 500px; width: 100%; margin: 0 auto; }
          .export-invoice-wrap .header { text-align: center; margin-bottom: 30px; margin-top: 10px; }
          .export-invoice-wrap .header h1 { font-size: 40px; font-weight: 900; color: #0d4754; margin: 0 0 10px 0; letter-spacing: 0.02em; text-transform: uppercase; }
          .export-invoice-wrap .header p { font-size: 16px; font-weight: 600; color: #e06666; margin: 0; }
          .export-invoice-wrap .info-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .export-invoice-wrap .info-left { flex: 1; padding-right: 15px; }
          .export-invoice-wrap .info-left h2 { font-size: 20px; font-weight: 800; color: #0d4754; margin: 0 0 10px 0; }
          .export-invoice-wrap .info-left p { margin: 0 0 6px 0; font-size: 15px; color: #374151; font-weight: 500; }
          .export-invoice-wrap .info-left p.address { font-size: 14px; color: #374151; line-height: 1.5; }
          .export-invoice-wrap .info-right { text-align: right; width: 220px; font-size: 14px; color: #4b5563; font-weight: 500; }
          .export-invoice-wrap .info-right p { margin: 0 0 10px 0; }
          .export-invoice-wrap .info-right strong { font-weight: 700; color: #4b5563; }
          .export-invoice-wrap .info-right .cod { font-weight: 800; color: #e06666; margin-top: 14px; font-size: 16px; text-transform: uppercase; }
          .export-invoice-wrap .divider-light { border-bottom: 1px solid #f3f4f6; margin: 24px 0; }
          .export-invoice-wrap .product-table { width: 100%; margin-bottom: 12px; }
          .export-invoice-wrap .table-header { display: flex; font-size: 14px; font-weight: 700; color: #6b7280; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px; }
          .export-invoice-wrap .table-row { display: flex; font-size: 16px; color: #1f2937; font-weight: 600; margin-bottom: 12px; align-items: start; line-height: 1.4; }
          .export-invoice-wrap .col-qty { width: 35px; text-align: center; }
          .export-invoice-wrap .col-name { flex: 1; padding-right: 15px; padding-left: 15px; text-transform: capitalize; }
          .export-invoice-wrap .col-price { width: 120px; text-align: right; font-weight: 800; color: #0d4754; }
          .export-invoice-wrap .note-box { background-color: #fff5f5; border: 1px solid #fecaca; border-radius: 12px; padding: 16px 20px; margin-top: 24px; font-size: 15px; color: #374151; font-weight: 500; }
          .export-invoice-wrap .note-box span { color: #e06666; font-weight: 800; margin-right: 4px; }
          .export-invoice-wrap .divider-dark { border-bottom: 3px solid #0d4754; margin: 24px 0; }
          .export-invoice-wrap .summary-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 15px; color: #6b7280; font-weight: 500; }
          .export-invoice-wrap .summary-row.discount { color: #e06666; }
          .export-invoice-wrap .grand-total { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }
          .export-invoice-wrap .grand-total span:first-child { font-size: 22px; font-weight: 900; color: #0d4754; text-transform: uppercase; }
          .export-invoice-wrap .grand-total span:last-child { font-size: 34px; font-weight: 900; color: #0d4754; }
          .export-invoice-wrap .divider-dashed { border-bottom: 1px dashed #fca5a5; margin: 30px 0; }
          .export-invoice-wrap .footer { text-align: center; margin-bottom: 30px; }
          .export-invoice-wrap .footer h3 { font-size: 18px; font-weight: 800; color: #0d4754; margin: 0 0 8px 0; }
          .export-invoice-wrap .footer p { font-size: 14px; color: #7fb38f; font-weight: 600; margin: 0; }
      </style>
      <div class="export-invoice-wrap">
        <div class="invoice-container">
          <div class="header">
            <h1>HÓA ĐƠN</h1>
            <div style="font-size: 13px; color: #6b7280; font-weight: 600; margin-bottom: 8px;">
              Mã đơn: ${order.id !== "MỚI" ? (order.id.length > 8 ? order.id.slice(-8).toUpperCase() : order.id.toUpperCase()) : "MỚI"} | Ngày đặt: ${order.orderDate.split("-").reverse().join("/")}
            </div>
            <p>🌷 Mọi sản phẩm gửi đi là cả tấm lòng 🌷</p>
          </div>
          <div class="info-section">
            <div class="info-left">
              <h2>${order.customerName}</h2>
              <p>${order.customerPhone}</p>
              <p class="address">${order.customerAddr || "Không có địa chỉ"}</p>
            </div>
            <div class="info-right">
              <p>Ngày gửi: <strong>${order.shipDate.split("-").reverse().join("/")}</strong></p>
              <p>Dự Kiến Nhận: <strong>${order.deliveryDate ? order.deliveryDate.split("-").reverse().join("/") : "---"}</strong></p>
              <div class="cod">COD (SHIPPER)</div>
            </div>
          </div>
          <div class="divider-light"></div>
          <div class="product-table">
            <div class="table-header">
              <span class="col-qty">SL</span>
              <span class="col-name">SẢN PHẨM</span>
              <span class="col-price">THÀNH TIỀN</span>
            </div>
            ${order.products.map(p => `
            <div class="table-row">
              <span class="col-qty">${p.qty}</span>
              <span class="col-name">${p.name}</span>
              <span class="col-price">${formatMoney(p.price * p.qty)}</span>
            </div>
            `).join('')}
          </div>
          ${order.note ? `
          <div class="note-box">
            <span>Ghi chú:</span> ${order.note}
          </div>
          ` : ''}
          <div class="divider-dark"></div>
          <div class="summary">
            <div class="summary-row">
              <span>Vận chuyển:</span>
              <span>+ ${order.shipFee > 0 ? formatMoney(order.shipFee) : "0 ₫"}</span>
            </div>
            <div class="summary-row discount">
              <span>Giảm giá:</span>
              <span>${discountText}</span>
            </div>
            <div class="grand-total">
              <span>TỔNG THU:</span>
              <span>${formatMoney(order.total)}</span>
            </div>
          </div>
          <div class="divider-dashed"></div>
          <div class="footer">
            <h3>Cảm ơn bạn đã ủng hộ Shop! ❤️</h3>
            <p>🍀 Chúc quý khách có những trải nghiệm tuyệt vời với sản phẩm 🍀</p>
          </div>
        </div>
      </div>
    `;

    invoiceElement.innerHTML = invoiceHTML;
    document.body.appendChild(invoiceElement);

    const canvas = await html2canvas(invoiceElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowHeight: invoiceElement.scrollHeight,
    });

    document.body.removeChild(invoiceElement);

    const imgData = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `HoaDon-${order.customerPhone}-${order.id.slice(-4)}.png`;
    link.href = imgData;
    link.click();

    showToast("Đã xuất hóa đơn thành công!");
  } catch (err) {
    console.error(err);
    showToast("Có lỗi khi xuất hóa đơn!");
  } finally {
    setIsExporting(false);
  }
};

export const printInvoice = (order: Order) => {
  const discountText =
    order.discount.type === "amount"
      ? `-${formatMoney(order.discount.val)}`
      : `- ${order.discount.val}%`;

  const printWindow = window.open('', '', 'width=800,height=600');
  if (!printWindow) return showToast("Vui lòng cho phép popup để in!");

  const invoiceHTML = `
    <html>
      <head>
        <title>In Hoá Đơn #${order.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          body { font-family: 'Inter', sans-serif; margin: 0; background-color: #ffffff; display: flex; justify-content: center; padding: 20px; }
          * { box-sizing: border-box; }
          .invoice-container { max-width: 500px; width: 100%; background: white; }
          .header { text-align: center; margin-bottom: 30px; margin-top: 10px; }
          .header h1 { font-size: 40px; font-weight: 900; color: #0d4754; margin: 0 0 10px 0; letter-spacing: 0.02em; text-transform: uppercase; }
          .header p { font-size: 16px; font-weight: 600; color: #e06666; margin: 0; }
          .info-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .info-left { flex: 1; padding-right: 15px; }
          .info-left h2 { font-size: 20px; font-weight: 800; color: #0d4754; margin: 0 0 10px 0; }
          .info-left p { margin: 0 0 6px 0; font-size: 15px; color: #374151; font-weight: 500; }
          .info-left p.address { font-size: 14px; color: #374151; line-height: 1.5; }
          .info-right { text-align: right; width: 220px; font-size: 14px; color: #4b5563; font-weight: 500; }
          .info-right p { margin: 0 0 10px 0; }
          .info-right strong { font-weight: 700; color: #4b5563; }
          .info-right .cod { font-weight: 800; color: #e06666; margin-top: 14px; font-size: 16px; text-transform: uppercase; }
          .divider-light { border-bottom: 1px solid #f3f4f6; margin: 24px 0; }
          .product-table { width: 100%; margin-bottom: 12px; }
          .table-header { display: flex; font-size: 14px; font-weight: 700; color: #6b7280; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px; }
          .table-row { display: flex; font-size: 16px; color: #1f2937; font-weight: 600; margin-bottom: 12px; align-items: start; line-height: 1.4; }
          .col-qty { width: 35px; text-align: center; }
          .col-name { flex: 1; padding-right: 15px; padding-left: 15px; text-transform: capitalize; }
          .col-price { width: 120px; text-align: right; font-weight: 800; color: #0d4754; }
          .note-box { background-color: #fff5f5; border: 1px solid #fecaca; border-radius: 12px; padding: 16px 20px; margin-top: 24px; font-size: 15px; color: #374151; font-weight: 500; }
          .note-box span { color: #e06666; font-weight: 800; margin-right: 4px; }
          .divider-dark { border-bottom: 3px solid #0d4754; margin: 24px 0; }
          .summary-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 15px; color: #6b7280; font-weight: 500; }
          .summary-row.discount { color: #e06666; }
          .grand-total { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }
          .grand-total span:first-child { font-size: 22px; font-weight: 900; color: #0d4754; text-transform: uppercase; }
          .grand-total span:last-child { font-size: 34px; font-weight: 900; color: #0d4754; }
          .divider-dashed { border-bottom: 1px dashed #fca5a5; margin: 30px 0; }
          .footer { text-align: center; margin-bottom: 30px; }
          .footer h3 { font-size: 18px; font-weight: 800; color: #0d4754; margin: 0 0 8px 0; }
          .footer p { font-size: 14px; color: #7fb38f; font-weight: 600; margin: 0; }
          @media print {
            body { padding: 0; background-color: #ffffff; }
            .invoice-container { max-width: 100%; }
            @page { margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <h1>HÓA ĐƠN</h1>
            <div style="font-size: 13px; color: #6b7280; font-weight: 600; margin-bottom: 8px;">
              Mã đơn: ${order.id !== "MỚI" ? (order.id.length > 8 ? order.id.slice(-8).toUpperCase() : order.id.toUpperCase()) : "MỚI"} | Ngày đặt: ${order.orderDate.split("-").reverse().join("/")}
            </div>
            <p>🌷 Mọi sản phẩm gửi đi là cả tấm lòng 🌷</p>
          </div>
          <div class="info-section">
            <div class="info-left">
              <h2>${order.customerName}</h2>
              <p>${order.customerPhone}</p>
              <p class="address">${order.customerAddr || "Không có địa chỉ"}</p>
            </div>
            <div class="info-right">
              <p>Ngày gửi: <strong>${order.shipDate.split("-").reverse().join("/")}</strong></p>
              <p>Dự Kiến Nhận: <strong>${order.deliveryDate ? order.deliveryDate.split("-").reverse().join("/") : "---"}</strong></p>
              <div class="cod">COD (SHIPPER)</div>
            </div>
          </div>
          <div class="divider-light"></div>
          <div class="product-table">
            <div class="table-header">
              <span class="col-qty">SL</span>
              <span class="col-name">SẢN PHẨM</span>
              <span class="col-price">THÀNH TIỀN</span>
            </div>
            ${order.products.map(p => `
            <div class="table-row">
              <span class="col-qty">${p.qty}</span>
              <span class="col-name">${p.name}</span>
              <span class="col-price">${formatMoney(p.price * p.qty)}</span>
            </div>
            `).join('')}
          </div>
          ${order.note ? `
          <div class="note-box">
            <span>Ghi chú:</span> ${order.note}
          </div>
          ` : ''}
          <div class="divider-dark"></div>
          <div class="summary">
            <div class="summary-row">
              <span>Vận chuyển:</span>
              <span>+ ${order.shipFee > 0 ? formatMoney(order.shipFee) : "0 ₫"}</span>
            </div>
            <div class="summary-row discount">
              <span>Giảm giá:</span>
              <span>${discountText}</span>
            </div>
            <div class="grand-total">
              <span>TỔNG THU:</span>
              <span>${formatMoney(order.total)}</span>
            </div>
          </div>
          <div class="divider-dashed"></div>
          <div class="footer">
            <h3>Cảm ơn bạn đã ủng hộ Shop! ❤️</h3>
            <p>🍀 Chúc quý khách có những trải nghiệm tuyệt vời với sản phẩm 🍀</p>
          </div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(invoiceHTML);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
};
