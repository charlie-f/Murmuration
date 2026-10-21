// Murmuration for Windows: a screensaver (.scr) and app that runs the shared web app
// (../web, embedded in this file at build time) in Microsoft Edge WebView2.
//
// Arguments, following the Windows screensaver conventions:
//   /s          full-screen screensaver
//   /p <hwnd>   small preview inside Screen Saver Settings (a static picture, no web view)
//   /c          settings dialog
//   /a or none  the Murmuration app: a normal window that starts in interactive mode
//   /dev <dir>  with /s or /a: load the web files from <dir> instead of the built-in copy
//               (for development; also enables the browser developer tools)

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <commctrl.h>
#include <shellapi.h>
#include <shlobj.h>
#include <wrl.h>

#include <string>
#include <vector>

#include "WebView2.h"
#include "version.h"

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

namespace {

const wchar_t kHost[] = L"app.murmuration.local";
const wchar_t kOrigin[] = L"https://app.murmuration.local/";
const wchar_t kRepo[] = L"https://github.com/charlie-f/Murmuration";
const wchar_t kWebView2Download[] = L"https://developer.microsoft.com/microsoft-edge/webview2/";
// Pages the app may open in the viewer's browser (the project page itself, or prefixes that
// end in "/" so a look-alike such as .../MurmurationX can't match); anything else is ignored
const wchar_t* const kExternalAllowed[] = { L"https://bsky.app/", L"https://github.com/charlie-f/Murmuration/" };

enum class Mode { Screensaver, App, Preview, Config };

struct App {
    Mode mode = Mode::App;
    HWND window = nullptr;
    std::vector<HWND> blankers;     // black windows covering other monitors
    ComPtr<ICoreWebView2Controller> controller;
    ComPtr<ICoreWebView2> webview;
    std::wstring devFolder;
} g;

bool StartsWith(const std::wstring& s, const wchar_t* prefix) {
    return s.rfind(prefix, 0) == 0;
}

std::wstring Widen(const std::string& s) {
    if (s.empty()) return {};
    int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
    std::wstring w(n, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), w.data(), n);
    return w;
}

// %LOCALAPPDATA%\Murmuration: web files, browser profile and saved settings live here
std::wstring DataDir() {
    PWSTR path = nullptr;
    std::wstring dir;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &path))) dir = path;
    CoTaskMemFree(path);
    return dir + L"\\Murmuration";
}

void Quit() {
    if (g.window) DestroyWindow(g.window);
    else PostQuitMessage(0);
}

// --- Built-in web files --------------------------------------------------------
// Resource 100 lists the files: a build id, then "resource-id relative/path" per line.
// They're unpacked once per build into %LOCALAPPDATA%\Murmuration\app\<build id>.

bool ReadResource(int id, const char** data, DWORD* size) {
    HRSRC res = FindResourceW(nullptr, MAKEINTRESOURCEW(id), MAKEINTRESOURCEW(10) /* RT_RCDATA */);
    if (!res) return false;
    HGLOBAL handle = LoadResource(nullptr, res);
    if (!handle) return false;
    *data = static_cast<const char*>(LockResource(handle));
    *size = SizeofResource(nullptr, res);
    return *data != nullptr;
}

