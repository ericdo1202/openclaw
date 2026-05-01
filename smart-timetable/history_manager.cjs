const { execSync, execFileSync } = require('child_process');
const CONFIG = require('./config.json');

class HistoryManager {
    constructor() {
        this.gogPath = CONFIG.GOG_PATH || '/opt/homebrew/bin/gog';
        this.primaryFolderId = CONFIG.DRIVE_FOLDER_ID;
    }

    /**
     * Tạo một bản sao lưu toàn bộ file Sheets hiện tại
     * @param {string} spreadsheetId 
     * @param {string} suffix Tên gợi nhớ (ví dụ: "Ban_Goc", "Thay_Doi_T2")
     */
    async createSnapshot(spreadsheetId, suffix = "Manual") {
        try {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toLocaleTimeString('en-GB').replace(/:/g, '');
            const backupName = `Backup_${dateStr}_${timeStr}_${suffix}`;
            
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
        return this.primaryFolderId || null;
    }
}

module.exports = HistoryManager;
