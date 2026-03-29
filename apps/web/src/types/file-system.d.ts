interface FileSystemDirectoryHandle {
  kind: "directory";
  name: string;
}

interface ShowDirectoryPickerOptions {
  mode?: "read" | "readwrite";
}

interface Window {
  showDirectoryPicker(
    options?: ShowDirectoryPickerOptions
  ): Promise<FileSystemDirectoryHandle>;
}
