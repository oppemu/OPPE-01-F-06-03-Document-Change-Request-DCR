let categoriesData = {};

document.addEventListener("DOMContentLoaded", () => {
    fetchCategories();

    document.getElementById("verifyBtn").addEventListener("click", verifyEmail);
    document.getElementById("docID").addEventListener("change", onCategoryChange);
    document.getElementById("dcrForm").addEventListener("submit", handleSubmit);
});

// ดึงหมวดงานเมื่อโหลดหน้าเว็บ
function fetchCategories() {
    const docSelect = document.getElementById("docID");
    docSelect.innerHTML = '<option value="">-- กำลังดึงข้อมูลหมวดงาน... --</option>';

    fetch(`${WEB_APP_URL}?action=getCategories`)
        .then(res => res.json())
        .then(data => {
            categoriesData = data;
            docSelect.innerHTML = '<option value="">-- เลือกหมวดงาน --</option>';
            
            Object.keys(categoriesData).forEach(cat => {
                const opt = document.createElement("option");
                opt.value = cat;
                opt.textContent = cat;
                docSelect.appendChild(opt);
            });
        })
        .catch(err => {
            console.error("Error fetching categories:", err);
            docSelect.innerHTML = '<option value="">❌ ไม่พบข้อมูลหมวดงาน</option>';
        });
}

// ตรวจสอบอีเมลผู้ใช้งาน
function verifyEmail() {
    const emailInput = document.getElementById("emailInput").value.trim();
    const statusDiv = document.getElementById("emailStatus");
    const verifyBtn = document.getElementById("verifyBtn");

    if (!emailInput.endsWith("@mahidol.ac.th")) {
        statusDiv.className = "status-msg error";
        statusDiv.textContent = "❌ กรุณากรอกอีเมลองค์กร (@mahidol.ac.th) เท่านั้น";
        return;
    }

    verifyBtn.disabled = true;
    statusDiv.className = "status-msg";
    statusDiv.textContent = "⏳ กำลังตรวจสอบสิทธิ์...";

    fetch(`${WEB_APP_URL}?action=checkEmail&email=${encodeURIComponent(emailInput)}`)
        .then(res => res.json())
        .then(data => {
            verifyBtn.disabled = false;
            if (data.isValid) {
                statusDiv.className = "status-msg success";
                statusDiv.textContent = "✅ ยืนยันตัวตนสำเร็จ";

                // แสดงผลชื่อที่จัดเรียงเรียบร้อยมาจาก Apps Script (คำนำหน้า + ชื่อ นามสกุล)
                document.getElementById("email").value = emailInput;
                document.getElementById("reporterName").value = data.name; 
                document.getElementById("position").value = data.position;
                document.getElementById("department").value = data.department;

                document.getElementById("mainFormArea").style.display = "block";
            } else {
                statusDiv.className = "status-msg error";
                statusDiv.textContent = "❌ ไม่พบอีเมลนี้ในระบบสิทธิ์ผู้ใช้งาน";
                document.getElementById("mainFormArea").style.display = "none";
            }
        })
        .catch(err => {
            verifyBtn.disabled = false;
            statusDiv.className = "status-msg error";
            statusDiv.textContent = "❌ เกิดข้อผิดพลาดในการเชื่อมต่อระบบ";
        });
}

// เปลี่ยนแปลงหมวดงาน -> โหลดรายชื่อระเบียบปฏิบัติ
function onCategoryChange() {
    const selectedCat = document.getElementById("docID").value;
    const catSelect = document.getElementById("docCategory");

    catSelect.innerHTML = "";
    if (selectedCat && categoriesData[selectedCat]) {
        catSelect.disabled = false;
        catSelect.innerHTML = '<option value="">-- เลือกชื่อระเบียบปฏิบัติ --</option>';
        
        categoriesData[selectedCat].forEach(item => {
            const opt = document.createElement("option");
            opt.value = item;
            opt.textContent = item;
            catSelect.appendChild(opt);
        });
    } else {
        catSelect.disabled = true;
        catSelect.innerHTML = '<option value="">-- กรุณาเลือกหมวดงานก่อน --</option>';
    }
}

// จัดการการส่งฟอร์ม
function handleSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "⏳ กำลังส่งข้อมูล...";

    const form = e.target;
    const formData = new FormData(form);
    const dataObj = {};
    formData.forEach((value, key) => dataObj[key] = value);

    dataObj.action = "submitDCR";

    const fileInput = document.getElementById("attachFile");
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(evt) {
            const base64 = evt.target.result.split(',')[1];
            dataObj.attachFile = {
                name: file.name,
                type: file.type,
                base64: base64
            };
            sendDataToGAS(dataObj, submitBtn);
        };
        reader.readAsDataURL(file);
    } else {
        sendDataToGAS(dataObj, submitBtn);
    }
}

function sendDataToGAS(dataObj, submitBtn) {
    fetch(WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify(dataObj)
    })
    .then(res => res.json())
    .then(res => {
        submitBtn.disabled = false;
        submitBtn.textContent = "🚀 ส่งใบร้องขอแก้ไขเอกสาร (DCR)";
        if (res.success) {
            alert(`✅ บันทึกข้อมูลสำเร็จ! รหัสเอกสารของคุณคือ: ${res.dcrId}`);
            location.reload();
        } else {
            alert("❌ เกิดข้อผิดพลาด: " + res.error);
        }
    })
    .catch(err => {
        submitBtn.disabled = false;
        submitBtn.textContent = "🚀 ส่งใบร้องขอแก้ไขเอกสาร (DCR)";
        alert("❌ เกิดข้อผิดพลาดในการส่งข้อมูล");
    });
}
