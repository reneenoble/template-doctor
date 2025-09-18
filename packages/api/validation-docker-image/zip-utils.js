/**
 * Zip file utility functions for extracting and processing ZIP archives
 */
const yauzl = require("yauzl");

/**
 * Extracts files from a ZIP archive contained in an ArrayBuffer
 * @param {ArrayBuffer} zipData - The ZIP file as an ArrayBuffer
 * @param {Object} context - Azure Functions context for logging
 * @param {string} [correlationId] - Optional ID to correlate logs across operations
 * @returns {Promise<Object>} - Object containing file contents, with filenames as keys
 */
async function extractFilesFromZip(zipData, context = null, correlationId = null) {
    const requestId = correlationId || `zip-extract-${Date.now()}`;

    return new Promise((resolve, reject) => {
        // Convert ArrayBuffer to Buffer for yauzl
        const buffer = Buffer.from(zipData);
        const files = {};

        if (context && context.log) {
            context.log(`Extracting files from ZIP archive`, {
                operation: 'extractFilesFromZip',
                bufferSize: buffer.length,
                requestId
            });
        }

        // Use yauzl to open the zip file from the buffer
        yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
            if (err) {
                const error = new Error(`Failed to open zip file: ${err.message}`);
                error.code = err.code;

                if (context && context.log && context.log.error) {
                    context.log.error(`Failed to open zip file`, {
                        operation: 'extractFilesFromZip',
                        error: err.message,
                        code: err.code,
                        stack: err.stack,
                        requestId
                    });
                }

                reject(error);
                return;
            }

            zipfile.on("entry", (entry) => {
                // Skip directory entries
                if (/\/$/.test(entry.fileName)) {
                    zipfile.readEntry();
                    return;
                }

                // Read the entry
                zipfile.openReadStream(entry, (err, readStream) => {
                    if (err) {
                        if (context && context.log && context.log.warn) {
                            context.log.warn(`Error opening read stream for file in ZIP`, {
                                operation: 'extractFilesFromZip',
                                fileName: entry.fileName,
                                error: err.message,
                                requestId
                            });
                        }
                        zipfile.readEntry();
                        return;
                    }

                    const chunks = [];
                    readStream.on("data", (chunk) => {
                        chunks.push(chunk);
                    });

                    readStream.on("end", () => {
                        const content = Buffer.concat(chunks).toString('utf8');
                        files[entry.fileName] = content;
                        zipfile.readEntry();
                    });

                    readStream.on("error", (err) => {
                        if (context && context.log && context.log.error) {
                            context.log.error(`Error reading file from ZIP`, {
                                operation: 'extractFilesFromZip',
                                fileName: entry.fileName,
                                error: err.message,
                                requestId
                            });
                        }

                        zipfile.readEntry();
                    });
                });
            });

            zipfile.on("end", () => {
                if (context && context.log) {
                    context.log(`ZIP extraction completed successfully`, {
                        operation: 'extractFilesFromZip',
                        fileCount: Object.keys(files).length,
                        requestId
                    });
                }
                resolve(files);
            });

            zipfile.on("error", (err) => {
                const error = new Error(`Error reading zip file: ${err.message}`);
                error.code = err.code;

                if (context && context.log && context.log.error) {
                    context.log.error(`Error reading zip file`, {
                        operation: 'extractFilesFromZip',
                        error: err.message,
                        code: err.code,
                        stack: err.stack,
                        requestId
                    });
                }

                reject(error);
            });

            // Start reading entries
            zipfile.readEntry();
        });
    });
}

module.exports = {
    extractFilesFromZip
};
