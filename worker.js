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
        } else if (msg.type === 'COMPUTE_MD5') {
            computeMD5(msg.file);
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

// ── MD5 ───────────────────────────────────────────────────────────────────────
function computeMD5(file) {
    const reader = new FileReader();
    reader.onload = ev => {
        const buf = new Uint8Array(ev.target.result);
        const hash = md5(buf);
        self.postMessage({ type: 'MD5_RESULT', hash });
    };
    reader.readAsArrayBuffer(file);
}

function md5(buffer) {
    function safeAdd(x, y) { const lx = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (lx >> 16)) << 16) | (lx & 0xFFFF); }
    function bitRotateLeft(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
    function md5cmn(q, a, b, x, s, t) { return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
    function md5ff(a,b,c,d,x,s,t){return md5cmn((b &c)|((~b) &d),a,b,x,s,t);}
    function md5gg(a,b,c,d,x,s,t){return md5cmn((b &d)|(c &(~d)),a,b,x,s,t);}
    function md5hh(a,b,c,d,x,s,t){return md5cmn(b^c^d,a,b,x,s,t);}
    function md5ii(a,b,c,d,x,s,t){return md5cmn(c^(b|(~d)),a,b,x,s,t);}
    const len8 = buffer.length;
    let l = len8 + 8;
    const n = ((l >>> 6) + 1) << 4;
    const m = new Array(n + 16).fill(0);
    for (let i = 0; i < len8; i++) m[i >> 2] |= buffer[i] << ((i % 4) << 3);
    m[len8 >> 2] |= 0x80 << ((len8 % 4) << 3);
    m[n - 2] = len8 << 3;

    let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
    for (let i = 0; i < n; i += 16) {
        const [oa,ob,oc,od] = [a,b,c,d];
        const M = (j) => m[i+j];
        a=md5ff(a,b,c,d,M(0),7,-680876936);d=md5ff(d,a,b,c,M(1),12,-389564586);c=md5ff(c,d,a,b,M(2),17,606105819);b=md5ff(b,c,d,a,M(3),22,-1044525330);
        a=md5ff(a,b,c,d,M(4),7,-176418897);d=md5ff(d,a,b,c,M(5),12,1200080426);c=md5ff(c,d,a,b,M(6),17,-1473231341);b=md5ff(b,c,d,a,M(7),22,-45705983);
        a=md5ff(a,b,c,d,M(8),7,1770035416);d=md5ff(d,a,b,c,M(9),12,-1958414417);c=md5ff(c,d,a,b,M(10),17,-42063);b=md5ff(b,c,d,a,M(11),22,-1990404162);
        a=md5ff(a,b,c,d,M(12),7,1804603682);d=md5ff(d,a,b,c,M(13),12,-40341101);c=md5ff(c,d,a,b,M(14),17,-1502002290);b=md5ff(b,c,d,a,M(15),22,1236535329);
        a=md5gg(a,b,c,d,M(1),5,-165796510);d=md5gg(d,a,b,c,M(6),9,-1069501632);c=md5gg(c,d,a,b,M(11),14,643717713);b=md5gg(b,c,d,a,M(0),20,-373897302);
        a=md5gg(a,b,c,d,M(5),5,-701558691);d=md5gg(d,a,b,c,M(10),9,38016083);c=md5gg(c,d,a,b,M(15),14,-660478335);b=md5gg(b,c,d,a,M(4),20,-405537848);
        a=md5gg(a,b,c,d,M(9),5,568446438);d=md5gg(d,a,b,c,M(14),9,-1019803690);c=md5gg(c,d,a,b,M(3),14,-187363961);b=md5gg(b,c,d,a,M(8),20,1163531501);
        a=md5gg(a,b,c,d,M(13),5,-1444681467);d=md5gg(d,a,b,c,M(2),9,-51403784);c=md5gg(c,d,a,b,M(7),14,1735328473);b=md5gg(b,c,d,a,M(12),20,-1926607734);
        a=md5hh(a,b,c,d,M(5),4,-378558);d=md5hh(d,a,b,c,M(8),11,-2022574463);c=md5hh(c,d,a,b,M(11),16,1839030562);b=md5hh(b,c,d,a,M(14),23,-35309556);
        a=md5hh(a,b,c,d,M(1),4,-1530992060);d=md5hh(d,a,b,c,M(4),11,1272893353);c=md5hh(c,d,a,b,M(7),16,-155497632);b=md5hh(b,c,d,a,M(10),23,-1094730640);
        a=md5hh(a,b,c,d,M(13),4,681279174);d=md5hh(d,a,b,c,M(0),11,-358537222);c=md5hh(c,d,a,b,M(3),16,-722521979);b=md5hh(b,c,d,a,M(6),23,76029189);
        a=md5hh(a,b,c,d,M(9),4,-640364487);d=md5hh(d,a,b,c,M(12),11,-421815835);c=md5hh(c,d,a,b,M(15),16,530742520);b=md5hh(b,c,d,a,M(2),23,-995338651);
        a=md5ii(a,b,c,d,M(0),6,-198630844);d=md5ii(d,a,b,c,M(7),10,1126891415);c=md5ii(c,d,a,b,M(14),15,-1416354905);b=md5ii(b,c,d,a,M(5),21,-57434055);
        a=md5ii(a,b,c,d,M(12),6,1700485571);d=md5ii(d,a,b,c,M(3),10,-1894986606);c=md5ii(c,d,a,b,M(10),15,-1051523);b=md5ii(b,c,d,a,M(1),21,-2054922799);
        a=md5ii(a,b,c,d,M(8),6,1873313359);d=md5ii(d,a,b,c,M(15),10,-30611744);c=md5ii(c,d,a,b,M(6),15,-1560198380);b=md5ii(b,c,d,a,M(13),21,1309151649);
        a=md5ii(a,b,c,d,M(4),6,-145523070);d=md5ii(d,a,b,c,M(11),10,-1120210379);c=md5ii(c,d,a,b,M(2),15,718787259);b=md5ii(b,c,d,a,M(9),21,-343485551);
        a=safeAdd(a,oa);b=safeAdd(b,ob);c=safeAdd(c,oc);d=safeAdd(d,od);
    }
    return [a,b,c,d].map(n => {
        let s = '';
        for (let j = 0; j < 4; j++) s += ((n >> (j*8)) & 0xff).toString(16).padStart(2,'0');
        return s;
    }).join('');
}

function getMimeType(ext) {
    const map = {
        'mp3':'audio/mpeg','mp4':'video/mp4','avi':'video/x-msvideo',
        'wav':'audio/wav','ogg':'audio/ogg','webm':'video/webm',
        'mkv':'video/x-matroska','flac':'audio/flac','aac':'audio/aac','m4a':'audio/mp4'
    };
    return map[ext] || 'application/octet-stream';
}