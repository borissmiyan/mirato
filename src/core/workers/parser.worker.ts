import { myBibleParser } from '@/core/parsers/myBibleParser';

self.onmessage = async (e: MessageEvent) => {
    const { fileType, content, fileName } = e.data;

    try {
        if (fileType === 'sqlite') {
            await myBibleParser.parse(content as ArrayBuffer, fileName, (type, data, progress) => {
                if (type === 'metadata') {
                    self.postMessage({ type: 'metadata', data });
                } else if (type === 'verses') {
                    self.postMessage({ type: 'chunk', data, progress });
                }
            });
            self.postMessage({ type: 'success' }); // Done
        } else {
            throw new Error(`Unsupported file type: ${fileType}`);
        }
    } catch (err: unknown) {
        console.error('[ParserWorker] Error:', err);
        self.postMessage({
            type: 'error',
            error: err instanceof Error ? err.message : (typeof err === 'string' ? err : 'Unknown Parsing Error')
        });
    }
};
