importScripts('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');

let activeZipInstance = null;

const EXT_GROUPS = {
    ARCHIVE: ['zip', 'jar', 'pptx', 'docx', 'xlsx'],
    MEDIA: ['mp3', 'mp4', 'avi', 'wav', 'ogg', 'webm', 'mkv', 'flac', 'aac', 'm4a'],
    HEX: ['exe', 'dll', 'bin', 'thanos', 'class'],
    NBT: ['nbt', 'dat', 'dta', 'mca', 'mcworld'],
    PDF: ['pdf'],
    JSON: ['json'],
    CSV: ['csv'],
    YAML: ['yaml', 'yml'],
    IMAGE: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']
};

self.onmessage = async function(e) {
    const msg = e.data;

    try {
        if (msg.type === 'ANALYZE_FILE') {
            const file = msg.file;
            const ext = file.name.toLowerCase().split('.').pop();

            if (msg.forceHex) {
                handleHex(file);
            } else if (EXT_GROUPS.NBT.includes(ext)) {
                await handleNBT(file);
            } else if (EXT_GROUPS.ARCHIVE.includes(ext)) {
                handleArchive(file);
            } else if (EXT_GROUPS.HEX.includes(ext)) {
                handleHex(file);
            } else if (EXT_GROUPS.MEDIA.includes(ext)) {
                self.postMessage({ type: 'ANALYSIS_COMPLETE', fileType: 'media', data: { mime: getMimeType(ext) } });
            } else if (EXT_GROUPS.PDF.includes(ext)) {
                self.postMessage({ type: 'ANALYSIS_COMPLETE', fileType: 'pdf', data: {} });
            } else if (EXT_GROUPS.IMAGE.includes(ext)) {
                self.postMessage({ type: 'ANALYSIS_COMPLETE', fileType: 'image', data: {} });
            } else if (EXT_GROUPS.JSON.includes(ext)) {
                handleJSON(file);
            } else if (EXT_GROUPS.CSV.includes(ext)) {
                handleCSV(file);
            } else if (EXT_GROUPS.YAML.includes(ext)) {
                processAsYaml(file);
            } else {
                processAsText(file);
            }
        } else if (msg.type === 'REQUEST_LINES') {
            const file = msg.file;
            const offsets = msg.offsets;
            if (!offsets || offsets.length === 0) {
                const reader = new FileReader();
                reader.onload = ev => self.postMessage({ type: 'TEXT_CHUNK_LOADED', lines: ev.target.result.split('\n'), startLine: 0 });
                reader.readAsText(file);
                return;
            }
            const startLine = msg.startLine;
            const endLine = Math.min(msg.endLine, offsets.length - 1);
            const byteStart = startLine === 0 ? 0 : offsets[startLine - 1] + 1;
            const byteEnd = offsets[endLine];
            const slice = file.slice(byteStart, byteEnd);
            const reader = new FileReader();
            reader.onload = ev => self.postMessage({ type: 'TEXT_CHUNK_LOADED', lines: ev.target.result.split('\n'), startLine });
            reader.readAsText(slice);
        } else if (msg.type === 'READ_INTERNAL_FILE') {
            if (activeZipInstance && activeZipInstance.file(msg.internalPath)) {
                const iPath = msg.internalPath;
                const fname = iPath.split('/').pop();
                const ext = fname.split('.').pop().toLowerCase();
                const blobExts = ['png','jpg','jpeg','gif','webp','bmp','ico','svg','mp3','wav','ogg','flac','aac','m4a','mp4','avi','mov','mkv','webm'];
                if (blobExts.includes(ext)) {
                    activeZipInstance.file(iPath).async('blob').then(blob => {
                        self.postMessage({ type: 'INTERNAL_FILE_LOADED', name: iPath, content: blob, isBlob: true });
                    });
                } else {
                    activeZipInstance.file(iPath).async('string').then(content => {
                        self.postMessage({ type: 'INTERNAL_FILE_LOADED', name: iPath, content, isBlob: false });
                    });
                }
            }
        }
    } catch (err) {
        self.postMessage({ type: 'ERROR', error: err.message });
    }
};

// ── HEX ──────────────────────────────────────────────────────────────────────
function handleHex(file) {
    const reader = new FileReader();
    reader.onload = ev => {
        const buffer = new Uint8Array(ev.target.result);
        const lines = [];
        const maxBytes = Math.min(buffer.length, 4096);
        for (let i = 0; i < maxBytes; i += 16) {
            const addr = i.toString(16).padStart(8, '0').toUpperCase();
            const hex = [], asc = [];
            for (let j = 0; j < 16; j++) {
                if (i + j < maxBytes) {
                    const b = buffer[i + j];
                    hex.push(b.toString(16).padStart(2, '0').toUpperCase());
                    asc.push(b >= 32 && b <= 126 ? String.fromCharCode(b) : '.');
                } else { hex.push('  '); asc.push(' '); }
            }
            lines.push(`${addr}: ${hex.join(' ')} |${asc.join('')}|`);
        }
        if (buffer.length > maxBytes) lines.push(`... [DUMP TRUNCATED — TOTAL: ${(buffer.length / 1024).toFixed(1)} KB]`);
        self.postMessage({ type: 'ANALYSIS_COMPLETE', fileType: 'hex', data: { lines } });
    };
    reader.readAsArrayBuffer(file);
}

