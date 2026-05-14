import { useState, useEffect } from 'react';

export interface TextItemStyle {
  text?: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
}

export interface StoreSettings {
  invoiceStyles: {
    globalFontFamily: string;
    messages: {
      headerGreeting: TextItemStyle;
      footerMsg1: TextItemStyle;
      footerMsg2: TextItemStyle;
    };
    parts: {
      title: TextItemStyle;
      orderInfo: TextItemStyle;
      customerName: TextItemStyle;
      customerPhone: TextItemStyle;
      customerAddr: TextItemStyle;
      storeInfo: TextItemStyle;
      tableHeader: TextItemStyle;
      tableBody: TextItemStyle;
      summary: TextItemStyle;
      totalText: TextItemStyle;
    };
  };
}

export const defaultStoreSettings: StoreSettings = {
  invoiceStyles: {
    globalFontFamily: "'Inter', sans-serif",
    messages: {
      headerGreeting: { text: "🌷 Mọi sản phẩm gửi đi là cả tấm lòng 🌷", fontSize: 14, color: "#e06666", fontFamily: "inherit" },
      footerMsg1: { text: "Cảm ơn bạn đã ủng hộ Shop! ❤️", fontSize: 16, color: "#0d4754", fontFamily: "inherit" },
      footerMsg2: { text: "🍀 Chúc quý khách có những trải nghiệm tuyệt vời với sản phẩm 🍀", fontSize: 12, color: "#7fb38f", fontFamily: "inherit" },
    },
    parts: {
      title: { fontSize: 32, color: "#0d4754", fontFamily: "inherit" },
      orderInfo: { fontSize: 12, color: "#6b7280", fontFamily: "inherit" },
      customerName: { fontSize: 18, color: "#0d4754", fontFamily: "inherit" },
      customerPhone: { fontSize: 14, color: "#374151", fontFamily: "inherit" },
      customerAddr: { fontSize: 13, color: "#374151", fontFamily: "inherit" },
      storeInfo: { fontSize: 13, color: "#4b5563", fontFamily: "inherit" },
      tableHeader: { fontSize: 13, color: "#6b7280", fontFamily: "inherit" },
      tableBody: { fontSize: 14, color: "#1f2937", fontFamily: "inherit" },
      summary: { fontSize: 14, color: "#6b7280", fontFamily: "inherit" },
      totalText: { fontSize: 18, color: "#0d4754", fontFamily: "inherit" },
    }
  }
};

export function getStoreSettings(): StoreSettings {
  try {
    const raw = localStorage.getItem('storeSettings');
    if (raw) {
      // Merge with default to handle missing fields
      const parsed = JSON.parse(raw);
      return {
        ...defaultStoreSettings,
        invoiceStyles: {
          ...defaultStoreSettings.invoiceStyles,
          ...parsed.invoiceStyles,
          messages: {
            ...defaultStoreSettings.invoiceStyles.messages,
            ...(parsed.invoiceStyles?.messages || {})
          },
          parts: {
            ...defaultStoreSettings.invoiceStyles.parts,
            ...(parsed.invoiceStyles?.parts || {})
          }
        }
      };
    }
  } catch (e) {
    console.error("Error reading store settings", e);
  }
  return defaultStoreSettings;
}

export function saveStoreSettings(settings: StoreSettings) {
  localStorage.setItem('storeSettings', JSON.stringify(settings));
}

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(getStoreSettings());

  const updateSettings = (newSettings: StoreSettings) => {
    setSettings(newSettings);
    saveStoreSettings(newSettings);
    window.dispatchEvent(new Event('storeSettingsUpdated'));
  };

  useEffect(() => {
    const handler = () => {
      setSettings(getStoreSettings());
    };
    window.addEventListener('storeSettingsUpdated', handler);
    return () => window.removeEventListener('storeSettingsUpdated', handler);
  }, []);

  return { settings, updateSettings };
}