bool WriteWholeFile(const std::wstring& path, const char* data, DWORD size) {
    HANDLE f = CreateFileW(path.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (f == INVALID_HANDLE_VALUE) return false;
    DWORD written = 0;
    BOOL ok = WriteFile(f, data, size, &written, nullptr);
    CloseHandle(f);
    return ok && written == size;
}

void DeleteTree(const std::wstring& dir) {
    std::wstring from = dir + L'\0';  // SHFileOperation wants a double-NUL-terminated list
    SHFILEOPSTRUCTW op = {};
    op.wFunc = FO_DELETE;
    op.pFrom = from.c_str();
    op.fFlags = FOF_NO_UI;
    SHFileOperationW(&op);
}

std::wstring UnpackWebFiles() {
    const char* listData = nullptr;
    DWORD listSize = 0;
    if (!ReadResource(100, &listData, &listSize)) return {};
    std::string list(listData, listSize);

    std::vector<std::pair<int, std::string>> files;
    std::string buildId;
    size_t pos = 0;
    while (pos < list.size()) {
        size_t end = list.find('\n', pos);
        if (end == std::string::npos) end = list.size();
        std::string line = list.substr(pos, end - pos);
        pos = end + 1;
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty()) continue;
        if (buildId.empty()) { buildId = line; continue; }
        size_t space = line.find(' ');
        if (space == std::string::npos) continue;
        std::string rel = line.substr(space + 1);
        if (rel.find("..") != std::string::npos || rel.find(':') != std::string::npos) continue;
        files.emplace_back(atoi(line.c_str()), rel);
    }
    if (buildId.empty()) return {};

    std::wstring base = DataDir() + L"\\app";
    std::wstring dir = base + L"\\" + Widen(buildId);
    std::wstring marker = dir + L"\\.complete";
    if (GetFileAttributesW(marker.c_str()) == INVALID_FILE_ATTRIBUTES) {
        DeleteTree(dir);  // a half-finished unpack from an interrupted start
        for (const auto& [id, rel] : files) {
            const char* data = nullptr;
            DWORD size = 0;
            if (!ReadResource(id, &data, &size)) return {};
            std::wstring path = dir + L"\\" + Widen(rel);
            for (auto& ch : path) if (ch == L'/') ch = L'\\';
            SHCreateDirectoryExW(nullptr, path.substr(0, path.find_last_of(L'\\')).c_str(), nullptr);
            if (!WriteWholeFile(path, data, size)) return {};
        }
        if (!WriteWholeFile(marker, "", 0)) return {};
    }

    // Keep things thin: remove files left by older versions
    WIN32_FIND_DATAW fd;
    HANDLE find = FindFirstFileW((base + L"\\*").c_str(), &fd);
    if (find != INVALID_HANDLE_VALUE) {
        do {
            std::wstring name = fd.cFileName;
            if ((fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) && name != L"." && name != L".." &&
                name != Widen(buildId)) {
                DeleteTree(base + L"\\" + name);
            }
        } while (FindNextFileW(find, &fd));
        FindClose(find);
    }
    return dir;
}

// --- Web view ------------------------------------------------------------------------

void ResizeWebView() {
    if (!g.controller || !g.window) return;
    RECT r;
    GetClientRect(g.window, &r);
    g.controller->put_Bounds(r);
}

void ShowWebViewMissing() {
    if (g.mode != Mode::App) { Quit(); return; }
    int choice = MessageBoxW(g.window,
        L"Murmuration needs the Microsoft Edge WebView2 Runtime, which comes with Windows 11 "
        L"and most up-to-date Windows 10 PCs but isn't on this one.\n\n"
        L"Open the download page now?",
        L"Murmuration", MB_ICONINFORMATION | MB_YESNO);
    if (choice == IDYES) ShellExecuteW(nullptr, L"open", kWebView2Download, nullptr, nullptr, SW_SHOWNORMAL);
    Quit();
}

