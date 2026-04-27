import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import { getDatabase, ref, onValue, set, update, remove, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// Cấu hình Firebase v12 mới của bạn
const firebaseConfig = {
    apiKey: "AIzaSyDgIdxEtZT8lEhPxzd19fFXEaqBvrVyENw",
    authDomain: "bndshop-a4670.firebaseapp.com",
    projectId: "bndshop-a4670",
    storageBucket: "bndshop-a4670.firebasestorage.app",
    messagingSenderId: "669286332397",
    appId: "1:669286332397:web:9c18d7f238f0c1d38b19e4",
    measurementId: "G-SNQKF8SV26"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

// --- KHỞI TẠO DỊCH VỤ MỚI ---
const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

let currentUser = null;
let currentAuthMode = 'login'; // 'login', 'register', 'reset'
let selectedAvatarFile = null;

// Đảm bảo khi trang web tải xong sẽ có sẵn 1 hàng sản phẩm
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('product-list'); 
    if (container && container.children.length === 0) {
        addProductRow();
    }
});

// Data Reference
const storeRef = ref(db, 'SunsetShopData/StoreData');

// ==========================================
// CHẾ ĐỘ THỬ NGHIỆM (OFFLINE MODE)
// ==========================================
const isOfflineMode = false; 

const OUT_KEYWORDS = ['BND', 'BNĐ', 'NƯỚC HOA', 'SERUM'];

let orders = [];
let customers = {};
let inventory = [];
let cvAccumulations = [];
let cvMonthlyStats = {};
let revenueChartInstance = null;
let isLocalAction = false; 

// ==========================================
// CÁC HÀM TIỆN ÍCH HỖ TRỢ 
// ==========================================

function removeAccents(str) {
    if (!str) return '';
    return str.toString().normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd').replace(/Đ/g, 'D')
              .toLowerCase().trim();
}

function parseDateString(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts[0].length === 4) return { y: parseInt(parts[0]), m: parseInt(parts[1]), d: parseInt(parts[2]) }; 
        return { d: parseInt(parts[0]), m: parseInt(parts[1]), y: parseInt(parts[2]) }; 
    } else if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts[2].length === 4) return { d: parseInt(parts[0]), m: parseInt(parts[1]), y: parseInt(parts[2]) }; 
        return { y: parseInt(parts[0]), m: parseInt(parts[1]), d: parseInt(parts[2]) }; 
    }
    return null;
}

const formatMoney = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

function formatCurrencyInput(input) { 
    let value = input.value.replace(/\D/g, ""); 
    if (value !== "") { input.value = new Intl.NumberFormat('en-US').format(value); } 
    else { input.value = ""; } 
}

function parseCurrency(str) { 
    if (!str) return 0; 
    return parseInt(String(str).replace(/\D/g, ""), 10) || 0; 
}

function getLocalDateString() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const vnTime = new Date(utc + (3600000 * 7)); 
    const yyyy = vnTime.getFullYear();
    const mm = String(vnTime.getMonth() + 1).padStart(2, '0');
    const dd = String(vnTime.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function dateToNumber(dateStr) {
    if (!dateStr) return 0;
    let y = 0, m = 0, d = 0;
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts[0].length === 4) { y = parseInt(parts[0]); m = parseInt(parts[1]); d = parseInt(parts[2]); }
        else { d = parseInt(parts[0]); m = parseInt(parts[1]); y = parseInt(parts[2]); }
    } else if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts[2].length === 4) { d = parseInt(parts[0]); m = parseInt(parts[1]); y = parseInt(parts[2]); }
        else { y = parseInt(parts[0]); m = parseInt(parts[1]); d = parseInt(parts[2]); }
    }
    return y * 10000 + m * 100 + d;
}

// ==========================================
// HỆ THỐNG CUSTOM MODAL
// ==========================================
function showCustomAlert(message, type = 'info') {
    const modal = document.getElementById('customAlertModal');
    const iconDiv = document.getElementById('customAlertIcon');
    const titleEl = document.getElementById('customAlertTitle');
    const messageEl = document.getElementById('customAlertMessage');

    let iconHtml = ''; let titleClass = ''; let iconBgClass = ''; let titleText = 'Thông báo';

    switch(type) {
        case 'success': iconHtml = '<i class="fa-solid fa-circle-check"></i>'; titleClass = 'text-emerald-600'; iconBgClass = 'bg-emerald-50 text-emerald-500 border-emerald-100'; titleText = 'Thành công'; break;
        case 'error': iconHtml = '<i class="fa-solid fa-circle-xmark"></i>'; titleClass = 'text-red-600'; iconBgClass = 'bg-red-50 text-red-500 border-red-100'; titleText = 'Lỗi hệ thống'; break;
        case 'warning': iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>'; titleClass = 'text-amber-600'; iconBgClass = 'bg-amber-50 text-amber-500 border-amber-100'; titleText = 'Cảnh báo'; break;
        default: iconHtml = '<i class="fa-solid fa-circle-info"></i>'; titleClass = 'text-[#034C5F]'; iconBgClass = 'bg-[#FDF5F4] text-[#034C5F] border-[#F9C4BA]'; titleText = 'Thông báo';
    }

    iconDiv.className = `w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-inner border ${iconBgClass}`;
    iconDiv.innerHTML = iconHtml;
    titleEl.className = `text-xl font-black mb-2 uppercase ${titleClass}`;
    titleEl.innerText = titleText;
    messageEl.innerText = message;

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);
}

function closeCustomAlert() {
    const modal = document.getElementById('customAlertModal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function showCustomConfirm(message, onConfirmCallback) {
    const modal = document.getElementById('customConfirmModal');
    const messageEl = document.getElementById('customConfirmMessage');
    const btnCancel = document.getElementById('customConfirmCancel');
    const btnOk = document.getElementById('customConfirmOk');

    messageEl.innerText = message;

    const newBtnCancel = btnCancel.cloneNode(true);
    const newBtnOk = btnOk.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);

    const closeModal = () => {
        modal.classList.add('opacity-0');
        modal.querySelector('div').classList.remove('scale-100');
        modal.querySelector('div').classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    newBtnCancel.addEventListener('click', closeModal);
    newBtnOk.addEventListener('click', () => {
        closeModal();
        if(onConfirmCallback) onConfirmCallback();
    });

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);
}

// ==========================================
// ĐỒNG BỘ DỮ LIỆU (LOCAL STORAGE & FIREBASE)
// ==========================================
function saveToLocal() {
    localStorage.setItem('BNDShop_OfflineData', JSON.stringify({
        orders, customers, inventory, cvAccumulations, cvMonthlyStats
    }));
}

function loadFromLocal() {
    const data = localStorage.getItem('BNDShop_OfflineData');
    if (data) {
        try {
            const parsed = JSON.parse(data);
            orders = parsed.orders || [];
            customers = parsed.customers || {};
            inventory = parsed.inventory || [];
            cvAccumulations = parsed.cvAccumulations || [];
            cvMonthlyStats = parsed.cvMonthlyStats || {};
        } catch (e) {
            console.error("Lỗi đọc LocalStorage", e);
        }
    }
}

function syncData(updates = null) {
    saveToLocal(); 
    if (isOfflineMode) return Promise.resolve(); 

    if (updates) {
        return update(storeRef, updates).catch(err => showCustomAlert("Lỗi đồng bộ: " + err.message, "error"));
    } else {
        return set(storeRef, {
            v11_orders: orders.reduce((acc, o) => { acc[o.id] = o; return acc; }, {}),
            v11_customers: customers,
            v11_inventory: inventory,
            v11_cv_accumulations: cvAccumulations,
            v11_cv_monthly: cvMonthlyStats
        }).catch(err => showCustomAlert("Lỗi đồng bộ: " + err.message, "error"));
    }
}

function initDataSync() {
    if (isOfflineMode) {
        console.log("ĐANG CHẠY CHẾ ĐỘ OFFLINE - Tải dữ liệu từ LocalStorage");
        loadFromLocal();
        refreshAllViews();
        return;
    }

    onValue(storeRef, (snapshot) => {
        const data = snapshot.val() || {};
        let rawOrders = data.v11_orders || {};
        
        orders = Object.keys(rawOrders).map(key => {
            let obj = rawOrders[key];
            if (!obj) return null;
            obj.id = key; 
            if (!obj.timestamp) obj.timestamp = parseInt(key) || Date.now();
            return obj;
        }).filter(obj => obj !== null).sort((a, b) => b.timestamp - a.timestamp);

        customers = data.v11_customers || {};
        inventory = data.v11_inventory || [];
        cvAccumulations = data.v11_cv_accumulations || [];
        cvMonthlyStats = data.v11_cv_monthly || {};

        saveToLocal(); 

        if (!isLocalAction) refreshAllViews();
    });
}

let pendingRender = false;

function refreshAllViews() {
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    const isInputActive = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

    if (isInputActive) {
        pendingRender = true;
        return; 
    }

    if(!document.getElementById('view-orders').classList.contains('hidden')) renderTable();
    if(!document.getElementById('view-customers').classList.contains('hidden')) renderCustomerCRM();
    if(!document.getElementById('view-inventory').classList.contains('hidden')) renderInventory();
    if(!document.getElementById('view-analytics').classList.contains('hidden')) renderAnalytics();
    if(!document.getElementById('view-cv').classList.contains('hidden')) renderAllCV();
    
    checkAndShowEvents();
    pendingRender = false; 
}

document.addEventListener('focusout', (e) => {
    if (pendingRender) {
        setTimeout(() => {
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
                refreshAllViews();
            }
        }, 150);
    }
});

// ==========================================
// CÁC HÀM BACKUP & RESTORE
// ==========================================
function backupData() {
    const data = { version: "12.0", timestamp: new Date().toISOString(), orders, customers, inventory, cvAccumulations, cvMonthlyStats };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `SunsetShop_BACKUP_${new Date().toISOString().slice(0,10)}.json`; a.click();
    showToast("Đã tải xuống file sao lưu!");
}

function restoreData(input) {
    const file = input.files[0];
    if (!file) return;

    showCustomConfirm("CẢNH BÁO: Toàn bộ dữ liệu trên hệ thống sẽ bị GHI ĐÈ bằng file này. Bạn có chắc chắn muốn tiếp tục?", () => {
        
        showToast("Đang đọc file và đồng bộ lên Firebase... Vui lòng đợi!");
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.orders && Array.isArray(data.orders) && data.customers && typeof data.customers === 'object') {
                    
                    isLocalAction = true;
                    
                    orders = data.orders;
                    customers = data.customers;
                    inventory = data.inventory || [];
                    cvAccumulations = data.cvAccumulations || [];
                    cvMonthlyStats = data.cvMonthlyStats || {};
                    
                    syncData().then(() => {
                        refreshAllViews();
                        isLocalAction = false; 
                        showCustomAlert("Đã khôi phục và lưu dữ liệu lên Firebase thành công!", "success"); 
                    }).catch(err => {
                        isLocalAction = false;
                        showCustomAlert("Có lỗi khi đẩy lên Firebase: " + err.message, "error");
                    });

                } else {
                    showCustomAlert("File không hợp lệ hoặc không phải file Backup của BNDShop.", "error");
                }
            } catch (err) { 
                showCustomAlert("File bị lỗi định dạng (Corrupted JSON): " + err.message, "error"); 
            }
        };
        reader.readAsText(file);
    });
    
    input.value = ''; 
}

