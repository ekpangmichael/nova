import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { serviceUnavailable } from "./errors.js";
import { normalizeAbsolutePath } from "./paths.js";

const execFileAsync = promisify(execFile);
const DIRECTORY_PICKER_PROMPT = "Select Project Root";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error ?? "");
};

const isCancelError = (error: unknown) => {
  const message = getErrorMessage(error);
  return /cancel/i.test(message);
};

const runPickerCommand = async (
  file: string,
  args: string[]
): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync(file, args, {
      windowsHide: true,
    });
    const selectedPath = stdout.trim();

    if (!selectedPath) {
      return null;
    }

    return normalizeAbsolutePath(selectedPath);
  } catch (error) {
    if (isCancelError(error)) {
      return null;
    }

    throw error;
  }
};

const pickDirectoryOnMac = () =>
  runPickerCommand("osascript", [
    "-e",
    `POSIX path of (choose folder with prompt "${DIRECTORY_PICKER_PROMPT}")`,
  ]);

const pickDirectoryOnWindows = () =>
  runPickerCommand("powershell", [
    "-NoProfile",
    "-Command",
    [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      `$dialog.Description = "${DIRECTORY_PICKER_PROMPT}"`,
      "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
      "  [Console]::Write($dialog.SelectedPath)",
      "}",
    ].join("; "),
  ]);

const pickDirectoryOnLinux = async () => {
  try {
    return await runPickerCommand("zenity", [
      "--file-selection",
      "--directory",
      `--title=${DIRECTORY_PICKER_PROMPT}`,
    ]);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return runPickerCommand("kdialog", [
        "--getexistingdirectory",
        process.env.HOME ?? "/",
        DIRECTORY_PICKER_PROMPT,
      ]);
    }

    throw error;
  }
};

export const pickDirectory = async () => {
  try {
    if (process.platform === "darwin") {
      const path = await pickDirectoryOnMac();
      return {
        path,
        canceled: path === null,
      };
    }

    if (process.platform === "win32") {
      const path = await pickDirectoryOnWindows();
      return {
        path,
        canceled: path === null,
      };
    }

    const path = await pickDirectoryOnLinux();
    return {
      path,
      canceled: path === null,
    };
  } catch (error) {
    throw serviceUnavailable("Native directory picker is unavailable.", {
      platform: process.platform,
      message: getErrorMessage(error),
    });
  }
};
