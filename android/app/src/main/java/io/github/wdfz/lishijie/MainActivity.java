package io.github.wdfz.lishijie;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.Toast;

import org.mozilla.geckoview.AllowOrDeny;
import org.mozilla.geckoview.GeckoResult;
import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.GeckoRuntimeSettings;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoSessionSettings;
import org.mozilla.geckoview.GeckoView;

/**
 * 里世界 3D 安卓版：用 APK 自带的 GeckoView（Mozilla Gecko 引擎，自己的 WebGL 与排版）跑单文件页面，
 * 不用 Android 系统 WebView。
 * · 全屏沉浸、常亮；旋转不重建（Manifest 的 configChanges），游戏不会重新载入
 * · 返回键：先发一次 Esc 给游戏（暂停、关面板）；1.5 秒内再按一次回到桌面（游戏留在后台）
 * · 不是本机页面的链接（Wiki、仓库）交给系统浏览器
 * · 导入 DLC 文件：用系统的文件选择器
 */
public class MainActivity extends Activity {
    private static final int REQ_FILE = 7;
    private static GeckoRuntime runtime;                 // 整个进程只能有一个

    private GeckoSession session;
    private GeckoView view;
    private LocalServer server;
    private long lastBack;
    private boolean hinted;
    private GeckoResult<GeckoSession.PromptDelegate.PromptResponse> pendingFile;
    private GeckoSession.PromptDelegate.FilePrompt pendingPrompt;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.activity_main);
        view = findViewById(R.id.gecko);
        immersive();

        server = new LocalServer(getAssets());
        if (!server.start()) {
            Toast.makeText(this, R.string.server_failed, Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        if (runtime == null) {
            GeckoRuntimeSettings settings = new GeckoRuntimeSettings.Builder()
                    .javaScriptEnabled(true)
                    .remoteDebuggingEnabled(false)
                    .build();
            runtime = GeckoRuntime.create(getApplicationContext(), settings);
        }
        openSession();
    }

    private void openSession() {
        session = new GeckoSession(new GeckoSessionSettings.Builder()
                .usePrivateMode(false)                                   // 存档、设置要留在设备上
                .userAgentMode(GeckoSessionSettings.USER_AGENT_MODE_MOBILE)
                .viewportMode(GeckoSessionSettings.VIEWPORT_MODE_MOBILE)
                .build());
        session.setNavigationDelegate(new Navigation());
        session.setContentDelegate(new Content());
        session.setPromptDelegate(new Prompts());
        session.open(runtime);
        view.setSession(session);
        session.loadUri(server.url());
    }

    private boolean isLocal(String uri) {
        return uri == null || uri.startsWith(server.origin() + "/") || uri.equals(server.origin())
                || uri.startsWith("blob:") || uri.startsWith("data:") || uri.startsWith("about:") || uri.startsWith("javascript:");
    }

    private void openExternal(String uri) {
        runOnUiThread(() -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(uri)));
            } catch (ActivityNotFoundException ignored) {
            }
        });
    }

    private final class Navigation implements GeckoSession.NavigationDelegate {
        @Override
        public GeckoResult<AllowOrDeny> onLoadRequest(GeckoSession s, LoadRequest request) {
            if (isLocal(request.uri)) return GeckoResult.allow();
            openExternal(request.uri);
            return GeckoResult.deny();
        }

        @Override
        public GeckoResult<GeckoSession> onNewSession(GeckoSession s, String uri) {
            openExternal(uri);                                           // 新窗口（Wiki 等）在系统浏览器里打开
            return null;
        }
    }

    private final class Content implements GeckoSession.ContentDelegate {
        @Override
        public void onFullScreen(GeckoSession s, boolean fullScreen) {
            immersive();                                                 // 一直是全屏：游戏里的「进入全屏」也一样
        }

        @Override
        public void onCrash(GeckoSession s) {
            restart();
        }

        @Override
        public void onKill(GeckoSession s) {
            restart();
        }
    }

    private void restart() {
        runOnUiThread(() -> {
            try {
                session.close();
            } catch (Exception ignored) {
            }
            openSession();                                               // 页面进程没了：重新打开（存档在浏览器存储里）
        });
    }

    private final class Prompts implements GeckoSession.PromptDelegate {
        @Override
        public GeckoResult<PromptResponse> onFilePrompt(GeckoSession s, FilePrompt prompt) {
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("*/*");
            GeckoResult<PromptResponse> result = new GeckoResult<>();
            pendingFile = result;
            pendingPrompt = prompt;
            try {
                startActivityForResult(Intent.createChooser(pick, null), REQ_FILE);
            } catch (ActivityNotFoundException e) {
                pendingFile = null;
                Toast.makeText(MainActivity.this, R.string.no_file_app, Toast.LENGTH_SHORT).show();
                return GeckoResult.fromValue(prompt.dismiss());
            }
            return result;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE || pendingFile == null) return;
        GeckoResult<GeckoSession.PromptDelegate.PromptResponse> r = pendingFile;
        pendingFile = null;
        if (resultCode == RESULT_OK && data != null && data.getData() != null) r.complete(pendingPrompt.confirm(this, data.getData()));
        else r.complete(pendingPrompt.dismiss());
    }

    /* 返回键：先发 Esc（游戏里是暂停、关面板）；1.5 秒内再按一次回到桌面 */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_UP) {
                long now = SystemClock.uptimeMillis();
                if (now - lastBack < 1500) {
                    moveTaskToBack(true);
                } else {
                    sendEscape();
                    if (!hinted) {
                        hinted = true;
                        Toast.makeText(this, "1.5 秒内再按一次返回键回到桌面", Toast.LENGTH_SHORT).show();
                    }
                }
                lastBack = now;
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private void sendEscape() {
        long t = SystemClock.uptimeMillis();
        view.requestFocus();
        view.dispatchKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ESCAPE, 0));
        view.dispatchKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ESCAPE, 0));
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (session != null) session.setActive(false);                   // 页面收到「切到后台」：游戏自己会暂停
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (session != null) session.setActive(true);
        immersive();
    }

    @Override
    protected void onDestroy() {
        if (session != null) session.close();
        if (server != null) server.stop();
        super.onDestroy();
    }

    @SuppressWarnings("deprecation")
    private void immersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }
}