// ==========================================
// QUẢN LÝ KHO
// ==========================================
function saveInventory() { syncData({ 'v11_inventory': inventory }); }
function addInventoryProduct() {
    const name = document.getElementById('invName').value.trim();
    const price = parseCurrency(document.getElementById('invPrice').value);
    const qty = parseInt(document.getElementById('invQty').value) || 0;
    if(!name) return showToast("Nhập tên sản phẩm!");
    if(inventory.find(p => p.name.toLowerCase() === name.toLowerCase())) return showCustomAlert("Sản phẩm đã tồn tại trong kho!", "warning");
    inventory.push({ name, price: price || 0, qty: qty });
    document.getElementById('invName').value = ''; document.getElementById('invPrice').value = ''; document.getElementById('invQty').value = '';
    saveInventory(); renderInventory(); showToast("Đã nhập kho!");
}

function updateInventoryProduct(index, field, value) {
    if(field === 'qty') inventory[index].qty = parseInt(value) || 0;
    else if(field === 'price') inventory[index].price = parseCurrency(value) || 0;
    else inventory[index][field] = value;
    
    syncData({ [`v11_inventory/${index}/${field}`]: inventory[index][field] });
}

function deleteInventoryProduct(index) { 
    showCustomConfirm("Xóa sản phẩm này khỏi kho?", () => {
        inventory.splice(index, 1); 
        saveInventory(); renderInventory(); showToast("Đã xóa khỏi kho!");
    }); 
}

function renderInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    const filterMode = document.getElementById('inventoryFilter') ? document.getElementById('inventoryFilter').value : 'all';
    let html = '';
    inventory.forEach((p, originalIdx) => {
        const isOut = OUT_KEYWORDS.some(k => p.name.toUpperCase().includes(k));
        if (filterMode === 'out' && !isOut) return;
        if (filterMode === 'vnl' && isOut) return;
        const stockClass = p.qty <= 5 ? "stock-low" : "stock-ok";
        html += `
        <tr class="hover:bg-white transition-colors">
            <td class="p-3"><input type="text" value="${p.name}" onchange="updateInventoryProduct(${originalIdx}, 'name', this.value)" class="crm-input font-bold text-[#034C5F]"></td>
            <td class="p-3"><input type="text" inputmode="numeric" value="${new Intl.NumberFormat('en-US').format(p.price)}" oninput="formatCurrencyInput(this)" onchange="updateInventoryProduct(${originalIdx}, 'price', this.value)" class="crm-input text-[#EE6457]"></td>
            <td class="p-3 text-center"><input type="number" value="${p.qty}" onchange="updateInventoryProduct(${originalIdx}, 'qty', this.value)" class="crm-input text-center ${stockClass}" style="font-size:14px;"></td>
            <td class="p-3 text-right"><button onclick="deleteInventoryProduct(${originalIdx})" class="text-slate-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

// ==========================================
// TÍNH TOÁN & THÊM ĐƠN HÀNG
// ==========================================
function updateQty(btn, change) {
    const input = btn.parentElement.querySelector('.p-qty');
    let newVal = (parseInt(input.value) || 0) + change;
    input.value = newVal < 1 ? 1 : newVal;
    calculateTotal();
}

function addProductRow(name = '', price = '', qty = 1) {
    const container = document.getElementById('product-list'); 
    const formattedPrice = price ? new Intl.NumberFormat('en-US').format(price) : '';

    const div = document.createElement('div');
    div.className = "product-row grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm";
    
    div.innerHTML = `
        <div class="col-span-6 relative">
            <input type="text" class="form-input text-xs font-bold p-name" placeholder="Tên sản phẩm..." value="${name}">
            <div class="product-suggestions custom-suggestion-box"></div>
        </div>
        <div class="col-span-3">
            <input type="text" class="form-input text-xs text-center p-price" placeholder="Giá" value="${formattedPrice}" oninput="formatCurrencyInput(this); calculateTotal()">
        </div>
        <div class="col-span-2 flex shadow-sm rounded-lg">
            <button type="button" onclick="updateQty(this, -1)" class="w-8 bg-slate-50 border border-slate-200 border-r-0 rounded-l-lg flex justify-center items-center text-slate-500 hover:bg-slate-200 hover:text-[#EE6457] transition-colors focus:outline-none shrink-0">
                <i class="fa-solid fa-minus text-[10px]"></i>
            </button>
            <input type="number" class="form-input text-xs text-center p-qty !px-0 !rounded-none !shadow-none z-10 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value="${qty}" min="1" oninput="calculateTotal()">
            <button type="button" onclick="updateQty(this, 1)" class="w-8 bg-slate-50 border border-slate-200 border-l-0 rounded-r-lg flex justify-center items-center text-slate-500 hover:bg-slate-200 hover:text-[#034C5F] transition-colors focus:outline-none shrink-0">
                <i class="fa-solid fa-plus text-[10px]"></i>
            </button>
        </div>
        <div class="col-span-1 text-right">
            <button type="button" onclick="this.closest('.product-row').remove(); calculateTotal()" class="text-slate-300 hover:text-red-500">
                <i class="fa-solid fa-circle-xmark"></i>
            </button>
        </div>
    `;
    container.appendChild(div);
}

function calculateTotal() {
    let subtotal = 0;
    document.querySelectorAll('.product-row').forEach(row => {
        const price = parseCurrency(row.querySelector('.p-price').value) || 0;
        const qty = parseFloat(row.querySelector('.p-qty').value) || 0;
        if (row.querySelector('.p-name').value) subtotal += price * qty;
    });

    const ship = parseCurrency(document.getElementById('shipFee').value) || 0;
    
    const dValStr = document.getElementById('discountVal').value.replace(/,/g, '');
    const dVal = parseCurrency(dValStr) || 0;
    const dType = document.getElementById('discountType').value;
    
    let disc = dType === 'percent' ? subtotal * (dVal/100) : dVal;
    let total = Math.max(0, subtotal - disc + ship);
    
    document.getElementById('finalTotal').innerText = formatMoney(total);
    return { subtotal, total };
}

function saveOrder() {
    const phone = document.getElementById('custPhone').value.trim();
    const name = document.getElementById('custName').value.trim();
    const addr = document.getElementById('custAddr').value;
    const type = document.getElementById('custType').value;
    const isEdit = document.getElementById('editOrderId').value !== "";
    
    if(!phone || !name) return showCustomAlert("Vui lòng nhập Tên hoặc SĐT!", "warning");
    
    let products = [];
    let valid = true;

    document.querySelectorAll('.product-row').forEach((row) => {
        const nameInput = row.querySelector('.p-name').value;
        const priceInput = row.querySelector('.p-price').value;
        const qtyInput = parseInt(row.querySelector('.p-qty').value) || 1;
        
        if(!nameInput || !priceInput) {
            valid = false;
        } else {
            products.push({ name: nameInput, price: parseCurrency(priceInput) || 0, qty: qtyInput });
        }
    });

    if(!valid || products.length === 0) return showCustomAlert("Kiểm tra lại thông tin sản phẩm!", "warning");
    
    const id = isEdit ? document.getElementById('editOrderId').value : Date.now().toString();
    const existingOrder = isEdit ? orders.find(x => x.id == id) : null;
    
    if (isEdit && existingOrder) {
        existingOrder.products.forEach(oldP => {
            const invItem = inventory.find(i => i.name.toLowerCase() === oldP.name.toLowerCase());
            if (invItem) invItem.qty = Number(invItem.qty) + Number(oldP.qty);
        });
    }

    products.forEach(p => {
        const invItem = inventory.find(i => i.name.toLowerCase() === p.name.toLowerCase());
        if (invItem) {
            invItem.qty = Math.max(0, Number(invItem.qty) - Number(p.qty));
        } else {
            inventory.push({ name: p.name, price: p.price, qty: 0 });
        }
    });
    
    if(!customers[phone]) {
        customers[phone] = { name, address: addr, birthday: '', job: '', note: '', anniversary: document.getElementById('orderDate').value, status: 'Vãn lai', timestamp: Date.now() };
    } else { 
        customers[phone].name = name; 
        customers[phone].address = addr; 
        if (!customers[phone].anniversary) customers[phone].anniversary = document.getElementById('orderDate').value;
    }

    const { subtotal, total } = calculateTotal();
    
    const orderTimestamp = (isEdit && existingOrder) ? existingOrder.timestamp : Date.now();

    const order = { 
        id, 
        timestamp: orderTimestamp, 
        customer: { name, phone, addr, type }, 
        products, 
        payMethod: document.getElementById('payMethod').value, 
        shipFee: parseCurrency(document.getElementById('shipFee').value) || 0, // <--- SỬA TẠI ĐÂY
        discount: { val: parseCurrency(document.getElementById('discountVal').value) || 0, type: document.getElementById('discountType').value }, // <--- SỬA TẠI ĐÂY
        orderDate: document.getElementById('orderDate').value,
        date: document.getElementById('shipDate').value, 
        deliveryDate: document.getElementById('deliveryDate').value, 
        note: document.getElementById('orderNote').value.trim(), 
        subtotal, 
        total, 
        status: existingOrder ? existingOrder.status : "Đợi gửi",
        isPaid: existingOrder ? (existingOrder.isPaid || false) : false 
    };

    if (isEdit) {
        const index = orders.findIndex(x => x.id == id);
        if (index !== -1) orders[index] = order;
    } else {
        orders.unshift(order); 
    }

    orders.sort((a, b) => b.timestamp - a.timestamp);

    let updates = {};
    updates[`v11_orders/${id}`] = order;
    updates[`v11_customers/${phone}`] = customers[phone];
    updates[`v11_inventory`] = inventory;

    syncData(updates).then(() => {
        resetForm(); 
        renderTable(); 
        showToast("Đã lưu đồng bộ thành công!");
    }).catch((error) => {
        showCustomAlert("Có lỗi khi lưu đơn hàng: " + error.message, "error");
    });
}

function renderTable() {
    const fStart = document.getElementById('listFilterStart').value;
    const fEnd = document.getElementById('listFilterEnd').value;
    const fType = document.getElementById('listFilterType').value;
    const search = document.getElementById('searchOrderInput').value.toLowerCase();
    
    let filtered = orders.filter(o => {
        const targetDate = o.orderDate || o.date;
        const dateMatch = (!fStart || targetDate >= fStart) && (!fEnd || targetDate <= fEnd);
        const typeMatch = (fType === 'all' || o.customer.type === fType);
        const searchMatch = !search || o.customer.name.toLowerCase().includes(search) || o.customer.phone.includes(search);
        return dateMatch && typeMatch && searchMatch;
    });
    
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    document.getElementById('orderTableBody').innerHTML = filtered.map(o => {
        const formattedShipDate = o.date ? o.date.split('-').reverse().join('/') : '';
        let shortPayMethod = "COD";
        if (o.payMethod === "Chuyển khoản") shortPayMethod = "CK";
        else if (o.payMethod === "Tiền mặt") shortPayMethod = "TM";

        let paidStyle = o.isPaid 
            ? "background-color: #10b981; border-color: #059669; color: #ffffff;"
            : "background-color: #f1f5f9; border-color: #e2e8f0; color: #94a3b8;";

        let shipDateStyle = o.status === 'Đợi gửi' 
            ? "bg-[#EE6457]/10 text-[#EE6457] border border-[#EE6457]/30" 
            : "bg-slate-100 text-slate-400 border border-slate-200 opacity-60"; 

        return `
        <tr class="hover:bg-[#FDF5F4]/50 transition-colors">
            <td class="p-4">
                <div class="flex items-start gap-2">
                    <div>
                        <b>${o.customer.name}</b> 
                        <span class="text-[9px] px-1.5 py-0.5 rounded ${o.customer.type === 'ttd' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'} font-bold uppercase ml-1">${o.customer.type === 'ttd' ? 'TTD' : 'Mới'}</span>
                        <br><span class="text-xs text-[#97BEC6]">${o.customer.phone}</span>
                    </div>
                    <button onclick="copyCustomerInfo('${o.customer.name.replace(/'/g, "\\'")}', '${o.customer.phone}', '${o.customer.addr.replace(/'/g, "\\'").replace(/\n/g, ' ')}')">
                        <i class="fa-solid fa-copy text-[10px]"></i>
                    </button>
                </div>
            </td>
            <td class="p-4 text-xs text-slate-500 line-clamp-1">${o.products.map(p => `${p.name} (x${p.qty})`).join(', ')}</td>
            <td class="p-4 text-center">
                    <span id="ship-badge-${o.id}" class="${shipDateStyle} font-black px-3 py-1 rounded-lg text-[11px] shadow-sm whitespace-nowrap transition-all">
                    <i class="fa-solid fa-truck-fast mr-1"></i>${formattedShipDate}
                </span>
            </td>

            <td class="p-4 text-center font-black text-[#034C5F] text-xs">
                ${shortPayMethod}
            </td>
            <td class="p-4 text-center">
                <select id="status-select-${o.id}" onchange="changeOrderStatus('${o.id}', this.value)" 
                    class="text-[11px] font-bold rounded-full px-3 py-1 cursor-pointer transition-all appearance-none border-none outline-none focus:ring-0"
                    style="
                        background-color: ${getStatusStyles(o.status).bg} !important; 
                        color: ${getStatusStyles(o.status).text} !important;
                        text-align: center;
                        width: auto;
                        min-width: 100px;
                    ">
                    <option value="Đợi gửi" ${o.status === 'Đợi gửi' ? 'selected' : ''} style="background: white; color: #000000;">Đợi gửi</option>
                    <option value="Đang giao" ${o.status === 'Đang giao' ? 'selected' : ''} style="background: white; color: #1e40af;">Đang giao 🚚</option>
                    <option value="Thành công" ${o.status === 'Thành công' ? 'selected' : ''} style="background: white; color: #065f46;">Thành công ✅</option>
                    <option value="Chăm sóc" ${o.status === 'Chăm sóc' ? 'selected' : ''} style="background: white; color: #5b21b6;">Chăm sóc 💬</option>
                    <option value="HD sử dụng" ${o.status === 'HD sử dụng' ? 'selected' : ''} style="background: white; color: #92400e;">HD sử dụng 📖</option>
                    <option value="Xử lý" ${o.status === 'Xử lý' ? 'selected' : ''} style="background: white; color: #991b1b;">Xử lý ⚙️</option>
                    <option value="Đơn BOM 💣" ${o.status === 'Đơn BOM 💣' ? 'selected' : ''} style="background: white; color: #7f1d1d;">Đơn Bom 💣</option>
                    <option value="Đã Hủy" ${o.status === 'Đã Hủy' ? 'selected' : ''} style="background: white; color: #374151;">Đã Hủy ❌</option>
                </select>
            </td>

            <td class="p-4 text-right font-bold text-[#EE6457]">${formatMoney(o.total)}</td>
           <td class="p-4 text-center">
                <button id="btn-paid-${o.id}" onclick="togglePaidStatus('${o.id}')" 
                    class="w-7 h-7 rounded-lg border flex items-center justify-center transition-all hover:scale-110 shadow-sm mx-auto" 
                    style="${paidStyle}" title="Đánh dấu đã thu tiền">
                    <i class="fa-solid fa-check text-sm"></i>
                </button>
            </td>
            <td class="p-4 text-center">
                <div class="flex justify-center gap-3">
                    <button onclick="openInvoice('${o.id}')" class="text-[#97BEC6] hover:text-[#034C5F]"><i class="fa-solid fa-receipt text-lg"></i></button>
                    <button onclick="editOrder('${o.id}')" class="text-[#97BEC6] hover:text-[#034C5F]"><i class="fa-solid fa-pen-to-square text-lg"></i></button>
                    <button onclick="deleteOrder('${o.id}')" class="text-slate-200 hover:text-red-400"><i class="fa-solid fa-trash text-lg"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}