void ConfigureWebView() {
    ComPtr<ICoreWebView2Settings> settings;
    g.webview->get_Settings(&settings);
    bool dev = !g.devFolder.empty();
    settings->put_AreDevToolsEnabled(dev);
    settings->put_AreDefaultContextMenusEnabled(dev);
    settings->put_AreDefaultScriptDialogsEnabled(FALSE);
    settings->put_AreHostObjectsAllowed(FALSE);
    settings->put_IsStatusBarEnabled(FALSE);
    settings->put_IsZoomControlEnabled(FALSE);
    settings->put_IsWebMessageEnabled(TRUE);
    ComPtr<ICoreWebView2Settings3> settings3;
    if (SUCCEEDED(settings.As(&settings3))) settings3->put_AreBrowserAcceleratorKeysEnabled(dev);
    ComPtr<ICoreWebView2Settings4> settings4;
    if (SUCCEEDED(settings.As(&settings4))) {
        settings4->put_IsGeneralAutofillEnabled(FALSE);
        settings4->put_IsPasswordAutosaveEnabled(FALSE);
    }

    // Stay on our own pages
    g.webview->add_NavigationStarting(Callback<ICoreWebView2NavigationStartingEventHandler>(
        [](ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT {
            LPWSTR uri = nullptr;
            args->get_Uri(&uri);
            if (!uri || !StartsWith(uri, kOrigin)) args->put_Cancel(TRUE);
            CoTaskMemFree(uri);
            return S_OK;
        }).Get(), nullptr);

    // Links (a post on Bluesky, the project page) open in the viewer's own browser
    g.webview->add_NewWindowRequested(Callback<ICoreWebView2NewWindowRequestedEventHandler>(
        [](ICoreWebView2*, ICoreWebView2NewWindowRequestedEventArgs* args) -> HRESULT {
            args->put_Handled(TRUE);
            LPWSTR uri = nullptr;
            args->get_Uri(&uri);
            bool allowed = uri && wcscmp(uri, kRepo) == 0;
            if (uri) for (auto prefix : kExternalAllowed) allowed = allowed || StartsWith(uri, prefix);
            if (allowed) {
                ShellExecuteW(nullptr, L"open", uri, nullptr, nullptr, SW_SHOWNORMAL);
                if (g.mode == Mode::Screensaver) Quit();  // get out of the way of the browser
            }
            CoTaskMemFree(uri);
            return S_OK;
        }).Get(), nullptr);

    // The page asks to close the screensaver (any key or a click outside Explore)
    g.webview->add_WebMessageReceived(Callback<ICoreWebView2WebMessageReceivedEventHandler>(
        [](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
            LPWSTR message = nullptr;
            if (SUCCEEDED(args->TryGetWebMessageAsString(&message)) && message &&
                wcscmp(message, L"exit") == 0) {
                Quit();
            }
            CoTaskMemFree(message);
            return S_OK;
        }).Get(), nullptr);

    // Runs unattended: if the page's process dies, start it again
    g.webview->add_ProcessFailed(Callback<ICoreWebView2ProcessFailedEventHandler>(
        [](ICoreWebView2* sender, ICoreWebView2ProcessFailedEventArgs* args) -> HRESULT {
            COREWEBVIEW2_PROCESS_FAILED_KIND kind;
            args->get_ProcessFailedKind(&kind);
            if (kind == COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED) Quit();
            else sender->Reload();
            return S_OK;
        }).Get(), nullptr);
}

void StartWebView() {
    std::wstring folder = g.devFolder.empty() ? UnpackWebFiles() : g.devFolder;
    if (folder.empty()) {
        if (g.mode == Mode::App) MessageBoxW(g.window, L"Murmuration couldn't unpack its files.", L"Murmuration", MB_ICONERROR);
        Quit();
        return;
    }
    std::wstring profile = DataDir() + L"\\WebView2";
    HRESULT hr = CreateCoreWebView2EnvironmentWithOptions(nullptr, profile.c_str(), nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [folder](HRESULT result, ICoreWebView2Environment* env) -> HRESULT {
                if (FAILED(result) || !env) { ShowWebViewMissing(); return S_OK; }
                return env->CreateCoreWebView2Controller(g.window,
                    Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [folder](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
                            if (FAILED(result) || !controller) { ShowWebViewMissing(); return S_OK; }
                            g.controller = controller;
                            g.controller->get_CoreWebView2(&g.webview);
                            ComPtr<ICoreWebView2Controller2> controller2;
                            if (SUCCEEDED(g.controller.As(&controller2))) {
                                controller2->put_DefaultBackgroundColor({ 255, 0, 0, 0 });  // no white flash
                            }
                            ConfigureWebView();
                            ComPtr<ICoreWebView2_3> webview3;
                            if (FAILED(g.webview.As(&webview3))) { ShowWebViewMissing(); return S_OK; }
                            webview3->SetVirtualHostNameToFolderMapping(kHost, folder.c_str(),
                                COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY_CORS);
                            ResizeWebView();
                            std::wstring url = std::wstring(kOrigin) + L"index.html?host=" +
                                (g.mode == Mode::Screensaver ? L"screensaver" : L"app");
                            g.webview->Navigate(url.c_str());
                            g.controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
                            return S_OK;
                        }).Get());
            }).Get());
    if (FAILED(hr)) ShowWebViewMissing();
}

// --- Windows ---------------------------------------------------------------------------

LRESULT CALLBACK MainProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_SIZE:
        ResizeWebView();
        return 0;
    case WM_SETFOCUS:
        if (g.controller) g.controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
        return 0;
    case WM_DESTROY:
        for (HWND b : g.blankers) DestroyWindow(b);
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

