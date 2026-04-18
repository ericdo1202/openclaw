/**
 * MockSheetsClient: Giả lập Google Sheets để chạy Unit Test mà không cần API thật.
 */
class MockSheetsClient {
    constructor(data = {}) {
        this.data = data;
    }

    async getRange(rangeName) {
        // Trả về dữ liệu giả lập dựa trên tên range (từ config.json)
        return this.data[rangeName] || [["Header"], ["Dummy Data"]];
    }

    async updateRange(rangeName, values) {
        this.data[rangeName] = values;
        console.log(`[Mock] Update range ${rangeName} with ${values.length} rows`);
    }
}

module.exports = MockSheetsClient;