function changeOrderStatus(id, newStatus) {
    const index = orders.findIndex(o => o.id == id);
    if (index !== -1) {
        orders[index].status = newStatus;
        const selectEl = document.getElementById(`status-select-${id}`);
        if (selectEl) {
            selectEl.value = newStatus; 
            const styles = getStatusStyles(newStatus);
            selectEl.style.setProperty('background-color', styles.bg, 'important');
            selectEl.style.setProperty('color', styles.text, 'important');
        }
        const shipBadge = document.getElementById(`ship-badge-${id}`);
        if (shipBadge) shipBadge.className = newStatus === 'Đợi gửi' ? "bg-[#EE6457]/10 text-[#EE6457] border border-[#EE6457]/30 font-black px-3 py-1 rounded-lg text-[11px] shadow-sm whitespace-nowrap" : "bg-slate-100 text-slate-400 border border-slate-200 opacity-60 font-black px-3 py-1 rounded-lg text-[11px] shadow-sm whitespace-nowrap";
        
        if (!document.getElementById('view-analytics').classList.contains('hidden')) renderAnalytics();
        
        syncData({ [`v11_orders/${id}/status`]: newStatus });
    }
}

function togglePaidStatus(id) {
    const orderIndex = orders.findIndex(x => x.id == id);
    if (orderIndex !== -1) {
        const newStatus = !orders[orderIndex].isPaid;
        orders[orderIndex].isPaid = newStatus;
        const btn = document.getElementById(`btn-paid-${id}`);
        if(btn) btn.style.cssText = newStatus ? "background-color: #10b981; border-color: #059669; color: #ffffff;" : "background-color: #f1f5f9; border-color: #e2e8f0; color: #94a3b8;";
        if(!document.getElementById('view-analytics').classList.contains('hidden')) renderAnalytics(); 
        
        syncData({ [`v11_orders/${id}/isPaid`]: newStatus }).catch(err => {
            orders[orderIndex].isPaid = !newStatus; renderTable();
        });
    }
}

function deleteOrder(id) { 
    showCustomConfirm("Bạn có chắc chắn muốn xóa đơn hàng này và hoàn lại số lượng vào kho?", () => {
        const orderIndex = orders.findIndex(x => x.id == id);
        if (orderIndex === -1) return;
        const orderToDelete = orders[orderIndex];

        if (orderToDelete.products && Array.isArray(orderToDelete.products)) {
            orderToDelete.products.forEach(p => {
                const invItem = inventory.find(i => i.name.toLowerCase() === p.name.toLowerCase());
                if (invItem) invItem.qty = Number(invItem.qty) + Number(p.qty); 
            });
        }
        orders.splice(orderIndex, 1); 

        let updates = {};
        updates[`v11_orders/${id}`] = null;
        updates[`v11_inventory`] = inventory;

        syncData(updates).then(() => {
            renderTable(); renderInventory();
            showToast(isOfflineMode ? "Xóa thành công (Offline)!" : "Xóa thành công và đã hoàn kho!");
        });
    });
}

function getStatusStyles(status) {
    const styles = {
        'Đợi gửi': { bg: '#f1f5f9', text: '#000000' }, 'Đang giao': { bg: '#9ce4ff', text: '#000000' }, 'Thành công': { bg: '#a4ff9c', text: '#000000' },   
        'Chăm sóc': { bg: '#00ffe5', text: '#000000' }, 'HD sử dụng': { bg: '#fef3c7', text: '#000000' }, 'Xử lý': { bg: '#fee2e2', text: '#000000' },        
        'Đơn BOM 💣': { bg: '#fca5a5', text: '#ffffff' }, 'Đã Hủy': { bg: '#f3f4f6', text: '#374151' }        
    };
    return styles[status] || { bg: '#ffffff', text: '#000000' };
}

// ==========================================
// KHÁCH HÀNG CRM
// ==========================================
function saveCRM() { syncData({ 'v11_customers': customers }); }

function addManualCustomer() {
    const phone = document.getElementById('newCustPhone').value.trim();
    const name = document.getElementById('newCustName').value.trim();
    const addr = document.getElementById('newCustAddr').value.trim();
    if (!phone || !name) return showToast("Vui lòng nhập đầy đủ Tên và Số điện thoại!");
    if (customers[phone]) return showToast("Khách hàng với SĐT này đã tồn tại!");
    customers[phone] = { name: name, address: addr, birthday: '', job: '', note: '', anniversary: '', status: 'Vãn lai', timestamp: Date.now() };
    saveCRM(); renderCustomerCRM();
    document.getElementById('newCustPhone').value = ''; document.getElementById('newCustName').value = ''; document.getElementById('newCustAddr').value = '';
    showToast("Đã thêm khách hàng mới thành công!");
}

function updateCustomerField(p, f, v) { 
    if(customers[p]) { 
        customers[p][f] = v; 
        
        syncData({ [`v11_customers/${p}/${f}`]: v }); 
        
        if(f === 'birthday' || f === 'anniversary') {
            checkAndShowEvents();
        }
    } 
}

function deleteCustomer(phoneId) {
    showCustomConfirm("Bạn có chắc chắn muốn xóa khách hàng này?", () => {
        delete customers[phoneId];
        saveCRM(); renderCustomerCRM();
        showToast("Đã xóa khách hàng thành công!");
    });
}

