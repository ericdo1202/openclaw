const { execSync, execFileSync } = require('child_process');
const CONFIG = require('./config.json');

class HistoryManager {
    constructor() {
        this.gogPath = CONFIG.GOG_PATH || '/opt/homebrew/bin/gog';
        this.historyFolderName = "Smart-Timetable-History";
    }

    /**
     * Tạo một bản sao lưu toàn bộ file Sheets hiện tại
     * @param {string} spreadsheetId 
     * @param {string} suffix Tên gợi nhớ (ví dụ: "Ban_Goc", "Thay_Doi_T2")
     */
    async createSnapshot(spreadsheetId, suffix = "Manual") {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const backupName = `Backup_${timestamp}_${suffix}`;
            
            // 1. Kiểm tra/Tạo thư mục History
            const folderId = await this._ensureHistoryFolder();
            
            // 2. Copy file trực tiếp vào thư mục History
            console.log(`📦 Đang tạo bản sao lưu: ${backupName}...`);
            const cmd = `${this.gogPath} drive copy "${spreadsheetId}" "${backupName}" --parent "${folderId || ''}" --json`;
            const output = execSync(cmd, { encoding: 'utf-8' });
            const result = JSON.parse(output);
            
            const newFileId = result.file?.id || result.id;
            
            if (!newFileId) {
                throw new Error("Không thể lấy ID của file bản sao lưu mới.");
            }

            return { success: true, name: backupName, id: newFileId };
        } catch (error) {
            console.error("❌ Lỗi khi tạo snapshot:", error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Liệt kê danh sách các bản sao lưu
     */
    async listSnapshots() {
        try {
            const folderId = await this._ensureHistoryFolder();
            const cmd = `${this.gogPath} drive ls --parent "${folderId}" --json`;
            const output = execSync(cmd, { encoding: 'utf-8' });
            const result = JSON.parse(output);
            
            // gog drive ls trả về mảng các file
            const files = Array.isArray(result) ? result : (result.files || []);
            return files.map(f => ({
                name: f.name,
                id: f.id,
                created: f.createdTime || f.modifiedTime,
                url: `https://docs.google.com/spreadsheets/d/${f.id}/edit`
            }));
        } catch (error) {
            console.error("❌ Lỗi khi lấy danh sách lịch sử:", error.message);
            return [];
        }
    }

    /**
     * Đảm bảo thư mục lưu trữ lịch sử tồn tại
     */
    async _ensureHistoryFolder() {
        try {
            const searchCmd = `${this.gogPath} drive search "name = '${this.historyFolderName}' and mimeType = 'application/vnd.google-apps.folder'" --raw-query --json`;
            const result = JSON.parse(execSync(searchCmd, { encoding: 'utf-8' }));
            const folders = Array.isArray(result) ? result : (result.files || []);
            
            if (folders.length > 0) return folders[0].id;

            // Tạo mới nếu chưa có
            console.log("📁 Đang tạo thư mục quản lý lịch sử mới...");
            const createCmd = `${this.gogPath} drive mkdir "${this.historyFolderName}" --json`;
            const createResult = JSON.parse(execSync(createCmd, { encoding: 'utf-8' }));
            return createResult.folder?.id || createResult.id;
        } catch (e) {
            return null; // Trả về root nếu lỗi
        }
    }
}

module.exports = HistoryManager;
