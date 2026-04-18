const CONFIG = require('./config.json');

/**
 * DeploymentManager: Manage and manipulate the Deployment tab
 */
class DeploymentManager {
    constructor(sheetsClient) {
        this.sheets = sheetsClient;
    }

    /**
     * CLONE DEPLOYMENT FROM ONE CLASS TO ANOTHER
     */
    async cloneClassDeployment(sourceClass, targetClass) {
        const deploymentRaw = await this.sheets.getRange(CONFIG.SHEET_RANGES.DEPLOYMENT);
        if (!deploymentRaw || deploymentRaw.length === 0) return { success: false, error: "Deployment data is empty." };

        const rows = deploymentRaw.slice(1);

        // Tìm các dòng thuộc về lớp nguồn
        const sourceRows = rows.filter(r => r[0] && r[0].trim().toLowerCase() === sourceClass.trim().toLowerCase());
        
        if (sourceRows.length === 0) {
            return { success: false, error: `No deployment data found for class "${sourceClass}".` };
        }

        // Tạo dữ liệu mới cho lớp đích
        const newRows = sourceRows.map(r => {
            const newRow = [...r];
            newRow[0] = targetClass; // Gán tên lớp mới vào cột A
            return newRow;
        });

        // Nối dữ liệu vào tab Deployment
        const finalData = deploymentRaw.concat(newRows);
        await this.sheets.updateRange(CONFIG.SHEET_RANGES.DEPLOYMENT, finalData);
        
        return { success: true, count: newRows.length };
    }
}

module.exports = DeploymentManager;
