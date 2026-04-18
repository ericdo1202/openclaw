let globalData = null;

async function fetchData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        globalData = data;
        renderDashboard(data);
        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error("Lỗi lấy dữ liệu:", error);
        alert("Không thể kết nối với máy chủ. Vui lòng kiểm tra ứng dụng đang chạy.");
    }
}

function renderDashboard(data) {
    document.getElementById('school-name').textContent = data.schoolName;
    document.getElementById('stat-total-slots').textContent = data.timetable.length - 1;
    document.getElementById('stat-teachers').textContent = Object.keys(data.stats).length;
    
    // Tính toán hiệu suất phòng (Room stats)
    const roomCount = Object.keys(data.roomUsage).length;
    let totalUsage = 0;
    Object.values(data.roomUsage).forEach(r => totalUsage += parseInt(r.percent));
    const avgUsage = (totalUsage / roomCount || 0).toFixed(1);
    document.getElementById('stat-rooms').textContent = avgUsage + "%";

    renderWorkload(data.stats);
    renderTimetable();
}

function renderWorkload(stats) {
    const container = document.getElementById('workload-chart');
    container.innerHTML = '';
    
    Object.entries(stats).sort((a,b) => b[1] - a[1]).forEach(([name, count]) => {
        const bar = document.createElement('div');
        bar.className = 'workload-item';
        const percent = Math.min((count / 30) * 100, 100); // Giả định max 30 tiết
        bar.innerHTML = `
            <div class="workload-label">
                <span>${name}</span>
                <span>${count} tiết</span>
            </div>
            <div class="progress-bg">
                <div class="progress-fill" style="width: ${percent}%"></div>
            </div>
        `;
        container.appendChild(bar);
    });
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('nav li').forEach(l => l.classList.remove('active'));
    
    document.getElementById(id).classList.add('active');
    event.currentTarget.parentElement.classList.add('active');
    
    const titles = {
        'overview': 'Tổng quan hệ thống',
        'timetable': 'Bảng Thời khóa biểu Toàn trường',
        'rooms': 'Trạng thái Phòng học',
        'remote': 'Điều khiển Bot từ xa'
    };
    document.getElementById('section-title').textContent = titles[id] || 'Báo cáo';
}

async function sendCommand(command, args = '') {
    const resultDiv = document.getElementById('remote-result');
    const logDiv = document.getElementById('remote-log');
    
    resultDiv.style.display = 'block';
    logDiv.textContent = `⏳ Đang gửi lệnh: ${command}...`;
    
    try {
        const response = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, args })
        });
        const data = await response.json();
        
        if (data.success) {
            logDiv.innerHTML = `<span style="color: #4ade80">✅ Thành công!</span>\n\n${data.report}`;
        } else {
            logDiv.innerHTML = `<span style="color: #f87171">❌ Lỗi:</span> ${data.error}`;
        }
    } catch (error) {
        logDiv.innerHTML = `<span style="color: #f87171">❌ Lỗi kết nối:</span> ${error.message}`;
    }
}

function renderTimetable() {
    const viewType = document.getElementById('tkb-view-type').value;
    const table = document.getElementById('main-timetable');
    const rows = globalData.timetable.slice(1);
    const search = document.getElementById('tkb-search').value.toLowerCase();

    // Lọc theo search
    const filtered = rows.filter(r => 
        r[0].toLowerCase().includes(search) || 
        r[5].toLowerCase().includes(search)
    );

    table.innerHTML = '';
    
    // Header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>${viewType === 'class' ? 'Lớp' : 'Giáo viên'}</th>
            <th>T2</th>
            <th>T3</th>
            <th>T4</th>
            <th>T5</th>
            <th>T6</th>
        </tr>
    `;
    table.appendChild(thead);

    // Xử lý dữ liệu Matrix
    const targets = [...new Set(filtered.map(r => viewType === 'class' ? r[5] : r[0]))];
    const days = ["T2", "T3", "T4", "T5", "T6"];
    
    const tbody = document.createElement('tbody');
    targets.forEach(target => {
        const tr = document.createElement('tr');
        let rowHtml = `<td><strong>${target}</strong></td>`;
        
        days.forEach(day => {
            const slots = filtered.filter(r => 
                (viewType === 'class' ? r[5] : r[0]) === target && r[1] === day
            );
            rowHtml += `<td>${slots.map(s => `<div>${s[2]} - ${viewType === 'class' ? s[0] : s[5]}</div>`).join('') || '-'}</td>`;
        });
        
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

function filterTimetable() {
    renderTimetable();
}

// Khởi chạy
fetchData();
// Tự động reload sau 30s
setInterval(fetchData, 30000);
