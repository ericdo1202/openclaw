const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 *SheetsClient: Xử lý giao tiếp với Google Sheets qua GOG CLI
 */
class SheetsClient {
    constructor(sheetId) {
        this.sheetId = sheetId;
    }

    /**
     * Lấy dữ liệu từ một dải ô (range)
     */
    async getRange(range) {
        try {
            if (!this.sheetId) throw new Error("Missing Sheet ID");
            const cmd = `gog sheets get "${this.sheetId}" "${range}" --json`;
            const output = execSync(cmd, { encoding: 'utf8' });
            const data = JSON.parse(output);
            return data.values || [];
        } catch (error) {
            const stderr = error.stderr ? error.stderr.toString() : error.message;
            if (stderr.includes('400 failedPrecondition')) {
                throw new Error("⚠️ File này đang là định dạng Excel (.xlsx). Bạn cần mở file trên Drive -> Tệp -> Lưu dưới dạng Google Trang tính, sau đó lấy ID của file mới dán vào hệ thống.");
            }
            console.error(`[Sheets] Error fetching range ${range}:`, error.message);
            throw new Error(`Không thể truy cập dữ liệu Sheets (Dải ô: ${range}). Vui lòng kiểm tra định dạng file và quyền truy cập.`);
        }
    }

    /**
     * Thêm hàng mới
     */
    async updateRange(range, values) {
        try {
            const valuesJson = JSON.stringify(values);
            // Sử dụng execFileSync để truyền tham số trực tiếp, tránh lỗi shell escaping
            execFileSync('gog', [
                'sheets', 
                'update', 
                this.sheetId, 
                range, 
                `--values-json=${valuesJson}`,
                '--json'
            ]);
            return { success: true };
        } catch (error) {
            console.error(`[Sheets] Error updating range ${range}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Xóa sạch dữ liệu trong một dải ô (Tab)
     */
    async clearRange(range) {
        try {
            if (!this.sheetId) throw new Error("Missing Sheet ID");
            execFileSync('gog', ['sheets', 'clear', this.sheetId, range]);
            return { success: true };
        } catch (error) {
            console.error(`[Sheets] Error clearing range ${range}:`, error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = SheetsClient;