// ── ARCHIVE ───────────────────────────────────────────────────────────────────
function handleArchive(file) {
    const reader = new FileReader();
    reader.onload = ev => {
        JSZip.loadAsync(ev.target.result).then(zip => {
            activeZipInstance = zip;
            const filesArray = [];
            zip.forEach((relativePath, entry) => {
                if (!entry.dir) {
                    filesArray.push({
                        name: relativePath,
                        size: ((entry._data && entry._data.uncompressedSize) ? (entry._data.uncompressedSize / 1024).toFixed(1) : '?') + ' KB',
                        compressed: ((entry._data && entry._data.compressedSize) ? (entry._data.compressedSize / 1024).toFixed(1) : '?') + ' KB'
                    });
                }
            });
            self.postMessage({ type: 'ANALYSIS_COMPLETE', fileType: 'archive', data: filesArray });
        }).catch(() => processAsText(file));
    };
    reader.readAsArrayBuffer(file);
}

// ── JSON ──────────────────────────────────────────────────────────────────────
function handleJSON(file) {
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const parsed = JSON.parse(ev.target.result);
            const pretty = JSON.stringify(parsed, null, 2);
            self.postMessage({ type: 'ANALYSIS_COMPLETE', fileType: 'text', data: { offsets: [], directText: pretty, lang: 'json' } });
        } catch(err) {
            self.postMessage({ type: 'ANALYSIS_COMPLETE', fileType: 'text', data: { offsets: [], directText: ev.target.result, lang: 'json', parseError: err.message } });
        }
    };
    reader.readAsText(file);
}

// ── CSV ───────────────────────────────────────────────────────────────────────
function handleCSV(file) {
    const reader = new FileReader();
    reader.onload = ev => {
        const raw = ev.target.result;
        const lines = raw.split('\n').filter(l => l.trim());
        const rows = lines.map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
        self.postMessage({ type: 'ANALYSIS_COMPLETE', fileType: 'csv', data: { rows } });
    };
    reader.readAsText(file);
}

function processAsYaml(file) {
    const reader = new FileReader();
    reader.onload = ev => self.postMessage({ type: 'ANALYSIS_COMPLETE', fileType: 'yaml', data: { offsets: [], directText: ev.target.result, lang: 'yaml' } });
    reader.readAsText(file);
}

// ── NBT / DAT / DTA (FIXED ASYNC GZIP) ───────────────────────────────────────────
async function handleNBT(file) {
    const reader = new FileReader();
    reader.onload = async ev => {
        const raw = new Uint8Array(ev.target.result);
        let buffer = raw;
        try {
            buffer = await decompressGzip(raw);
        } catch(e) {
            // Not gzipped, use raw
        }

        try {
            const tree = parseNBTBuffer(buffer, 0);
            self.postMessage({ type: 'ANALYSIS_COMPLETE', fileType: 'nbt', data: { tree: tree.value, name: tree.name } });
        } catch(e) {
            // Fallback to hex
            handleHexFromBuffer(raw);
        }
    };
    reader.readAsArrayBuffer(file);
}

function handleHexFromBuffer(buffer) {
    const lines = [];
    const maxBytes = Math.min(buffer.length, 4096);
    for (let i = 0; i < maxBytes; i += 16) {
        const addr = i.toString(16).padStart(8, '0').toUpperCase();
        const hex = [], asc = [];
        for (let j = 0; j < 16; j++) {
            if (i + j < maxBytes) {
                const b = buffer[i + j];
                hex.push(b.toString(16).padStart(2, '0').toUpperCase());
                asc.push(b >= 32 && b <= 126 ? String.fromCharCode(b) : '.');
            } else { hex.push('  '); asc.push(' '); }
        }
        lines.push(`${addr}: ${hex.join(' ')} |${asc.join('')}|`);
    }
    if (buffer.length > maxBytes) lines.push(`... [DUMP TRUNCATED — TOTAL: ${(buffer.length / 1024).toFixed(1)} KB]`);
    self.postMessage({ type: 'ANALYSIS_COMPLETE', fileType: 'hex', data: { lines } });
}