// Other monitors go black; clicking or typing there ends the screensaver
LRESULT CALLBACK BlankProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_LBUTTONDOWN: case WM_RBUTTONDOWN: case WM_MBUTTONDOWN: case WM_KEYDOWN: case WM_SYSKEYDOWN:
        Quit();
        return 0;
    case WM_SETCURSOR:
        SetCursor(nullptr);
        return TRUE;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

// The little preview in Screen Saver Settings: a still picture, so the dialog stays light
LRESULT CALLBACK PreviewProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_PAINT: {
        PAINTSTRUCT ps;
        HDC dc = BeginPaint(hwnd, &ps);
        RECT r;
        GetClientRect(hwnd, &r);
        FillRect(dc, &r, (HBRUSH)GetStockObject(BLACK_BRUSH));
        int size = std::min(r.right, r.bottom) * 3 / 5;
        int cx = r.right / 2, cy = r.bottom / 2;
        HBRUSH globe = CreateSolidBrush(RGB(14, 34, 66));
        HPEN glow = CreatePen(PS_SOLID, 2, RGB(74, 134, 216));
        HGDIOBJ oldBrush = SelectObject(dc, globe);
        HGDIOBJ oldPen = SelectObject(dc, glow);
        Ellipse(dc, cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2);
        SelectObject(dc, oldBrush);
        SelectObject(dc, oldPen);
        DeleteObject(globe);
        DeleteObject(glow);
        HBRUSH amber = CreateSolidBrush(RGB(255, 180, 84));
        const int dots[][2] = { {-12, -10}, {-6, -14}, {4, -6}, {10, 4}, {-2, 8}, {14, -12} };
        for (auto& d : dots) {
            RECT dot = { cx + d[0] * size / 60 - 1, cy + d[1] * size / 60 - 1, cx + d[0] * size / 60 + 2, cy + d[1] * size / 60 + 2 };
            FillRect(dc, &dot, amber);
        }
        DeleteObject(amber);
        EndPaint(hwnd, &ps);
        return 0;
    }
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

HWND CreateWindowOf(const wchar_t* cls, WNDPROC proc, DWORD style, DWORD exStyle, RECT r, HWND parent) {
    WNDCLASSEXW wc = { sizeof(wc) };
    if (!GetClassInfoExW(GetModuleHandleW(nullptr), cls, &wc)) {
        wc.lpfnWndProc = proc;
        wc.hInstance = GetModuleHandleW(nullptr);
        wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
        wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
        wc.lpszClassName = cls;
        RegisterClassExW(&wc);
    }
    return CreateWindowExW(exStyle, cls, L"Murmuration", style, r.left, r.top, r.right - r.left,
                           r.bottom - r.top, parent, nullptr, GetModuleHandleW(nullptr), nullptr);
}

BOOL CALLBACK AddBlanker(HMONITOR monitor, HDC, LPRECT, LPARAM) {
    MONITORINFO mi = { sizeof(mi) };
    GetMonitorInfoW(monitor, &mi);
    if (mi.dwFlags & MONITORINFOF_PRIMARY) return TRUE;
    g.blankers.push_back(CreateWindowOf(L"MurmurationBlank", BlankProc, WS_POPUP | WS_VISIBLE,
                                        WS_EX_TOPMOST | WS_EX_TOOLWINDOW, mi.rcMonitor, nullptr));
    return TRUE;
}

int RunLoop() {
    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
    return (int)msg.wParam;
}

