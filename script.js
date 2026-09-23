// =========================================================================
// ฟังก์ชันช่วย: แปลงไฟล์เป็น Base64 สำหรับอัปโหลดเข้า Google Drive
// =========================================================================
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); 
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

let categoryMappingData = {}; // ตัวแปรเก็บโครงสร้างข้อมูลหมวดหมู่และระเบียบปฏิบัติ

// =========================================================================
// 1. ตรวจสอบสิทธิ์อีเมลผู้ยื่นคำขอ
// =========================================================================
document.getElementById('verifyBtn').addEventListener('click', async function() {
    const emailInput = document.getElementById('emailInput');
    const statusText = document.getElementById('emailStatus');
    const mainForm = document.getElementById('mainFormArea');
    const btn = this;
    const email = emailInput.value.trim();

    if (!email) {
        statusText.innerText = "⚠️ กรุณากรอกอีเมลก่อนกดตรวจสอบ";
        statusText.style.color = "#d93025";
        return;
    }

    btn.innerText = "กำลังตรวจสอบ...";
    btn.disabled = true;
    statusText.innerText = "";

    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL + "?action=checkEmail&email=" + encodeURIComponent(email));
        const data = await response.json();

        if (data.isValid) {
            statusText.innerText = "✅ ยืนยันตัวตนสำเร็จ ระบบดึงข้อมูลผู้ยื่นคำขอเรียบร้อยแล้ว";
            statusText.style.color = "#188038";
            mainForm.style.display = "block";
            emailInput.readOnly = true; 
            btn.style.display = "none"; 

            // เติมข้อมูลผู้ยื่นคำขอลงในช่องอัตโนมัติ
            document.getElementById('reporterName').value = data.name || "";
            document.getElementById('position').value = data.position || "";
            document.getElementById('department').value = data.department || "";

            // โหลดรายการหมวดหมู่งานทันทีที่ยืนยันตัวตนสำเร็จ
            loadCategories();
        } else {
            statusText.innerText = "❌ ไม่พบอีเมลนี้ในระบบฐานข้อมูล กรุณาตรวจสอบอีกครั้ง";
            statusText.style.color = "#d93025";
            mainForm.style.display = "none";
        }
    } catch (error) {
        statusText.innerText = "⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาลองใหม่อีกครั้ง";
        statusText.style.color = "#d93025";
        console.error("Check Email Error:", error);
    } finally {
        btn.innerText = "ตรวจสอบ";
        btn.disabled = false;
    }
});

// =========================================================================
// 2. ดึงรายการหมวดหมู่และชื่อระเบียบปฏิบัติจาก Google Sheets (ปรับปรุงพร้อม Alert)
// =========================================================================
async function loadCategories() {
    const docIDSelect = document.getElementById('docID');
    const docCategorySelect = document.getElementById('docCategory');
    
    docIDSelect.innerHTML = '<option value="">-- กำลังโหลดรายการหมวดงาน... --</option>';
    docIDSelect.disabled = true;

    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL + "?action=getCategories");
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        categoryMappingData = data;
        
        // กรณีดึงข้อมูลได้แต่เป็นวัตถุว่างเปล่า
        if (!data || Object.keys(data).length === 0) {
            docIDSelect.innerHTML = '<option value="">❌ ไม่พบข้อมูลหมวดงานในระบบ</option>';
            alert("⚠️ ไม่พบข้อมูลหมวดหมู่งาน กรุณาตรวจสอบชีต 'หมวดหมู่งาน' ใน Google Sheets หรือตรวจเช็คการ Deploy Web App");
            return;
        }

        docIDSelect.innerHTML = '<option value="">-- เลือกหมวดงาน --</option>';
        docIDSelect.disabled = false;

        // วนลูปสร้างตัวเลือกใน Dropdown หมวดงาน (คอลัมน์ H)
        Object.keys(data).forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            docIDSelect.appendChild(opt);
        });

    } catch (e) {
        console.error("เกิดข้อผิดพลาดในการโหลดหมวดหมู่งาน:", e);
        docIDSelect.innerHTML = '<option value="">❌ เกิดข้อผิดพลาดในการโหลดข้อมูล</option>';
        docCategorySelect.innerHTML = '<option value="">❌ ไม่สามารถโหลดข้อมูลระเบียบปฏิบัติได้</option>';
        
        alert("❌ ไม่สามารถดึงข้อมูลหมวดหมู่งานจากระบบได้!\n\nกรุณาตรวจสอบ:\n1. การกด Deploy เป็น New Version บน Google Apps Script\n2. ลิงก์ GOOGLE_SCRIPT_URL ใน config.js");
    }
}

// =========================================================================
// 3. เมื่อเปลี่ยนหมวดงาน ให้แสดงรายชื่อระเบียบปฏิบัติเฉพาะหมวดนั้น (คอลัมน์ I)
// =========================================================================
document.getElementById('docID').addEventListener('change', function() {
    const selectedCategory = this.value;
    const docCategorySelect = document.getElementById('docCategory');
    
    docCategorySelect.innerHTML = '<option value="">-- เลือกชื่อระเบียบปฏิบัติ --</option>';
    
    if (selectedCategory && categoryMappingData[selectedCategory]) {
        docCategorySelect.disabled = false;
        categoryMappingData[selectedCategory].forEach(rule => {
            const opt = document.createElement('option');
            opt.value = rule;
            opt.textContent = rule;
            docCategorySelect.appendChild(opt);
        });
    } else {
        docCategorySelect.disabled = true;
    }
});

// =========================================================================
// 4. บันทึกและส่งข้อมูล DCR
// =========================================================================
document.getElementById('dcrForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = document.getElementById('submitBtn');
    
    let payload = {
        action: 'submitDCR',
        email: form.email.value,
        reporterName: form.reporterName.value,
        position: form.position.value,
        department: form.department.value,
        operationsName: form.operationsName.value,
        docID: form.docID.value,
        docCategory: form.docCategory.value,
        docCode: form.docCode.value,
        docCode2: form.docCode2.value,
        docName: form.docName.value,
        docItem: form.docItem.value,
        docItem2: form.docItem2.value,
        docIDetail: form.docIDetail.value
    };

    const attachFile = document.getElementById('attachFile').files[0];

    alert('🎉 ระบบได้รับคำขอแก้ไขเอกสาร (DCR) ของท่านเรียบร้อยแล้ว!\n\nข้อมูลกำลังถูกบันทึกลงระบบเบื้องหลัง');
    
    form.reset();
    window.scrollTo(0, 0);

    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = '⏳ กำลังบันทึกข้อมูลเบื้องหลัง...';
    submitBtn.style.backgroundColor = '#666';
    submitBtn.disabled = true;

    const processInBackground = async () => {
        try {
            if (attachFile) {
                payload.attachFile = {
                    name: attachFile.name,
                    type: attachFile.type,
                    base64: await getBase64(attachFile)
                };
            }

            await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            
            console.log('บันทึกข้อมูลเบื้องหลังสำเร็จ');
        } catch (error) {
            console.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล:', error);
            alert('❌ เกิดข้อผิดพลาดขณะส่งข้อมูลไปบันทึก กรุณาลองใหม่อีกครั้ง');
        } finally {
            submitBtn.innerText = originalBtnText;
            submitBtn.style.backgroundColor = 'var(--mahidol-blue)';
            submitBtn.disabled = false;
        }
    };

    processInBackground();
});