// Fixed decompressGzip using DecompressionStream
async function decompressGzip(data) {
    if (data[0] !== 0x1f || data[1] !== 0x8b) throw new Error('Not gzip');
    const ds = new DecompressionStream('gzip');
    const stream = new Response(data.buffer).body;
    const decompressed = await new Response(stream.pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(decompressed);
}

// NBT Tag types
const TAG = {
    END: 0, BYTE: 1, SHORT: 2, INT: 3, LONG: 4,
    FLOAT: 5, DOUBLE: 6, BYTE_ARRAY: 7, STRING: 8,
    LIST: 9, COMPOUND: 10, INT_ARRAY: 11, LONG_ARRAY: 12
};

function parseNBTBuffer(buf, offset) {
    const view = new DataView(buf.buffer || buf);
    return readTag(view, offset, true);
}

function readTag(view, offset, named, typeOverride) {
    let type = typeOverride !== undefined ? typeOverride : view.getUint8(offset++);
    if (type === TAG.END) return { type: TAG.END, offset };
    let name = '';
    if (named && typeOverride === undefined) {
        const nameLen = view.getUint16(offset); offset += 2;
        const nameBytes = new Uint8Array(view.buffer, offset, nameLen);
        name = String.fromCharCode(...nameBytes);
        offset += nameLen;
    }

    const { value, offset: newOffset } = readPayload(view, offset, type);
    return { type, name, value, offset: newOffset };
}

function readPayload(view, offset, type) {
    switch(type) {
        case TAG.BYTE: return { value: { _type: 'byte', v: view.getInt8(offset) }, offset: offset + 1 };
        case TAG.SHORT: return { value: { _type: 'short', v: view.getInt16(offset) }, offset: offset + 2 };
        case TAG.INT: return { value: { _type: 'int', v: view.getInt32(offset) }, offset: offset + 4 };
        case TAG.LONG: {
            const hi = view.getInt32(offset), lo = view.getInt32(offset + 4);
            return { value: { _type: 'long', v: `${hi * 4294967296 + (lo >>> 0)}` }, offset: offset + 8 };
        }
        case TAG.FLOAT: return { value: { _type: 'float', v: view.getFloat32(offset).toFixed(6) }, offset: offset + 4 };
        case TAG.DOUBLE: return { value: { _type: 'double', v: view.getFloat64(offset).toFixed(10) }, offset: offset + 8 };
        case TAG.BYTE_ARRAY: {
            const len = view.getInt32(offset); offset += 4;
            const arr = [];
            for (let i = 0; i < Math.min(len, 64); i++) arr.push(view.getInt8(offset + i));
            return { value: { _type: 'byte_array', v: arr, total: len }, offset: offset + len };
        }
        case TAG.STRING: {
            const len = view.getUint16(offset); offset += 2;
            const bytes = new Uint8Array(view.buffer, offset, len);
            const str = String.fromCharCode(...bytes);
            return { value: { _type: 'string', v: str },  offset: offset + len };
        }
        case TAG.LIST: {
            const elemType = view.getUint8(offset++);
            const len = view.getInt32(offset); offset += 4;
            const items = [];
            for (let i = 0; i < len; i++) {
                const r = readPayload(view, offset, elemType);
                items.push(r.value);
                offset = r.offset;
            }
            return { value: { _type: 'list', elemType, items }, offset };
        }
        case TAG.COMPOUND: {
            const children = {};
            while (offset < view.byteLength) {
                const childType = view.getUint8(offset);
                if (childType === TAG.END) { offset++; break; }
                offset++;
                const nameLen = view.getUint16(offset); offset += 2;
                const nameBytes = new Uint8Array(view.buffer, offset, nameLen);
                const name = String.fromCharCode(...nameBytes); offset += nameLen;
                const r = readPayload(view, offset, childType);
                children[name] = { ...r.value, _tagType: childType };
                offset = r.offset;
            }
            return { value: { _type: 'compound', children }, offset };
        }
        case TAG.INT_ARRAY: {
            const len = view.getInt32(offset); offset += 4;
            const arr = [];
            for (let i = 0; i < Math.min(len, 32); i++) arr.push(view.getInt32(offset + i * 4));
            return { value: { _type: 'int_array', v: arr, total: len }, offset: offset + len * 4 };
        }
        case TAG.LONG_ARRAY: {
            const len = view.getInt32(offset); offset += 4;
            return { value: { _type: 'long_array', total: len }, offset: offset + len * 8 };
        }
        default: return { value: { _type: 'unknown' }, offset };
    }
}

// ── TEXT ────────────────────────────────────────────────────────────────────── 
function processAsText(file) {
    const chunkSize = 1024 * 1024 * 4;
    let offset = 0;
    const offsets = [];
    let totalBytes = 0;
    function scan() {
        if (offset >= file.size) {
            self.postMessage({ type: 'ANALYSIS_COMPLETE', fileType: 'text', data: { offsets } });
            return;
        }
        const slice = file.slice(offset, offset + chunkSize);
        const reader = new FileReader();
        reader.onload = ev => {
            const buf = new Uint8Array(ev.target.result);
            for (let i = 0; i < buf.length; i++) if (buf[i] === 10) offsets.push(totalBytes + i);
            totalBytes += buf.length;
            offset += chunkSize;
            scan();
        };
        reader.readAsArrayBuffer(slice);
    }
    scan();
}

function getMimeType(ext) {
    const map = {
        'mp3':'audio/mpeg','mp4':'video/mp4','avi':'video/x-msvideo',
        'wav':'audio/wav','ogg':'audio/ogg','webm':'video/webm',
        'mkv':'video/x-matroska','flac':'audio/flac','aac':'audio/aac','m4a':'audio/mp4'
    };
    return map[ext] || 'application/octet-stream';
}
