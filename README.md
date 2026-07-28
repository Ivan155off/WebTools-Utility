# 🛠️ WebTools Utility — High-Performance File Hub

**WebTools Utility** is a powerful, privacy-first, client-side browser tool for viewing, analyzing, and converting various file formats. It operates entirely within your browser — no files are ever transmitted to external servers.

## ✨ Key Features

- **📂 Multi-Format Viewer**: Support for Code (JS, TS, Python, etc.), Media (MP4, MP3, PNG, WebP), Archives (ZIP, JAR), and specialized formats (NBT, JSON, XML).
- **🔄 Local Converter**: Convert images, audio, and video directly in your browser using FFmpeg.wasm.
- **✏️ Built-in Editor**: Edit text files with syntax highlighting, search/replace, and snippet templates.
- **📡 P2P QuickShare**: Transfer files between browser tabs or local devices using a peer-to-peer channel.
- **🔍 Metadata Inspector**: Calculate SHA-256 checksums and view detailed file statistics.
- **🔒 Privacy-First**: All processing is done locally via IndexedDB and Web Workers.

## 🚀 How to Use

1. **Open the App**: Simply open `index.html` in any modern web browser.
2. **Drop Files**: Drag and drop any file into the workspace.
3. **Analyze & Edit**: Use the sidebar to switch between active files and the top bar to toggle edit/raw modes.
4. **Convert**: Use the "Convert" button to change file formats locally.

## 🛠️ Technology Stack

- **HTML5/CSS3/JavaScript**: Pure client-side logic.
- **FFmpeg.wasm**: For high-performance media conversion.
- **JSZip**: For archive manipulation.
- **IndexedDB**: For high-capacity local persistence.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
