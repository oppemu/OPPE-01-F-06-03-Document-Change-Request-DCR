// ฟังก์ชันอ่านไฟล์เป็น Base64
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); 
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

let categoryMappingData = {}; // เก็บข้อมูลหมวดงานและระเบียบปฏิบัติ

// 1. ตรวจสอบอีเมล
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

            // เติมข้อมูลผู้ยื่นคำขอ
            document.getElementById('reporterName').value = data.name || "";
            document.getElementById('position').value = data.position || "";
            document.getElementById('department').value = data.department || "";

            // โหลดรายการหมวดหมู่งาน
            loadCategories();
        } else {
            statusText.innerText = "❌ ไม่พบอีเมลนี้ในระบบฐานข้อมูล กรุณาตรวจสอบอีกครั้ง";
            statusText.style.color = "#d93025";
            mainForm.style.display = "none";
        }
    } catch (error) {
        statusText.innerText = "⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาลองใหม่อีกครั้ง";
        statusText.style.color = "#d93025";
        console.error(error);
    } finally {
        btn.innerText = "ตรวจสอบ";
        btn.disabled = false;
    }
});

// 2. ดึงรายการหมวดหมู่ (Category & Rule)
async function loadCategories() {
    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL + "?action=getCategories");
        const data = await response.json();
        
        categoryMappingData = data;
        const docIDSelect = document.getElementById('docID');
        docIDSelect.innerHTML = '<option value="">-- เลือกหมวดงาน --</option>';

        Object.keys(data).forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            docIDSelect.appendChild(opt);
        });
    } catch (e) {
        console.error("Failed to load categories", e);
    }
}

// 3. เมื่อเลือกหมวดงาน ให้เปลี่ยนรายการใน Dropdown ชื่อระเบียบปฏิบัติ
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

// 4. ส่งฟอร์ม DCR
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
    submitBtn.innerText = '⏳ กำลังบันทึกข้อมูลเข้าสู่ระบบ...';
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
            
            console.log('DCR submission background process completed.');
        } catch (error) {
            console.error('Background Submit Error:', error);
        } finally {
            submitBtn.innerText = originalBtnText;
            submitBtn.style.backgroundColor = 'var(--mahidol-blue)';
            submitBtn.disabled = false;
        }
    };

    processInBackground();
});
