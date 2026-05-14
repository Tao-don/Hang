import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Save, RefreshCcw, CheckCircle2 } from "lucide-react";
import {
  useStoreSettings,
  defaultStoreSettings,
  StoreSettings,
  TextItemStyle,
} from "../lib/storeSettings";

export const StoreSettingsView: React.FC = () => {
  const { settings, updateSettings } = useStoreSettings();
  const [localSettings, setLocalSettings] = useState<StoreSettings>(settings);
  const [showToast, setShowToast] = useState(false);

  const handleSave = () => {
    updateSettings(localSettings);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  const handleReset = () => {
    if (confirm("Bạn có chắc chắn muốn khôi phục về mặc định?")) {
      setLocalSettings(defaultStoreSettings);
      updateSettings(defaultStoreSettings);
    }
  };

  const updateMessage = (
    key: keyof StoreSettings["invoiceStyles"]["messages"],
    field: keyof TextItemStyle,
    value: any,
  ) => {
    setLocalSettings((prev) => ({
      ...prev,
      invoiceStyles: {
        ...prev.invoiceStyles,
        messages: {
          ...prev.invoiceStyles.messages,
          [key]: {
            ...prev.invoiceStyles.messages[key],
            [field]: value,
          },
        },
      },
    }));
  };

  const updatePart = (
    key: keyof StoreSettings["invoiceStyles"]["parts"],
    field: keyof TextItemStyle,
    value: any,
  ) => {
    setLocalSettings((prev) => ({
      ...prev,
      invoiceStyles: {
        ...prev.invoiceStyles,
        parts: {
          ...prev.invoiceStyles.parts,
          [key]: {
            ...prev.invoiceStyles.parts[key],
            [field]: value,
          },
        },
      },
    }));
  };

  const renderStyleControls = (
    label: string,
    value: TextItemStyle,
    onChange: (field: keyof TextItemStyle, val: any) => void,
    hasText: boolean = false,
  ) => (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
      <div className="font-bold text-sm text-slate-700">{label}</div>

      {hasText && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Nội dung
          </label>
          <input
            type="text"
            value={value.text || ""}
            onChange={(e) => onChange("text", e.target.value)}
            className="w-full bg-white border-2 border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-deep-teal focus:ring-0 transition-colors"
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Màu sắc
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value.color || "#000000"}
              onChange={(e) => onChange("color", e.target.value)}
              className="h-8 w-12 rounded border border-slate-200 cursor-pointer"
            />
            <input
              type="text"
              value={value.color || ""}
              onChange={(e) => onChange("color", e.target.value)}
              className="w-full bg-white border-2 border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono uppercase focus:border-deep-teal"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Cỡ chữ (px)
          </label>
          <input
            type="number"
            value={value.fontSize || 14}
            onChange={(e) =>
              onChange("fontSize", parseInt(e.target.value) || 14)
            }
            className="w-full bg-white border-2 border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:border-deep-teal focus:ring-0 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Phông chữ
          </label>
          <select
            value={value.fontFamily || "inherit"}
            onChange={(e) => onChange("fontFamily", e.target.value)}
            className="w-full bg-white border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:border-deep-teal focus:ring-0 transition-colors"
          >
            <option value="inherit">Mặc định</option>
            <option value="'Inter', sans-serif">Inter</option>
            <option value="'Roboto', sans-serif">Roboto</option>
            <option value="'Playfair Display', serif">Playfair Display</option>
            <option value="'Courier New', monospace">Courier New</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 relative"
    >
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-500 text-white px-5 py-3 rounded-full shadow-lg font-semibold text-sm"
          >
            <CheckCircle2 size={18} />
            Đã lưu cấu hình thành công!
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-deep-teal tracking-tight uppercase">
            Cài đặt Cửa hàng
          </h1>
          <p className="text-sm font-semibold text-slate-500">
            Tùy chỉnh hiển thị hóa đơn và các thông số khác
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold uppercase text-xs hover:bg-slate-200 transition-colors"
          >
            <RefreshCcw size={16} /> Mặc định
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-deep-teal text-white rounded-xl font-bold uppercase text-xs hover:bg-deep-teal/90 transition-colors"
          >
            <Save size={16} /> Lưu lại
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-8">
        <div>
          <h2 className="text-sm font-black text-deep-teal uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
            Cài đặt Font chung
          </h2>
          <div className="w-1/3">
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Phông chữ toàn hóa đơn
            </label>
            <select
              value={localSettings.invoiceStyles.globalFontFamily}
              onChange={(e) =>
                setLocalSettings((prev) => ({
                  ...prev,
                  invoiceStyles: {
                    ...prev.invoiceStyles,
                    globalFontFamily: e.target.value,
                  },
                }))
              }
              className="w-full bg-white border-2 border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-deep-teal focus:ring-0 transition-colors"
            >
              <option value="'Inter', sans-serif">Inter (Không chân)</option>
              <option value="'Roboto', sans-serif">Roboto</option>
              <option value="'Playfair Display', serif">
                Playfair Display (Có chân)
              </option>
              <option value="'Courier New', monospace">
                Courier New (Máy chữ)
              </option>
            </select>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-black text-deep-teal uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
            Tùy chỉnh Lời chúc (Nội dung & Hình thức)
          </h2>
          <div className="space-y-4">
            {renderStyleControls(
              "Câu chào Header",
              localSettings.invoiceStyles.messages.headerGreeting,
              (f, v) => updateMessage("headerGreeting", f, v),
              true,
            )}
            {renderStyleControls(
              "Câu cảm ơn Footer (1)",
              localSettings.invoiceStyles.messages.footerMsg1,
              (f, v) => updateMessage("footerMsg1", f, v),
              true,
            )}
            {renderStyleControls(
              "Câu chúc Footer (2)",
              localSettings.invoiceStyles.messages.footerMsg2,
              (f, v) => updateMessage("footerMsg2", f, v),
              true,
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-black text-deep-teal uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
            Kích thước & Màu sắc các phần
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {renderStyleControls(
              "Tiêu đề (HÓA ĐƠN)",
              localSettings.invoiceStyles.parts.title,
              (f, v) => updatePart("title", f, v),
              false,
            )}
            {renderStyleControls(
              "Thông tin mã đơn/ngày đặt",
              localSettings.invoiceStyles.parts.orderInfo,
              (f, v) => updatePart("orderInfo", f, v),
              false,
            )}
            {renderStyleControls(
              "Tên Khách Hàng",
              localSettings.invoiceStyles.parts.customerName,
              (f, v) => updatePart("customerName", f, v),
              false,
            )}
            {renderStyleControls(
              "SĐT Khách Hàng",
              localSettings.invoiceStyles.parts.customerPhone,
              (f, v) => updatePart("customerPhone", f, v),
              false,
            )}
            {renderStyleControls(
              "Địa chỉ Khách Hàng",
              localSettings.invoiceStyles.parts.customerAddr,
              (f, v) => updatePart("customerAddr", f, v),
              false,
            )}
            {renderStyleControls(
              "Thông tin Cửa Hàng / Ngày gửi",
              localSettings.invoiceStyles.parts.storeInfo,
              (f, v) => updatePart("storeInfo", f, v),
              false,
            )}
            {renderStyleControls(
              "Header Bảng SP (SL, SẢN PHẨM...)",
              localSettings.invoiceStyles.parts.tableHeader,
              (f, v) => updatePart("tableHeader", f, v),
              false,
            )}
            {renderStyleControls(
              "Các dòng Sản Phẩm",
              localSettings.invoiceStyles.parts.tableBody,
              (f, v) => updatePart("tableBody", f, v),
              false,
            )}
            {renderStyleControls(
              "Phần Tóm Tắt (Vận chuyển, giảm giá...)",
              localSettings.invoiceStyles.parts.summary,
              (f, v) => updatePart("summary", f, v),
              false,
            )}
            {renderStyleControls(
              "Tổng Thu",
              localSettings.invoiceStyles.parts.totalText,
              (f, v) => updatePart("totalText", f, v),
              false,
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