void ShowSettings(HWND parent) {
    TASKDIALOG_BUTTON buttons[] = {
        { 101, L"Open Murmuration\nExplore the globe in a window, and set up translation" },
        { 102, L"Project page\nSource code, updates, help and reporting problems" },
    };
    TASKDIALOGCONFIG cfg = { sizeof(cfg) };
    cfg.hwndParent = parent;
    cfg.dwFlags = TDF_USE_COMMAND_LINKS | TDF_ALLOW_DIALOG_CANCELLATION | TDF_POSITION_RELATIVE_TO_WINDOW;
    cfg.dwCommonButtons = TDCBF_CLOSE_BUTTON;
    cfg.pszWindowTitle = L"Murmuration";
    cfg.pszMainInstruction = L"Murmuration screensaver";
    cfg.pszContent =
        L"Public Bluesky posts, live, on a spinning globe.\n\n"
        L"While it runs, move the mouse to show the Explore button. "
        L"Press any key or click anywhere else to close it.";
    cfg.pButtons = buttons;
    cfg.cButtons = ARRAYSIZE(buttons);
    cfg.pszFooter = L"Version " MURMURATION_VERSION_WSTR L"  \x00B7  free and open source (Apache-2.0)";
    int pressed = 0;
    if (FAILED(TaskDialogIndirect(&cfg, &pressed, nullptr, nullptr))) return;
    if (pressed == 101) {
        wchar_t self[MAX_PATH];
        GetModuleFileNameW(nullptr, self, MAX_PATH);
        ShellExecuteW(nullptr, L"open", self, L"/a", nullptr, SW_SHOWNORMAL);
    } else if (pressed == 102) {
        ShellExecuteW(nullptr, L"open", kRepo, nullptr, nullptr, SW_SHOWNORMAL);
    }
}

}  // namespace

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    int argc = 0;
    LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    HWND parent = nullptr;
    for (int i = 1; i < argc; i++) {
        std::wstring a = argv[i];
        if (a.size() < 2 || (a[0] != L'/' && a[0] != L'-')) continue;
        wchar_t flag = towlower(a[1]);
        // The window handle comes as "/p 1234" or "/p:1234"
        std::wstring value = a.size() > 3 && a[2] == L':' ? a.substr(3) : (i + 1 < argc ? argv[i + 1] : L"");
        if (a.substr(1) == L"dev" && i + 1 < argc) { g.devFolder = argv[++i]; continue; }
        if (flag == L's') g.mode = Mode::Screensaver;
        else if (flag == L'a') g.mode = Mode::App;
        else if (flag == L'p') { g.mode = Mode::Preview; parent = (HWND)(INT_PTR)_wtoi64(value.c_str()); }
        else if (flag == L'c') { g.mode = Mode::Config; parent = value.empty() ? GetForegroundWindow() : (HWND)(INT_PTR)_wtoi64(value.c_str()); }
    }
    LocalFree(argv);

    INITCOMMONCONTROLSEX icc = { sizeof(icc), ICC_STANDARD_CLASSES };
    InitCommonControlsEx(&icc);

    if (g.mode == Mode::Config) { ShowSettings(parent); return 0; }

    if (g.mode == Mode::Preview) {
        if (!IsWindow(parent)) return 0;
        RECT r;
        GetClientRect(parent, &r);
        CreateWindowOf(L"MurmurationPreview", PreviewProc, WS_CHILD | WS_VISIBLE, 0, r, parent);
        return RunLoop();
    }

    // Windows may start the screensaver more than once; one copy is enough
    HANDLE single = nullptr;
    if (g.mode == Mode::Screensaver) {
        single = CreateMutexW(nullptr, TRUE, L"Murmuration.Screensaver");
        if (GetLastError() == ERROR_ALREADY_EXISTS) return 0;
    }

    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    if (g.mode == Mode::Screensaver) {
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfoW(MonitorFromPoint({ 0, 0 }, MONITOR_DEFAULTTOPRIMARY), &mi);
        g.window = CreateWindowOf(L"MurmurationMain", MainProc, WS_POPUP | WS_VISIBLE, WS_EX_TOPMOST, mi.rcMonitor, nullptr);
        EnumDisplayMonitors(nullptr, nullptr, AddBlanker, 0);
    } else {
        // A comfortable window on the current monitor
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfoW(MonitorFromPoint({ 0, 0 }, MONITOR_DEFAULTTOPRIMARY), &mi);
        RECT work = mi.rcWork;
        int w = (work.right - work.left) * 4 / 5, h = (work.bottom - work.top) * 4 / 5;
        RECT r = { work.left + (work.right - work.left - w) / 2, work.top + (work.bottom - work.top - h) / 2, 0, 0 };
        r.right = r.left + w;
        r.bottom = r.top + h;
        g.window = CreateWindowOf(L"MurmurationMain", MainProc, WS_OVERLAPPEDWINDOW | WS_VISIBLE, 0, r, nullptr);
    }
    StartWebView();
    int code = RunLoop();

    g.webview.Reset();
    g.controller.Reset();
    CoUninitialize();
    if (single) CloseHandle(single);
    return code;
}
