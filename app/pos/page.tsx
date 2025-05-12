"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// DOCX va FileSaver importlari
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, TabStopType, TabStopPosition, BorderStyle, Table, TableRow, TableCell, WidthType, VerticalAlign, PageOrientation } from "docx";
import { saveAs } from "file-saver";


// Ikonkalar
import { LogOut, Search, ShoppingBag, ShoppingCart, Truck, Users, Minus, Plus as PlusIcon, History, Eye, Edit, Loader2, X, Save, RotateCcw, CheckCircle, Repeat, Printer, Download } from "lucide-react"; // Download ikonkasini qo'shdim
// UI Komponentlari
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const API_BASE_URL = "https://oshxonacopy.pythonanywhere.com/api";

const handleApiError = (error: any, contextMessage: string = "Xatolik") => {
    // ... (avvalgidek)
    let errorMessage = "Noma'lum xatolik yuz berdi.";
    if (error instanceof AxiosError && error.response) {
        if (error.response.data && error.response.data.message) {
            errorMessage = error.response.data.message;
        } else if (error.response.data && error.response.data.detail) {
            errorMessage = error.response.data.detail;
        } else if (error.response.statusText) {
            errorMessage = `Server xatosi: ${error.response.status} ${error.response.statusText}`;
        }
    } else if (error.message) {
        errorMessage = error.message;
    }
    console.error(`${contextMessage}:`, error);
    toast.error(`${contextMessage}: ${errorMessage}`);
};


export default function POSPageWrapper() {
  // ... (avvalgidek)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 1 * 60 * 1000, 
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ToastContainer 
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      <POSPage />
    </QueryClientProvider>
  );
}

