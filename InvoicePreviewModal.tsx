import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Order } from '../types';
import { formatMoney } from '../lib/utils';
import { X, Printer, FileDown } from 'lucide-react';
import { exportInvoice, printInvoice } from '../lib/invoice';
import { getStoreSettings } from '../lib/storeSettings';

interface InvoicePreviewModalProps {
  order: Order | null;
  onClose: () => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({ order, onClose }) => {
  const [isExporting, setIsExporting] = React.useState(false);

  if (!order) return null;

  const discountText =
    order.discount.type === "amount"
      ? `-${formatMoney(order.discount.val)}`
      : `- ${order.discount.val}%`;

  const settings = getStoreSettings();
  const st = settings.invoiceStyles;

  const styleObj = (part: keyof typeof st.parts | keyof typeof st.messages | 'headerGreeting' | 'footerMsg1' | 'footerMsg2', isMsg = false) => {
    const s = isMsg ? st.messages[part as keyof typeof st.messages] : st.parts[part as keyof typeof st.parts];
    return {
      fontSize: s?.fontSize ? `${s.fontSize}px` : undefined,
      color: s?.color,
      fontFamily: s?.fontFamily !== 'inherit' && s?.fontFamily ? s.fontFamily : 'inherit',
    };
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-deep-teal/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Header Actions */}
          <div className="flex items-center justify-between p-4 border-b border-sky-50 bg-slate-50/50">
            <h3 className="font-black text-deep-teal text-lg">Xem Hóa Đơn</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportInvoice(order, setIsExporting)}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg text-xs font-black transition-all border border-sky-100 disabled:opacity-50"
              >
                <FileDown size={14} />
                {isExporting ? "ĐANG XUẤT..." : "TẢI ẢNH"}
              </button>
              <button
                onClick={() => printInvoice(order)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-deep-teal/5 text-deep-teal hover:bg-deep-teal/10 rounded-lg text-xs font-black transition-all border border-deep-teal/10"
              >
                <Printer size={14} /> IN
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors ml-1"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Invoice Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
            <div className="bg-white p-8 w-full max-w-[460px] mx-auto shadow-sm invoice-preview-wrap relative" style={{ fontFamily: st.globalFontFamily }}>
              <style dangerouslySetInnerHTML={{ __html: `
                  .invoice-preview-wrap .header { text-align: center; margin-bottom: 30px; margin-top: 10px; }
                  .invoice-preview-wrap .header h1 { margin: 0 0 8px 0; letter-spacing: 0.02em; text-transform: uppercase; font-weight: 900; }
                  .invoice-preview-wrap .header p { font-weight: 600; margin: 0; }
                  .invoice-preview-wrap .info-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
                  .invoice-preview-wrap .info-left { flex: 1; padding-right: 15px; }
                  .invoice-preview-wrap .info-left h2 { font-weight: 800; margin: 0 0 8px 0; }
                  .invoice-preview-wrap .info-left p { margin: 0 0 6px 0; font-weight: 500; }
                  .invoice-preview-wrap .info-left p.address { line-height: 1.5; }
                  .invoice-preview-wrap .info-right { text-align: right; width: 180px; font-weight: 500; }
                  .invoice-preview-wrap .info-right p { margin: 0 0 8px 0; }
                  .invoice-preview-wrap .info-right strong { font-weight: 700; color: inherit; }
                  .invoice-preview-wrap .info-right .cod { font-weight: 800; color: #e06666; margin-top: 12px; font-size: 14px; text-transform: uppercase; }
                  .invoice-preview-wrap .divider-light { border-bottom: 1px solid #f3f4f6; margin: 20px 0; }
                  .invoice-preview-wrap .product-table { width: 100%; margin-bottom: 10px; }
                  .invoice-preview-wrap .table-header { display: flex; font-weight: 700; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px; }
                  .invoice-preview-wrap .table-row { display: flex; font-weight: 600; margin-bottom: 12px; align-items: start; line-height: 1.4; }
                  .invoice-preview-wrap .col-qty { width: 30px; text-align: center; }
                  .invoice-preview-wrap .col-name { flex: 1; padding-right: 15px; padding-left: 15px; text-transform: capitalize; }
                  .invoice-preview-wrap .col-price { width: 100px; text-align: right; font-weight: 800; }
                  .invoice-preview-wrap .note-box { background-color: #fff5f5; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-top: 20px; font-size: 13px; color: #374151; font-weight: 500; }
                  .invoice-preview-wrap .note-box span { color: #e06666; font-weight: 800; margin-right: 4px; }
                  .invoice-preview-wrap .divider-dark { border-bottom: 2px solid #0d4754; margin: 20px 0; }
                  .invoice-preview-wrap .summary-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: 500; }
                  .invoice-preview-wrap .summary-row.discount { color: #e06666; }
                  .invoice-preview-wrap .grand-total { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
                  .invoice-preview-wrap .grand-total span:first-child { font-weight: 900; text-transform: uppercase; }
                  .invoice-preview-wrap .grand-total span:last-child { font-weight: 900; }
                  .invoice-preview-wrap .divider-dashed { border-bottom: 1px dashed #fca5a5; margin: 24px 0; }
                  .invoice-preview-wrap .footer { text-align: center; margin-bottom: 10px; }
                  .invoice-preview-wrap .footer h3 { font-weight: 800; margin: 0 0 6px 0; }
                  .invoice-preview-wrap .footer p { font-weight: 600; margin: 0; }
              `}} />

              <div className="header">
                <h1 style={styleObj('title')}>HÓA ĐƠN</h1>
                <div style={{ ...styleObj('orderInfo'), marginBottom: '8px', fontWeight: 600 }}>
                  Mã đơn: {order.id !== "MỚI" ? (order.id.length > 8 ? order.id.slice(-8).toUpperCase() : order.id.toUpperCase()) : "MỚI"} | Ngày đặt: {order.orderDate.split("-").reverse().join("/")}
                </div>
                <p style={styleObj('headerGreeting', true)}>{st.messages.headerGreeting.text}</p>
              </div>
              <div className="info-section">
                <div className="info-left">
                  <h2 style={styleObj('customerName')}>{order.customerName}</h2>
                  <p style={styleObj('customerPhone')}>{order.customerPhone}</p>
                  <p className="address" style={styleObj('customerAddr')}>{order.customerAddr || "Không có địa chỉ"}</p>
                </div>
                <div className="info-right" style={styleObj('storeInfo')}>
                  <p>Ngày gửi: <strong>{order.shipDate.split("-").reverse().join("/")}</strong></p>
                  <p>Dự Kiến Nhận: <strong>{order.deliveryDate ? order.deliveryDate.split("-").reverse().join("/") : "---"}</strong></p>
                  <div className="cod">COD (SHIPPER)</div>
                </div>
              </div>
              <div className="divider-light"></div>
              <div className="product-table">
                <div className="table-header" style={styleObj('tableHeader')}>
                  <span className="col-qty">SL</span>
                  <span className="col-name">SẢN PHẨM</span>
                  <span className="col-price">THÀNH TIỀN</span>
                </div>
                {order.products.map((p, i) => (
                  <div className="table-row" key={i} style={styleObj('tableBody')}>
                    <span className="col-qty">{p.qty}</span>
                    <span className="col-name">{p.name}</span>
                    <span className="col-price">{formatMoney(p.price * p.qty)}</span>
                  </div>
                ))}
              </div>
              {order.note && (
                <div className="note-box">
                  <span>Ghi chú:</span> {order.note}
                </div>
              )}
              <div className="divider-dark"></div>
              <div className="summary">
                <div className="summary-row" style={styleObj('summary')}>
                  <span>Vận chuyển:</span>
                  <span>+ {order.shipFee > 0 ? formatMoney(order.shipFee) : "0 ₫"}</span>
                </div>
                <div className="summary-row discount" style={styleObj('summary')}>
                  <span>Giảm giá:</span>
                  <span>{discountText}</span>
                </div>
                <div className="grand-total">
                  <span style={{ fontSize: styleObj('title').fontSize, color: styleObj('totalText').color, fontFamily: styleObj('totalText').fontFamily }}>TỔNG THU:</span>
                  <span style={styleObj('totalText')}>{formatMoney(order.total)}</span>
                </div>
              </div>
              <div className="divider-dashed"></div>
              <div className="footer">
                <h3 style={styleObj('footerMsg1', true)}>{st.messages.footerMsg1.text}</h3>
                <p style={styleObj('footerMsg2', true)}>{st.messages.footerMsg2.text}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
