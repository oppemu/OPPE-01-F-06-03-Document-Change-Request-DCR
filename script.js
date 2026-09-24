let categoryMappingData = {};

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); 
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// 1. ตรวจสอบสิทธิ์อีเมลผู้ยื่นคำขอ
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
            statusText.innerText = "✅ ยืนยันตัวตนสำเร็จ";
            statusText.style.color = "#188038";
            mainForm.style.display = "block";
            emailInput.readOnly = true; 
            btn.style.display = "none"; 

            document.getElementById('email').value = email;
            document.getElementById('reporterName').value = data.name || "";
            document.getElementById('position').value = data.position || "";
            document.getElementById('department').value = data.department || "";

            // โหลดรายการหมวดงานทันที
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

// 2. ดึงรายการหมวดหมู่และชื่อระเบียบปฏิบัติจาก Google Sheets
async function loadCategories() {
    const docIDSelect = document.getElementById('docID');
    const docCategorySelect = document.getElementById('docCategory');
    
    docIDSelect.innerHTML = '<option value="">-- กำลังโหลดรายการหมวดงาน... --</option>';
    docIDSelect.disabled = true;

    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL + "?action=getCategories");
        const data = await response.json();
        categoryMappingData = data;
        
        if (!data || Object.keys(data).length === 0) {
            docIDSelect.innerHTML = '<option value="">❌ ไม่พบข้อมูลหมวดงานในระบบ</option>';
            return;
        }

        docIDSelect.innerHTML = '<option value="">-- เลือกหมวดงาน --</option>';
        docIDSelect.disabled = false;

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
    }
}

// 3. เมื่อเปลี่ยนหมวดงาน ให้แสดงระเบียบปฏิบัติเฉพาะหมวดนั้น
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

// 4. บันทึกและส่งข้อมูล DCR
document.getElementById('dcrForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerText = '⏳ กำลังบันทึกข้อมูล...';
    submitBtn.disabled = true;

    const attachFile = document.getElementById('attachFile').files[0];
    let fileData = null;

    if (attachFile) {
        fileData = {
            name: attachFile.name,
            type: attachFile.type,
            base64: await getBase64(attachFile)
        };
    }

    const payload = {
        action: 'submitDCR',
        email: this.email.value,
        reporterName: this.reporterName.value,
        position: this.position.value,
        department: this.department.value,
        operationsName: this.operationsName.value,
        docID: this.docID.value,
        docCategory: this.docCategory.value,
        docCode: this.docCode.value,
        docCode2: this.docCode2.value,
        docName: this.docName.value,
        docItem: this.docItem.value,
        docItem2: this.docItem2.value,
        docIDetail: this.docIDetail.value,
        attachFile: fileData
    };

    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const res = await response.json();

        if (res.success) {
            alert('🎉 ส่งใบร้องขอแก้ไขเอกสาร (DCR) สำเร็จ!\nเลขที่รายการ: ' + res.dcrId);
            location.reload();
        } else {
            alert('❌ เกิดข้อผิดพลาด: ' + res.error);
            submitBtn.innerText = '🚀 ส่งใบร้องขอแก้ไขเอกสาร (DCR)';
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการส่งข้อมูล:', error);
        alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
        submitBtn.innerText = '🚀 ส่งใบร้องขอแก้ไขเอกสาร (DCR)';
        submitBtn.disabled = false;
    }
});
