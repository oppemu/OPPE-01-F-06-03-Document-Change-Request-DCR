let categoriesData = {};

document.addEventListener("DOMContentLoaded", () => {
    fetchCategories();

    const verifyBtn = document.getElementById("verifyBtn");
    if (verifyBtn) verifyBtn.addEventListener("click", verifyEmail);

    const docID = document.getElementById("docID");
    if (docID) docID.addEventListener("change", onCategoryChange);

    const dcrForm = document.getElementById("dcrForm");
    if (dcrForm) dcrForm.addEventListener("submit", handleSubmit);
});

// ฟังก์ชันดึงข้อมูลแบบ JSONP เพื่อเลี่ยงปัญหา CORS
function fetchJSONP(url) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_cb_' + Math.round(100000 * Math.random());
        const script = document.createElement('script');
        
        window[callbackName] = (data) => {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(data);
        };

        const delimiter = url.includes('?') ? '&' : '?';
        script.src = `${url}${delimiter}callback=${callbackName}`;
        script.onerror = (err) => {
            delete window[callbackName];
            document.body.removeChild(script);
            reject(err);
        };
        document.body.appendChild(script);
    });
}

// 1. ดึงข้อมูลหมวดหมู่งาน
function fetchCategories() {
    const docSelect = document.getElementById("docID");
    if (!docSelect) return;

    docSelect.innerHTML = '<option value="">-- กำลังโหลดรายการหมวดงาน... --</option>';
    const targetUrl = typeof CONFIG !== 'undefined' ? CONFIG.GOOGLE_SCRIPT_URL : WEB_APP_URL;

    fetchJSONP(`${targetUrl}?action=getCategories`)
        .then(data => {
            categoriesData = data;
            docSelect.innerHTML = '<option value="">-- เลือกหมวดงาน --</option>';
            
            const keys = Object.keys(categoriesData);
            if (keys.length === 0) {
                docSelect.innerHTML = '<option value="">❌ ไม่พบข้อมูลหมวดงาน</option>';
                return;
            }

            keys.forEach(cat => {
                const opt = document.createElement("option");
                opt.value = cat;
                opt.textContent = cat;
                docSelect.appendChild(opt);
            });
        })
        .catch(err => {
            console.error("Error fetching categories:", err);
            docSelect.innerHTML = '<option value="">❌ เกิดข้อผิดพลาดในการโหลดหมวดงาน</option>';
        });
}

// 2. ตรวจสอบอีเมลผู้ใช้งาน
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

    const targetUrl = typeof CONFIG !== 'undefined' ? CONFIG.GOOGLE_SCRIPT_URL : WEB_APP_URL;

    fetchJSONP(`${targetUrl}?action=checkEmail&email=${encodeURIComponent(emailInput)}`)
        .then(data => {
            verifyBtn.disabled = false;
            if (data.isValid) {
                statusDiv.className = "status-msg success";
                statusDiv.textContent = "✅ ยืนยันตัวตนสำเร็จ";

                document.getElementById("email").value = emailInput;
                document.getElementById("reporterName").value = data.name || ""; 
                document.getElementById("position").value = data.position || "";
                document.getElementById("department").value = data.department || "";

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

// 3. เมื่อเลือกหมวดงาน ให้เปลี่ยนรายการระเบียบปฏิบัติ
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

// 4. ส่งฟอร์ม DCR
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
    if (fileInput && fileInput.files.length > 0) {
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
    const targetUrl = typeof CONFIG !== 'undefined' ? CONFIG.GOOGLE_SCRIPT_URL : WEB_APP_URL;

    fetch(targetUrl, {
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