function renderCustomerCRM() {
    const tbody = document.getElementById('customerTableBody');
    if(!tbody) return;
    
    const spendings = {}; 
    orders.forEach(o => { if(o && o.customer && o.customer.phone) spendings[o.customer.phone] = (spendings[o.customer.phone] || 0) + o.total; });

    const CUSTOMER_STATUS_STYLES = { "Vip": "background-color: #fee2e2; color: #dc2626; font-weight: bold; border: 1px solid #f87171;", "Vãn lai": "background-color: #fef9c3; color: #a16207; font-weight: bold; border: 1px solid #facc15;", "Thân Thiết": "background-color: #dcfce7; color: #15803d; font-weight: bold; border: 1px solid #4ade80;", "Đơn 1": "background-color: #dbeafe; color: #1d4ed8; font-weight: bold; border: 1px solid #60a5fa;", "Đơn 2": "background-color: #f3e8ff; color: #7e22ce; font-weight: bold; border: 1px solid #c084fc;", "Đơn 3": "background-color: #fce7f3; color: #be185d; font-weight: bold; border: 1px solid #f472b6;", "Bom": "background-color: #f3f4f6; color: #4b5563; font-weight: bold; border: 1px solid #9ca3af;", "Ngừng kết nối": "background-color: #ffedd5; color: #c2410c; font-weight: bold; border: 1px solid #fb923c;", "Chăm sóc": "background-color: #ecfdf5; color: #047857; font-weight: normal;" };
    const sortMode = document.getElementById('customerSortOrder').value; 
    let keys = Object.keys(customers);

        const searchInput = document.getElementById('searchCustomerInput');
    if (searchInput && searchInput.value) {
        const searchTerms = removeAccents(searchInput.value.trim()).split(' ');
        
        keys = keys.filter(phone => {
            const customerName = customers[phone].name ? removeAccents(customers[phone].name) : '';
            return searchTerms.every(term => phone.includes(term) || customerName.includes(term));
        });
    }

    keys.sort((a, b) => {
        const cA = customers[a] || {}; const cB = customers[b] || {};
        if (sortMode === 'newest') return (cB.timestamp || 0) - (cA.timestamp || 0);
        else if (sortMode === 'oldest') return (cA.timestamp || 0) - (cB.timestamp || 0);
        else if (sortMode === 'name') return (cA.name || "").localeCompare(cB.name || "");
        else if (sortMode === 'spending') return (spendings[b] || 0) - (spendings[a] || 0); 
        return 0;
    });
    
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDate = today.getDate();

    tbody.innerHTML = keys.map((phone, index) => {
        const c = customers[phone]; if(!c) return ""; 
        const currentStatus = c.status || 'Vãn lai'; 
        const statusStyle = CUSTOMER_STATUS_STYLES[currentStatus] || "";
        const safePhone = phone.replace(/'/g, "\\'");
        
        const bdayData = parseDateString(c.birthday);
        const anniData = parseDateString(c.anniversary);
        let bdayClass = (bdayData && bdayData.d === todayDate && bdayData.m === todayMonth) ? "birthday-today" : "bg-light-pink";
        let anniClass = (anniData && anniData.d === todayDate && anniData.m === todayMonth) ? "anniversary-today" : "bg-light-blue";
        
        return `<tr>
            <td class="p-3 text-center font-bold text-slate-400">${index + 1}</td>
            <td class="p-3"><textarea rows="1" onchange="updateCustomerField('${safePhone}', 'name', this.value)" class="crm-textarea font-bold text-[#034C5F]">${c.name || ''}</textarea></td>
            <td class="p-3">${phone}</td>
            <td class="p-3"><textarea rows="1" onchange="updateCustomerField('${safePhone}', 'address', this.value)" class="crm-textarea">${c.address||''}</textarea></td>
            <td class="p-3"><input type="text" data-phone="${safePhone}" data-field="birthday" value="${c.birthday||''}" class="crm-input cursor-pointer flatpickr-birthday ${bdayClass}" placeholder="DD/MM/YYYY"></td>
            <td class="p-3"><input type="text" data-phone="${safePhone}" data-field="anniversary" value="${c.anniversary||''}" class="crm-input cursor-pointer flatpickr-anniversary text-[#EE6457] ${anniClass}" placeholder="DD/MM/YYYY"></td>
            <td class="p-3"><textarea rows="1" onchange="updateCustomerField('${safePhone}', 'job', this.value)" class="crm-textarea">${c.job||''}</textarea></td>
            <td class="p-3"><select onchange="updateCustomerField('${safePhone}', 'status', this.value); renderCustomerCRM();" class="crm-input rounded-md px-2 py-1 transition-all" style="${statusStyle}"><option value="Vip" ${currentStatus === 'Vip' ? 'selected' : ''}>Vip 🍀</option><option value="Vãn lai" ${currentStatus === 'Vãn lai' ? 'selected' : ''}>Vãn lai 🍃</option><option value="Thân Thiết" ${currentStatus === 'Thân Thiết' ? 'selected' : ''}>Thân thiết 🌺</option><option value="Đơn 1" ${currentStatus === 'Đơn 1' ? 'selected' : ''}> Đơn 1 💙</option><option value="Đơn 2" ${currentStatus === 'Đơn 2' ? 'selected' : ''}> Đơn 2 💜</option><option value="Đơn 3" ${currentStatus === 'Đơn 3' ? 'selected' : ''}> Đơn 3 🩷</option><option value="Bom" ${currentStatus === 'Bom' ? 'selected' : ''}>Bom 💣</option><option value="Ngừng kết nối" ${currentStatus === 'Ngừng kết nối' ? 'selected' : ''}>Ngừng kết nối ❌</option><option value="Chăm sóc" ${currentStatus === 'Chăm sóc' ? 'selected' : ''}>Chăm sóc</option></select></td>
            <td class="p-3"><textarea rows="1" onchange="updateCustomerField('${safePhone}', 'note', this.value)" class="crm-textarea italic text-slate-600">${c.note||''}</textarea></td>
            <td class="p-3 text-right font-black text-[#034C5F]">${formatMoney(spendings[phone]||0)}</td>
            <td class="p-3 text-center"><button onclick="deleteCustomer('${safePhone}')" class="text-slate-300 hover:text-red-500 transition-colors"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    }).join('');

    flatpickr(".flatpickr-birthday, .flatpickr-anniversary", {
        locale: "vn",
        dateFormat: "Y-m-d", 
        altInput: true,
        altFormat: "d/m/Y", 
        minDate: "1950-01-01",
        maxDate: "2060-12-31",
        onChange: function(selectedDates, dateStr, instance) {
            const phone = instance.element.getAttribute('data-phone');
            const field = instance.element.getAttribute('data-field');
            updateCustomerField(phone, field, dateStr);
        }
    });
}

// ==========================================
// TÍCH LŨY & CV THÁNG
// ==========================================
function saveCVSync() { syncData({ 'v11_cv_accumulations': cvAccumulations, 'v11_cv_monthly': cvMonthlyStats }); }

function renderAllCV() { renderCVAccumulations(); renderCVMonthlyStats(); renderCVSummary(); }

function addCVAccumulation() {
    let amount = parseCurrency(document.getElementById('cvAccAmount').value);
    let date = document.getElementById('cvAccDate').value;
    let method = document.getElementById('cvAccMethod').value;
    let note = document.getElementById('cvAccNote').value;
    let editId = document.getElementById('editCvAccId').value;

    if (!amount || !date) return showToast("Vui lòng nhập số tiền và ngày tích!");

    if(editId) {
        let idx = cvAccumulations.findIndex(a => a.id == editId);
        if(idx !== -1) {
            cvAccumulations[idx].amount = amount; cvAccumulations[idx].date = date; cvAccumulations[idx].method = method; cvAccumulations[idx].note = note;
        }
        document.getElementById('editCvAccId').value = ""; document.getElementById('btnSaveCVAcc').innerText = "THÊM MỚI"; 
    } else {
        cvAccumulations.push({ id: Date.now(), amount: amount, date: date, method: method, checked: false, note: note });
    }

   document.getElementById('cvAccAmount').value = ''; document.getElementById('cvAccDate').value = getLocalDateString(); document.getElementById('cvAccNote').value = '';
    cvAccumulations.sort((a,b) => new Date(b.date) - new Date(a.date));
    saveCVSync(); renderAllCV(); showToast("Đã lưu tích lũy thành công!");
}

function editCVAccumulation(id) {
    let acc = cvAccumulations.find(a => a.id == id);
    if(!acc) return;
    document.getElementById('editCvAccId').value = acc.id;
    document.getElementById('cvAccAmount').value = new Intl.NumberFormat('en-US').format(acc.amount);
    document.getElementById('cvAccDate').value = acc.date;
    document.getElementById('cvAccMethod').value = acc.method;
    document.getElementById('cvAccNote').value = acc.note || '';
    document.getElementById('btnSaveCVAcc').innerText = "CẬP NHẬT";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleCVCheck(id) {
    let acc = cvAccumulations.find(a => a.id == id); 
    if(acc) {
        acc.checked = !acc.checked;
        saveCVSync(); renderCVAccumulations();
    }
}

function deleteCVAccumulation(id) {
    showCustomConfirm("Bạn có chắc chắn muốn xóa dòng tích lũy này?", () => {
        cvAccumulations = cvAccumulations.filter(a => a.id !== id);
        saveCVSync(); renderAllCV(); showToast("Đã xóa tích lũy!");
    });
}

function renderCVAccumulations() {
    const tbody = document.getElementById('cvAccTableBody');
    const filterMonth = document.getElementById('cvAccFilterMonth').value;
    let filtered = filterMonth ? cvAccumulations.filter(acc => acc.date && acc.date.startsWith(filterMonth)) : cvAccumulations;

    tbody.innerHTML = filtered.map((acc) => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-4 font-bold text-[#034C5F]">${acc.date.split('-').reverse().join('/')}</td>
            <td class="p-4 text-right font-black text-[#EE6457] text-[16px]">${new Intl.NumberFormat('en-US').format(acc.amount)} đ</td>
            <td class="p-4 text-center"><span class="px-2 py-1 bg-slate-100 rounded-md text-xs font-bold text-slate-600">${acc.method}</span></td>
            <td class="p-4 text-xs italic text-slate-500">${acc.note || ''}</td>
            <td class="p-4 text-center"><input type="checkbox" ${acc.checked ? 'checked' : ''} onchange="toggleCVCheck(${acc.id})" class="w-5 h-5 accent-[#034C5F] cursor-pointer"></td>
            <td class="p-4 text-center">
                <div class="flex justify-center gap-3">
                    <button onclick="editCVAccumulation(${acc.id})" class="text-[#97BEC6] hover:text-[#034C5F]"><i class="fa-solid fa-pen-to-square text-lg"></i></button>
                    <button onclick="deleteCVAccumulation(${acc.id})" class="text-slate-300 hover:text-red-500"><i class="fa-solid fa-trash text-lg"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function saveCVMonthlyStat() {
    let monthPick = document.getElementById('cvMonthPick').value;
    let cv = parseCurrency(document.getElementById('cvMonthCV').value);
    let importAmt = parseCurrency(document.getElementById('cvMonthImport').value);
    let manualNote = document.getElementById('cvMonthNote').value.trim();
    let entryType = document.getElementById('cvMonthEntry').value;

    if(!monthPick) return showToast("Vui lòng chọn Tháng để lưu!");
    let finalNote = entryType === "Ghi đè" ? manualNote : (manualNote ? `${entryType} (${manualNote})` : entryType);

    if (entryType === "Ghi đè") {
        cvMonthlyStats[monthPick] = { cv: cv, importAmt: importAmt, note: finalNote };
        showToast("Đã ghi đè lại toàn bộ số liệu tháng!");
    } else {
        if (cvMonthlyStats[monthPick]) {
            cvMonthlyStats[monthPick].cv = (cvMonthlyStats[monthPick].cv || 0) + cv;
            cvMonthlyStats[monthPick].importAmt = (cvMonthlyStats[monthPick].importAmt || 0) + importAmt;
            let oldNote = cvMonthlyStats[monthPick].note || "";
            cvMonthlyStats[monthPick].note = oldNote ? (oldNote + " | " + finalNote) : finalNote;
        } else {
            cvMonthlyStats[monthPick] = { cv: cv, importAmt: importAmt, note: finalNote };
        }
        showToast(`Đã cộng gộp thành công (${entryType})!`);
    }

    document.getElementById('cvMonthCV').value = ''; document.getElementById('cvMonthImport').value = ''; document.getElementById('cvMonthNote').value = ''; document.getElementById('cvMonthEntry').value = 'Lần 1'; 
    document.getElementById('btnSaveCVMonth').innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> LƯU'; 
    document.getElementById('btnSaveCVMonth').classList.replace('bg-amber-500', 'bg-[#EE6457]');
    saveCVSync(); renderAllCV();
}

function editCVMonthlyStat(monthKey) {
    let stat = cvMonthlyStats[monthKey];
    if(!stat) return;
    document.getElementById('cvMonthPick').value = monthKey;
    document.getElementById('cvMonthCV').value = new Intl.NumberFormat('en-US').format(stat.cv || 0);
    document.getElementById('cvMonthImport').value = new Intl.NumberFormat('en-US').format(stat.importAmt || 0);
    document.getElementById('cvMonthNote').value = stat.note || '';
    document.getElementById('cvMonthEntry').value = 'Ghi đè';
    
    let btnSave = document.getElementById('btnSaveCVMonth');
    btnSave.innerHTML = '<i class="fa-solid fa-pen mr-1"></i> GHI ĐÈ'; btnSave.classList.replace('bg-[#EE6457]', 'bg-amber-500'); 
    document.getElementById('cvMonthPick').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteCVMonthlyStat(monthKey) {
    showCustomConfirm(`Bạn có chắc chắn muốn xóa thống kê của tháng ${monthKey}?`, () => {
        delete cvMonthlyStats[monthKey];
        saveCVSync(); renderAllCV(); showToast("Đã xóa thống kê tháng!");
    });
}

function renderCVMonthlyStats() {
    const tbody = document.getElementById('cvMonthTableBody');
    if(!tbody) return;
    const filterYear = document.getElementById('cvMonthTableFilterYear') ? document.getElementById('cvMonthTableFilterYear').value : 'all';
    
    let allMonths = new Set(Object.keys(cvMonthlyStats));
    cvAccumulations.forEach(acc => { if(acc.date) allMonths.add(acc.date.substring(0,7)); });

    let sortedMonths = Array.from(allMonths).sort((a,b) => b.localeCompare(a));
    if(filterYear !== 'all') sortedMonths = sortedMonths.filter(month => month.startsWith(filterYear));

    tbody.innerHTML = sortedMonths.map(month => {
        let stat = cvMonthlyStats[month] || { cv: 0, importAmt: 0, note: '' };
        let totalAcc = cvAccumulations.reduce((s, a) => (a.date && a.date.startsWith(month)) ? s + a.amount : s, 0);
        let remaining = totalAcc - stat.importAmt;
        let noteHtml = stat.note ? `<div class="text-[10px] text-slate-500 italic mt-1 bg-slate-50 p-1 rounded"><i class="fa-solid fa-quote-left mr-1 opacity-50"></i>${stat.note}</div>` : '';
        
        return `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-3 text-center border-r border-slate-100"><div class="font-black text-[#034C5F] bg-blue-50 py-1 rounded-md border border-blue-100">${month}</div></td>
            <td class="p-3 text-right font-black text-emerald-600">${new Intl.NumberFormat('en-US').format(totalAcc)} đ</td>
            <td class="p-3 text-right font-bold text-slate-700">${new Intl.NumberFormat('en-US').format(stat.cv)} Cv</td>
            <td class="p-3 text-right font-black text-rose-500">${new Intl.NumberFormat('en-US').format(stat.importAmt)} đ</td>
            <td class="p-3 text-right font-black ${remaining >= 0 ? 'text-amber-500' : 'text-red-600'}">${new Intl.NumberFormat('en-US').format(remaining)} đ</td>
            <td class="p-3 align-top">
                <div class="flex justify-center gap-2 items-center h-full">
                    ${cvMonthlyStats[month] ? `<button onclick="editCVMonthlyStat('${month}')" class="text-blue-400 hover:text-blue-600 bg-white shadow-sm rounded p-1.5 border border-slate-200"><i class="fa-solid fa-pen"></i></button><button onclick="deleteCVMonthlyStat('${month}')" class="text-red-400 hover:text-red-600 bg-white shadow-sm rounded p-1.5 border border-slate-200"><i class="fa-solid fa-trash"></i></button>` : '<span class="text-[10px] text-slate-400 italic">Chưa chốt</span>'}
                </div>
                ${noteHtml}
            </td>
        </tr>`;
    }).join('');
            
    if(sortedMonths.length === 0) tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 font-bold italic">Không có dữ liệu trong năm ${filterYear}</td></tr>`;
}

// ==========================================
// CÁC CHỨC NĂNG CÒN LẠI (HÓA ĐƠN, GIAO DIỆN)
// ==========================================
function openInvoice(id) { 
    const o = orders.find(x => x.id == id); 
    if (!o) return showToast("Không tìm thấy dữ liệu đơn hàng!");
    
    const noteHtml = o.note ? `<div style="padding:15px; background:#FDF5F4; border-radius:12px; font-size:12px; color:#034C5F; margin:15px 0; border:1px solid #F9C4BA; line-height: 1.5; text-align: left;"><b style="color:#EE6457;">Ghi chú:</b> <span style="display:inline-block; padding-bottom:2px;">${o.note}</span></div>` : '<div style="margin-top:20px"></div>'; 
    
    let discountDisplay = o.discount.type === 'percent' ? `${o.discount.val}%` : formatMoney(o.discount.val);
        
    document.getElementById('invoiceContent').innerHTML = ` 
        <div style="padding:40px 30px; text-align:center; background:white;">
            <h1 style="margin:0; font-size:32px; font-weight:900; color:#034C5F; letter-spacing:1px; line-height: 1.2;">HÓA ĐƠN</h1>
            <p style="margin:8px 0 0 0; color:#EE6457; font-weight:600; line-height: 1.5;">🌷 Mọi sản phẩm gửi đi là cả tấm lòng 🌷</p> 
        </div> 
        <div style="padding:0 20px 10px 20px; background:white;"> 
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding-bottom:15px; margin-bottom:10px;"> 
                <div style="text-align: left;">
                    <p style="font-weight:800; font-size:16px; margin:0; color:#034C5F; line-height: 2.0; padding-bottom: 2px;">${o.customer.name}</p> 
                    <p style="color:#44; font-size:13px; margin:3px 0; line-height: 1.4;">${o.customer.phone}</p> 
                    <p style="color:#44; font-size:11px; margin:0; max-width:200px; line-height: 1.5;">${o.customer.addr}</p> 
                </div> 
                <div style="text-align:right; font-size:11px; color:#64748b; line-height: 2.3;"> 
                    <p style="margin:0;">Ngày đặt: <b style="display:inline-block; padding-bottom:1px;">${(o.orderDate || o.date).split('-').reverse().join('/')}</b></p> 
                    <p style="margin:0;">Ngày gửi: <b style="display:inline-block; padding-bottom:1px;">${o.date.split('-').reverse().join('/')}</b></p> 
                    <p style="margin:0;">Dự Kiến Nhận: <b style="display:inline-block; padding-bottom:1px;">${o.deliveryDate.split('-').reverse().join('/')}</b></p> 
                    <p style="color:#EE6457; font-weight:800; margin-top:5px; text-transform:uppercase; line-height: 1.8;">${o.payMethod}</p> 
                </div> 
            </div> 
            <table style="width:100%; border-collapse:collapse; font-size:13px; line-height: 2.0;"> 
                ${o.products.map(p => `<tr><td style="padding:10px 0; border-bottom:1px solid #f8fafc; text-align: left;">${p.name} (x${p.qty})</td><td style="text-align:right; font-weight:700; color:#034C5F;">${formatMoney(p.price*p.qty)}</td></tr>`).join('')} 
            </table> 
            ${noteHtml} 
            <div style="border-top:2px solid #034C5F; padding-top:15px; margin-bottom:20px;"> 
                <div style="display:flex; justify-content:space-between; font-size:12px; color:#64748b; margin-bottom:4px; line-height: 1.5;"><span>Vận chuyển:</span><span>+ ${formatMoney(o.shipFee)}</span></div> 
                <div style="display:flex; justify-content:space-between; font-size:12px; color:#EE6457; margin-bottom:10px; line-height: 1.5;"><span>Giảm giá:</span><span>- ${discountDisplay}</span></div> 
                <div style="display:flex; justify-content:space-between; font-weight:900; font-size:28px; color:#034C5F; line-height: 1.2; align-items: center;"><span style="font-size: 16px;">TỔNG THU:</span><span style="padding-bottom: 4px;">${formatMoney(o.total)}</span></div> 
            </div> 
            <div style="text-align:center; padding-top:15px; border-top:1px dashed #F9C4BA;"> 
                <p style="font-size:14px; font-weight:700; color:#034C5F; margin:0; line-height: 1.5;">Cảm ơn bạn đã ủng hộ Shop! ❤️</p> 
                <p style="font-size:10px; color:#97BEC6; margin-top:4px; line-height: 1.5; padding-bottom: 10px;">🍀Chúc quý khách có những trải nghiệm tuyệt vời với sản phẩm🍀</p> 
            </div> 
        </div>`; 
    document.getElementById('invoiceModal').classList.remove('hidden'); 
}

function resetForm() { 
    // Reset chính thức từ thẻ form (nếu có)
    const form = document.getElementById('orderForm');
    if(form) form.reset(); 
    
    // Sửa lỗi Reset số 3: Chủ động xóa trắng sạch sẽ tất cả các Input/Textarea người dùng đã nhập
    const fieldsToClear = ['editOrderId', 'custPhone', 'custName', 'custAddr', 'orderNote', 'shipFee', 'discountVal'];
    fieldsToClear.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });

    // Chủ động Reset lại các Dropdown (Select) về lựa chọn mặc định ban đầu
    const custTypeEl = document.getElementById('custType');
    if (custTypeEl) custTypeEl.value = 'new';
    
    const payMethodEl = document.getElementById('payMethod');
    if (payMethodEl) payMethodEl.value = 'COD';

    const discountTypeEl = document.getElementById('discountType');
    if (discountTypeEl) discountTypeEl.value = 'amount';

    // Xóa sạch danh sách sản phẩm và tự động nhả lại 1 ô nhập sản phẩm trống
    document.getElementById('product-list').innerHTML = ""; 
    addProductRow(); 
    
    // Reset ngày tháng về hôm nay
    const todayStr = getLocalDateString();
    const orderDateEl = document.getElementById('orderDate');
    if (orderDateEl) orderDateEl.value = todayStr; 
    
    const shipDateEl = document.getElementById('shipDate');
    if (shipDateEl) shipDateEl.value = todayStr; 
    
    autoSetDeliveryDate(); 
    calculateTotal(); 
    
    // Reset lại trạng thái của nút
    const btnSave = document.getElementById('btnSave');
    if (btnSave) btnSave.innerHTML = '<i class="fa-solid fa-check-double mr-2"></i>Lưu đơn'; 
}


function editOrder(id) { 
    const o = orders.find(x => x.id == id); 
    if(!o) return;
    document.getElementById('editOrderId').value = o.id; document.getElementById('custPhone').value = o.customer.phone; document.getElementById('custName').value = o.customer.name; document.getElementById('custAddr').value = o.customer.addr; document.getElementById('custType').value = o.customer.type || 'new'; 
    document.getElementById('product-list').innerHTML = ""; 
    o.products.forEach(p => addProductRow(p.name, p.price, p.qty)); 
    document.getElementById('payMethod').value = o.payMethod; document.getElementById('shipFee').value = new Intl.NumberFormat('en-US').format(o.shipFee); document.getElementById('discountVal').value = o.discount.type === 'amount' ? new Intl.NumberFormat('en-US').format(o.discount.val) : o.discount.val; document.getElementById('discountType').value = o.discount.type; document.getElementById('orderDate').value = o.orderDate || o.date; document.getElementById('shipDate').value = o.date; document.getElementById('deliveryDate').value = o.deliveryDate; document.getElementById('orderNote').value = o.note || ''; 
    document.getElementById('btnSave').innerHTML = '<i class="fa-solid fa-rotate mr-2"></i>Cập nhật'; 
    calculateTotal(); window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

function autoSetDeliveryDate() { const d = document.getElementById('shipDate').value; if(d) { const date = new Date(d); date.setDate(date.getDate()+3); document.getElementById('deliveryDate').value = date.toISOString().split('T')[0]; } }
function showToast(msg) { const t = document.getElementById("toast"); t.innerText = msg; t.className = "show"; setTimeout(() => { t.className = t.className.replace("show", ""); }, 3000); }
function copyCustomerInfo(n, p, a) { navigator.clipboard.writeText(`${n}\n${p}\n${a}`).then(() => showToast("Đã copy info!")); }
function closeModal() { document.getElementById('invoiceModal').classList.add('hidden'); }

function downloadImage() {
    const invoice = document.getElementById('invoiceContent'); const modal = document.getElementById('invoiceModal'); const btn = document.querySelector('button[onclick="downloadImage()"]'); const originalText = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>ĐANG XỬ LÝ...'; btn.disabled = true;
    const originalOverflow = invoice.style.overflow; const originalPadding = invoice.style.paddingBottom; const originalShadow = invoice.style.boxShadow;
    invoice.style.overflow = 'visible'; invoice.style.paddingBottom = "30px"; invoice.style.boxShadow = 'none'; modal.scrollTop = 0; window.scrollTo(0, 0);
    setTimeout(() => { html2canvas(invoice, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff", scrollY: -window.scrollY, windowWidth: invoice.scrollWidth, windowHeight: invoice.scrollHeight }).then(canvas => { const link = document.createElement('a'); link.download = `HoaDon_BNDShop_${new Date().getTime()}.png`; link.href = canvas.toDataURL('image/png', 1.0); link.click(); showToast("✅ Đã lưu ảnh hóa đơn thành công!"); }).catch(err => { showToast("❌ Có lỗi xảy ra khi lưu ảnh, vui lòng thử lại!"); }).finally(() => { invoice.style.overflow = originalOverflow || ''; invoice.style.paddingBottom = originalPadding || ''; invoice.style.boxShadow = originalShadow || ''; btn.innerHTML = originalText; btn.disabled = false; }); }, 300); 
}

function switchTab(t) { 
    ['view-orders', 'view-analytics', 'view-customers', 'view-inventory', 'view-cv'].forEach(v => document.getElementById(v).classList.add('hidden')); 
    document.getElementById(`view-${t}`).classList.remove('hidden'); 
    document.querySelectorAll('nav button').forEach(btn => btn.className = "px-3 md:px-4 py-2 rounded-xl text-sm font-medium text-[#034C5F] transition-all bg-transparent"); 
    document.getElementById(`tab-${t}`).className = "px-3 md:px-4 py-2 rounded-xl text-sm font-bold bg-white text-[#034C5F] shadow-sm"; 
    
    if(t === 'orders') renderTable();
    if(t === 'analytics') renderAnalytics(); 
    if(t === 'inventory') renderInventory(); 
    if(t === 'customers') renderCustomerCRM(); 
    if(t === 'cv') { initCVSummaryFilters(); renderAllCV(); } 
}
function toggleSettingsMenu() { const menu = document.getElementById('settingsMenu'); menu.classList.toggle('hidden'); document.getElementById('notificationMenu').classList.add('hidden'); const closeMenu = (e) => { if (!document.getElementById('settingsMenuContainer').contains(e.target)) { menu.classList.add('hidden'); document.removeEventListener('click', closeMenu); } }; if (!menu.classList.contains('hidden')) { setTimeout(() => document.addEventListener('click', closeMenu), 10); } else { document.removeEventListener('click', closeMenu); } }
function toggleNotificationMenu() { const menu = document.getElementById('notificationMenu'); menu.classList.toggle('hidden'); document.getElementById('settingsMenu').classList.add('hidden'); const closeMenu = (e) => { if (!document.getElementById('notificationMenuContainer').contains(e.target)) { menu.classList.add('hidden'); document.removeEventListener('click', closeMenu); } }; if (!menu.classList.contains('hidden')) { setTimeout(() => document.addEventListener('click', closeMenu), 10); } else { document.removeEventListener('click', closeMenu); } }
function resetOrderFilters() { 
    document.getElementById('listFilterStart').value = ''; 
    document.getElementById('listFilterEnd').value = ''; 
    document.getElementById('listFilterType').value = 'all'; 
    document.getElementById('searchOrderInput').value = ''; 
    renderTable(); 
}

function openExportModal() { document.getElementById('exportModal').classList.remove('hidden'); const today = new Date(); document.getElementById('exportStartDate').value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]; document.getElementById('exportEndDate').value = getLocalDateString(); document.getElementById('exportFileName').value = `Don_Hang_Thang_${today.getMonth()+1}`; }
function closeExportModal() { document.getElementById('exportModal').classList.add('hidden'); }

function confirmExport() {
    const fileNameInput = document.getElementById('exportFileName').value.trim();
    const fileName = fileNameInput || `BaoCaoDonHang_${new Date().toISOString().slice(0, 10)}`;
    
    const s = document.getElementById('exportStartDate').value;
    const e = document.getElementById('exportEndDate').value;

    const data = orders.filter(o => {
        const targetDate = o.orderDate || o.date;
        return (!s || targetDate >= s) && (!e || targetDate <= e);
    });

    let csv = "\ufeffMã Đơn,Ngày Đặt,Ngày Gửi,Ngày Giao,Tên Khách,SĐT,Sản Phẩm,Tổng Tiền\n";

    const escapeCSV = (text) => {
        if (!text) return "";
        return `"${String(text).replace(/"/g, '""')}"`;
    };

    data.forEach(o => {
        const productNames = o.products ? o.products.map(p => p.name).join(' | ') : "";
        
        const row = [
            o.id,
            o.orderDate || o.date || '',
            o.shipDate || '', 
            o.deliveryDate || '',
            escapeCSV(o.customer?.name),
            escapeCSV(o.customer?.phone),
            escapeCSV(productNames),
            o.total || 0
        ];

        csv += row.join(",") + "\n";
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.href = url;
    link.download = `${fileName}.csv`;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    closeExportModal();
}

function exportCustomersToExcel() {
    let csv = "\ufeffTên Khách Hàng,Số Điện Thoại,Địa Chỉ,Sinh Nhật,Ngày Kỉ Niệm,Công Việc,Tình Trạng,Ghi Chú,Tổng Chi Tiêu\n";

    const escapeCSV = (text) => {
        if (text === null || text === undefined) return "";
        return String(text).replace(/"/g, '""').replace(/\n|\r/g, ' ');
    };

    Object.keys(customers).forEach(phone => {
        const c = customers[phone];
        
        const totalSpend = orders
            .filter(o => o.customer && o.customer.phone === phone)
            .reduce((a, b) => a + (Number(b.total) || 0), 0);

        const row = [
            escapeCSV(c.name),
            escapeCSV(phone),
            escapeCSV(c.address),
            escapeCSV(c.birthday),
            escapeCSV(c.anniversary),
            escapeCSV(c.job),
            escapeCSV(c.status),
            escapeCSV(c.note),
            totalSpend 
        ];

        csv += `"${row.join('","')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `DanhSachKhachHang_${new Date().toLocaleDateString('vi-VN')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportCVToExcel() { let csv = "\ufeffTháng,Tổng tiền tích,CV,Tổng tiền nhập,Còn Lại,Ghi chú\n"; let allMonths = new Set(Object.keys(cvMonthlyStats)); cvAccumulations.forEach(acc => { if(acc.date) allMonths.add(acc.date.substring(0,7)); }); let sortedMonths = Array.from(allMonths).sort((a,b) => b.localeCompare(a)); sortedMonths.forEach(month => { let stat = cvMonthlyStats[month] || { cv: 0, importAmt: 0, note: '' }; let totalAcc = cvAccumulations.reduce((s, a) => (a.date && a.date.startsWith(month)) ? s + a.amount : s, 0); let remaining = totalAcc - stat.importAmt; let note = stat.note ? stat.note.replace(/"/g, '""') : ''; csv += `"${month}","${totalAcc}","${stat.cv}","${stat.importAmt}","${remaining}","${note}"\n`; }); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); link.download = `Thong_Ke_CV_${new Date().toISOString().slice(0,10)}.csv`; link.click(); showToast("Đã xuất file Excel thống kê CV!"); }

function renderAnalytics() {
    const startInput = document.getElementById('filterStart');
    const endInput = document.getElementById('filterEnd');
    if (!startInput.value || !endInput.value) {
        const today = new Date(); const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset()); firstDay.setMinutes(firstDay.getMinutes() - firstDay.getTimezoneOffset());
        if (!startInput.value) startInput.value = firstDay.toISOString().split('T')[0]; if (!endInput.value) endInput.value = today.toISOString().split('T')[0];
    }

    const start = startInput.value; const end = endInput.value;
    let validOrders = orders.filter(o => { const targetDate = o.orderDate || o.date; return o.status !== "Đã Hủy" && o.status !== "Đơn BOM 💣" && (!start || targetDate >= start) && (!end || targetDate <= end) });
    let bomOrders = orders.filter(o => { const targetDate = o.orderDate || o.date; return o.status === "Đơn BOM 💣" && (!start || targetDate >= start) && (!end || targetDate <= end) });

    let sOut = 0, sVnl = 0, sNew = 0, sTtd = 0, grandTotal = 0, sCollected = 0; let dailyRevenue = {}; 

    validOrders.forEach(o => {
        const net = o.total - o.shipFee; grandTotal += net; if(o.isPaid) sCollected += net;
        const targetDate = o.orderDate || o.date;
        if(dailyRevenue[targetDate]) dailyRevenue[targetDate] += net; else dailyRevenue[targetDate] = net;
        o.products.forEach(p => {
            const ratio = o.subtotal > 0 ? (p.price * p.qty / o.subtotal) : 0;
            if(OUT_KEYWORDS.some(k => p.name.toUpperCase().includes(k))) sOut += ratio * net; else sVnl += ratio * net;
        });
        if(o.customer.type === 'ttd') sTtd += net; else sNew += net;
    });
    
    let bomTotalValue = bomOrders.reduce((sum, o) => sum + o.total, 0);
    let sAccumulated = cvAccumulations.reduce((s, a) => (a.date && (!start || a.date >= start) && (!end || a.date <= end)) ? s + a.amount : s, 0);
    let sIncome = sCollected - sAccumulated;

    document.getElementById('statOut').innerText = formatMoney(sOut); document.getElementById('statVnl').innerText = formatMoney(sVnl); document.getElementById('statNew').innerText = formatMoney(sNew); document.getElementById('statTtd').innerText = formatMoney(sTtd); document.getElementById('totalPeriodRevenue').innerText = formatMoney(grandTotal); document.getElementById('statTotalOrders').innerText = validOrders.length; document.getElementById('statAvgOrder').innerText = validOrders.length ? formatMoney(grandTotal/validOrders.length) : '0 ₫'; document.getElementById('statBomCount').innerText = bomOrders.length; document.getElementById('statBomTotal').innerText = formatMoney(bomTotalValue); document.getElementById('statCollected').innerText = formatMoney(sCollected); document.getElementById('statIncome').innerText = formatMoney(sIncome);

    drawRevenueChart(dailyRevenue);
}

function drawRevenueChart(dataObj) {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    const sortedDates = Object.keys(dataObj).sort();
    const labels = sortedDates.length > 7 ? sortedDates.slice(-7) : sortedDates;
    const dataValues = labels.map(date => dataObj[date]);
    if (revenueChartInstance) revenueChartInstance.destroy();
    revenueChartInstance = new Chart(ctx, { type: 'bar', data: { labels: labels.map(d => d.split('-').reverse().join('/')), datasets: [{ label: 'Doanh thu', data: dataValues, backgroundColor: '#034C5F', borderRadius: 4, barThickness: 20 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } } } });
}

function initCVSummaryFilters() { let yearSelect = document.getElementById('cvSumYear'); let tableYearSelect = document.getElementById('cvMonthTableFilterYear'); let currentYear = new Date().getFullYear(); let yearsHtml = `<option value="all">Tất cả</option>`; for(let y = currentYear - 6; y <= currentYear + 2; y++) yearsHtml += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>Năm ${y}</option>`; if(yearSelect) yearSelect.innerHTML = yearsHtml; if(tableYearSelect) tableYearSelect.innerHTML = yearsHtml; }
function renderCVSummary() { let mFilter = document.getElementById('cvSumMonth').value; let yFilter = document.getElementById('cvSumYear').value; let totalCV = 0; let totalAcc = 0; let totalImport = 0; cvAccumulations.forEach(acc => { if(!acc.date) return; let [y, m, d] = acc.date.split('-'); if( (yFilter === 'all' || y === yFilter) && (mFilter === 'all' || m === mFilter) ) totalAcc += acc.amount; }); for (let monthKey in cvMonthlyStats) { let [y, m] = monthKey.split('-'); if( (yFilter === 'all' || y === yFilter) && (mFilter === 'all' || m === mFilter) ) { totalCV += cvMonthlyStats[monthKey].cv || 0; totalImport += cvMonthlyStats[monthKey].importAmt || 0; } } document.getElementById('sumCV').innerText = new Intl.NumberFormat('en-US').format(totalCV) + ' Cv'; document.getElementById('sumAcc').innerText = formatMoney(totalAcc); document.getElementById('sumImport').innerText = formatMoney(totalImport); document.getElementById('sumRemain').innerText = formatMoney(totalAcc - totalImport); }

function setupCustomAutocomplete() {
    const phoneInput = document.getElementById('custPhone'); const phoneBox = document.getElementById('phoneSuggestions'); const nameInput = document.getElementById('custName'); const nameBox = document.getElementById('nameSuggestions');
    function renderSuggestions(inputElement, boxElement, type) {
        const val = removeAccents(inputElement.value); boxElement.innerHTML = '';
        if (!val) return boxElement.classList.remove('active');
        const customerKeys = Object.keys(customers);
        
        const matches = type === 'phone' 
            ? customerKeys.filter(phone => phone.includes(val)).slice(0, 5) 
            : customerKeys.filter(phone => customers[phone].name && removeAccents(customers[phone].name).includes(val)).slice(0, 5);
            
        if (matches.length > 0) {
            matches.forEach(phone => {
                const c = customers[phone]; const div = document.createElement('div'); div.className = 'suggestion-item';
                div.innerHTML = type === 'phone' ? `<b>${phone}</b> - <span class="text-xs text-slate-500">${c.name}</span>` : `<b>${c.name}</b> - <span class="text-xs text-slate-500">${phone}</span>`;
                div.onclick = () => { document.getElementById('custPhone').value = phone; document.getElementById('custName').value = c.name; document.getElementById('custAddr').value = c.address || ''; boxElement.classList.remove('active'); };
                boxElement.appendChild(div);
            }); boxElement.classList.add('active');
        } else { boxElement.classList.remove('active'); }
    }
    if (phoneInput && phoneBox) { phoneInput.addEventListener('input', () => renderSuggestions(phoneInput, phoneBox, 'phone')); phoneInput.addEventListener('focus', () => renderSuggestions(phoneInput, phoneBox, 'phone')); }
    if (nameInput && nameBox) { nameInput.addEventListener('input', () => renderSuggestions(nameInput, nameBox, 'name')); nameInput.addEventListener('focus', () => renderSuggestions(nameInput, nameBox, 'name')); }
    
    document.getElementById('product-list').addEventListener('input', e => { if (e.target.classList.contains('p-name')) handleProductSearch(e.target); });
    document.getElementById('product-list').addEventListener('focusin', e => { if (e.target.classList.contains('p-name')) handleProductSearch(e.target); });
    function handleProductSearch(input) {
        const val = removeAccents(input.value); const box = input.nextElementSibling; box.innerHTML = '';
        if (!val) return box.classList.remove('active');
        const matches = inventory.filter(p => removeAccents(p.name).includes(val)).slice(0, 5);
        if (matches.length > 0) {
            matches.forEach(p => {
                const div = document.createElement('div'); div.className = 'suggestion-item'; div.innerHTML = `<b>${p.name}</b> <br> <span class="text-[10px] text-[#EE6457]">Kho: ${p.qty} | Giá: ${formatMoney(p.price)}</span>`;
                div.onclick = () => { input.value = p.name; input.closest('.product-row').querySelector('.p-price').value = new Intl.NumberFormat('en-US').format(p.price); calculateTotal(); box.classList.remove('active'); }; box.appendChild(div);
            }); box.classList.add('active');
        } else { box.classList.remove('active'); }
    }
    document.addEventListener('click', e => {
        if (phoneBox && !phoneBox.contains(e.target) && e.target !== phoneInput) phoneBox.classList.remove('active');
        if (nameBox && !nameBox.contains(e.target) && e.target !== nameInput) nameBox.classList.remove('active');
        document.querySelectorAll('.product-suggestions').forEach(box => { if (!box.contains(e.target) && e.target !== box.previousElementSibling) box.classList.remove('active'); });
    });
}

function checkAndShowEvents() {
    const today = new Date(); 
    const currentMonth = today.getMonth() + 1; 
    const currentYear = today.getFullYear(); 
    const currentDay = today.getDate();
    let events = [];

    for (const phone in customers) {
        const c = customers[phone];
        
        const b = parseDateString(c.birthday);
        if (b && b.m === currentMonth) { 
            let age = currentYear - b.y;
            if(isNaN(age) || age < 0) age = '?';
            events.push({ 
                type: 'birthday', name: c.name, phone: phone, date: `${String(b.d).padStart(2,'0')}/${String(b.m).padStart(2,'0')}`, 
                number: age, sortDay: b.d, isToday: (b.d === currentDay) 
            }); 
        }
        
        const a = parseDateString(c.anniversary);
        if (a && a.m === currentMonth) { 
            let years = currentYear - a.y; 
            if(isNaN(years) || years < 0) years = '?';
            if (years >= 1 || years === '?') {
                events.push({ 
                    type: 'anniversary', name: c.name, phone: phone, date: `${String(a.d).padStart(2,'0')}/${String(a.m).padStart(2,'0')}`, 
                    number: years, sortDay: a.d, isToday: (a.d === currentDay) 
                }); 
            } 
        }
    }
    
    events.sort((a, b) => a.sortDay - b.sortDay);
    
    const dot = document.getElementById('notificationDot'); 
    const countBadge = document.getElementById('notificationCount'); 
    const listContainer = document.getElementById('notificationList');
    
    if (events.length > 0) {
        dot.classList.remove('hidden'); countBadge.innerText = events.length; let html = '';
        events.forEach(e => { 
            const todayBadge = e.isToday ? `<span class="bg-red-500 text-white px-1.5 py-0.5 rounded ml-1 animate-pulse uppercase tracking-wider text-[9px]"><i class="fa-solid fa-star mr-1"></i>Hôm nay</span>` : '';
            
            if(e.type === 'birthday') {
                html += `<div class="${e.isToday ? 'bg-pink-100 border-pink-300 shadow-sm' : 'bg-pink-30 border-pink-100'} p-2.5 rounded-xl border flex items-center gap-3 hover:bg-pink-200 transition-colors cursor-default">
                    <div class="w-9 h-9 rounded-full bg-gradient-to-br from-pink-100 to-pink-250 text-pink-600 flex items-center justify-center shrink-0 shadow-inner"><i class="fa-solid fa-cake-candles"></i></div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-black text-[#034C5F] truncate">${e.name}</p>
                        <p class="text-[10px] text-slate-500 font-semibold mb-0.5">${e.phone}</p>
                        <p class="text-[10px] font-bold text-slate-500 bg-pink-150 inline-block px-1.5 py-0.5 rounded">Ngày ${e.date} <span class="text-slate-500">(${e.number} tuổi)</span>${todayBadge}</p>
                    </div>
                </div>`; 
            } else {
                html += `<div class="${e.isToday ? 'bg-blue-100 border-blue-300 shadow-sm' : 'bg-blue-30 border-blue-100'} p-2.5 rounded-xl border flex items-center gap-3 hover:bg-blue-200 transition-colors cursor-default">
                    <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-250 text-blue-600 flex items-center justify-center shrink-0 shadow-inner"><i class="fa-solid fa-heart"></i></div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-black text-[#034C5F] truncate">${e.name}</p>
                        <p class="text-[10px] text-slate-500 font-semibold mb-0.5">${e.phone}</p>
                        <p class="text-[10px] font-bold text-slate-500 bg-blue-150 inline-block px-1.5 py-0.5 rounded">Ngày ${e.date} <span class="text-slate-500">(${e.number} năm)</span>${todayBadge}</p>
                    </div>
                </div>`;
            }
        });
        listContainer.innerHTML = html;
    } else {
        dot.classList.add('hidden'); countBadge.innerText = '0'; listContainer.innerHTML = `<div class="py-8 text-center text-slate-400 flex flex-col items-center justify-center h-full"><div class="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-2"><i class="fa-regular fa-bell-slash text-xl text-slate-300"></i></div><p class="text-xs font-bold uppercase tracking-wider text-slate-400">Trống</p><p class="text-[10px] mt-1">Tháng này không có sự kiện.</p></div>`;
    }
}

document.addEventListener('input', e => { if (e.target && e.target.classList.contains('crm-textarea')) { const target = e.target; requestAnimationFrame(() => { target.style.height = 'auto'; target.style.height = target.scrollHeight + 'px'; }); } });
let searchOrderTimeout; function debouncedRenderOrder() { clearTimeout(searchOrderTimeout); searchOrderTimeout = setTimeout(() => { renderTable(); }, 150); }
let searchCustomerTimeout; function debouncedRenderCustomerCRM() { clearTimeout(searchCustomerTimeout); searchCustomerTimeout = setTimeout(() => { renderCustomerCRM(); }, 150); }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === 'visible') initDataSync(); });

// ==========================================
// HỆ THỐNG AUTHENTICATION & PROFILE
// ==========================================

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const btnLogin = document.getElementById('btnLoginMenu');
    const btnProfile = document.getElementById('btnProfileMenu');
    const btnLogout = document.getElementById('btnLogoutMenu');
    
    if (user) {
        btnLogin.classList.add('hidden');
        btnProfile.classList.remove('hidden');
        btnLogout.classList.remove('hidden');
        
        if(isOfflineMode) showToast("Đã đăng nhập - Vui lòng tắt isOfflineMode trong code để đồng bộ!");
        
        closeAuthModal();
        await loadUserData(user);
        initDataSync();
    } else {
        btnLogin.classList.remove('hidden');
        btnProfile.classList.add('hidden');
        btnLogout.classList.add('hidden');
    }
});

function openLoginModal() {
    toggleAuthMode('login');
    const modal = document.getElementById('authModal');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modal.querySelector('div').classList.remove('scale-95'); modal.querySelector('div').classList.add('scale-100'); }, 10);
    document.getElementById('settingsMenu').classList.add('hidden');
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function toggleAuthMode(mode) {
    currentAuthMode = mode;
    const title = document.getElementById('authTitle');
    const btnSubmit = document.getElementById('btnSubmitAuth');
    const pwdGroup = document.getElementById('passwordGroup');
    const btnReg = document.getElementById('btnSwitchRegister');
    const btnRes = document.getElementById('btnSwitchReset');

    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';

    if (mode === 'login') {
        title.innerText = 'Đăng nhập'; btnSubmit.innerText = 'ĐĂNG NHẬP';
        pwdGroup.classList.remove('hidden'); btnReg.innerText = 'Tạo tài khoản'; btnReg.setAttribute('onclick', "toggleAuthMode('register')"); btnRes.classList.remove('hidden');
    } else if (mode === 'register') {
        title.innerText = 'Đăng ký NV mới'; btnSubmit.innerText = 'ĐĂNG KÝ';
        pwdGroup.classList.remove('hidden'); btnReg.innerText = 'Đã có tài khoản?'; btnReg.setAttribute('onclick', "toggleAuthMode('login')"); btnRes.classList.add('hidden');
    } else if (mode === 'reset') {
        title.innerText = 'Khôi phục MK'; btnSubmit.innerText = 'GỬI LINK KHÔI PHỤC';
        pwdGroup.classList.add('hidden'); btnReg.innerText = 'Quay lại'; btnReg.setAttribute('onclick', "toggleAuthMode('login')"); btnRes.classList.add('hidden');
    }
}

async function handleAuthAction() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const btnSubmit = document.getElementById('btnSubmitAuth');
    
    if (!email) return showToast("Vui lòng nhập Email!");
    if (currentAuthMode !== 'reset' && !password) return showToast("Vui lòng nhập Mật khẩu!");

    const originalText = btnSubmit.innerText;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnSubmit.disabled = true;

    try {
        if (currentAuthMode === 'login') {
            await signInWithEmailAndPassword(auth, email, password);
            showToast("Đăng nhập thành công!");
        } else if (currentAuthMode === 'register') {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            await set(ref(db, `SunsetShopData/Users/${userCred.user.uid}`), {
                email: email, joinDate: getLocalDateString(), role: 'employee'
            });
            showToast("Đăng ký thành công!");
        } else if (currentAuthMode === 'reset') {
            await sendPasswordResetEmail(auth, email);
            showCustomAlert("Link khôi phục mật khẩu đã được gửi đến email của bạn.", "success");
            toggleAuthMode('login');
        }
    } catch (error) {
        showCustomAlert("Lỗi: " + error.message, "error");
    } finally {
        btnSubmit.innerText = originalText;
        btnSubmit.disabled = false;
    }
}

async function handleGoogleLogin() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const userRef = ref(db, `SunsetShopData/Users/${result.user.uid}`);
        const snapshot = await get(userRef);
        if (!snapshot.exists()) {
            await set(userRef, { email: result.user.email, name: result.user.displayName, joinDate: getLocalDateString(), role: 'employee' });
        }
        showToast("Đăng nhập Google thành công!");
    } catch (error) {
        showCustomAlert("Lỗi Google: " + error.message, "error");
    }
}

function handleSignOut() {
    showCustomConfirm("Bạn có chắc chắn muốn đăng xuất?", async () => {
        try { await signOut(auth); showToast("Đã đăng xuất!"); document.getElementById('settingsMenu').classList.add('hidden'); } 
        catch (error) { showCustomAlert("Lỗi đăng xuất", "error"); }
    });
}

function openProfileModal() {
    // Thêm dòng này: Tải lại dữ liệu mới nhất trước khi mở Modal
    if (currentUser) {
        loadUserData(currentUser);
    }

    const modal = document.getElementById('profileModal');
    modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        modal.querySelector('div').classList.remove('scale-95'); 
        modal.querySelector('div').classList.add('scale-100'); 
    }, 10);
    document.getElementById('settingsMenu').classList.add('hidden');
}

function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
    selectedAvatarFile = null;
}

async function loadUserData(user) {
    document.getElementById('profileEmail').value = user.email || '';
    document.getElementById('profileName').value = user.displayName || '';
    document.getElementById('profileAvatarPreview').src = user.photoURL || `https://ui-avatars.com/api/?name=${user.email.charAt(0)}&background=034C5F&color=fff`;

    const userRef = ref(db, `SunsetShopData/Users/${user.uid}`);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
        const data = snapshot.val();
        if(data.name) document.getElementById('profileName').value = data.name;
        document.getElementById('profilePhone').value = data.phone || '';
        
        // --- SỬA LỖI FLATPICKR KHÔNG HIỂN THỊ NGÀY THÁNG ---
        const dobEl = document.getElementById('profileDOB');
        if (data.dob) {
            dobEl.value = data.dob;
            // Ép thư viện flatpickr hiển thị ngày lên giao diện
            if (dobEl._flatpickr) dobEl._flatpickr.setDate(data.dob);
        }

        const joinDateEl = document.getElementById('profileJoinDate');
        const joinDateVal = data.joinDate || getLocalDateString();
        joinDateEl.value = joinDateVal;
        if (joinDateEl._flatpickr) joinDateEl._flatpickr.setDate(joinDateVal);
    }
}

function handleAvatarSelect(event) {
    const file = event.target.files[0];
    if (file) {
        selectedAvatarFile = file;
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById('profileAvatarPreview').src = e.target.result;
        reader.readAsDataURL(file);
    }
}

async function saveUserProfile() {
    if (!currentUser) return;
    const btnSave = document.getElementById('btnSaveProfile');
    btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>ĐANG LƯU...';
    btnSave.disabled = true;

    try {
        const name = document.getElementById('profileName').value.trim();
        const phone = document.getElementById('profilePhone').value.trim();
        const dob = document.getElementById('profileDOB').value;
        const joinDate = document.getElementById('profileJoinDate').value; 
        
        let photoURL = currentUser.photoURL || ""; 

        if (selectedAvatarFile) {
            const avatarRef = storageRef(storage, `Avatars/${currentUser.uid}_${Date.now()}`);
            await uploadBytes(avatarRef, selectedAvatarFile);
            photoURL = await getDownloadURL(avatarRef);
        }

        await updateProfile(currentUser, { displayName: name, photoURL: photoURL });

        await update(ref(db, `SunsetShopData/Users/${currentUser.uid}`), {
            name: name, 
            phone: phone, 
            dob: dob, 
            joinDate: joinDate,
            photoURL: photoURL
        });

        showToast("Đã cập nhật hồ sơ thành công!");
        closeProfileModal();
    } catch (error) {
        console.error("Lỗi khi lưu profile:", error);
        showCustomAlert("Lỗi cập nhật: " + error.message, "error");
    } finally {
        btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk text-lg mr-2"></i> LƯU THAY ĐỔI';
        btnSave.disabled = false;
    }
}

flatpickr(".flatpickr-profile", {
    locale: "vn",
    dateFormat: "Y-m-d", 
    altInput: true,
    altFormat: "d/m/Y",
    minDate: "1950-01-01", // Thêm dòng này để cho phép chọn năm từ 1950
    maxDate: "2060-12-31"  // Thêm dòng này
});


// ==============================================================
// GẮN TẤT CẢ CÁC HÀM VÀO WINDOW CHO HTML
// ==============================================================
Object.assign(window, {
    closeCustomAlert, showCustomConfirm, switchTab, toggleNotificationMenu, toggleSettingsMenu, backupData, restoreData,
    addProductRow, autoSetDeliveryDate, formatCurrencyInput, calculateTotal, resetForm, saveOrder, debouncedRenderOrder,
    openExportModal, renderTable, resetOrderFilters, changeOrderStatus, togglePaidStatus, openInvoice, editOrder, deleteOrder, 
    renderAnalytics, addInventoryProduct, renderInventory, updateInventoryProduct, deleteInventoryProduct, addManualCustomer, 
    exportCustomersToExcel, renderCustomerCRM, debouncedRenderCustomerCRM, updateCustomerField, deleteCustomer, renderCVSummary, 
    addCVAccumulation, renderCVAccumulations, exportCVToExcel, saveCVMonthlyStat, editCVMonthlyStat, deleteCVMonthlyStat, 
    renderCVMonthlyStats, closeModal, downloadImage, closeExportModal, confirmExport, updateQty, editCVAccumulation, 
    toggleCVCheck, deleteCVAccumulation, copyCustomerInfo,openLoginModal, closeAuthModal, toggleAuthMode, handleAuthAction, handleGoogleLogin, handleSignOut,
    openProfileModal, closeProfileModal, handleAvatarSelect, saveUserProfile
});