function POSPage() {
  const queryClient = useQueryClient();
  // ... (barcha state'lar avvalgidek qoladi)
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<any | null>(null);
  const [originalOrderItems, setOriginalOrderItems] = useState<any[]>([]);
  const [isEditLoadingManual, setIsEditLoadingManual] = useState(false);
  const [editErrorManual, setEditErrorManual] = useState<string | null>(null);
  const [submitEditError, setSubmitEditError] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [orderType, setOrderType] = useState("dine_in");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [customerInfo, setCustomerInfo] = useState({ name: "", phone: "+998 ", address: "" });
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('all');
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState("");
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [tableForCheckout, setTableForCheckout] = useState<any | null>(null);
  const [paymentDetails, setPaymentDetails] = useState({
    method: "cash",
    received_amount: "",
    mobile_provider: "Click"
  });

  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false); // DOCX yuklash uchun state

  const getToken = () => { // ... (avvalgidek)
     if (typeof window !== "undefined") { return localStorage.getItem("token"); }
    return null;
  };

  // --- API So'rovlari (avvalgidek) ---
  const { data: categories = [], isLoading: isLoadingCategories, error: errorCategories } = useQuery({ /* ... */ 
    queryKey: ['categories'],
    queryFn: async () => {
      const token = getToken();
      if (!token) { throw new Error("Token topilmadi"); }
      const res = await axios.get(`${API_BASE_URL}/categories/`, { headers: { Authorization: `Bearer ${token}` } });
      return res.data || [];
    },
    onError: (err: any) => { console.error("Kategoriyalarni yuklashda xato:", err); }
  });
  const { data: products = [], isLoading: isLoadingProducts, error: errorProducts } = useQuery({ /* ... */ 
    queryKey: ['products'],
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new Error("Token topilmadi");
      const res = await axios.get(`${API_BASE_URL}/products/`, { headers: { Authorization: `Bearer ${token}` } });
      return res.data || [];
    },
     onError: (err: any) => { console.error("Mahsulotlarni yuklashda xato:", err); }
  });
  const { data: tables = [], isLoading: isLoadingTables, error: errorTables } = useQuery({ /* ... */
    queryKey: ['tables'],
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new Error("Token topilmadi");
      const res = await axios.get(`${API_BASE_URL}/tables/`, { headers: { Authorization: `Bearer ${token}` } });
      return res.data || [];
    },
    refetchInterval: 10000, 
    onError: (err: any) => { console.error("Stollarni yuklashda xato:", err); }
   });
  useEffect(() => { /* ... */
    const handler = setTimeout(() => { setDebouncedHistorySearch(historySearchQuery); }, 300);
    return () => clearTimeout(handler);
   }, [historySearchQuery]);
  const { data: orderHistory = [], isLoading: isHistoryLoading, error: historyError, refetch: refetchHistory } = useQuery({ /* ... */
    queryKey: ['orderHistory', debouncedHistorySearch],
    queryFn: async ({ queryKey }) => {
      const [, searchTerm] = queryKey;
      const token = getToken();
      if (!token) throw new Error("Token topilmadi");
      const url = `${API_BASE_URL}/orders/${searchTerm ? `?search=${encodeURIComponent(searchTerm as string)}` : ''}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      return res.data || [];
    },
    enabled: showHistoryDialog,
    onError: (err: any) => { console.error("Buyurtmalar tarixini yuklashda xato:", err); }
   });

  const formatDateTime = (d: string | Date | undefined, format: 'datetime' | 'date' | 'time' = 'datetime'): string => { // ... (avvalgidek)
    if (!d) return "N/A";
    try {
      const date = new Date(d);
      if (format === 'date') return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
      if (format === 'time') return date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
      return date.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(d); }
  };

  const printReceiptViaWindowPrint = (orderData: any) => { /* ... (avvalgi kod, o'zgarishsiz) ... */
    if (!orderData || !orderData.id) {
        toast.error("Mijoz cheki uchun buyurtma ma'lumotlari topilmadi.");
        return;
    }
    const companyDetails = {
        name: "SmartResto POS",
        address: "O'zbekiston, Toshkent sh.",
        phone: "+998 99 123 45 67", // Telefon raqamini o'zgartirdim
        inn: "123456789",
        thankYouMessage: "Xaridingiz uchun rahmat!",
        additionalInfo: "Yana kutib qolamiz!",
    };
    let itemsHtml = "";
    if (Array.isArray(orderData.items)) {
        orderData.items.forEach((item: any) => {
            const productName = item.product_details?.name || 'Noma\'lum mahsulot';
            const quantity = item.quantity;
            const unitPrice = parseFloat(item.unit_price || 0);
            const totalItemPrice = unitPrice * quantity;
            itemsHtml += `
                <tr>
                    <td style="word-break: break-word;">${productName}</td>
                    <td style="text-align:center;">${quantity}</td>
                    <td style="text-align:right;">${unitPrice.toLocaleString('uz-UZ')}</td>
                    <td style="text-align:right;">${totalItemPrice.toLocaleString('uz-UZ')}</td>
                </tr>
            `;
        });
    }
    const totalAmount = parseFloat(orderData.total_price || 0);
    const serviceFeePercent = parseFloat(orderData.actual_service_fee_percent || orderData.service_fee_percent || 0);
    const serviceFeeAmount = (totalAmount * serviceFeePercent) / 100;
    const finalPrice = parseFloat(orderData.final_price || 0);
    let paymentInfoHtml = '';
    if (orderData.payment) {
        paymentInfoHtml += `<p><strong>To'lov usuli:</strong> ${orderData.payment.method_display || orderData.payment.method}</p>`;
        if (orderData.payment.method === 'cash' && orderData.payment.received_amount) {
            paymentInfoHtml += `<p><strong>Olingan summa:</strong> ${parseFloat(orderData.payment.received_amount).toLocaleString('uz-UZ')} so'm</p>`;
            paymentInfoHtml += `<p><strong>Qaytim:</strong> ${parseFloat(orderData.payment.change_amount || 0).toLocaleString('uz-UZ')} so'm</p>`;
        }
        if (orderData.payment.method === 'mobile' && orderData.payment.mobile_provider) {
            paymentInfoHtml += `<p><strong>Mobil provayder:</strong> ${orderData.payment.mobile_provider}</p>`;
        }
    }
    const receiptContent = `
        <html>
        <head>
            <title>Chek #${orderData.id}</title>
            <style>
                body { font-family: 'Arial', sans-serif; margin: 0; padding: 5mm; font-size: 10pt; color: #000; }
                .receipt { width: 72mm; max-width: 100%; margin: 0 auto; }
                .center { text-align: center; }
                h1 { font-size: 14pt; margin: 5px 0; font-weight: bold; }
                h2 { font-size: 12pt; margin: 10px 0 5px 0; font-weight: bold; }
                p { margin: 2px 0; font-size: 9pt; line-height: 1.3; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 8px; }
                th, td { padding: 3px 0px; font-size: 9pt; border-bottom: 1px dashed #ccc; vertical-align: top;}
                th { text-align: left; border-bottom: 1px solid #000; font-weight: bold; }
                .items-table td:nth-child(1) { width: 45%; }
                .items-table td:nth-child(2) { width: 15%; text-align:center; }
                .items-table td:nth-child(3) { width: 20%; text-align:right; }
                .items-table td:nth-child(4) { width: 20%; text-align:right; }
                .totals p { display: flex; justify-content: space-between; margin: 4px 0; font-size: 10pt; }
                .totals p span:last-child { font-weight: bold; }
                .totals .grand-total span { font-size: 11pt; font-weight: bold; }
                hr.dashed { border: none; border-top: 1px dashed #555; margin: 8px 0; }
                .footer-message { margin-top: 10px; }
                @media print {
                    body { padding: 0; margin: 0; font-size: 9pt; }
                    .receipt { width: 100%; margin: 0; box-shadow: none; }
                    @page { margin: 5mm; size: 80mm auto; /* Termal printer uchun moslash */ } 
                }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="center">
                    <h1>${companyDetails.name}</h1>
                    ${companyDetails.address ? `<p>${companyDetails.address}</p>` : ''}
                    ${companyDetails.phone ? `<p>Tel: ${companyDetails.phone}</p>` : ''}
                    <!-- INNni kommentga oldim, sizda yo'q ekan ${companyDetails.inn ? `<p>INN: ${companyDetails.inn}</p>` : ''} -->
                </div>
                <hr class="dashed">
                <h2 class="center">CHEK #${orderData.id}</h2>
                <p><strong>Sana:</strong> ${formatDateTime(orderData.created_at, 'datetime')}</p>
                <p><strong>Buyurtma turi:</strong> ${orderData.order_type_display || orderData.order_type}</p>
                ${orderData.created_by ? `<p><strong>Ofitsiant:</strong> ${(`${orderData.created_by.first_name || ''} ${orderData.created_by.last_name || ''}`).trim()}</p>` : ''}
                ${(orderData.table?.name || orderData.table_name) ? `<p><strong>Stol:</strong> ${orderData.table?.name || orderData.table_name}</p>` : ''}
                ${orderData.customer_name ? `<p><strong>Mijoz:</strong> ${orderData.customer_name}</p>` : ''}
                ${orderData.customer_phone ? `<p><strong>Mijoz tel:</strong> ${orderData.customer_phone}</p>` : ''}

                ${itemsHtml.length > 0 ? `
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>Mahsulot</th>
                                <th style="text-align:center;">Miq.</th>
                                <th style="text-align:right;">Narx</th>
                                <th style="text-align:right;">Jami</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                ` : '<p class="center">Mahsulotlar yo\'q.</p>'}
                <hr class="dashed">
                <div class="totals">
                    <p><span>Jami (ovqatlar):</span> <span>${totalAmount.toLocaleString('uz-UZ')} so'm</span></p>
                    ${serviceFeePercent > 0 ? `<p><span>Xizmat haqi (${serviceFeePercent.toFixed(1)}%):</span> <span>${serviceFeeAmount.toLocaleString('uz-UZ')} so'm</span></p>` : ''}
                    <p class="grand-total"><span>YAKUNIY NARX:</span> <span>${finalPrice.toLocaleString('uz-UZ')} so'm</span></p>
                </div>
                ${paymentInfoHtml ? `<hr class="dashed">${paymentInfoHtml}` : ''}
                <hr class="dashed">
                <div class="center footer-message">
                    <p>${companyDetails.thankYouMessage}</p>
                    <p>${companyDetails.additionalInfo}</p>
                </div>
            </div>
            <script>
                setTimeout(function() {
                    window.print();
                }, 250);
            </script>
        </body>
        </html>
    `;
    const printWindow = window.open('', '_blank', 'width=320,height=600,scrollbars=yes,resizable=yes');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(receiptContent);
        printWindow.document.close();
        printWindow.focus(); 
    } else {
        toast.error("Mijoz cheki oynasini ochib bo'lmadi. Brauzeringizda pop-up'lar bloklangan bo'lishi mumkin.");
    }
  }

  const printKitchenReceiptViaWindowPrint = (orderData: any, receiptType: 'initial' | 'delta_added' | 'delta_cancelled' = 'initial', deltaItems: any[] | null = null) => { /* ... (avvalgi kod, o'zgarishsiz) ... */
    if (!orderData || !orderData.id) {
        toast.error("Oshxona cheki uchun buyurtma ma'lumotlari topilmadi.");
        return;
    }
    const itemsToPrint = deltaItems || orderData.items;
    if (!Array.isArray(itemsToPrint) || itemsToPrint.length === 0) {
        if (receiptType === 'initial') {} else {
            toast.warn(`Oshxona cheki (${receiptType}) uchun mahsulotlar yo'q.`);
            return;
        }
    }
    let itemsHtml = "";
    if (Array.isArray(itemsToPrint) && itemsToPrint.length > 0) {
        itemsToPrint.forEach((item: any) => {
            const productName = item.product_details?.name || item.productName || 'Noma\'lum';
            const quantity = item.quantity;
            let reasonText = "";
            if (receiptType === 'delta_cancelled') {
                reasonText = ` <span style="color:red; font-style:italic;">(${item.reason || "O'chirildi"})</span>`;
            } else if (receiptType === 'delta_added') {
                reasonText = ` <span style="color:green; font-style:italic;">(${item.reason || "Qo'shildi"})</span>`;
            }
            itemsHtml += `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #ccc;">
                    <span style="font-size: 11pt; font-weight: bold; flex-grow: 1; word-break: break-word;">${productName}${reasonText}</span>
                    <span style="font-size: 12pt; font-weight: bold; min-width: 30px; text-align: right;">x ${quantity}</span>
                </div>
            `;
        });
    } else if (receiptType === 'initial') {
         itemsHtml = `<div style="padding: 4px 0; border-bottom: 1px dashed #ccc; text-align: center; font-weight: bold;">YANGI BUYURTMA (BO'SH)</div>`;
    }
    let title = `BUYURTMA #${orderData.id}`;
    if (receiptType === 'delta_added') title = `QO'SHIMCHA #${orderData.id}`;
    else if (receiptType === 'delta_cancelled') title = `BEKOR QILINDI #${orderData.id}`;
    const kitchenReceiptContent = `
        <html>
        <head>
            <title>Oshxona Cheki #${orderData.id} (${receiptType})</title>
            <style>
                body { font-family: 'Arial', sans-serif; margin: 0; padding: 5mm; font-size: 10pt; color: #000; }
                .receipt { width: 72mm; max-width: 100%; margin: 0 auto; }
                .center { text-align: center; }
                h2 { font-size: 14pt; margin: 10px 0 5px 0; font-weight: bold; }
                p { margin: 3px 0; font-size: 10pt; line-height: 1.3; }
                hr.dashed { border: none; border-top: 1px solid #000; margin: 8px 0; }
                 @media print {
                    body { padding: 0; margin: 0; font-size: 10pt; }
                    .receipt { width: 100%; margin: 0; box-shadow: none; }
                    @page { margin: 3mm; size: 80mm auto; } 
                }
            </style>
        </head>
        <body>
            <div class="receipt">
                <h2 class="center">${title}</h2>
                <hr class="dashed">
                <p><strong>Vaqt:</strong> ${formatDateTime(new Date(), 'time')} (Buyurtma: ${formatDateTime(orderData.created_at, 'time')})</p>
                ${(orderData.table?.name || orderData.table_name) ? `<p><strong>Stol:</strong> ${orderData.table?.name || orderData.table_name}</p>` : ''}
                <p><strong>Turi:</strong> ${orderData.order_type_display || orderData.order_type}</p>
                ${orderData.created_by ? `<p><strong>Ofitsiant:</strong> ${(`${orderData.created_by.first_name || ''} ${orderData.created_by.last_name || ''}`).trim()}</p>` : ''}
                ${orderData.comment ? `<hr class="dashed"><p><strong>Izoh:</strong> ${orderData.comment}</p>` : ''}
                <hr class="dashed">
                <div>
                    ${itemsHtml}
                </div>
                <hr class="dashed">
            </div>
            <script>
                setTimeout(function() {
                    window.print();
                }, 250);
            </script>
        </body>
        </html>
    `;
    const printWindow = window.open('', `_blank_kitchen_${orderData.id}_${receiptType}`, 'width=320,height=400,scrollbars=yes,resizable=yes');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(kitchenReceiptContent);
        printWindow.document.close();
        printWindow.focus(); 
    } else {
        toast.error("Oshxona cheki oynasini ochib bo'lmadi. Brauzeringizda pop-up'lar bloklangan bo'lishi mumkin.");
    }
  }

  // =========================================================================================
  // === .DOCX CHEK GENERATSIYA VA YUKLAB OLISH FUNKSIYALARI ===
  // =========================================================================================
  const generateDocxReceiptBlob = async (orderData: any, type: 'customer' | 'kitchen') => {
    if (!orderData || !orderData.id) {
      toast.error(`${type === 'customer' ? 'Mijoz' : 'Oshxona'} cheki uchun buyurtma ma'lumotlari topilmadi.`);
      throw new Error("Buyurtma ma'lumotlari yo'q");
    }

    const companyDetails = { // Buni o'zingizga moslang
        name: "SmartResto POS",
        address: "O'zbekiston, Toshkent sh.",
        phone: "+998 99 123 45 67",
    };

    const children: Paragraph[] = [];
    const commonTextProps = { font: "Arial", size: 20 }; // 10pt uchun 20 (yarim-point)

    // Chek sarlavhasi
    children.push(new Paragraph({
        children: [new TextRun({ text: companyDetails.name, bold: true, size: 28, ...commonTextProps })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
    }));
    if (companyDetails.address) {
        children.push(new Paragraph({ text: companyDetails.address, alignment: AlignmentType.CENTER, spacing: { after: 50 }, ...commonTextProps }));
    }
    if (companyDetails.phone) {
        children.push(new Paragraph({ text: `Tel: ${companyDetails.phone}`, alignment: AlignmentType.CENTER, spacing: { after: 200 }, ...commonTextProps }));
    }
    
    children.push(new Paragraph({ text: "-".repeat(35), alignment: AlignmentType.CENTER, spacing: { after: 100, before: 100 }, ...commonTextProps }));


    if (type === 'customer') {
        children.push(new Paragraph({
            children: [new TextRun({ text: `CHEK #${orderData.id}`, bold: true, size: 24, ...commonTextProps })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
        }));
        children.push(new Paragraph({ text: `Sana: ${formatDateTime(orderData.created_at, 'datetime')}`, spacing: { after: 50 }, ...commonTextProps }));
        children.push(new Paragraph({ text: `Buyurtma turi: ${orderData.order_type_display || orderData.order_type}`, spacing: { after: 50 }, ...commonTextProps }));
        if (orderData.created_by) {
            children.push(new Paragraph({ text: `Ofitsiant: ${(`${orderData.created_by.first_name || ''} ${orderData.created_by.last_name || ''}`).trim()}`, spacing: { after: 50 }, ...commonTextProps }));
        }
        if (orderData.table?.name || orderData.table_name) {
            children.push(new Paragraph({ text: `Stol: ${orderData.table?.name || orderData.table_name}`, spacing: { after: 50 }, ...commonTextProps }));
        }
        if (orderData.customer_name) {
            children.push(new Paragraph({ text: `Mijoz: ${orderData.customer_name}`, spacing: { after: 50 }, ...commonTextProps }));
        }
    } else { // Oshxona cheki
        let title = `BUYURTMA #${orderData.id}`;
        // Agar receiptType ni orderData ichida saqlasangiz yoki alohida parametr qilsangiz, bu yerni moslashtirishingiz mumkin
        // Misol uchun, oshxona chekida delta holatlarni ko'rsatish kerak bo'lsa. Hozircha 'initial' deb qabul qilamiz.
        children.push(new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 26, ...commonTextProps })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
        }));
        children.push(new Paragraph({ text: `Vaqt: ${formatDateTime(new Date(), 'time')} (Buyurtma: ${formatDateTime(orderData.created_at, 'time')})`, spacing: { after: 50 }, ...commonTextProps }));
        if (orderData.table?.name || orderData.table_name) {
            children.push(new Paragraph({ text: `Stol: ${orderData.table?.name || orderData.table_name}`, spacing: { after: 50 }, ...commonTextProps }));
        }
        children.push(new Paragraph({ text: `Turi: ${orderData.order_type_display || orderData.order_type}`, spacing: { after: 50 }, ...commonTextProps }));
        if (orderData.created_by) {
            children.push(new Paragraph({ text: `Ofitsiant: ${(`${orderData.created_by.first_name || ''} ${orderData.created_by.last_name || ''}`).trim()}`, spacing: { after: 50 }, ...commonTextProps }));
        }
        if (orderData.comment) {
            children.push(new Paragraph({ text: "-".repeat(35), alignment: AlignmentType.CENTER, spacing: { after: 100, before: 100 }, ...commonTextProps }));
            children.push(new Paragraph({ text: `Izoh: ${orderData.comment}`, spacing: { after: 50 }, ...commonTextProps }));
        }
    }

    children.push(new Paragraph({ text: "-".repeat(35), alignment: AlignmentType.CENTER, spacing: { after: 100, before: 100 }, ...commonTextProps }));

    // Mahsulotlar jadvali
    if (Array.isArray(orderData.items) && orderData.items.length > 0) {
        if (type === 'customer') {
            children.push(new Paragraph({ text: "Mahsulotlar:", bold: true, spacing: { after: 50 }, ...commonTextProps }));
        }
        const tableRows = [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ text: "Mahsulot", bold: true, ...commonTextProps })], width: { size: 45, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ text: "Miq.", bold: true, alignment: AlignmentType.CENTER, ...commonTextProps })], width: { size: 15, type: WidthType.PERCENTAGE } }),
                    ...(type === 'customer' ? [
                        new TableCell({ children: [new Paragraph({ text: "Narx", bold: true, alignment: AlignmentType.RIGHT, ...commonTextProps })], width: { size: 20, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ text: "Jami", bold: true, alignment: AlignmentType.RIGHT, ...commonTextProps })], width: { size: 20, type: WidthType.PERCENTAGE } }),
                    ] : [ // Oshxona uchun faqat mahsulot va miqdor
                         new TableCell({ children: [new Paragraph({ text: "", ...commonTextProps })], width: { size: 40, type: WidthType.PERCENTAGE } }), // Bo'sh ustun
                    ]),
                ],
            }),
        ];

        orderData.items.forEach((item: any) => {
            const productName = item.product_details?.name || 'Noma\'lum';
            const quantity = item.quantity.toString();
            const unitPrice = type === 'customer' ? parseFloat(item.unit_price || 0).toLocaleString('uz-UZ') : '';
            const totalItemPrice = type === 'customer' ? (parseFloat(item.unit_price || 0) * item.quantity).toLocaleString('uz-UZ') : '';

            tableRows.push(new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ text: productName, ...commonTextProps })] }),
                    new TableCell({ children: [new Paragraph({ text: quantity, alignment: AlignmentType.CENTER, ...commonTextProps })] }),
                    ...(type === 'customer' ? [
                        new TableCell({ children: [new Paragraph({ text: unitPrice, alignment: AlignmentType.RIGHT, ...commonTextProps })] }),
                        new TableCell({ children: [new Paragraph({ text: totalItemPrice, alignment: AlignmentType.RIGHT, ...commonTextProps })] }),
                    ] : [
                         new TableCell({ children: [new Paragraph({ text: "", ...commonTextProps })] }),
                    ]),
                ],
            }));
        });
        children.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    } else {
        children.push(new Paragraph({ text: "Mahsulotlar yo'q.", alignment: AlignmentType.CENTER, spacing: { after: 100 }, ...commonTextProps }));
    }

    children.push(new Paragraph({ text: "-".repeat(35), alignment: AlignmentType.CENTER, spacing: { after: 100, before: 100 }, ...commonTextProps }));

    // Jami va to'lov ma'lumotlari (faqat mijoz cheki uchun)
    if (type === 'customer') {
        const totalAmount = parseFloat(orderData.total_price || 0);
        const serviceFeePercent = parseFloat(orderData.actual_service_fee_percent || orderData.service_fee_percent || 0);
        const serviceFeeAmount = (totalAmount * serviceFeePercent) / 100;
        const finalPrice = parseFloat(orderData.final_price || 0);

        children.push(new Paragraph({ text: `Jami (ovqatlar): ${totalAmount.toLocaleString('uz-UZ')} so'm`, alignment: AlignmentType.RIGHT, spacing: { after: 50 }, ...commonTextProps }));
        if (serviceFeePercent > 0) {
            children.push(new Paragraph({ text: `Xizmat haqi (${serviceFeePercent.toFixed(1)}%): ${serviceFeeAmount.toLocaleString('uz-UZ')} so'm`, alignment: AlignmentType.RIGHT, spacing: { after: 50 }, ...commonTextProps }));
        }
        children.push(new Paragraph({
            children: [new TextRun({ text: `YAKUNIY NARX: ${finalPrice.toLocaleString('uz-UZ')} so'm`, bold: true, size: 22, ...commonTextProps })],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 },
        }));

        if (orderData.payment) {
            children.push(new Paragraph({ text: "-".repeat(35), alignment: AlignmentType.CENTER, spacing: { after: 100, before: 100 }, ...commonTextProps }));
            children.push(new Paragraph({ text: `To'lov usuli: ${orderData.payment.method_display || orderData.payment.method}`, spacing: { after: 50 }, ...commonTextProps }));
            if (orderData.payment.method === 'cash' && orderData.payment.received_amount) {
                children.push(new Paragraph({ text: `Olingan summa: ${parseFloat(orderData.payment.received_amount).toLocaleString('uz-UZ')} so'm`, spacing: { after: 50 }, ...commonTextProps }));
                children.push(new Paragraph({ text: `Qaytim: ${parseFloat(orderData.payment.change_amount || 0).toLocaleString('uz-UZ')} so'm`, spacing: { after: 50 }, ...commonTextProps }));
            }
             if (orderData.payment.method === 'mobile' && orderData.payment.mobile_provider) {
                children.push(new Paragraph({ text: `Mobil provayder: ${orderData.payment.mobile_provider}`, spacing: { after: 50 }, ...commonTextProps }));
            }
        }
        children.push(new Paragraph({ text: "-".repeat(35), alignment: AlignmentType.CENTER, spacing: { after: 100, before: 100 }, ...commonTextProps }));
        children.push(new Paragraph({ text: companyDetails.thankYouMessage, alignment: AlignmentType.CENTER, spacing: { after: 50 }, ...commonTextProps }));
        if (companyDetails.additionalInfo) {
             children.push(new Paragraph({ text: companyDetails.additionalInfo, alignment: AlignmentType.CENTER, spacing: { after: 50 }, ...commonTextProps }));
        }
    }


    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    size: { width: 2267.7, height: 10000 }, // 80mm kenglik uchun (80mm * 28.3465 points/mm)
                    margin: { top: 283.465, right: 141.732, bottom: 283.465, left: 141.732 }, // 10mm, 5mm, 10mm, 5mm
                },
            },
            children: children,
        }],
        styles: {
            default: {
                document: {
                    run: { font: "Arial", size: 20 }, // Barcha matn uchun standart shrift va o'lcham
                },
            },
        },
    });

    try {
      const blob = await Packer.toBlob(doc);
      return blob;
    } catch (error) {
      console.error(`Error generating ${type} DOCX:`, error);
      throw new Error(`DOCX ${type} chekini yaratishda xatolik: ${(error as Error).message}`);
    }
  };

  const handleDownloadDocxReceipt = async (orderData: any, type: 'customer' | 'kitchen') => {
    if (isDownloadingDocx) return;
    setIsDownloadingDocx(true);
    try {
      const blob = await generateDocxReceiptBlob(orderData, type);
      const filename = `${type === 'customer' ? 'Mijoz_Cheki' : 'Oshxona_Cheki'}_${orderData.id}.docx`;
      saveAs(blob, filename);
      toast.success(`${type === 'customer' ? 'Mijoz' : 'Oshxona'} cheki DOCX formatida yuklandi.`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsDownloadingDocx(false);
    }
  };


  // --- Qolgan Mutatsiyalar va Funksiyalar (avvalgidek, faqat chek chiqarish joylari o'zgartiriladi) ---
  const finishEditingInternal = (informUser: boolean = false) => { /* ... */ 
    const previousId = editingOrderId;
    setEditingOrderId(null);
    setOrderToEdit(null);
    setOriginalOrderItems([]);
    setIsEditLoadingManual(false);
    setEditErrorManual(null);
    setSubmitEditError(null);
    setCart([]); 
    setSelectedTableId(null);
    setOrderType('dine_in');
    setCustomerInfo({ name: "", phone: "+998 ", address: "" });
    if (informUser && previousId) {
      console.log(`Buyurtma #${previousId} bilan ishlash yakunlandi/bekor qilindi.`);
    }
  };
  const loadOrderForEditing = async (orderIdToLoad: number, associatedTable: any = null) => { /* ... */ 
    const token = getToken();
    if (!token || !orderIdToLoad) { 
        toast.error("Tahrirlash uchun ID yoki token yetarli emas.");
        return; 
    }
    const isAnyMutationActive = createOrderMutation.isPending || updateOrderItemsMutation.isPending || checkoutMutation.isPending || reorderMutation.isPending;
    if (isAnyMutationActive) { 
        toast.warn("Iltimos, avvalgi amal tugashini kuting.");
        return; 
    }
    if (isEditLoadingManual && editingOrderId === orderIdToLoad) { return; }

    setIsEditLoadingManual(true);
    setEditErrorManual(null);
    setSubmitEditError(null);
    
    try {
      const data = await queryClient.fetchQuery<any>({
        queryKey: ['orderDetails', orderIdToLoad],
        queryFn: async () => {
          const url = `${API_BASE_URL}/orders/${orderIdToLoad}/`;
          const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.data) throw new Error(`Buyurtma (#${orderIdToLoad}) ma'lumoti topilmadi.`);
          return res.data;
        },
        staleTime: 0 
      });

      if (data.status === 'paid' || data.status === 'completed' || data.status === 'cancelled') {
        toast.warn(`Buyurtma #${orderIdToLoad} (${data.status_display}) holatida tahrirlab bo'lmaydi.`);
        setIsEditLoadingManual(false);
        setShowHistoryDialog(true);
        return;
      }
      
      setOrderToEdit(data);
      setOriginalOrderItems(JSON.parse(JSON.stringify(data.items || [])));
      setEditingOrderId(orderIdToLoad);
      setOrderType(data.order_type || "dine_in");
      setCustomerInfo({ 
        name: data.customer_name || "", 
        phone: data.customer_phone || "+998 ", 
        address: data.customer_address || "" 
      });
      setCart([]);

      if (data.order_type === 'dine_in' && data.table && data.table.id) {
        setSelectedTableId(data.table.id);
      } else if (data.order_type === 'dine_in' && associatedTable && associatedTable.id) {
         setSelectedTableId(associatedTable.id);
      } else {
        setSelectedTableId(null);
      }

      toast.info(`Buyurtma #${orderIdToLoad} tahrirlash uchun yuklandi.`);
      setShowHistoryDialog(false);
      setShowTableDialog(false);

    } catch (err: any) {
      handleApiError(err, `Buyurtma #${orderIdToLoad} ni yuklash`);
      setEditErrorManual(`Buyurtma #${orderIdToLoad} ni yuklashda xato.`);
      finishEditingInternal();
    } finally {
      setIsEditLoadingManual(false);
    }
  };
  const createOrderMutation = useMutation({ /* ... */ 
    mutationFn: async (orderData: any) => {
      const token = getToken();
      if (!token) throw new Error("Avtorizatsiya tokeni topilmadi!");
      const dataToSend = { ...orderData };
      if (dataToSend.customer_phone) { dataToSend.customer_phone = dataToSend.customer_phone.replace(/\D/g, ''); }
      const res = await axios.post(`${API_BASE_URL}/orders/`, dataToSend, { headers: { Authorization: `Bearer ${token}` } });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Buyurtma #${data.id} muvaffaqiyatli yaratildi!`);
      if (data && data.id) {
        printKitchenReceiptViaWindowPrint(data, 'initial'); 
      }
      finishEditingInternal(); 
      setShowCustomerDialog(false);
      setShowTableDialog(false);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      if (showHistoryDialog) { queryClient.invalidateQueries({ queryKey: ['orderHistory'] }); }
    },
    onError: (error: any, variables: any) => {
      let msg = "Buyurtma yaratishda noma'lum xato!";
      if (error.response?.data) {
        const errorData = error.response.data;
        if (typeof errorData === 'string') msg = errorData;
        else if (errorData.detail) msg = errorData.detail;
        else if (errorData.table_id && Array.isArray(errorData.table_id) && errorData.table_id[0]?.includes('is already occupied')) {
          queryClient.invalidateQueries({ queryKey: ['tables'] });
          const tableNameFromState = tables.find((t: any) => t.id === variables.table_id)?.name;
          msg = `Stol ${tableNameFromState || variables.table_id || "Tanlangan stol"} hozirda band.`;
        } else if (typeof errorData === 'object') {
          msg = Object.entries(errorData).map(([k, v]: [string, any]) => `${k}: ${Array.isArray(v) ? v.join(',') : v}`).join('; ');
        }
      } else if (error.message) { msg = error.message; }
      setSubmitEditError(`Xatolik: ${msg}`);
      toast.error(`Buyurtma yaratishda xato: ${msg}`);
    }
  });
  const updateOrderItemsMutation = useMutation({ /* ... */ 
    mutationFn: async ({ orderId, payload }: { orderId: number, payload: any }) => {
      const token = getToken();
      if (!token) throw new Error("Avtorizatsiya tokeni topilmadi!");
      const url = `${API_BASE_URL}/orders/${orderId}/update-items/`;
      const res = await axios.post(url, payload, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      return res.data;
    },
    onMutate: () => { setSubmitEditError(null); },
    onSuccess: (data, variables) => {
      toast.success(`Buyurtma #${variables.orderId} muvaffaqiyatli yangilandi!`);
      
      const updatedOrderFromServer = data;
      const newItemsFromResponse = updatedOrderFromServer.items || [];
      const addedOrIncreasedItems: any[] = [];
      const removedOrDecreasedItems: any[] = [];

      newItemsFromResponse.forEach((newItem: any) => {
        const oldItem = originalOrderItems.find(oi => (oi.product_id || oi.product) === (newItem.product_id || newItem.product));
        if (!oldItem) { 
          addedOrIncreasedItems.push({ ...newItem, productName: newItem.product_details?.name, quantity: newItem.quantity, reason: "Yangi" });
        } else if (newItem.quantity > oldItem.quantity) { 
          addedOrIncreasedItems.push({ ...newItem, productName: newItem.product_details?.name, quantity: newItem.quantity - oldItem.quantity, reason: "Qo'shimcha" });
        }
      });

      originalOrderItems.forEach((oldItem: any) => {
        const newItem = newItemsFromResponse.find(ni => (ni.product_id || ni.product) === (oldItem.product_id || oldItem.product));
        if (!newItem) { 
            removedOrDecreasedItems.push({ ...oldItem, productName: oldItem.product_details?.name, quantity: oldItem.quantity, reason: "Bekor qilindi" });
        } else if (newItem.quantity < oldItem.quantity) { 
            removedOrDecreasedItems.push({ ...oldItem, productName: oldItem.product_details?.name, quantity: oldItem.quantity - newItem.quantity, reason: "Kamaytirildi" });
        }
      });
      
      if (addedOrIncreasedItems.length > 0) {
        printKitchenReceiptViaWindowPrint(updatedOrderFromServer, 'delta_added', addedOrIncreasedItems);
      }
      if (removedOrDecreasedItems.length > 0) {
        printKitchenReceiptViaWindowPrint(updatedOrderFromServer, 'delta_cancelled', removedOrDecreasedItems);
      }

      setOrderToEdit(updatedOrderFromServer); 
      setOriginalOrderItems(JSON.parse(JSON.stringify(newItemsFromResponse))); 

      queryClient.setQueryData(['orderDetails', variables.orderId], updatedOrderFromServer);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      if (showHistoryDialog) { refetchHistory(); }
    },
    onError: (error: any) => {
        let errorMsg = "O'zgarishlarni saqlashda xato yuz berdi.";
        if (error.response?.data) {
            const errorData = error.response.data;
            if (typeof errorData === 'string') errorMsg = errorData;
            else if (errorData.detail) errorMsg = errorData.detail;
            else if (typeof errorData === 'object') {
                errorMsg = Object.entries(errorData).map(([k,v]:[string,any]) => `${k}: ${Array.isArray(v) ? v.join(',') : v}`).join('; ')
            }
        } else { errorMsg = `Ulanish xatosi: ${error.message}`; }
        setSubmitEditError(errorMsg);
        toast.error(`O'zgarishlarni saqlashda xato: ${errorMsg}`);
    }
  });
  const checkoutMutation = useMutation({ /* ... */
    mutationFn: async ({ tableId, paymentData }: { tableId: number, paymentData: any }) => {
      const token = getToken();
      if (!token) throw new Error("Avtorizatsiya tokeni topilmadi!");
      const url = `${API_BASE_URL}/tables/${tableId}/checkout/`;
      const res = await axios.post(url, paymentData, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      return res.data;
    },
    onSuccess: (data, variables) => {
      toast.success(`Stol #${variables.tableId} uchun to'lov amalga oshirildi! Buyurtma #${data.id} yopildi.`);
      
      if (data && data.id) {
        printReceiptViaWindowPrint(data); 
      }
      
      setShowCheckoutDialog(false);
      setTableForCheckout(null);
      setPaymentDetails({ method: "cash", received_amount: "", mobile_provider: "Click" });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['orderHistory'] });
      if (editingOrderId === data.id) {
        finishEditingInternal(); 
      }
    },
    onError: (error: any, variables) => {
        let msg = "To'lovni amalga oshirishda xato.";
        if (error.response?.data) {
            const errorData = error.response.data;
            if (typeof errorData === 'string') msg = errorData;
            else if (errorData.detail) msg = errorData.detail;
            else if (typeof errorData === 'object') msg = Object.entries(errorData).map(([k,v]:[string,any])=>`${k}: ${Array.isArray(v)?v.join(','):v}`).join('; ')
        } else if (error.message) { msg = error.message; }
        setSubmitEditError(`Xatolik: ${msg}`);
        toast.error(`To'lovda xato (Stol #${variables.tableId}): ${msg}`);
        if (error.response?.status === 404 || error.response?.data?.detail?.includes("active order")) {
            queryClient.invalidateQueries({ queryKey: ['tables'] });
        }
    }
   });
  const reorderMutation = useMutation({ /* ... */
    mutationFn: async (orderData: any) => {
      const token = getToken();
      if (!token) throw new Error("Avtorizatsiya tokeni topilmadi!");
      const dataToSend = { ...orderData };
      if (dataToSend.customer_phone) {
          dataToSend.customer_phone = dataToSend.customer_phone.replace(/\D/g, '');
      }
      const { originalOrderId, originalOrderData, ...actualOrderData } = dataToSend;
      const res = await axios.post(`${API_BASE_URL}/orders/`, actualOrderData, { headers: { Authorization: `Bearer ${token}` } });
      return { newData: res.data, originalOrderId: originalOrderId };
    },
    onSuccess: (response, variables: any) => {
      const { newData, originalOrderId } = response;
      toast.success(`Buyurtma #${originalOrderId} dan nusxa (#${newData.id}) yaratildi!`);
      if (newData && newData.id) { 
        printKitchenReceiptViaWindowPrint(newData, 'initial'); 
      }
      finishEditingInternal(); 
      setShowHistoryDialog(false);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['orderHistory'] });
    },
    onError: (error: any, variables: any) => {
        let msg = "Qayta buyurtma berishda noma'lum xato!";
        if (error.response?.data) {
            const errorData = error.response.data;
            if(typeof errorData === 'string') msg=errorData;
            else if(errorData.detail) msg=errorData.detail;
            else if (errorData.table_id && Array.isArray(errorData.table_id) && errorData.table_id[0]?.includes('is already occupied')) {
                 queryClient.invalidateQueries({ queryKey: ['tables'] });
                 const originalOrder = variables.originalOrderData;
                 const tableNameFromState = tables.find((t:any)=>t.id===originalOrder?.table?.id)?.name;
                 const tableName = tableNameFromState || originalOrder?.table_name || originalOrder?.table?.id || "Stol";
                 msg = `Stol ${tableName} hozirda band. Boshqa stol tanlang.`;
             }
            else if(typeof errorData === 'object') msg=Object.entries(errorData).map(([k,v]:[string,any])=>`${k}:${Array.isArray(v)?v.join(','):v}`).join('; ');
        } else if (error.message) { msg = error.message; }
        setSubmitEditError(`Xatolik: ${msg}`);
        toast.error(`Qayta buyurtma berishda xato: ${msg}`);
    }
   });

  const filteredProducts = useMemo(() => { /* ... */ 
    if (!Array.isArray(products)) return [];
    return products.filter((p: any) =>
      p.is_active &&
      (selectedCategory === null || p.category?.id === selectedCategory) &&
      p.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, selectedCategory, searchQuery]);
  const uniqueZones = useMemo(() => { /* ... */ 
    if (!Array.isArray(tables)) return ['all'];
    const zones = tables.map((t: any) => t.zone || 'N/A');
    const uniqueSet = new Set(zones);
    const sortedZones = Array.from(uniqueSet).sort((a, b) => {
      if (a === 'N/A') return 1; if (b === 'N/A') return -1;
      const numA = parseInt(a); const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      if (!isNaN(numA) && isNaN(numB)) return -1; if (isNaN(numA) && !isNaN(numB)) return 1;
      return a.localeCompare(b);
    });
    return ['all', ...sortedZones];
  }, [tables]);
  const currentPanelItems = useMemo(() => { /* ... */
    if (editingOrderId && orderToEdit?.items) { return orderToEdit.items; }
    else if (!editingOrderId) { return cart; }
    return [];
   }, [editingOrderId, orderToEdit, cart]);
  const currentPanelTotal = useMemo(() => { /* ... */ 
    let itemsTotal = 0;
    if (editingOrderId && orderToEdit?.items) {
      itemsTotal = orderToEdit.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price || 0) * item.quantity), 0);
    } else if (!editingOrderId && cart.length > 0) {
      itemsTotal = cart.reduce((total: number, cartItem: any) => total + (parseFloat(cartItem.product?.price || 0) * cartItem.quantity), 0);
    }
    return itemsTotal;
  }, [editingOrderId, orderToEdit, cart]);
  const isMutationLoading = createOrderMutation.isPending || updateOrderItemsMutation.isPending || checkoutMutation.isPending || reorderMutation.isPending;
  const isAnyLoading = isMutationLoading || isLoadingProducts || isLoadingCategories || isEditLoadingManual || isLoadingTables;

  const addToCart = (product: any) => { /* ... */
    if (editingOrderId) { 
      handleLocalAddItemFromProductList(product);
      return;
    }
    if (!product?.id) { 
        toast.error("Mahsulot qo'shishda xatolik: Mahsulot IDsi topilmadi.");
         return; 
    }
    setCart((prev) => {
      const exist = prev.find((i) => i.id === product.id);
      if (exist) return prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: product.id, product: product, quantity: 1 }];
    });
   };
  const decreaseQuantity = (item: any) => { /* ... */ 
    if (editingOrderId && orderToEdit) {
      handleLocalEditQuantityChange(item.product_id || item.product, -1);
      return;
    }
    setCart((prev) => {
      const current = prev.find((i) => i.id === item.id); 
      if (!current) return prev;
      if (current.quantity === 1) return prev.filter((i) => i.id !== item.id);
      return prev.map((i) => i.id === item.id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i);
    });
  };
  const increaseQuantity = (item: any) => { /* ... */ 
    if (editingOrderId && orderToEdit) {
        handleLocalEditQuantityChange(item.product_id || item.product, 1);
        return;
    }
    setCart((prev) => prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
  };
  const handleLocalEditQuantityChange = (productId: number, change: number) => { /* ... */ 
    if (!editingOrderId || !orderToEdit || updateOrderItemsMutation.isPending) return;
    setOrderToEdit((prevOrder: any) => {
      if (!prevOrder) return null;
      const updatedItems = prevOrder.items ? [...prevOrder.items] : [];
      const itemIndex = updatedItems.findIndex(item => (item.product_id || item.product) === productId);
      if (itemIndex > -1) {
        const currentItem = updatedItems[itemIndex];
        const newQuantity = currentItem.quantity + change;
        if (newQuantity <= 0) { updatedItems.splice(itemIndex, 1); }
        else { updatedItems[itemIndex] = { ...currentItem, quantity: newQuantity }; }
      }
      return { ...prevOrder, items: updatedItems };
    });
  };
  const handleLocalAddItemFromProductList = (product: any) => { /* ... */
    if (!editingOrderId || !orderToEdit || !product || updateOrderItemsMutation.isPending || isEditLoadingManual) return;
    setOrderToEdit((prevOrder: any) => {
      if (!prevOrder) return null;
      const updatedItems = prevOrder.items ? [...prevOrder.items] : [];
      const itemIndex = updatedItems.findIndex(item => (item.product_id || item.product) === product.id);
      if (itemIndex > -1) {
        updatedItems[itemIndex] = { ...updatedItems[itemIndex], quantity: updatedItems[itemIndex].quantity + 1 };
      } else {
        updatedItems.push({
          product: product.id,
          product_id: product.id,
          product_details: { id: product.id, name: product.name, image_url: product.image },
          quantity: 1,
          unit_price: product.price,
        });
      }
      return { ...prevOrder, items: updatedItems };
    });
   };
  const submitOrder = () => { /* ... */ 
    if (editingOrderId) return;
    if (cart.length === 0) { 
        toast.warn("Savat bo‘sh!");
        setSubmitEditError("Savat bo‘sh!");
        return; 
    }
    if (orderType === "dine_in" && !selectedTableId) { 
        toast.warn("Stol tanlanmagan!");
        setSubmitEditError("Stol tanlanmagan!");
        setShowTableDialog(true); 
        return; 
    }
    const phoneDigits = customerInfo.phone.replace(/\D/g, '');
    if ((orderType === "takeaway" || orderType === "delivery") && (!customerInfo.name || phoneDigits.length < 12 )) { 
        setShowCustomerDialog(true); 
        toast.warn("Mijoz ismi va telefon raqamini to'liq kiriting!");
        setSubmitEditError("Mijoz ismi va telefon raqamini to'liq kiriting!");
        return; 
    }
    if (orderType === "delivery" && !customerInfo.address) { 
        setShowCustomerDialog(true); 
        toast.warn("Yetkazish manzilini kiriting!");
        setSubmitEditError("Yetkazish manzilini kiriting!");
        return; 
    }

    const orderData = {
      order_type: orderType,
      table_id: orderType === "dine_in" ? selectedTableId : null,
      customer_name: (orderType === "takeaway" || orderType === "delivery") ? customerInfo.name : null,
      customer_phone: (orderType === "takeaway" || orderType === "delivery") ? customerInfo.phone : null,
      customer_address: orderType === "delivery" ? customerInfo.address : null,
      items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })),
    };
    createOrderMutation.mutate(orderData);
  };
  const submitEditedOrderChanges = () => { /* ... */ 
    if (!editingOrderId || !orderToEdit || !originalOrderItems || updateOrderItemsMutation.isPending || isEditLoadingManual) {
      toast.warn("O'zgarishlarni saqlash uchun shartlar bajarilmadi.");
      setSubmitEditError("O'zgarishlarni saqlash uchun shartlar bajarilmadi.");
      return;
    }
    if (orderToEdit.status === 'paid' || orderToEdit.status === 'completed' || orderToEdit.status === 'cancelled') {
        toast.error(`Buyurtma #${editingOrderId} (${orderToEdit.status_display}) holatida, o'zgartirib bo'lmaydi.`);
        setSubmitEditError(`Buyurtma #${editingOrderId} (${orderToEdit.status_display}) holatida, o'zgartirib bo'lmaydi.`);
        return;
    }
    
    const currentItems = orderToEdit.items || [];
    const operations: any[] = [];

    currentItems.forEach((currentItem: any) => {
      const originalItem = originalOrderItems.find(o => (o.product_id || o.product) === (currentItem.product_id || currentItem.product));
      if (!originalItem) { 
        operations.push({ operation: "add", product_id: (currentItem.product_id || currentItem.product), quantity: currentItem.quantity });
      } else if (currentItem.quantity !== originalItem.quantity) {
        if (originalItem.id && typeof originalItem.id === 'number') {
            operations.push({ operation: "set", order_item_id: originalItem.id, quantity: currentItem.quantity });
        } else {
            console.warn("Set operatsiyasi uchun order_item_id topilmadi, product_id ishlatiladi:", originalItem);
            operations.push({ operation: "set_by_product", product_id: (originalItem.product_id || originalItem.product), quantity: currentItem.quantity });
        }
      }
    });
    originalOrderItems.forEach((originalItem: any) => {
      if (!currentItems.find((c: any) => (c.product_id || c.product) === (originalItem.product_id || originalItem.product))) {
        if (originalItem.id && typeof originalItem.id === 'number') { 
          operations.push({ operation: "remove", order_item_id: originalItem.id });
        } else { 
          console.warn("Remove operatsiyasi uchun order_item_id topilmadi:", originalItem);
           operations.push({ operation: "remove_by_product", product_id: (originalItem.product_id || originalItem.product) });
        }
      }
    });

    if (operations.length === 0) { 
        toast.info("Hech qanday o'zgarish qilinmadi.");
        return; 
    }
    updateOrderItemsMutation.mutate({ orderId: editingOrderId, payload: { items_operations: operations } });
  };
  const reorderToSameTable = (order: any) => { /* ... */ 
    if (isAnyLoading) { 
        toast.warn("Boshqa amal bajarilmoqda, iltimos kuting.");
         return; 
    }
    if (order.status !== "completed" && order.status !== "paid") { 
        toast.warn("Bu funksiya faqat yakunlangan yoki to'langan buyurtmalar uchun.");
         return; 
    }
    const tableIdForReorder = order.order_type === "dine_in" ? (order.table?.id || order.table_id) : null;
    if (order.order_type === "dine_in" && !tableIdForReorder) {
        toast.error("Qayta buyurtma berish uchun stol ma'lumotlari topilmadi.");
         return; 
    }
    const orderData = {
      order_type: order.order_type,
      table_id: tableIdForReorder,
      customer_name: (order.order_type === "takeaway" || order.order_type === "delivery") ? order.customer_name : null,
      customer_phone: (order.order_type === "takeaway" || order.order_type === "delivery") ? order.customer_phone : null,
      customer_address: order.order_type === "delivery" ? order.customer_address : null,
      items: order.items.map((item: any) => ({ product_id: (item.product_id || item.product), quantity: item.quantity })),
    };
    reorderMutation.mutate({ ...orderData, originalOrderId: order.id, originalOrderData: order });
  };
  const handleCustomerInfoSave = () => { /* ... */ 
    const phoneDigits = customerInfo.phone.replace(/\D/g, '');
    if (!customerInfo.name || phoneDigits.length < 12 ) { 
        toast.error("Ism va telefon raqamini to'liq kiriting (kamida 12 raqam).");
        setSubmitEditError("Ism va telefon raqamini to'liq kiriting!");
        return; 
    }
    if (orderType === "delivery" && !customerInfo.address) { 
        toast.error("Yetkazish manzilini kiriting!");
        setSubmitEditError("Yetkazish manzilini kiriting!");
         return; 
    }
    setShowCustomerDialog(false); 
    setSubmitEditError(null);
    toast.success("Mijoz ma'lumotlari saqlandi.");
  };
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */
    const prefix = "+998";
    let value = e.target.value;
    if (!value.startsWith(prefix)) {
        value = prefix + value.replace(/\D/g, '').substring(prefix.length-3);
    }
    const numbers = value.substring(prefix.length).replace(/\D/g, '');
    let formattedNumber = prefix;
    if (numbers.length > 0) formattedNumber += " " + numbers.substring(0, 2);
    if (numbers.length > 2) formattedNumber += " " + numbers.substring(2, 5);
    if (numbers.length > 5) formattedNumber += " " + numbers.substring(5, 7);
    if (numbers.length > 7) formattedNumber += " " + numbers.substring(7, 9);
    
    setCustomerInfo(prev => ({ ...prev, phone: formattedNumber.slice(0, 17) }));
   };
  const cancelEditing = () => { /* ... */ 
    if (updateOrderItemsMutation.isPending) { 
        toast.warn("Saqlash jarayoni tugashini kuting.");
        return; 
    }
    finishEditingInternal(true);
    toast.info("Tahrirlash bekor qilindi.");
  };
  const handleLogout = () => { /* ... */ 
    setShowLogoutDialog(true);
  };
  const confirmLogoutAction = () => { /* ... */ 
    if (typeof window !== "undefined") { 
        localStorage.removeItem("token"); 
        localStorage.removeItem("user");
        queryClient.clear();
        window.location.href = "/auth";
        toast.success("Tizimdan muvaffaqiyatli chiqildi!");
    }
    setShowLogoutDialog(false);
  };

  // === JSX ===
  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col bg-muted/40">
        {/* ... (Header JSX avvalgidek) ... */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6 shrink-0">
           <div className="flex items-center gap-2 sm:gap-4">
            <Tooltip><TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0" onClick={handleLogout}><LogOut className="h-5 w-5" /></Button>
            </TooltipTrigger><TooltipContent><p>Chiqish</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => { setHistorySearchQuery(''); setDebouncedHistorySearch(''); setShowHistoryDialog(true); if(showHistoryDialog) refetchHistory(); }}>
                <History className="h-5 w-5" />
              </Button>
            </TooltipTrigger><TooltipContent><p>Buyurtmalar Tarixi</p></TooltipContent></Tooltip>
            <h1 className="text-lg sm:text-xl font-bold hidden md:inline-block">SmartResto POS</h1>
          </div>
          <div className="flex-1 flex justify-center px-4">
            <Tabs
              value={editingOrderId && orderToEdit ? orderToEdit.order_type : orderType}
              onValueChange={(value) => {
                if (editingOrderId || isMutationLoading) {
                    toast.info("Joriy buyurtma bilan ishlash tugallanmaguncha turni o'zgartirib bo'lmaydi.");
                    return;
                }
                if (orderType !== value) {
                    setOrderType(value);
                    setSelectedTableId(null);
                    setCustomerInfo({ name: "", phone: "+998 ", address: "" });
                    setCart([]); 
                    toast.info(`Buyurtma turi "${value === 'dine_in' ? 'Shu yerda' : value === 'takeaway' ? 'Olib ketish' : 'Yetkazish'}" ga o'zgartirildi.`);
                }
              }}
              className={`w-full max-w-md ${editingOrderId || isMutationLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <TabsList className="grid w-full grid-cols-3 h-11">
                <TabsTrigger value="dine_in" disabled={!!editingOrderId || isMutationLoading} className="flex items-center gap-1">
                  <Users className="h-4 w-4" /> <span className="hidden sm:inline">Shu yerda</span><span className="sm:hidden">Ichki</span>
                </TabsTrigger>
                <TabsTrigger value="takeaway" disabled={!!editingOrderId || isMutationLoading} className="flex items-center gap-1">
                  <ShoppingBag className="h-4 w-4" /> <span className="hidden sm:inline">Olib ketish</span><span className="sm:hidden">Olib k.</span>
                </TabsTrigger>
                <TabsTrigger value="delivery" disabled={!!editingOrderId || isMutationLoading} className="flex items-center gap-1">
                  <Truck className="h-4 w-4" /> <span className="hidden sm:inline">Yetkazish</span><span className="sm:hidden">Yetkaz.</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2 sm:gap-4"> {/* O'ng taraf uchun bo'sh joy */} </div>
        </header>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-0 overflow-hidden">
          {/* ... (Mahsulotlar paneli JSX avvalgidek) ... */}
          <div className="md:col-span-2 lg:col-span-3 flex flex-col border-r border-border overflow-hidden">
            <div className="border-b border-border p-4 shrink-0">
              <div className="relative mb-4">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Mahsulot qidirish..." className="w-full rounded-lg bg-background pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <ScrollArea className="w-full">
                <div className="flex space-x-2 pb-2">
                  <Button size="sm" variant={selectedCategory === null ? "default" : "outline"} className="rounded-full px-4" onClick={() => setSelectedCategory(null)}>Barchasi</Button>
                  {isLoadingCategories ? <div className="p-2"><Loader2 className="h-4 w-4 animate-spin" /></div> : errorCategories ? <p className="p-2 text-xs text-destructive">Kategoriya xato</p> :
                    Array.isArray(categories) && categories.map((cat: any) => (
                      <Button size="sm" key={cat.id} variant={selectedCategory === cat.id ? "default" : "outline"} className="rounded-full px-4" onClick={() => setSelectedCategory(cat.id)}>{cat.name}</Button>
                  ))}
                </div><ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
            <ScrollArea className="flex-1 p-4">
              {isLoadingProducts ? <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /><p className="ml-2">Yuklanmoqda...</p></div> :
               errorProducts ? <div className="text-destructive p-4 text-center">Mahsulotlarni yuklashda xatolik. <Button variant="link" onClick={() => queryClient.refetchQueries({queryKey: ['products']})}>Qayta urinish</Button></div> :
               filteredProducts.length === 0 ? <div className="text-muted-foreground text-center p-10">Mahsulot topilmadi.</div> :
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredProducts.map((product: any) => (
                    <Card key={product.id} 
                        className={`cursor-pointer group overflow-hidden ${isAnyLoading && (!editingOrderId || (editingOrderId && updateOrderItemsMutation.isPending)) ? 'opacity-60 pointer-events-none' : ''}`}
                        onClick={() => { 
                            if (isAnyLoading && (!editingOrderId || (editingOrderId && updateOrderItemsMutation.isPending))) return;
                            addToCart(product);
                        }}>
                      <CardContent className="p-0 flex flex-col">
                        <div className="aspect-square w-full overflow-hidden"><img src={product.image || "/placeholder-product.jpg"} alt={product.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.jpg"; }} loading="lazy" /></div>
                        <div className="p-3"><h3 className="font-semibold text-sm line-clamp-2">{product.name}</h3><p className="text-xs font-semibold text-primary mt-1">{Number(product.price).toLocaleString('uz-UZ')} so‘m</p></div>
                      </CardContent>
                    </Card>
                  ))}
              </div>}
            </ScrollArea>
          </div>

          {/* O'ng Panel (Buyurtma/Savat) */}
          <div className="md:col-span-1 lg:col-span-2 flex flex-col bg-background overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4 shrink-0 h-16">
              <div className="flex items-center space-x-2">
                {isEditLoadingManual ? <Loader2 className="h-5 w-5 animate-spin" /> : editingOrderId ? <Edit className="h-5 w-5 text-primary" /> : <ShoppingCart className="h-5 w-5" />}
                <h2 className="text-lg font-medium">{isEditLoadingManual ? "Yuklanmoqda..." : editingOrderId ? `Tahrirlash #${editingOrderId}` : "Yangi Buyurtma"}</h2>
              </div>
              <div className="flex items-center gap-1"> 
                {editingOrderId && orderToEdit ? (
                  <>
                    {orderToEdit.table && <Badge variant="outline" className="hidden sm:inline-flex text-xs px-1.5 py-0.5">Stol {orderToEdit.table.name}</Badge>}
                    {/* Mijoz Cheki (Chop etish) */}
                    <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" 
                            onClick={() => printReceiptViaWindowPrint(orderToEdit)} 
                            disabled={!orderToEdit.items || orderToEdit.items.length === 0 || isAnyLoading}>
                             <Printer className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger><TooltipContent><p>Mijoz Cheki (Chop etish)</p></TooltipContent></Tooltip>
                    {/* Mijoz Cheki (DOCX Yuklab olish) */}
                    <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" 
                            onClick={() => handleDownloadDocxReceipt(orderToEdit, 'customer')} 
                            disabled={!orderToEdit.items || orderToEdit.items.length === 0 || isAnyLoading || isDownloadingDocx}>
                             {isDownloadingDocx ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4 text-blue-500" />}
                        </Button>
                    </TooltipTrigger><TooltipContent><p>Mijoz Cheki (DOCX)</p></TooltipContent></Tooltip>
                    
                    {/* Oshxona Cheki (Chop etish) */}
                    <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" 
                            onClick={() => printKitchenReceiptViaWindowPrint(orderToEdit, 'initial')} 
                            disabled={!orderToEdit.items || orderToEdit.items.length === 0 || isAnyLoading}>
                            <Printer className="h-4 w-4 text-orange-500" />
                        </Button>
                    </TooltipTrigger><TooltipContent><p>Oshxona Cheki (Chop etish)</p></TooltipContent></Tooltip>
                     {/* Oshxona Cheki (DOCX Yuklab olish) */}
                    <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" 
                            onClick={() => handleDownloadDocxReceipt(orderToEdit, 'kitchen')} 
                            disabled={!orderToEdit.items || orderToEdit.items.length === 0 || isAnyLoading || isDownloadingDocx}>
                             {isDownloadingDocx ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4 text-green-500" />}
                        </Button>
                    </TooltipTrigger><TooltipContent><p>Oshxona Cheki (DOCX)</p></TooltipContent></Tooltip>
                    
                    <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEditing} disabled={isAnyLoading || updateOrderItemsMutation.isPending}>
                            <X className="h-5 w-5 text-destructive" />
                        </Button>
                    </TooltipTrigger><TooltipContent><p>Bekor qilish</p></TooltipContent></Tooltip>
                  </>
                ) : !editingOrderId ? ( /* ... (avvalgidek) ... */ 
                   <> 
                    {orderType === "dine_in" && (
                      <>
                        {selectedTableId && tables.find((t: any) => t.id === selectedTableId) && 
                          <Badge variant="outline" className="text-xs px-1.5 py-0.5">Stol {tables.find((t: any) => t.id === selectedTableId)?.name}</Badge>}
                        <Button variant="outline" className="h-10 text-sm px-3" onClick={() => setShowTableDialog(true)} disabled={isAnyLoading}>
                          {selectedTableId ? "Stol O'zg." : "Stol Tanlash"}
                        </Button>
                      </>
                    )}
                    {(orderType === 'takeaway' || orderType === 'delivery') && (
                        customerInfo.name ? 
                        <Tooltip><TooltipTrigger asChild>
                            <Badge variant="secondary" className="cursor-pointer text-xs px-1.5 py-0.5 h-10 flex items-center" onClick={() => setShowCustomerDialog(true)}>
                                {customerInfo.name.split(' ')[0]}
                            </Badge>
                        </TooltipTrigger><TooltipContent><p>{customerInfo.name}, {customerInfo.phone}</p></TooltipContent></Tooltip> :
                        <Button variant="outline" className="h-10 text-sm px-3" onClick={() => setShowCustomerDialog(true)} disabled={isAnyLoading}>Mijoz</Button>
                    )}
                   </>
                ) : null}
              </div>
            </div>
            {/* ... (Panel ichi va pastki qismi JSX avvalgidek) ... */}
             <ScrollArea className="flex-1 p-4">
              {isEditLoadingManual ? <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Buyurtma yuklanmoqda...</div> :
               editErrorManual ? <div className="text-destructive p-4 text-center">{editErrorManual} <Button variant="link" onClick={() => editingOrderId && loadOrderForEditing(editingOrderId)}>Qayta urinish</Button></div> :
               currentPanelItems.length === 0 ? <div className="text-muted-foreground text-center p-10"><ShoppingCart className="mx-auto h-12 w-12 mb-2" />{editingOrderId ? "Buyurtmada mahsulot yo'q" : "Savat bo'sh"}</div> :
                <div className="space-y-3">
                  {currentPanelItems.map((item: any, index: number) => {
                    const productInfo = editingOrderId ? item.product_details : item.product;
                    const productName = productInfo?.name || `Noma'lum ID: ${editingOrderId ? (item.product_id || item.product) : item.id}`;
                    const productImage = editingOrderId ? productInfo?.image_url : productInfo?.image;
                    const unitPrice = editingOrderId ? item.unit_price : productInfo?.price;
                    const itemKey = editingOrderId ? (item.id || `temp-${item.product_id || item.product}-${index}`) : item.id;
                    
                    return (
                      <div key={itemKey} className={`flex items-center justify-between space-x-2 border-b pb-3 last:border-b-0 ${isAnyLoading && editingOrderId && updateOrderItemsMutation.isPending ? 'opacity-70 pointer-events-none' : ''}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <img src={productImage || "/placeholder-product.jpg"} alt={productName} className="h-10 w-10 rounded-md object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.jpg"; }} />
                          <div className="flex-1 min-w-0"><h3 className="font-medium text-sm truncate" title={productName}>{productName}</h3><p className="text-xs text-muted-foreground">{Number(unitPrice || 0).toLocaleString('uz-UZ')} so‘m</p></div>
                        </div>
                        <div className="flex items-center space-x-1 shrink-0">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => decreaseQuantity(item)} disabled={isAnyLoading && editingOrderId && updateOrderItemsMutation.isPending}><Minus className="h-3.5 w-3.5" /></Button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => increaseQuantity(item)} disabled={isAnyLoading && editingOrderId && updateOrderItemsMutation.isPending}><PlusIcon className="h-3.5 w-3.5" /></Button>
                        </div>
                        <div className="text-right shrink-0 w-24"><p className="font-semibold text-sm">{(Number(unitPrice || 0) * item.quantity).toLocaleString('uz-UZ')} so‘m</p></div>
                      </div>
                    );
                  })}
              </div>}
              {submitEditError && <p className="text-center text-destructive text-xs mt-4 p-2 bg-destructive/10 rounded">{submitEditError}</p>}
            </ScrollArea>
            <div className="border-t border-border p-4 shrink-0 bg-muted/20">
              <div className="space-y-1 mb-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Jami (mahsulot):</span><span className="font-semibold">{currentPanelTotal.toLocaleString('uz-UZ')} so‘m</span></div>
                {editingOrderId && orderToEdit && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Holati:</span><Badge variant={orderToEdit.status === 'completed' || orderToEdit.status === 'paid' ? 'success' : orderToEdit.status === 'cancelled' ? 'destructive' : 'secondary'} className="capitalize">{orderToEdit.status_display || orderToEdit.status}</Badge></div>
                    {Number(orderToEdit.actual_service_fee_percent || orderToEdit.service_fee_percent || 0) > 0 && 
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Xizmat ({orderToEdit.actual_service_fee_percent || orderToEdit.service_fee_percent}%):</span>
                        <span>{(currentPanelTotal * Number(orderToEdit.actual_service_fee_percent || orderToEdit.service_fee_percent) / 100).toLocaleString('uz-UZ')} so'm</span>
                      </div>
                    }
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                      <span className="text-muted-foreground">Yakuniy Narx:</span>
                      <span>{Number(orderToEdit.final_price || currentPanelTotal).toLocaleString('uz-UZ')} so‘m</span>
                    </div>
                  </>
                )}
              </div>
              {editingOrderId && orderToEdit ? (
                <div className="space-y-2">
                  <Button 
                    className="w-full h-12" 
                    size="lg" 
                    onClick={submitEditedOrderChanges} 
                    disabled={isAnyLoading || currentPanelItems.length === 0 || !!editErrorManual || ['paid', 'completed', 'cancelled'].includes(orderToEdit.status)} 
                  >
                    {updateOrderItemsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Saqlash
                  </Button>
                  {orderToEdit.order_type === 'dine_in' && orderToEdit.table &&
                   tables.find((t:any) => t.id === orderToEdit.table.id)?.active_order_id === editingOrderId &&
                   !['paid', 'completed', 'cancelled'].includes(orderToEdit.status) 
                   && (
                    <Button 
                      variant="success" 
                      className="w-full h-12" 
                      size="lg" 
                      onClick={() => { 
                        const currentTable = tables.find((t:any) => t.id === orderToEdit.table.id); 
                        setTableForCheckout(currentTable); 
                        setPaymentDetails({
                            method: "cash",
                            received_amount: "",
                            mobile_provider: "Click"
                        });
                        setShowCheckoutDialog(true); 
                      }} 
                      disabled={isAnyLoading}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" /> To'lov ({Number(orderToEdit.final_price || 0).toLocaleString('uz-UZ')} so‘m)
                    </Button>
                  )}
                </div>
              ) : (
                <Button 
                  className="w-full h-12" 
                  size="lg" 
                  onClick={submitOrder} 
                  disabled={isAnyLoading || cart.length === 0 || 
                           (orderType === 'dine_in' && !selectedTableId) || 
                           ((orderType === 'takeaway' || orderType === 'delivery') && (!customerInfo.name || customerInfo.phone.replace(/\D/g, '').length < 12)) || 
                           (orderType === 'delivery' && !customerInfo.address)
                          }
                >
                  {createOrderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Buyurtma ({currentPanelTotal.toLocaleString('uz-UZ')} so‘m)
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ... (Barcha Dialoglar JSX avvalgidek) ... */}
        <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
          <DialogContent className="sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>Stol tanlash</DialogTitle><DialogDescription>Buyurtma uchun stol tanlang yoki band stolni oching.</DialogDescription></DialogHeader>
            <div className="my-4 flex items-center gap-4 px-1 sm:px-6">
              <Label htmlFor="zone-filter" className="shrink-0">Zona:</Label>
              <Select value={selectedZoneFilter} onValueChange={setSelectedZoneFilter}><SelectTrigger id="zone-filter" className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>{uniqueZones.map(zone => (<SelectItem key={zone} value={zone}>{zone === 'all' ? 'Barchasi' : (zone === 'N/A' ? "Zonasiz" : zone)}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="flex-1 overflow-hidden px-1 sm:px-6 pb-4">
              {isLoadingTables && !tables.length ? <div className="flex justify-center items-center h-40"><Loader2 className="h-6 w-6 animate-spin" /></div> :
               errorTables ? <div className="text-destructive p-4 text-center">Stollarni yuklashda xatolik. <Button variant="link" onClick={() => queryClient.refetchQueries({queryKey: ['tables']})}>Qayta</Button></div> :
               !tables.filter((t:any) => selectedZoneFilter === 'all' || (t.zone || 'N/A') === selectedZoneFilter).length ? <p className="text-center text-muted-foreground py-10">Bu zonada stol topilmadi.</p> :
                <ScrollArea className="h-full pr-3"><div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {tables.filter((t:any) => selectedZoneFilter === 'all' || (t.zone || 'N/A') === selectedZoneFilter)
                    .sort((a:any, b:any) => {
                        const numA = parseInt(a.name.replace(/\D/g,''));
                        const numB = parseInt(b.name.replace(/\D/g,''));
                        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                        return a.name.localeCompare(b.name, undefined, {numeric: true});
                    })
                    .map((table: any) => (
                    <div key={table.id} className="flex flex-col items-stretch">
                        <Button 
                          variant="outline"
                          className={`w-full h-auto min-h-[80px] flex flex-col justify-center items-center p-2 border-2 whitespace-normal text-center mb-1
                            ${!table.is_available ? "bg-red-100 border-red-400 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-800/40"
                            : selectedTableId === table.id && !editingOrderId ? "bg-blue-600 border-blue-700 text-white hover:bg-blue-700"
                            : "bg-green-100 border-green-400 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-800/40"}`}
                          onClick={() => {
                            if (isAnyLoading) return;
                            if (!table.is_available) {
                              if (table.active_order_id) {
                                if (editingOrderId === table.active_order_id) { setShowTableDialog(false); return; }
                                finishEditingInternal();
                                loadOrderForEditing(table.active_order_id, table);
                              } else { 
                                toast.warn(`Stol ${table.name} band, lekin aktiv buyurtmasi topilmadi. Ma'lumotlar yangilanmoqda...`);
                                queryClient.invalidateQueries({ queryKey: ['tables'] }); 
                              }
                            } else {
                              if (editingOrderId) {
                                toast.info("Avval joriy buyurtmani saqlang yoki bekor qiling.");
                                return;
                              }
                              if (orderType !== 'dine_in') {
                                  setOrderType('dine_in');
                                  setCart([]); 
                                  toast.info("Buyurtma turi 'Shu yerda' ga o'zgartirildi.");
                              }
                              setSelectedTableId(table.id);
                              setCustomerInfo({ name: "", phone: "+998 ", address: "" });
                              setShowTableDialog(false);
                              toast.success(`Stol ${table.name} tanlandi.`);
                            }
                          }} disabled={isAnyLoading}>
                          <div className="font-semibold text-base leading-tight">{table.name}</div>
                          <div className={`text-xs mt-0.5 font-medium ${!table.is_available ? '' : 'text-green-700 dark:text-green-400'}`}>{table.is_available ? "Bo‘sh" : "Band"}</div>
                          {table.zone && table.zone !== 'N/A' && <div className="text-[10px] text-muted-foreground">({table.zone})</div>}
                          {!table.is_available && table.active_order_id && (
                            <div className="text-[10px] mt-0.5 text-blue-600 dark:text-blue-400">
                              ID: #{table.active_order_id} <br />
                              {parseFloat(table.active_order_final_price || "0") > 0 && <span>{parseFloat(table.active_order_final_price).toLocaleString('uz-UZ')} so'm</span>}
                            </div>
                          )}
                        </Button>
                        {!table.is_available && table.active_order_id && !checkoutMutation.isPending &&
                          (
                          <Button
                            variant="destructive" size="xs" className="w-full text-[10px] px-1 py-0.5 h-auto"
                            onClick={() => { setTableForCheckout(table); setShowCheckoutDialog(true); setSubmitEditError(null); }}
                            disabled={isAnyLoading} > To'lash </Button>
                        )}
                    </div>
                  ))}
                </div></ScrollArea>}
            </div>
            <DialogFooter className="px-1 sm:px-6 pb-6 pt-3 border-t"><DialogClose asChild><Button variant="ghost">Yopish</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCustomerDialog} onOpenChange={(open) => { if(!open) setSubmitEditError(null); setShowCustomerDialog(open);}}>
          <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{orderType === "delivery" ? "Yetkazish ma‘lumotlari" : "Mijoz ma‘lumotlari"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1"><Label htmlFor="cust-name">Ism*</Label><Input id="cust-name" value={customerInfo.name} onChange={(e) => setCustomerInfo(p=>({...p, name: e.target.value}))} /></div>
              <div className="space-y-1"><Label htmlFor="cust-phone">Telefon*</Label><Input id="cust-phone" type="tel" value={customerInfo.phone} onChange={handlePhoneChange} placeholder="+998 XX XXX XX XX" maxLength={17}/></div>
              {orderType === "delivery" && <div className="space-y-1"><Label htmlFor="cust-addr">Manzil*</Label><Input id="cust-addr" value={customerInfo.address} onChange={(e) => setCustomerInfo(p=>({...p, address: e.target.value}))} /></div>}
            </div>
            {submitEditError && <p className="text-sm text-destructive text-center -mt-2 mb-2">{submitEditError}</p>}
            <DialogFooter>
                <Button variant="outline" onClick={() => {setShowCustomerDialog(false); setSubmitEditError(null);}}>Bekor</Button>
                <Button onClick={handleCustomerInfoSave}>Saqlash</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <DialogContent className="sm:max-w-[400px]"><DialogHeader><DialogTitle>Chiqish</DialogTitle><DialogDescription>Tizimdan chiqmoqchimisiz?</DialogDescription></DialogHeader>
          <DialogFooter className="mt-4"><DialogClose asChild><Button variant="outline">Yo'q</Button></DialogClose><Button variant="destructive" onClick={confirmLogoutAction}>Ha, Chiqish</Button></DialogFooter></DialogContent>
        </Dialog>

        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="sm:max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-7xl h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>Buyurtmalar Tarixi</DialogTitle><DialogDescription>Tahrirlash uchun ustiga bosing (yakunlangan/bekor qilinganlarni tahrirlab bo'lmaydi).</DialogDescription></DialogHeader>
            <div className="px-1 sm:px-6 py-2"><div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="ID, mijoz, tel, stol bo'yicha qidirish..." className="w-full pl-8" value={historySearchQuery} onChange={(e) => setHistorySearchQuery(e.target.value)} />
            </div></div>
            <div className="flex-1 overflow-hidden px-1"><ScrollArea className="h-full px-2 sm:px-5 pb-6">
              {isHistoryLoading ? <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Yuklanmoqda...</div> :
               historyError ? <div className="text-destructive p-4 text-center">Tarix yuklashda xatolik.</div> :
               orderHistory.length === 0 ? <div className="text-muted-foreground text-center p-10">{historySearchQuery ? `"${historySearchQuery}" uchun topilmadi.` : "Tarix bo'sh."}</div> :
                <div className="space-y-4">
                  {[...orderHistory].sort((a:any, b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((order: any) => (
                    <Card key={order.id}
                      className={`overflow-hidden shadow-sm hover:shadow-md group relative ${['completed', 'paid', 'cancelled'].includes(order.status) ? 'opacity-80' : 'cursor-pointer'} ${isEditLoadingManual && editingOrderId === order.id ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => {
                        if (['completed', 'paid', 'cancelled'].includes(order.status)) { 
                            toast.info(`Buyurtma #${order.id} (${order.status_display}) yakunlangan, tahrirlab bo'lmaydi.`);
                            return; 
                        }
                        if (isAnyLoading) { 
                            toast.info("Boshqa amal bajarilmoqda, iltimos kuting.");
                            return; 
                        }
                        if (editingOrderId === order.id) { setShowHistoryDialog(false); return; }
                        finishEditingInternal();
                        loadOrderForEditing(order.id);
                      }}>
                      <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-6 md:grid-cols-8 gap-x-4 gap-y-2 text-sm">
                        <div className="sm:col-span-2 md:col-span-2 space-y-0.5"><div className="font-medium">ID: <span className="text-primary font-semibold">{order.id}</span></div><div className="text-muted-foreground text-xs">{formatDateTime(order.created_at)}</div></div>
                        <div className="sm:col-span-2 md:col-span-2 space-y-1 flex flex-col items-start"><Badge variant="outline">{order.order_type_display || order.order_type}</Badge><Badge variant={['completed', 'paid'].includes(order.status) ? 'success' : order.status === 'cancelled' ? 'destructive' : 'secondary'} className="mt-1 capitalize">{order.status_display || order.status}</Badge></div>
                        <div className="sm:col-span-2 md:col-span-2 space-y-0.5">{order.customer_name && <div className="truncate">Mijoz: <span className="font-medium">{order.customer_name}</span></div>}{(order.table_name || order.table?.name) && <div>Stol: <span className="font-medium">{order.table_name || order.table?.name}</span></div>}{order.customer_phone && <div className="text-xs text-muted-foreground">{order.customer_phone}</div>}</div>
                        <div className="sm:col-span-6 md:col-span-2 space-y-1 text-right sm:text-left md:text-right flex flex-col items-end sm:items-start md:items-end justify-between">
                          <div><div className="font-semibold text-base">{Number(order.final_price || 0).toLocaleString('uz-UZ')} so'm</div><div className="text-muted-foreground text-xs">{(order.items?.reduce((acc:number, curr:any) => acc + curr.quantity, 0) || 0)} ta mahsulot</div></div>
                          {(order.status === 'completed' || order.status === 'paid') && (
                            <Button variant="outline" size="sm" className="mt-2 text-xs h-7 px-2 py-1 self-end" onClick={(e) => { e.stopPropagation(); reorderToSameTable(order); }} disabled={isAnyLoading || reorderMutation.isPending && reorderMutation.variables?.originalOrderId === order.id}>
                              {reorderMutation.isPending && reorderMutation.variables?.originalOrderId === order.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin"/> : <Repeat className="h-3 w-3 mr-1" />} Qayta
                            </Button>
                          )}
                        </div>
                      </CardContent>
                      {!['completed', 'paid', 'cancelled'].includes(order.status) && <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><Edit className="h-4 w-4 text-muted-foreground"/></div>}
                    </Card>
                  ))}
                </div>}
            </ScrollArea></div>
            <DialogFooter className="px-1 sm:px-6 py-3 border-t"><DialogClose asChild><Button variant="outline">Yopish</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCheckoutDialog} onOpenChange={(open) => { if(!open) setSubmitEditError(null); setShowCheckoutDialog(open);}}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>To'lov: Stol {tableForCheckout?.name} {tableForCheckout?.zone && tableForCheckout.zone !== 'N/A' ? `(${tableForCheckout.zone})` : ''}</DialogTitle>
                    <DialogDescription>Buyurtma #{tableForCheckout?.active_order_id} | Jami: <span className="font-semibold text-lg ml-1">{parseFloat(tableForCheckout?.active_order_final_price || "0").toLocaleString('uz-UZ')} so'm</span></DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <Select value={paymentDetails.method} onValueChange={(value) => setPaymentDetails(p => ({ ...p, method: value, received_amount: "" }))}>
                        <SelectTrigger><SelectValue placeholder="To'lov usuli" /></SelectTrigger>
                        <SelectContent><SelectItem value="cash">Naqd</SelectItem><SelectItem value="card">Karta</SelectItem><SelectItem value="mobile">Mobil</SelectItem></SelectContent>
                    </Select>
                    {paymentDetails.method === 'cash' && (
                      <div className="space-y-1">
                        <Label htmlFor="received_amount">Qabul qilingan summa*</Label>
                        <Input id="received_amount" type="number" placeholder="Summani kiriting" value={paymentDetails.received_amount} 
                               onChange={(e) => setPaymentDetails(p => ({ ...p, received_amount: e.target.value.replace(/\D/g,'') }))} 
                               min={(parseFloat(tableForCheckout?.active_order_final_price || "0")).toString()} />
                        {parseFloat(paymentDetails.received_amount) >= parseFloat(tableForCheckout?.active_order_final_price || "0") && (
                          <p className="text-xs text-green-600 dark:text-green-400">Qaytim: {(parseFloat(paymentDetails.received_amount) - parseFloat(tableForCheckout?.active_order_final_price || "0")).toLocaleString('uz-UZ')} so'm</p>
                        )}
                      </div>
                    )}
                    {paymentDetails.method === 'mobile' && (
                      <div className="space-y-1">
                        <Label htmlFor="mobile_provider">Mobil Provayder</Label>
                        <Select value={paymentDetails.mobile_provider} onValueChange={(val) => setPaymentDetails(p => ({...p, mobile_provider: val}))}><SelectTrigger id="mobile_provider"><SelectValue/></SelectTrigger>
                           <SelectContent><SelectItem value="Click">Click</SelectItem><SelectItem value="Payme">Payme</SelectItem><SelectItem value="UzPay">UzPay</SelectItem><SelectItem value="Other">Boshqa</SelectItem></SelectContent>
                        </Select>
                      </div>
                    )}
                </div>
                 {submitEditError && <p className="text-sm text-destructive text-center -mt-2 mb-2">{submitEditError}</p>}
                <DialogFooter>
                    <Button variant="outline" onClick={() => {setShowCheckoutDialog(false); setSubmitEditError(null);}} disabled={checkoutMutation.isPending}>Bekor</Button>
                    <Button onClick={() => {
                        if (!tableForCheckout || !tableForCheckout.id) { 
                            toast.error("To'lov uchun stol topilmadi!");
                            setSubmitEditError("Stol topilmadi!");
                             return; 
                        }
                        const payload: any = { method: paymentDetails.method };
                        if (paymentDetails.method === 'cash') { 
                            if (!paymentDetails.received_amount || parseFloat(paymentDetails.received_amount) < parseFloat(tableForCheckout?.active_order_final_price || "0")) { 
                                toast.error("Qabul qilingan naqd summa xato yoki yetarli emas.");
                                setSubmitEditError("Qabul qilingan naqd summa xato yoki yetarli emas.");
                                return; 
                            } 
                            payload.received_amount = parseFloat(paymentDetails.received_amount); 
                        }
                        if (paymentDetails.method === 'mobile') { 
                            if (!paymentDetails.mobile_provider) {
                                toast.error("Mobil to'lov uchun provayder tanlanmagan.");
                                setSubmitEditError("Mobil provayder tanlanmagan.");
                                return;
                            } 
                            payload.mobile_provider = paymentDetails.mobile_provider; 
                        }
                        checkoutMutation.mutate({ tableId: tableForCheckout.id, paymentData: payload });
                    }} 
                    disabled={checkoutMutation.isPending || 
                              (paymentDetails.method === 'cash' && (!paymentDetails.received_amount || parseFloat(paymentDetails.received_amount) < parseFloat(tableForCheckout?.active_order_final_price || "0"))) ||
                              (paymentDetails.method === 'mobile' && !paymentDetails.mobile_provider)
                             }>
                        {checkoutMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : null} To'lash
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}